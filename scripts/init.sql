CREATE TABLE IF NOT EXISTS "Users" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  "passwordHash" VARCHAR(255) NOT NULL,
  "firstName" VARCHAR(100),
  "lastName" VARCHAR(100),
  avatar VARCHAR(500),
  "emailVerified" BOOLEAN DEFAULT false,
  "emailVerificationToken" VARCHAR(255),
  "pinCode" VARCHAR(255),
  "twoFactorEnabled" BOOLEAN DEFAULT false,
  "twoFactorSecret" VARCHAR(255),
  "lastLogin" TIMESTAMP,
  "lastLoginIp" VARCHAR(45),
  "isActive" BOOLEAN DEFAULT true,
  "isDeleted" BOOLEAN DEFAULT false,
  "deletedAt" TIMESTAMP,
  "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_email ON "Users"(email);
CREATE INDEX idx_users_is_deleted ON "Users"("isDeleted");
