const express = require('express');
const { authenticate, requireWorkspaceAccess } = require('../middleware/auth');
const { db } = require('../config/database');
const stripeService = require('../services/stripeService');
const { formatError } = require('../middleware/errorHandler');

const router = express.Router();

// GET /api/payments/plans — public, list available Stripe prices
router.get('/plans', async (req, res) => {
  try {
    const plans = await stripeService.getAvailablePlans();
    res.json(plans);
  } catch (error) {
    res.status(500).json(formatError(error.message, 'STRIPE_ERROR'));
  }
});

// POST /api/payments/checkout — create Stripe Checkout session
router.post('/checkout', authenticate, requireWorkspaceAccess(['owner', 'admin']), async (req, res) => {
  const { priceId, workspaceId } = req.body;

  if (!priceId) {
    return res.status(400).json(formatError('priceId is required', 'VALIDATION_ERROR'));
  }

  const wsId = workspaceId || req.user.workspaceId;
  if (!wsId) {
    return res.status(400).json(formatError('workspaceId is required', 'VALIDATION_ERROR'));
  }

  try {
    const session = await stripeService.createCheckoutSession(
      wsId,
      priceId,
      `${process.env.FRONTEND_URL}/checkout-success.html`
    );
    res.json({ url: session.url });
  } catch (error) {
    res.status(400).json(formatError(error.message, 'STRIPE_ERROR'));
  }
});

// POST /api/payments/webhook — Stripe webhook (raw body required)
// NOTE: This route is also mounted directly in server.js BEFORE express.json()
// to ensure the raw body is available for signature verification. The handler
// is exported so both mounting points share the same logic.
async function webhookHandler(req, res) {
  const sig = req.headers['stripe-signature'];

  try {
    const event = stripeService.constructWebhookEvent(req.body, sig);
    await stripeService.handleWebhook(event);
    res.json({ received: true });
  } catch (error) {
    res.status(400).json({ error: 'Webhook Error', message: 'Invalid webhook payload or signature' });
  }
}

router.post('/webhook', express.raw({ type: 'application/json' }), webhookHandler);

// GET /api/payments/subscription — get current workspace subscription
router.get('/subscription', authenticate, async (req, res) => {
  const workspaceId = req.query.workspaceId || req.user.workspaceId;

  if (!workspaceId) {
    return res.status(400).json(formatError('workspaceId is required', 'VALIDATION_ERROR'));
  }

  try {
    const subscription = await db.Subscription.findOne({
      where: { workspaceId },
      order: [['createdAt', 'DESC']]
    });
    res.json(subscription || { plan: 'starter', status: 'active' });
  } catch (error) {
    res.status(500).json(formatError(error.message, 'DB_ERROR'));
  }
});

// POST /api/payments/upgrade — redirect to Stripe Checkout for a new price
router.post('/upgrade', authenticate, requireWorkspaceAccess(['owner', 'admin']), async (req, res) => {
  const { newPriceId, workspaceId } = req.body;

  if (!newPriceId) {
    return res.status(400).json(formatError('newPriceId is required', 'VALIDATION_ERROR'));
  }

  const wsId = workspaceId || req.user.workspaceId;
  if (!wsId) {
    return res.status(400).json(formatError('workspaceId is required', 'VALIDATION_ERROR'));
  }

  try {
    const session = await stripeService.createCheckoutSession(
      wsId,
      newPriceId,
      `${process.env.FRONTEND_URL}/checkout-success.html`
    );
    res.json({ url: session.url });
  } catch (error) {
    res.status(400).json(formatError(error.message, 'STRIPE_ERROR'));
  }
});

// POST /api/payments/downgrade — schedule cancellation at period end
router.post('/downgrade', authenticate, requireWorkspaceAccess(['owner']), async (req, res) => {
  const wsId = req.body.workspaceId || req.user.workspaceId;

  if (!wsId) {
    return res.status(400).json(formatError('workspaceId is required', 'VALIDATION_ERROR'));
  }

  try {
    const subscription = await db.Subscription.findOne({ where: { workspaceId: wsId } });
    if (!subscription) {
      return res.status(404).json(formatError('No active subscription found', 'NOT_FOUND'));
    }

    await stripeService.stripe.subscriptions.update(subscription.stripeSubscriptionId, {
      cancel_at_period_end: true
    });

    res.json({ message: 'Plan downgrade scheduled at end of billing period' });
  } catch (error) {
    res.status(400).json(formatError(error.message, 'STRIPE_ERROR'));
  }
});

// POST /api/payments/customer-portal — create Stripe billing portal session
router.post('/customer-portal', authenticate, requireWorkspaceAccess(['owner', 'admin']), async (req, res) => {
  const wsId = req.body.workspaceId || req.user.workspaceId;

  if (!wsId) {
    return res.status(400).json(formatError('workspaceId is required', 'VALIDATION_ERROR'));
  }

  try {
    const workspace = await db.Workspace.findByPk(wsId);
    if (!workspace || !workspace.stripeCustomerId) {
      return res.status(400).json(formatError('No billing account found for this workspace', 'NO_CUSTOMER'));
    }

    const session = await stripeService.createCustomerPortalSession(
      workspace.stripeCustomerId,
      `${process.env.FRONTEND_URL}/workspace/settings`
    );
    res.json({ url: session.url });
  } catch (error) {
    res.status(400).json(formatError(error.message, 'STRIPE_ERROR'));
  }
});

// GET /api/payments/invoices — list billing history
router.get('/invoices', authenticate, async (req, res) => {
  const wsId = req.query.workspaceId || req.user.workspaceId;

  if (!wsId) {
    return res.status(400).json(formatError('workspaceId is required', 'VALIDATION_ERROR'));
  }

  try {
    const invoices = await db.Invoice.findAll({
      where: { workspaceId: wsId },
      order: [['createdAt', 'DESC']]
    });
    res.json(invoices);
  } catch (error) {
    res.status(500).json(formatError(error.message, 'DB_ERROR'));
  }
});

// GET /api/payments/invoices/:invoiceId/pdf — redirect to invoice PDF
router.get('/invoices/:invoiceId/pdf', authenticate, async (req, res) => {
  const wsId = req.query.workspaceId || req.user.workspaceId;

  try {
    const invoice = await db.Invoice.findByPk(req.params.invoiceId);
    if (!invoice) {
      return res.status(404).json(formatError('Invoice not found', 'NOT_FOUND'));
    }

    if (wsId && invoice.workspaceId !== wsId) {
      return res.status(403).json(formatError('Forbidden', 'FORBIDDEN'));
    }

    if (!invoice.pdfUrl) {
      return res.status(404).json(formatError('PDF not available', 'PDF_NOT_FOUND'));
    }

    res.redirect(invoice.pdfUrl);
  } catch (error) {
    res.status(500).json(formatError(error.message, 'DB_ERROR'));
  }
});

module.exports = router;
module.exports.webhookHandler = webhookHandler;
