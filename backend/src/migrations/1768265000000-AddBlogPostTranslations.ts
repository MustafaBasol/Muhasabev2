import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddBlogPostTranslations1768265000000 implements MigrationInterface {
  name = 'AddBlogPostTranslations1768265000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'blog_posts',
      new TableColumn({
        name: 'translations',
        type: 'text',
        isNullable: true,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('blog_posts', 'translations');
  }
}
