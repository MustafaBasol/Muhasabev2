import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMultiTenantSupport1698854400000 implements MigrationInterface {
  name = 'AddMultiTenantSupport1698854400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create role and plan enums
    await queryRunner.query(`
      CREATE TYPE "role_enum" AS ENUM('OWNER', 'ADMIN', 'MEMBER');
      CREATE TYPE "plan_enum" AS ENUM('STARTER', 'PRO', 'BUSINESS');
    `);

    // Create organizations table
    await queryRunner.query(`
      CREATE TABLE "organizations" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "name" varchar NOT NULL,
        "plan" "plan_enum" NOT NULL DEFAULT 'STARTER',
        "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create organization_members table
    await queryRunner.query(`
      CREATE TABLE "organization_members" (
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
      CREATE TABLE "invites" (
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
      CREATE INDEX "IDX_organization_members_userId" ON "organization_members" ("userId");
      CREATE INDEX "IDX_organization_members_organizationId" ON "organization_members" ("organizationId");  
      CREATE INDEX "IDX_invites_token" ON "invites" ("token");
    `);

    // Add currentOrgId column to users table
    await queryRunner.query(`
      ALTER TABLE "users" ADD COLUMN "currentOrgId" uuid NULL;
    `);

    // Create default organizations for existing users and set currentOrgId
    const users = await queryRunner.query(`SELECT id, "firstName", "lastName" FROM users`);
    
    for (const user of users) {
      // Create organization
      const orgName = `${user.firstName} ${user.lastName}'s Organization`;
      const orgResult = await queryRunner.query(`
        INSERT INTO organizations (name, plan) 
        VALUES ($1, 'STARTER') 
        RETURNING id
      `, [orgName]);
      
      const orgId = orgResult[0].id;

      // Create organization member with OWNER role
      await queryRunner.query(`
        INSERT INTO organization_members ("organizationId", "userId", role)
        VALUES ($1, $2, 'OWNER')
      `, [orgId, user.id]);

      // Set currentOrgId for the user
      await queryRunner.query(`
        UPDATE users SET "currentOrgId" = $1 WHERE id = $2
      `, [orgId, user.id]);
    }

    console.log(`Migrated ${users.length} existing users to their own organizations`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove currentOrgId column from users
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "currentOrgId"`);

    // Drop tables in reverse order
    await queryRunner.query(`DROP TABLE "invites"`);
    await queryRunner.query(`DROP TABLE "organization_members"`);
    await queryRunner.query(`DROP TABLE "organizations"`);

    // Drop enums
    await queryRunner.query(`DROP TYPE "role_enum"`);
    await queryRunner.query(`DROP TYPE "plan_enum"`);
  }
}