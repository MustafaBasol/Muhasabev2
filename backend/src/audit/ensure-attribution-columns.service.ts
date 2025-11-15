import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class EnsureAttributionColumnsService
  implements OnApplicationBootstrap
{
  private readonly logger = new Logger(EnsureAttributionColumnsService.name);

  constructor(private readonly dataSource: DataSource) {}

  async onApplicationBootstrap() {
    try {
      const type = (this.dataSource.options as any)?.type;
      if (type !== 'postgres') {
        // SQLite veya diğer tiplerde bu fix'e gerek yok
        return;
      }

      await this.applyIfMissing();
    } catch (err) {
      this.logger.warn(
        `EnsureAttributionColumns skipped or failed: ${(err as Error)?.message}`,
      );
    }
  }

  private async applyIfMissing() {
    const tables = [
      'customers',
      'suppliers',
      'products',
      'invoices',
      'sales',
      'quotes',
      'expenses',
    ];

    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    try {
      await qr.startTransaction();
      for (const table of tables) {
        await qr.query(
          `ALTER TABLE "${table}" ADD COLUMN IF NOT EXISTS "createdById" uuid NULL`,
        );
        await qr.query(
          `ALTER TABLE "${table}" ADD COLUMN IF NOT EXISTS "createdByName" varchar(255) NULL`,
        );
        await qr.query(
          `ALTER TABLE "${table}" ADD COLUMN IF NOT EXISTS "updatedById" uuid NULL`,
        );
        await qr.query(
          `ALTER TABLE "${table}" ADD COLUMN IF NOT EXISTS "updatedByName" varchar(255) NULL`,
        );

        // FK'leri güvenli şekilde ekle
        await qr.query(`
          DO $$
          BEGIN
            IF NOT EXISTS (
              SELECT 1 FROM pg_constraint WHERE conname = '${table}_createdById_fkey'
            ) THEN
              ALTER TABLE "${table}" ADD CONSTRAINT "${table}_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL;
            END IF;
          END$$;
        `);
        await qr.query(`
          DO $$
          BEGIN
            IF NOT EXISTS (
              SELECT 1 FROM pg_constraint WHERE conname = '${table}_updatedById_fkey'
            ) THEN
              ALTER TABLE "${table}" ADD CONSTRAINT "${table}_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "users"("id") ON DELETE SET NULL;
            END IF;
          END$$;
        `);

        // Eski kayıtlar için isim alanlarını geriye dönük doldur
        await qr.query(`
          UPDATE "${table}" t
          SET "createdByName" = COALESCE(NULLIF(BTRIM(CONCAT(u."firstName", ' ', u."lastName")), ''), u.email)
          FROM "users" u
          WHERE t."createdById" = u.id
            AND (t."createdByName" IS NULL OR t."createdByName" = '')
        `);
        await qr.query(`
          UPDATE "${table}" t
          SET "updatedByName" = COALESCE(NULLIF(BTRIM(CONCAT(u."firstName", ' ', u."lastName")), ''), u.email)
          FROM "users" u
          WHERE t."updatedById" = u.id
            AND (t."updatedByName" IS NULL OR t."updatedByName" = '')
        `);
      }
      await qr.commitTransaction();
      this.logger.log('Attribution columns ensured on core tables.');
    } catch (e) {
      await qr.rollbackTransaction();
      this.logger.error('Failed ensuring attribution columns', e as any);
      throw e;
    } finally {
      await qr.release();
    }
  }
}
