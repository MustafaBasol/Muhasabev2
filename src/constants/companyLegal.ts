export interface CompanyIdentifiers {
  siren?: string; // France company ID (9 digits)
  siret?: string; // France establishment ID (14 digits)
  tva?: string;   // VAT number (e.g., FRXXXXXXXXXXX)
  rcs?: string;   // Registre du Commerce et des Sociétés
  ape?: string;   // APE/NAF code
  steuernummer?: string; // DE tax number (optional for DE locale)
  umsatzsteuerID?: string; // DE VAT ID
  handelsregisternummer?: string; // DE Commercial register number
}

export interface CompanyLegalConstants {
  companyName: string;
  address: string;      // Full postal address
  country?: string;     // Country name
  email?: string;       // Legal contact email
  dataProtectionEmail?: string; // DPO / privacy contact
  phone?: string;       // Optional public phone
  website?: string;     // Public website
  representative?: string; // Legal representative or responsible person
  identifiers?: CompanyIdentifiers; // Optional IDs per jurisdiction
  hostingProvider?: string; // Hosting provider
  emailInfrastructure?: string; // Email delivery infrastructure
}

// NOTE: Fill these values with your official company details.
export const COMPANY_LEGAL: CompanyLegalConstants = {
  companyName: 'Peaknova (trading as “Comptario”)',
  address: '30 Rue Jean Turel, 73200 Albertville, France',
  country: 'France',
  email: 'legal@comptario.com',
  dataProtectionEmail: 'privacy@comptario.com',
  phone: '',
  website: 'https://comptario.com',
  representative: 'Mustafa BASOL',
  identifiers: {
    siren: '937704740',
    siret: '93770474000011',
    tva: '',
    rcs: '',
    ape: ''
  },
  hostingProvider: 'Hostinger International Ltd.',
  emailInfrastructure: 'Amazon Simple Email Service (SES), Amazon Web Services EMEA SARL – EU (Frankfurt)'
};
