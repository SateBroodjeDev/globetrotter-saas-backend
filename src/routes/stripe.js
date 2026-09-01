const express = require('express');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder');
const { asyncHandler } = require('../middleware/errorHandler');
const { db } = require('../config/database');
const logger = require('../services/loggerService');

const router = express.Router();

// Stripe requires raw body for signature verification
router.post('/webhook', express.raw({ type: 'application/json' }), asyncHandler(async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;
  try {
    if (webhookSecret) {
      event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    } else {
      event = JSON.parse(req.body);
      logger.warn('[Stripe] Webhook secret not configured – skipping signature verification');
    }
  } catch (err) {
    logger.error('[Stripe] Webhook signature failed', { error: err.message });
    return res.status(400).json({ error: `Webhook Error: ${err.message}` });
  }

  switch (event.type) {
    case 'customer.subscription.created':
    case 'customer.subscription.updated': {
      const subscription = event.data.object;
      const workspaceId = subscription.metadata?.workspaceId;
      if (workspaceId) {
        const planMap = {
          'price_starter': 'starter',
          'price_pro': 'pro',
          'price_business': 'business'
        };
        const plan = planMap[subscription.items?.data?.[0]?.price?.id] || 'pro';
        await db.Workspace.update(
          { planTier: plan, stripeSubscriptionId: subscription.id, subscriptionStatus: subscription.status },
          { where: { id: workspaceId } }
        );
        logger.info('[Stripe] Subscription updated', { workspaceId, plan, status: subscription.status });
      }
      break;
    }
    case 'customer.subscription.deleted': {
      const subscription = event.data.object;
      const workspaceId = subscription.metadata?.workspaceId;
      if (workspaceId) {
        await db.Workspace.update(
          { planTier: 'starter', subscriptionStatus: 'canceled' },
          { where: { id: workspaceId } }
        );
        logger.info('[Stripe] Subscription canceled', { workspaceId });
      }
      break;
    }
    case 'invoice.payment_failed': {
      logger.warn('[Stripe] Payment failed', { invoiceId: event.data.object.id });
      break;
    }
    default:
      logger.info('[Stripe] Unhandled event', { type: event.type });
  }

  res.json({ received: true });
}));

module.exports = router;
