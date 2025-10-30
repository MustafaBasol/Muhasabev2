import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class CreateAuditLogTable1730282000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'audit_log',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'gen_random_uuid()',
          },
          {
            name: 'userId',
            type: 'uuid',
            isNullable: true, // Nullable for system actions
          },
          {
            name: 'tenantId',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'entity',
            type: 'varchar',
            length: '100',
            isNullable: false,
          },
          {
            name: 'entityId',
            type: 'uuid',
            isNullable: true, // Nullable for bulk actions
          },
          {
            name: 'action',
            type: 'varchar',
            length: '20',
            isNullable: false, // CREATE, UPDATE, DELETE
          },
          {
            name: 'diff',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'ip',
            type: 'varchar',
            length: '45',
            isNullable: true, // IPv4 or IPv6
          },
          {
            name: 'userAgent',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'createdAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
        foreignKeys: [
          {
            columnNames: ['userId'],
            referencedColumnNames: ['id'],
            referencedTableName: 'users',
            onDelete: 'SET NULL',
          },
          {
            columnNames: ['tenantId'],
            referencedColumnNames: ['id'],
            referencedTableName: 'tenants',
            onDelete: 'CASCADE',
          },
        ],
      }),
    );

    // Indexes for better query performance
    await queryRunner.createIndex('audit_log', new TableIndex({
      name: 'IDX_audit_log_tenant_id',
      columnNames: ['tenantId'],
    }));
    
    await queryRunner.createIndex('audit_log', new TableIndex({
      name: 'IDX_audit_log_user_id', 
      columnNames: ['userId'],
    }));
    
    await queryRunner.createIndex('audit_log', new TableIndex({
      name: 'IDX_audit_log_entity',
      columnNames: ['entity'],
    }));
    
    await queryRunner.createIndex('audit_log', new TableIndex({
      name: 'IDX_audit_log_created_at',
      columnNames: ['createdAt'],
    }));
    
    await queryRunner.createIndex('audit_log', new TableIndex({
      name: 'IDX_audit_log_entity_composite',
      columnNames: ['entity', 'entityId'],
    }));
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('audit_log');
  }
}