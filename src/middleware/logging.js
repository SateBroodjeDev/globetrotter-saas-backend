const { v4: uuidv4 } = require('uuid');

const requestLogger = (req, res, next) => {
  req.id = uuidv4();
  const startTime = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - startTime;
    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      requestId: req.id,
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip
    }));
  });

  next();
};

module.exports = { requestLogger };
