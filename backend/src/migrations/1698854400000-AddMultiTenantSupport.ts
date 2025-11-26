import { MigrationInterface, QueryRunner } from 'typeorm';

type UserRow = {
  id: string;
  firstName: string | null;
  lastName: string | null;
};

type IdRow = { id: string };

const rowsToArray = <T>(rows: unknown): T[] =>
  Array.isArray(rows) ? (rows as T[]) : [];

const firstRow = <T>(rows: unknown): T | null => {
  if (Array.isArray(rows) && rows.length > 0) {
    return rows[0] as T;
  }
  return null;
};

const hasAnyRow = (rows: unknown): boolean =>
  Array.isArray(rows) && rows.length > 0;

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
    const usersRaw: unknown = await queryRunner.query(
      `SELECT id, "firstName", "lastName" FROM users`,
    );
    const users = rowsToArray<UserRow>(usersRaw);

    for (const user of users) {
      // Create organization if missing
      const orgName =
        `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() ||
        `${user.id}'s Organization`;
      const existingOrgRaw: unknown = await queryRunner.query(
        `SELECT id FROM organizations WHERE name = $1 LIMIT 1`,
        [orgName],
      );
      let orgId: string;
      const existingOrg = firstRow<IdRow>(existingOrgRaw);
      if (existingOrg?.id) {
        orgId = existingOrg.id;
      } else {
        const orgResultRaw: unknown = await queryRunner.query(
          `
          INSERT INTO organizations (name, plan) 
          VALUES ($1, 'STARTER') 
          RETURNING id
        `,
          [orgName],
        );
        const insertedOrg = firstRow<IdRow>(orgResultRaw);
        if (!insertedOrg?.id) {
          throw new Error('Failed to create organization during migration');
        }
        orgId = insertedOrg.id;
      }

      // Create organization member with OWNER role if missing
      const memberExistsRaw: unknown = await queryRunner.query(
        `SELECT 1 FROM organization_members WHERE "organizationId"=$1 AND "userId"=$2 LIMIT 1`,
        [orgId, user.id],
      );
      if (!hasAnyRow(memberExistsRaw)) {
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
