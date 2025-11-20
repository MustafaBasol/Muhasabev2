import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddAnnouncementsMaintenanceToSiteSettings1762920000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Non-destructive: only add columns if not exists
    const table = 'site_settings';

    // announcementEnabled
    await queryRunner.addColumn(
      table,
      new TableColumn({
        name: 'announcementEnabled',
        type: 'boolean',
        isNullable: false,
        default: false,
      }),
    ).catch(() => {});

    // announcementMessage
    await queryRunner.addColumn(
      table,
      new TableColumn({
        name: 'announcementMessage',
        type: 'text',
        isNullable: true,
      }),
    ).catch(() => {});

    // announcementType
    await queryRunner.addColumn(
      table,
      new TableColumn({
        name: 'announcementType',
        type: 'varchar',
        length: '20',
        isNullable: false,
        default: `'info'`,
      }),
    ).catch(() => {});

    // maintenanceModeEnabled
    await queryRunner.addColumn(
      table,
      new TableColumn({
        name: 'maintenanceModeEnabled',
        type: 'boolean',
        isNullable: false,
        default: false,
      }),
    ).catch(() => {});

    // maintenanceMessage
    await queryRunner.addColumn(
      table,
      new TableColumn({
        name: 'maintenanceMessage',
        type: 'text',
        isNullable: true,
      }),
    ).catch(() => {});
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Keep data safe: do not drop columns in down migration in production
    await queryRunner.query('-- Non-destructive down: no column drops to avoid data loss');
  }
}
