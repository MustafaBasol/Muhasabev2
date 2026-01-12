import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class CreateBlogPostsTable1768200000000 implements MigrationInterface {
  name = 'CreateBlogPostsTable1768200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'blog_posts',
        columns: [
          {
            name: 'id',
            type: queryRunner.connection.options.type === 'sqlite' ? 'varchar' : 'uuid',
            isPrimary: true,
            isNullable: false,
            default:
              queryRunner.connection.options.type === 'sqlite'
                ? undefined
                : 'gen_random_uuid()',
          },
          { name: 'slug', type: 'varchar', length: '200', isNullable: false },
          { name: 'title', type: 'varchar', length: '255', isNullable: false },
          { name: 'excerpt', type: 'text', isNullable: true },
          { name: 'contentHtml', type: 'text', isNullable: false },
          { name: 'contentMarkdown', type: 'text', isNullable: true },
          { name: 'metaTitle', type: 'varchar', length: '255', isNullable: true },
          { name: 'metaDescription', type: 'text', isNullable: true },
          { name: 'canonicalUrl', type: 'varchar', length: '500', isNullable: true },
          { name: 'ogImageUrl', type: 'varchar', length: '500', isNullable: true },
          { name: 'keywords', type: 'varchar', length: '1000', isNullable: true },
          { name: 'noIndex', type: 'boolean', isNullable: false, default: false },
          { name: 'jsonLd', type: 'text', isNullable: true },
          { name: 'status', type: 'varchar', length: '20', isNullable: false, default: "'draft'" },
          {
            name: 'publishedAt',
            type:
              queryRunner.connection.options.type === 'sqlite'
                ? 'datetime'
                : 'timestamptz',
            isNullable: true,
          },
          {
            name: 'createdAt',
            type:
              queryRunner.connection.options.type === 'sqlite'
                ? 'datetime'
                : 'timestamptz',
            isNullable: false,
            default:
              queryRunner.connection.options.type === 'sqlite'
                ? '(datetime(\'now\'))'
                : 'now()',
          },
          {
            name: 'updatedAt',
            type:
              queryRunner.connection.options.type === 'sqlite'
                ? 'datetime'
                : 'timestamptz',
            isNullable: false,
            default:
              queryRunner.connection.options.type === 'sqlite'
                ? '(datetime(\'now\'))'
                : 'now()',
          },
        ],
      }),
      true,
    );

    await queryRunner.createIndex(
      'blog_posts',
      new TableIndex({
        name: 'IDX_blog_posts_slug_unique',
        columnNames: ['slug'],
        isUnique: true,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropIndex('blog_posts', 'IDX_blog_posts_slug_unique');
    await queryRunner.dropTable('blog_posts');
  }
}
