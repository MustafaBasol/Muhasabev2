import { MigrationInterface, QueryRunner, Table } from 'typeorm';

export class CreateSiteSettingsTable1762826000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'site_settings',
        columns: [
          {
            name: 'id',
            type: 'int',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          { name: 'defaultMetaTitle', type: 'varchar', length: '255', isNullable: true },
          { name: 'defaultMetaDescription', type: 'text', isNullable: true },
          { name: 'defaultOgImageUrl', type: 'varchar', length: '500', isNullable: true },
          { name: 'canonicalBaseUrl', type: 'varchar', length: '255', isNullable: true },
          { name: 'enableIndexing', type: 'boolean', isNullable: false, default: true },
          { name: 'googleAnalyticsId', type: 'varchar', length: '100', isNullable: true },
          { name: 'googleTagManagerId', type: 'varchar', length: '100', isNullable: true },
          { name: 'pinterestTagId', type: 'varchar', length: '100', isNullable: true },
          { name: 'metaPixelId', type: 'varchar', length: '100', isNullable: true },
          { name: 'linkedinInsightTagId', type: 'varchar', length: '100', isNullable: true },
          { name: 'customHeadHtml', type: 'text', isNullable: true },
          { name: 'customBodyStartHtml', type: 'text', isNullable: true },
          { name: 'customBodyEndHtml', type: 'text', isNullable: true },
          { name: 'createdAt', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
          { name: 'updatedAt', type: 'timestamp', default: 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' },
        ],
      }),
    );

    // Ensure there is a singleton row with id=1
    await queryRunner.query(
      `INSERT INTO site_settings (id, "enableIndexing", "defaultMetaTitle", "defaultMetaDescription")
       VALUES (1, true, 'Comptario - Accounting Dashboard', 'Professional accounting and invoicing solution for small businesses.')
       ON CONFLICT (id) DO NOTHING;`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('site_settings');
  }
}
