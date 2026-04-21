import {
  mapCustomerToCompanyPayload,
  mapCustomerToIndividualPayload,
  isCompanyCustomer,
} from '../integrations/pennylane/mappers/customer.mapper';
import { Customer, CustomerType } from '../customers/entities/customer.entity';

// ─── Factory ─────────────────────────────────────────────────────────────────

function makeCustomer(overrides: Partial<Customer> = {}): Customer {
  return {
    id: 'cust-uuid-1',
    name: 'Acme Corp',
    email: 'contact@acme.fr',
    phone: '+33 1 23 45 67 89',
    address: '10 Rue de la Paix',
    taxNumber: null,
    siretNumber: '12345678901234',
    sirenNumber: '123456789',
    tvaNumber: 'FR12345678901',
    company: null,
    balance: 0,
    customerType: CustomerType.B2B,
    billingAddress: {
      street: '10 Rue de la Paix',
      city: 'Paris',
      postalCode: '75001',
      country: 'FR',
    },
    deliveryAddress: null,
    defaultPaymentTerms: '30',
    ...overrides,
  } as Customer;
}

// ─── isCompanyCustomer ────────────────────────────────────────────────────────

describe('isCompanyCustomer', () => {
  it('B2B müşteri → true döner', () => {
    expect(isCompanyCustomer(makeCustomer({ customerType: CustomerType.B2B }))).toBe(true);
  });

  it('customerType null ise → true döner (varsayılan B2B)', () => {
    expect(isCompanyCustomer(makeCustomer({ customerType: null }))).toBe(true);
  });

  it('B2C → false döner', () => {
    expect(isCompanyCustomer(makeCustomer({ customerType: CustomerType.B2C }))).toBe(false);
  });

  it('INDIVIDUAL → false döner', () => {
    expect(isCompanyCustomer(makeCustomer({ customerType: CustomerType.INDIVIDUAL }))).toBe(false);
  });
});

// ─── mapCustomerToCompanyPayload ──────────────────────────────────────────────

describe('mapCustomerToCompanyPayload', () => {
  it('zorunlu alanları doğru maplar', () => {
    const customer = makeCustomer();
    const payload = mapCustomerToCompanyPayload(customer);

    expect(payload.name).toBe('Acme Corp');
    expect(payload.vat_number).toBe('FR12345678901');
    expect(payload.reg_no).toBe('123456789');
    expect(payload.external_reference).toBe('cust-uuid-1');
    expect(payload.billing_language).toBe('fr_FR');
  });

  it('fatura adresini doğru maplar', () => {
    const payload = mapCustomerToCompanyPayload(makeCustomer());

    expect(payload.billing_address).toMatchObject({
      city: 'Paris',
      postal_code: '75001',
      country_alpha2: 'FR',
    });
  });

  it('email listesi dolu olmalı', () => {
    const payload = mapCustomerToCompanyPayload(makeCustomer());
    expect(payload.emails).toEqual(['contact@acme.fr']);
  });

  it('email null ise boş dizi döner', () => {
    const payload = mapCustomerToCompanyPayload(makeCustomer({ email: null }));
    expect(payload.emails).toEqual([]);
  });

  it('billingAddress yoksa address alanını kullanır', () => {
    const customer = makeCustomer({ billingAddress: null, address: '5 Avenue Montaigne, Paris' });
    const payload = mapCustomerToCompanyPayload(customer);

    // String address → address alanı set edilmeli
    expect(payload.billing_address?.address).toBe('5 Avenue Montaigne, Paris');
  });

  it('tüm alanlar null ise payload hala geçerlidir', () => {
    const customer = makeCustomer({
      email: null,
      phone: null,
      tvaNumber: null,
      sirenNumber: null,
      billingAddress: null,
      address: null,
      deliveryAddress: null,
    });
    const payload = mapCustomerToCompanyPayload(customer);

    expect(payload.name).toBe('Acme Corp');
    expect(payload.vat_number).toBeUndefined();
    expect(payload.reg_no).toBeUndefined();
    expect(payload.emails).toEqual([]);
  });
});

// ─── mapCustomerToIndividualPayload ───────────────────────────────────────────

describe('mapCustomerToIndividualPayload', () => {
  it('isim alanını ayırır', () => {
    const customer = makeCustomer({ name: 'Jean-Pierre Dupont' });
    const payload = mapCustomerToIndividualPayload(customer);

    expect(payload.first_name).toBe('Jean-Pierre');
    expect(payload.last_name).toBe('Dupont');
  });

  it('tek kelimelik isim için first_name == last_name', () => {
    const customer = makeCustomer({ name: 'Marie' });
    const payload = mapCustomerToIndividualPayload(customer);

    expect(payload.first_name).toBe('Marie');
    expect(payload.last_name).toBe('Marie');
  });

  it('billing_address zorunlu; null gelince fallback uygulanır', () => {
    const customer = makeCustomer({ billingAddress: null, address: null });
    const payload = mapCustomerToIndividualPayload(customer);

    expect(payload.billing_address).toMatchObject({
      address: '-',
      postal_code: '00000',
      city: '-',
      country_alpha2: 'FR',
    });
  });

  it('billing_address varsa doğru maplar', () => {
    const payload = mapCustomerToIndividualPayload(makeCustomer());

    expect(payload.billing_address).toMatchObject({
      city: 'Paris',
      postal_code: '75001',
    });
  });

  it('external_reference müsteri UUID si olmali', () => {
    const payload = mapCustomerToIndividualPayload(makeCustomer());
    expect(payload.external_reference).toBe('cust-uuid-1');
  });
});
