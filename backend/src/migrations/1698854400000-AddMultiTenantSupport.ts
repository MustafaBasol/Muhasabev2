import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMultiTenantSupport1698854400000 implements MigrationInterface {
  name = 'AddMultiTenantSupport1698854400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create role and plan enums (idempotent)
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'role_enum') THEN
          CREATE TYPE "role_enum" AS ENUM('OWNER', 'ADMIN', 'MEMBER');
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'plan_enum') THEN
          CREATE TYPE "plan_enum" AS ENUM('STARTER', 'PRO', 'BUSINESS');
        END IF;
      END$$;
    `);

    // Create organizations table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "organizations" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "name" varchar NOT NULL,
        "plan" "plan_enum" NOT NULL DEFAULT 'STARTER',
        "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create organization_members table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "organization_members" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "organizationId" uuid NOT NULL,
        "userId" uuid NOT NULL,
        "role" "role_enum" NOT NULL DEFAULT 'MEMBER',
        "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "FK_organization_members_organizationId" 
          FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_organization_members_userId" 
          FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "UQ_organization_members_org_user" UNIQUE("organizationId", "userId")
      );
    `);

    // Create invites table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "invites" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "organizationId" uuid NOT NULL,
        "email" varchar NOT NULL,
        "role" "role_enum" NOT NULL DEFAULT 'MEMBER',
        "token" varchar UNIQUE NOT NULL,
        "expiresAt" TIMESTAMP NOT NULL,
        "acceptedAt" TIMESTAMP NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "FK_invites_organizationId" 
          FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE
      );
    `);

    // Add indexes
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'IDX_organization_members_userId') THEN
          CREATE INDEX "IDX_organization_members_userId" ON "organization_members" ("userId");
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'IDX_organization_members_organizationId') THEN
          CREATE INDEX "IDX_organization_members_organizationId" ON "organization_members" ("organizationId");  
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'IDX_invites_token') THEN
          CREATE INDEX "IDX_invites_token" ON "invites" ("token");
        END IF;
      END$$;
    `);

    // Add currentOrgId column to users table
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'users' AND column_name = 'currentOrgId'
        ) THEN
          ALTER TABLE "users" ADD COLUMN "currentOrgId" uuid NULL;
        END IF;
      END$$;
    `);

    // Create default organizations for existing users and set currentOrgId
    const users = await queryRunner.query(
      `SELECT id, "firstName", "lastName" FROM users`,
    );

    for (const user of users) {
      // Create organization if missing
      const orgName = `${user.firstName} ${user.lastName}'s Organization`;
      const existingOrg = await queryRunner.query(
        `SELECT id FROM organizations WHERE name = $1 LIMIT 1`,
        [orgName],
      );
      let orgId: string;
      if (existingOrg && existingOrg.length > 0) {
        orgId = existingOrg[0].id;
      } else {
        const orgResult = await queryRunner.query(
          `
          INSERT INTO organizations (name, plan) 
          VALUES ($1, 'STARTER') 
          RETURNING id
        `,
          [orgName],
        );
        orgId = orgResult[0].id;
      }

      // Create organization member with OWNER role if missing
      const memberExists = await queryRunner.query(
        `SELECT 1 FROM organization_members WHERE "organizationId"=$1 AND "userId"=$2 LIMIT 1`,
        [orgId, user.id],
      );
      if (!memberExists || memberExists.length === 0) {
        await queryRunner.query(
          `
          INSERT INTO organization_members ("organizationId", "userId", role)
          VALUES ($1, $2, 'OWNER')
        `,
          [orgId, user.id],
        );
      }

      // Set currentOrgId for the user
      await queryRunner.query(
        `
        UPDATE users SET "currentOrgId" = $1 WHERE id = $2
      `,
        [orgId, user.id],
      );
    }

    console.log(
      `Migrated ${users.length} existing users to their own organizations`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove currentOrgId column from users
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'users' AND column_name = 'currentOrgId'
        ) THEN
          ALTER TABLE "users" DROP COLUMN "currentOrgId";
        END IF;
      END$$;
    `);

    // Drop tables in reverse order
    await queryRunner.query(`DROP TABLE IF EXISTS "invites"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "organization_members"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "organizations"`);

    // Drop enums
    await queryRunner.query(
      `DO $$ BEGIN IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'role_enum') THEN DROP TYPE "role_enum"; END IF; END$$;`,
    );
    await queryRunner.query(
      `DO $$ BEGIN IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'plan_enum') THEN DROP TYPE "plan_enum"; END IF; END$$;`,
    );
  }
}
