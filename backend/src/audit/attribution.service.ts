import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Quote } from '../quotes/entities/quote.entity';
import { Sale } from '../sales/entities/sale.entity';
import { Invoice } from '../invoices/entities/invoice.entity';
import { Expense } from '../expenses/entities/expense.entity';
import { Product } from '../products/entities/product.entity';
import { Customer } from '../customers/entities/customer.entity';
import { Supplier } from '../suppliers/entities/supplier.entity';

type KnownEntity = 'Quote' | 'Sale' | 'Invoice' | 'Expense' | 'Product' | 'Customer' | 'Supplier';

@Injectable()
export class AttributionService {
  constructor(
    @InjectRepository(Quote) private quotes: Repository<Quote>,
    @InjectRepository(Sale) private sales: Repository<Sale>,
    @InjectRepository(Invoice) private invoices: Repository<Invoice>,
    @InjectRepository(Expense) private expenses: Repository<Expense>,
    @InjectRepository(Product) private products: Repository<Product>,
    @InjectRepository(Customer) private customers: Repository<Customer>,
    @InjectRepository(Supplier) private suppliers: Repository<Supplier>,
  ) {}

  async setAttribution(
    entity: KnownEntity,
    entityId: string | undefined,
    action: 'CREATE' | 'UPDATE' | 'DELETE',
    user: { id?: string; name?: string } | undefined,
  ): Promise<void> {
    if (!entityId || !user?.id) return;
    const id = user.id;
    const name = (user.name || '').trim() || null;

    const applyCreate = { createdById: id, createdByName: name, updatedById: id, updatedByName: name } as any;
    const applyUpdate = { updatedById: id, updatedByName: name } as any;
    const patch = action === 'CREATE' ? applyCreate : applyUpdate;

    try {
      switch (entity) {
        case 'Quote':
          await this.quotes.update({ id: entityId }, patch);
          break;
        case 'Sale':
          await this.sales.update({ id: entityId }, patch);
          break;
        case 'Invoice':
          await this.invoices.update({ id: entityId }, patch);
          break;
        case 'Expense':
          await this.expenses.update({ id: entityId }, patch);
          break;
        case 'Product':
          await this.products.update({ id: entityId }, patch);
          break;
        case 'Customer':
          await this.customers.update({ id: entityId }, patch);
          break;
        case 'Supplier':
          await this.suppliers.update({ id: entityId }, patch);
          break;
        default:
          return;
      }
    } catch (e) {
      // Sessizce yut: attribution hatası ana akışı bozmasın
      // eslint-disable-next-line no-console
      console.warn('Attribution update failed', { entity, entityId, error: (e as any)?.message });
    }
  }
}
