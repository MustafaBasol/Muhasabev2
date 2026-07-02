import { MigrationInterface, QueryRunner, Table } from 'typeorm';

export class CreateAdminConfigTable1762827000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'admin_config',
        columns: [
          {
            name: 'id',
            type: 'int',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          {
            name: 'username',
            type: 'varchar',
            length: '100',
            isNullable: false,
          },
          {
            name: 'passwordHash',
            type: 'varchar',
            length: '255',
            isNullable: false,
          },
          { name: 'twoFactorEnabled', type: 'boolean', default: false },
          {
            name: 'twoFactorSecret',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          { name: 'recoveryCodes', type: 'jsonb', isNullable: true },
          {
            name: 'updatedAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
            onUpdate: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
    );

    // Seed default admin ONLY when an explicit password hash is provided.
    // Fail-closed: no default 'admin123' hash. If ADMIN_PASSWORD_HASH is unset,
    // the row is not seeded here and the app initializes it from
    // ADMIN_PASSWORD_HASH / ADMIN_PASSWORD at runtime (see AdminSecurityService).
    const username = process.env.ADMIN_USERNAME || 'admin';
    const adminPasswordHash = process.env.ADMIN_PASSWORD_HASH;
    if (adminPasswordHash) {
      await queryRunner.query(
        `INSERT INTO admin_config ("id", "username", "passwordHash", "twoFactorEnabled") VALUES (1, $1, $2, false) ON CONFLICT ("id") DO NOTHING`,
        [username, adminPasswordHash],
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('admin_config');
  }
}
