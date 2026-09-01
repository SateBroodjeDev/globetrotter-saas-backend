const { db } = require('../config/database');
const emailService = require('./emailService');
const featureService = require('./featureService');

class StripeService {
  constructor() {
    this._stripe = null;
  }

  get stripe() {
    if (!this._stripe) {
      if (!process.env.STRIPE_SECRET_KEY) {
        throw new Error('STRIPE_SECRET_KEY is not configured');
      }
      this._stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
    }
    return this._stripe;
  }

  // Determine plan name from Stripe subscription metadata or product nickname
  async _getPlanFromStripeSubscriptionId(stripeSubscriptionId) {
    try {
      const sub = await this.stripe.subscriptions.retrieve(stripeSubscriptionId, {
        expand: ['items.data.price.product']
      });
      const productName = sub.items.data[0]?.price?.product?.name?.toLowerCase() || '';
      if (productName.includes('business')) return 'business';
      if (productName.includes('pro')) return 'pro';
      return 'starter';
    } catch {
      return 'starter';
    }
  }

  async createCheckoutSession(workspaceId, priceId, returnUrl) {
    const workspace = await db.Workspace.findByPk(workspaceId, {
      include: [{ model: db.User, as: 'owner' }]
    });

    if (!workspace) throw new Error('Workspace not found');

    const sessionParams = {
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${returnUrl}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: returnUrl,
      subscription_data: {
        metadata: { workspaceId: workspaceId },
        trial_period_days: 14
      },
      metadata: { workspaceId: workspaceId }
    };

    if (workspace.stripeCustomerId) {
      sessionParams.customer = workspace.stripeCustomerId;
    } else if (workspace.owner && workspace.owner.email) {
      sessionParams.customer_email = workspace.owner.email;
    }

    const session = await this.stripe.checkout.sessions.create(sessionParams);
    return session;
  }

  constructWebhookEvent(rawBody, signature) {
    return this.stripe.webhooks.constructEvent(
      rawBody,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  }

  async handleWebhook(event) {
    switch (event.type) {
      case 'checkout.session.completed':
        return await this.handleCheckoutComplete(event.data.object);
      case 'invoice.payment_succeeded':
        return await this.handlePaymentSucceeded(event.data.object);
      case 'invoice.payment_failed':
        return await this.handlePaymentFailed(event.data.object);
      case 'customer.subscription.deleted':
        return await this.handleSubscriptionCanceled(event.data.object);
      case 'customer.subscription.updated':
        return await this.handleSubscriptionUpdated(event.data.object);
      default:
        break;
    }
  }

  async handleCheckoutComplete(session) {
    const workspaceId = session.metadata && session.metadata.workspaceId;
    if (!workspaceId) return;

    const workspace = await db.Workspace.findByPk(workspaceId, {
      include: [{ model: db.User, as: 'owner' }]
    });
    if (!workspace) return;

    const plan = await this._getPlanFromStripeSubscriptionId(session.subscription);

    const [subscription] = await db.Subscription.findOrCreate({
      where: { stripeSubscriptionId: session.subscription },
      defaults: {
        workspaceId: workspace.id,
        stripeSubscriptionId: session.subscription,
        stripeCustomerId: session.customer,
        plan,
        status: 'trialing',
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
      }
    });

    await workspace.update({
      subscriptionPlan: plan,
      stripeCustomerId: session.customer,
      subscriptionStatus: 'trialing'
    });

    await featureService.updateWorkspaceFeatures(workspace.id, plan);

    if (workspace.owner) {
      await emailService.sendUpgradeSuccessEmail(workspace.owner.email, plan);
    }

    return subscription;
  }

  async handlePaymentSucceeded(invoice) {
    if (!invoice.subscription) return;

    const subscription = await db.Subscription.findOne({
      where: { stripeSubscriptionId: invoice.subscription }
    });

    if (subscription) {
      const periodEnd = invoice.lines && invoice.lines.data[0]
        ? new Date(invoice.lines.data[0].period.end * 1000)
        : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

      await subscription.update({
        status: 'active',
        currentPeriodEnd: periodEnd
      });

      // Upsert invoice record
      await db.Invoice.findOrCreate({
        where: { stripeInvoiceId: invoice.id },
        defaults: {
          workspaceId: subscription.workspaceId,
          stripeInvoiceId: invoice.id,
          amount: invoice.amount_paid / 100,
          currency: (invoice.currency || 'eur').toUpperCase(),
          status: 'paid',
          pdfUrl: invoice.invoice_pdf || null,
          periodStart: invoice.lines && invoice.lines.data[0]
            ? new Date(invoice.lines.data[0].period.start * 1000) : null,
          periodEnd: periodEnd,
          dueDate: invoice.due_date ? new Date(invoice.due_date * 1000) : null
        }
      });

      const workspace = await db.Workspace.findByPk(subscription.workspaceId, {
        include: [{ model: db.User, as: 'owner' }]
      });
      if (workspace && workspace.owner) {
        await emailService.sendPaymentReceiptEmail(
          workspace.owner.email,
          invoice.amount_paid / 100,
          invoice.hosted_invoice_url
        );
      }

      await workspace.update({ subscriptionStatus: 'active' });
      await featureService.updateWorkspaceFeatures(workspace.id, subscription.plan);
    }
  }

  async handlePaymentFailed(invoice) {
    if (!invoice.subscription) return;

    const subscription = await db.Subscription.findOne({
      where: { stripeSubscriptionId: invoice.subscription }
    });

    if (subscription) {
      await subscription.update({ status: 'past_due' });

      const workspace = await db.Workspace.findByPk(subscription.workspaceId, {
        include: [{ model: db.User, as: 'owner' }]
      });

      if (workspace) {
        await workspace.update({ subscriptionStatus: 'past_due' });
        if (workspace.owner) {
          const portalUrl = `${process.env.FRONTEND_URL}/workspace/settings`;
          await emailService.sendPaymentFailureEmail(workspace.owner.email, portalUrl);
        }
      }
    }
  }

  async handleSubscriptionCanceled(stripeSub) {
    const subscription = await db.Subscription.findOne({
      where: { stripeSubscriptionId: stripeSub.id }
    });

    if (subscription) {
      await subscription.update({ status: 'canceled', canceledAt: new Date() });

      await db.Workspace.update(
        { subscriptionPlan: 'starter', subscriptionStatus: 'canceled' },
        { where: { id: subscription.workspaceId } }
      );

      await featureService.updateWorkspaceFeatures(subscription.workspaceId, 'starter');
    }
  }

  async handleSubscriptionUpdated(stripeSub) {
    const subscription = await db.Subscription.findOne({
      where: { stripeSubscriptionId: stripeSub.id }
    });

    if (subscription) {
      const statusMap = {
        active: 'active',
        trialing: 'trialing',
        past_due: 'past_due',
        canceled: 'canceled',
        unpaid: 'unpaid'
      };
      const status = statusMap[stripeSub.status] || 'active';
      await subscription.update({ status });
      await db.Workspace.update(
        { subscriptionStatus: status },
        { where: { id: subscription.workspaceId } }
      );
    }
  }

  async getAvailablePlans() {
    const prices = await this.stripe.prices.list({
      limit: 10,
      active: true,
      expand: ['data.product']
    });
    return prices.data;
  }

  async createCustomerPortalSession(customerId, returnUrl) {
    const session = await this.stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl
    });
    return session;
  }
}

module.exports = new StripeService();
