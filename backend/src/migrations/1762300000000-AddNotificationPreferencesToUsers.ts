import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddNotificationPreferencesToUsers1762300000000 implements MigrationInterface {
  name = 'AddNotificationPreferencesToUsers1762300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // PostgreSQL için jsonb tercih ediyoruz; yoksa json fallback
    // IF NOT EXISTS guard: bazı ortamlarda kolon eklenmiş olabilir (dev sync vs.)
    const driver = queryRunner.connection.driver.options.type;
    const jsonType = driver === 'postgres' ? 'jsonb' : 'json';

    // Kolon zaten varsa ekleme
    const table = await queryRunner.getTable('users');
    const exists = table?.columns.find(c => c.name === 'notificationPreferences');
    if (!exists) {
      await queryRunner.addColumn(
        'users',
        new TableColumn({
          name: 'notificationPreferences',
            type: jsonType,
            isNullable: true,
        })
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('users');
    const exists = table?.columns.find(c => c.name === 'notificationPreferences');
    if (exists) {
      await queryRunner.dropColumn('users', 'notificationPreferences');
    }
  }
}
