const { body, param, query, validationResult } = require('express-validator');
const Joi = require('joi');

const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ 
      error: 'Validation failed',
      details: errors.array() 
    });
  }
  next();
};

const validateAuth = {
  register: [
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
    body('firstName').trim().optional(),
    body('lastName').trim().optional(),
    handleValidationErrors
  ],
  login: [
    body('email').isEmail().normalizeEmail(),
    body('password').notEmpty(),
    handleValidationErrors
  ]
};

const validateWorkspace = {
  create: [
    body('name').trim().notEmpty().withMessage('Workspace name is required'),
    body('slug').trim().isSlug().withMessage('Slug must be URL-safe'),
    body('subdomain').trim().optional().isSlug(),
    handleValidationErrors
  ],
  update: [
    body('name').trim().optional().notEmpty(),
    body('description').trim().optional(),
    handleValidationErrors
  ]
};

const validateTrip = {
  create: [
    body('title').trim().notEmpty().withMessage('Trip title is required'),
    body('startDate').isISO8601().withMessage('Valid start date required'),
    body('endDate').isISO8601().withMessage('Valid end date required'),
    body('type').isIn(['roadtrip', 'backpacking', 'city_break', 'safari', 'cruise', 'other']),
    handleValidationErrors
  ]
};

const validateExpense = {
  create: [
    body('description').trim().notEmpty(),
    body('amount').isDecimal({ min: 0 }).withMessage('Amount must be positive'),
    body('currency').isLength({ min: 3, max: 3 }).toUpperCase(),
    body('date').isISO8601(),
    body('category').isIn(['flights', 'accommodation', 'meals', 'transport', 'activities', 'shopping', 'other']),
    handleValidationErrors
  ]
};

const expenseCategories = ['food', 'transport', 'hotel', 'activities', 'shopping', 'drinks', 'services', 'other'];
const splitTypes = ['equal', 'percentage', 'custom'];

const createExpenseSchema = Joi.object({
  tripId: Joi.string().uuid().required(),
  description: Joi.string().trim().min(1).required(),
  amount: Joi.number().positive().required(),
  category: Joi.string().valid(...expenseCategories).required(),
  date: Joi.date().iso().required(),
  currency: Joi.string().length(3).uppercase(),
  originalCurrency: Joi.string().length(3).uppercase(),
  receipt: Joi.string().uri().allow(null, ''),
  splitType: Joi.string().valid(...splitTypes).default('equal'),
  participants: Joi.array().items(
    Joi.alternatives().try(
      Joi.string().uuid(),
      Joi.object({
        userId: Joi.string().uuid().required(),
        share: Joi.number().positive().optional()
      })
    )
  ).default([])
}).custom((value, helper) => {
  if (!value.currency && !value.originalCurrency) {
    value.originalCurrency = 'EUR';
    value.currency = 'EUR';
  }

  const normalizedParticipants = (value.participants || []).map((participant) => (
    typeof participant === 'string' ? { userId: participant } : participant
  ));

  if (value.splitType === 'percentage') {
    const totalPercentage = normalizedParticipants.reduce((sum, participant) => sum + Number(participant.share || 0), 0);
    if (Math.abs(totalPercentage - 100) > 0.01) {
      return helper.message('Percentage split must total exactly 100');
    }
  }

  if (value.splitType === 'custom') {
    const totalCustom = normalizedParticipants.reduce((sum, participant) => sum + Number(participant.share || 0), 0);
    if (Math.abs(totalCustom - Number(value.amount)) > 0.01) {
      return helper.message('Custom split total must match expense amount');
    }
  }

  return value;
}, 'Expense split validation');

const updateExpenseSchema = Joi.object({
  description: Joi.string().trim().min(1),
  amount: Joi.number().positive(),
  category: Joi.string().valid(...expenseCategories),
  date: Joi.date().iso(),
  currency: Joi.string().length(3).uppercase(),
  originalCurrency: Joi.string().length(3).uppercase(),
  receipt: Joi.string().uri().allow(null, ''),
  notes: Joi.string().allow(''),
  splitType: Joi.string().valid(...splitTypes),
  participants: Joi.array().items(
    Joi.alternatives().try(
      Joi.string().uuid(),
      Joi.object({
        userId: Joi.string().uuid().required(),
        share: Joi.number().positive().optional()
      })
    )
  )
}).min(1).custom((value, helper) => {
  const participants = (value.participants || []).map((participant) => (
    typeof participant === 'string' ? { userId: participant } : participant
  ));

  if (!participants.length) {
    return value;
  }

  if (value.splitType === 'percentage') {
    const totalPercentage = participants.reduce((sum, participant) => sum + Number(participant.share || 0), 0);
    if (Math.abs(totalPercentage - 100) > 0.01) {
      return helper.message('Percentage split must total exactly 100');
    }
  }

  if (value.splitType === 'custom' && value.amount != null) {
    const totalCustom = participants.reduce((sum, participant) => sum + Number(participant.share || 0), 0);
    if (Math.abs(totalCustom - Number(value.amount)) > 0.01) {
      return helper.message('Custom split total must match expense amount');
    }
  }

  return value;
}, 'Expense update split validation');

const expenseFiltersSchema = Joi.object({
  startDate: Joi.date().iso(),
  endDate: Joi.date().iso(),
  category: Joi.string().valid(...expenseCategories),
  participant: Joi.string().uuid()
});

const markSettlementPaidSchema = Joi.object({
  proofImage: Joi.string().uri().allow(null, '')
});

const validateJoi = (schema, source = 'body') => (req, res, next) => {
  const { value, error } = schema.validate(req[source], { abortEarly: false, stripUnknown: true });
  if (error) {
    return res.status(400).json({
      error: 'Validation failed',
      details: error.details.map((detail) => detail.message)
    });
  }

  req[source] = value;
  next();
};

module.exports = {
  validateAuth,
  validateWorkspace,
  validateTrip,
  validateExpense,
  handleValidationErrors,
  validateJoi,
  createExpenseSchema,
  updateExpenseSchema,
  expenseFiltersSchema,
  markSettlementPaidSchema,
  expenseCategories,
  splitTypes
};
