/**
 * Database migration script
 * Runs all pending migrations using Sequelize sync
 */
const dotenv = require('dotenv');
dotenv.config();

const { sequelize, initializeDatabase } = require('../src/config/database');

async function migrate() {
  console.log('[🔧] Running database migrations...');
  try {
    await initializeDatabase();
    // Sync all models - creates/alters tables as needed
    await sequelize.sync({ alter: process.env.NODE_ENV !== 'production' });
    console.log('[✅] Migrations complete');
    process.exit(0);
  } catch (error) {
    console.error('[❌] Migration failed:', error.message);
    process.exit(1);
  }
}

migrate();
