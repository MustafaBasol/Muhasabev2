import { Customer } from '../../../customers/entities/customer.entity';
import { CustomerType } from '../../../customers/entities/customer.entity';
import {
  PennylaneAddress,
  PennylaneCreateCompanyCustomerPayload,
  PennylaneCreateIndividualCustomerPayload,
} from '../types/pennylane.types';

/**
 * Comptario Customer → Pennylane API payload
 *
 * Pennylane iki endpoint kullanır:
 *  - b2b  → POST /company_customers   (required: name)
 *  - b2c / individual → POST /individual_customers (required: first_name, last_name, billing_address)
 */
export function mapCustomerToCompanyPayload(
  customer: Customer,
): PennylaneCreateCompanyCustomerPayload {
  return {
    name: customer.name,
    vat_number: customer.tvaNumber ?? undefined,
    reg_no: customer.sirenNumber ?? undefined,
    phone: customer.phone ?? undefined,
    billing_address: mapAddress(customer.billingAddress ?? customer.address),
    delivery_address: mapAddress(customer.deliveryAddress ?? undefined),
    payment_conditions: customer.defaultPaymentTerms ?? undefined,
    emails: customer.email ? [customer.email] : [],
    external_reference: customer.id, // Comptario UUID → Pennylane tarafı eşleşme
    billing_language: 'fr_FR',
  };
}

export function mapCustomerToIndividualPayload(
  customer: Customer,
): PennylaneCreateIndividualCustomerPayload {
  const [firstName, ...rest] = (customer.name ?? '').split(' ');
  const lastName = rest.join(' ') || firstName; // tek kelimeyse her ikisi de aynı

  const billingAddr = mapAddress(customer.billingAddress ?? customer.address);

  return {
    first_name: firstName || customer.name,
    last_name: lastName || customer.name,
    phone: customer.phone ?? undefined,
    billing_address: billingAddr ?? {
      address: '-',
      postal_code: '00000',
      city: '-',
      country_alpha2: 'FR',
    },
    delivery_address: mapAddress(customer.deliveryAddress ?? undefined),
    payment_conditions: customer.defaultPaymentTerms ?? undefined,
    emails: customer.email ? [customer.email] : [],
    external_reference: customer.id,
    billing_language: 'fr_FR',
  };
}

/** Customer'ın tipine göre doğru payload tipini döner */
export function isCompanyCustomer(customer: Customer): boolean {
  return customer.customerType === CustomerType.B2B || !customer.customerType;
}

// ─── Address helper ──────────────────────────────────────────────────────────

function mapAddress(
  addr: Record<string, string | undefined> | string | null | undefined,
): PennylaneAddress | undefined {
  if (!addr) return undefined;

  // Basit string ise sadece address alanını doldur
  if (typeof addr === 'string') {
    return { address: addr, postal_code: '', city: '', country_alpha2: 'FR' };
  }

  // Nesne (Customer.billingAddress / deliveryAddress)
  return {
    address: addr['address'] ?? addr['street'] ?? '',
    postal_code: addr['postal_code'] ?? addr['postalCode'] ?? addr['zipCode'] ?? '',
    city: addr['city'] ?? '',
    country_alpha2: addr['country_alpha2'] ?? addr['countryAlpha2'] ?? addr['country'] ?? 'FR',
  };
}
