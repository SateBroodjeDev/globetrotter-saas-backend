const { body, param, query, validationResult } = require('express-validator');

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

module.exports = {
  validateAuth,
  validateWorkspace,
  validateTrip,
  validateExpense,
  handleValidationErrors
};
