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
    reg_no: customer.sirenNumber ?? customer.siretNumber?.slice(0, 9) ?? undefined,
    phone: customer.phone ?? undefined,
    billing_address: mapAddress(customer.billingAddress ?? customer.address) ?? DEFAULT_FR_ADDRESS,
    delivery_address: mapAddress(customer.deliveryAddress ?? undefined),
    payment_conditions: customer.defaultPaymentTerms ?? undefined,
    emails: customer.email ? [customer.email] : [],
    external_reference: customer.id,
    billing_language: 'fr_FR',
  };
}

export function mapCustomerToIndividualPayload(
  customer: Customer,
): PennylaneCreateIndividualCustomerPayload {
  const nameParts = (customer.name ?? '').trim().split(/\s+/);
  const firstName = nameParts[0] || customer.name || 'Inconnu';
  const lastName = nameParts.slice(1).join(' ') || firstName;

  const billingAddr = mapAddress(customer.billingAddress ?? customer.address) ?? DEFAULT_FR_ADDRESS;

  return {
    first_name: firstName,
    last_name: lastName,
    phone: customer.phone ?? undefined,
    billing_address: billingAddr,
    delivery_address: mapAddress(customer.deliveryAddress ?? undefined),
    payment_conditions: customer.defaultPaymentTerms ?? undefined,
    emails: customer.email ? [customer.email] : [],
    external_reference: customer.id,
    billing_language: 'fr_FR',
  };
}

/** Customer'ın tipine göre doğru payload tipini döner */
export function isCompanyCustomer(customer: Customer): boolean {
  // Tip açıkça B2C/individual ise bireysel müşteri, aksi hâlde şirket
  return (
    customer.customerType !== CustomerType.B2C &&
    customer.customerType !== CustomerType.INDIVIDUAL
  );
}

// ─── Address helper ──────────────────────────────────────────────────────────

/** Pennylane billing_address zorunlu alanları için varsayılan FR adresi */
const DEFAULT_FR_ADDRESS: PennylaneAddress = {
  address: '-',
  postal_code: '00000',
  city: '-',
  country_alpha2: 'FR',
};

function mapAddress(
  addr: Record<string, string | undefined> | string | null | undefined,
): PennylaneAddress | undefined {
  if (!addr) return undefined;

  // Basit string ise sadece address alanını doldur
  if (typeof addr === 'string') {
    if (!addr.trim()) return undefined;
    return { address: addr.trim(), postal_code: '', city: '', country_alpha2: 'FR' };
  }

  // Nesne (Customer.billingAddress / deliveryAddress)
  // Entity'de `street` kullanılıyor, Pennylane `address` istiyor
  const street =
    addr['address'] ??
    addr['street'] ??
    addr['line1'] ??
    '';

  const postalCode =
    addr['postal_code'] ??
    addr['postalCode'] ??
    addr['zipCode'] ??
    addr['zip'] ??
    '';

  const city =
    addr['city'] ??
    addr['town'] ??
    '';

  // Ülke: entity'de ISO alpha-2 veya Türkçe isim olabilir
  const rawCountry =
    addr['country_alpha2'] ??
    addr['countryAlpha2'] ??
    addr['country'] ??
    'FR';

  const country_alpha2 = normalizeCountryCode(rawCountry);

  // Hiçbir alan dolmamışsa undefined dönerek Pennylane'e boş adres gitmesin
  if (!street && !postalCode && !city) return undefined;

  return { address: street, postal_code: postalCode, city, country_alpha2 };
}

/**
 * Ülke kodunu ISO 3166-1 alpha-2 formatına normalize eder.
 * Türkçe isimler veya tam adlar → koda çevrilir.
 */
function normalizeCountryCode(value: string): string {
  const v = value.trim().toUpperCase();

  // Zaten 2 harfli kod ise direkt kullan
  if (/^[A-Z]{2}$/.test(v)) return v;

  // Yaygın Türkçe/İngilizce ülke adları → koda çevir
  const COUNTRY_MAP: Record<string, string> = {
    'TÜRKİYE': 'TR',
    'TURKEY': 'TR',
    'TURKIYE': 'TR',
    'FRANCE': 'FR',
    'FRANSA': 'FR',
    'GERMANY': 'DE',
    'ALMANYA': 'DE',
    'UNITED KINGDOM': 'GB',
    'UK': 'GB',
    'İNGİLTERE': 'GB',
    'UNITED STATES': 'US',
    'USA': 'US',
    'AMERİKA': 'US',
    'SPAIN': 'ES',
    'İSPANYA': 'ES',
    'ITALY': 'IT',
    'İTALYA': 'IT',
    'NETHERLANDS': 'NL',
    'HOLLANDA': 'NL',
    'BELGIUM': 'BE',
    'BELÇİKA': 'BE',
    'SWITZERLAND': 'CH',
    'İSVİÇRE': 'CH',
  };

  return COUNTRY_MAP[v] ?? 'FR'; // bilinmeyenler için FR varsayılan
}
