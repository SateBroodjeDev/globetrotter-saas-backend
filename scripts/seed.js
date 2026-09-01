/**
 * Database seed script - creates initial admin user and sample data
 */
const dotenv = require('dotenv');
dotenv.config();

const { db, initializeDatabase } = require('../src/config/database');

async function seed() {
  console.log('[🌱] Seeding database...');
  try {
    await initializeDatabase();

    // Create admin user if not exists
    // passwordHash is hashed by User model's beforeCreate hook
    const [adminUser, created] = await db.User.findOrCreate({
      where: { email: 'admin@globetrotter.nl' },
      defaults: {
        email: 'admin@globetrotter.nl',
        passwordHash: process.env.ADMIN_PASSWORD || 'Admin123!',
        firstName: 'Admin',
        lastName: 'Globetrotter',
        role: 'admin',
        emailVerified: true,
        isActive: true
      }
    });

    if (created) {
      console.log('[✅] Admin user created: admin@globetrotter.nl');
    } else {
      console.log('[ℹ️] Admin user already exists');
    }

    // Create default admin workspace
    const [workspace] = await db.Workspace.findOrCreate({
      where: { slug: 'admin-workspace' },
      defaults: {
        ownerId: adminUser.id,
        name: 'Admin Workspace',
        slug: 'admin-workspace',
        subdomain: 'admin',
        planTier: 'business'
      }
    });

    await db.WorkspaceUser.findOrCreate({
      where: { userId: adminUser.id, workspaceId: workspace.id },
      defaults: {
        userId: adminUser.id,
        workspaceId: workspace.id,
        role: 'owner',
        permissions: { canCreateTrip: true, canManageMembers: true, canManageSettings: true }
      }
    });

    console.log('[✅] Seeding complete');
    process.exit(0);
  } catch (error) {
    console.error('[❌] Seeding failed:', error.message);
    process.exit(1);
  }
}

seed();
