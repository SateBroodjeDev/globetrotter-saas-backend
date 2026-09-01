const { Sequelize } = require('sequelize');
const fs = require('fs');
const path = require('path');

const sequelize = new Sequelize(process.env.DATABASE_URL, {
  dialect: 'postgres',
  logging: process.env.NODE_ENV === 'development' ? console.log : false,
  pool: {
    max: 5,
    min: 2,
    acquire: 30000,
    idle: 10000
  },
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

const db = {};

// Dynamisch load alle models
const modelsDir = path.join(__dirname, '../models');
if (fs.existsSync(modelsDir)) {
  fs.readdirSync(modelsDir).forEach(file => {
    if (file.endsWith('.js')) {
      const model = require(path.join(modelsDir, file))(sequelize);
      db[model.name] = model;
    }
  });
}

// Associate models
Object.keys(db).forEach(modelName => {
  if (db[modelName].associate) {
    db[modelName].associate(db);
  }
});

db.sequelize = sequelize;
db.Sequelize = Sequelize;

async function initializeDatabase() {
  try {
    await sequelize.authenticate();
    console.log('[✅] Database connection successful');
    
    if (process.env.NODE_ENV === 'development') {
      await sequelize.sync({ alter: true });
      console.log('[✅] Database tables synchronized');
    }
  } catch (error) {
    console.error('[❌] Database connection failed:', error);
    throw error;
  }
}

module.exports = {
  db,
  sequelize,
  initializeDatabase
};
