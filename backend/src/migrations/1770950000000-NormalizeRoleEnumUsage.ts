import { MigrationInterface, QueryRunner } from 'typeorm';

export class NormalizeRoleEnumUsage1770950000000
  implements MigrationInterface
{
  name = 'NormalizeRoleEnumUsage1770950000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      DECLARE
        org_role_udt text;
        org_role_default text;
        invite_role_udt text;
        invite_role_default text;
        role_enum_old_in_use boolean;
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_type t
          JOIN pg_namespace n ON n.oid = t.typnamespace
          WHERE n.nspname = 'public' AND t.typname = 'role_enum'
        ) THEN
          CREATE TYPE public.role_enum AS ENUM ('OWNER', 'ADMIN', 'MEMBER');
        END IF;

        SELECT c.udt_name, c.column_default
        INTO org_role_udt, org_role_default
        FROM information_schema.columns c
        WHERE c.table_schema = 'public'
          AND c.table_name = 'organization_members'
          AND c.column_name = 'role';

        IF org_role_udt IS NOT NULL THEN
          IF org_role_default IS NOT NULL THEN
            EXECUTE 'ALTER TABLE public.organization_members ALTER COLUMN role DROP DEFAULT';
          END IF;

          IF org_role_udt <> 'role_enum' THEN
            EXECUTE 'ALTER TABLE public.organization_members ALTER COLUMN role TYPE public.role_enum USING role::text::public.role_enum';
          END IF;

          IF org_role_default IS NOT NULL THEN
            EXECUTE 'ALTER TABLE public.organization_members ALTER COLUMN role SET DEFAULT ''MEMBER''::public.role_enum';
          END IF;
        END IF;

        SELECT c.udt_name, c.column_default
        INTO invite_role_udt, invite_role_default
        FROM information_schema.columns c
        WHERE c.table_schema = 'public'
          AND c.table_name = 'invites'
          AND c.column_name = 'role';

        IF invite_role_udt IS NOT NULL THEN
          IF invite_role_default IS NOT NULL THEN
            EXECUTE 'ALTER TABLE public.invites ALTER COLUMN role DROP DEFAULT';
          END IF;

          IF invite_role_udt <> 'role_enum' THEN
            EXECUTE 'ALTER TABLE public.invites ALTER COLUMN role TYPE public.role_enum USING role::text::public.role_enum';
          END IF;

          IF invite_role_default IS NOT NULL THEN
            EXECUTE 'ALTER TABLE public.invites ALTER COLUMN role SET DEFAULT ''MEMBER''::public.role_enum';
          END IF;
        END IF;

        IF EXISTS (
          SELECT 1
          FROM pg_type t
          JOIN pg_namespace n ON n.oid = t.typnamespace
          WHERE n.nspname = 'public' AND t.typname = 'role_enum_old'
        ) THEN
          SELECT EXISTS (
            SELECT 1
            FROM pg_type t
            JOIN pg_namespace n ON n.oid = t.typnamespace
            JOIN pg_attribute a ON a.atttypid = t.oid
            WHERE n.nspname = 'public'
              AND t.typname = 'role_enum_old'
              AND a.attnum > 0
              AND NOT a.attisdropped
          ) INTO role_enum_old_in_use;

          IF NOT role_enum_old_in_use THEN
            DROP TYPE public.role_enum_old;
          END IF;
        END IF;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'organization_members'
            AND column_name = 'role'
            AND udt_name = 'role_enum'
        ) THEN
          ALTER TABLE public.organization_members ALTER COLUMN role SET DEFAULT 'MEMBER'::public.role_enum;
        END IF;

        IF EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'invites'
            AND column_name = 'role'
            AND udt_name = 'role_enum'
        ) THEN
          ALTER TABLE public.invites ALTER COLUMN role SET DEFAULT 'MEMBER'::public.role_enum;
        END IF;
      END $$;
    `);
  }
}