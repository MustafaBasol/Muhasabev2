import { MigrationInterface, QueryRunner, Table } from 'typeorm';

export class CreateAdminConfigTable1762827000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'admin_config',
        columns: [
          { name: 'id', type: 'int', isPrimary: true, isGenerated: true, generationStrategy: 'increment' },
          { name: 'username', type: 'varchar', length: '100', isNullable: false },
          { name: 'passwordHash', type: 'varchar', length: '255', isNullable: false },
          { name: 'twoFactorEnabled', type: 'boolean', default: false },
          { name: 'twoFactorSecret', type: 'varchar', length: '255', isNullable: true },
          { name: 'recoveryCodes', type: 'jsonb', isNullable: true },
          { name: 'updatedAt', type: 'timestamp', default: 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' },
        ],
      })
    );

    // Seed default using environment variables if provided
    const username = process.env.ADMIN_USERNAME || 'admin';
    // In migrations we can't run bcrypt easily; defer to app init to hash if missing
    await queryRunner.query(
      `INSERT INTO admin_config ("id", "username", "passwordHash", "twoFactorEnabled") VALUES (1, $1, $2, false) ON CONFLICT ("id") DO NOTHING`,
      [
        username,
        // Precomputed bcrypt(12) hash for 'admin123' if ADMIN_PASSWORD_HASH not provided
        process.env.ADMIN_PASSWORD_HASH || '$2b$12$ZSFsVBWUKfc8pkr6W35EsuoNCM/rdFX9ojkWeHEf/g9JInCdj4/6.'
      ]
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('admin_config');
  }
}
