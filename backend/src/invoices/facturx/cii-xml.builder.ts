import { create } from 'xmlbuilder2';
import { Invoice, InvoiceDocumentType } from '../entities/invoice.entity';
import { InvoiceLine } from '../entities/invoice-line.entity';
import { FacturXProfile } from './facturx-profile.enum';

/**
 * CII XML Builder — Cross Industry Invoice (UN/CEFACT CII D16B)
 *
 * EN 16931 uyumlu Factur-X XML üretir.
 * Profil: EN_16931 (varsayılan) — tüm zorunlu ve isteğe bağlı alanları içerir.
 *
 * Referans standartlar:
 *  - Factur-X 1.0 (FR) / ZUGFeRD 2.3 (DE)
 *  - EN 16931-1:2017
 *  - CHORUSPRO Implementation Guide
 */
export function buildCiiXml(
  invoice: Invoice,
  lines: InvoiceLine[],
  profile: FacturXProfile = FacturXProfile.EN_16931,
): string {
  const seller = invoice.sellerSnapshot ?? {};
  const buyer = invoice.buyerSnapshot ?? {};

  const docTypeCode = resolveDocTypeCode(invoice.documentType);
  const currency = invoice.invoiceCurrency ?? 'EUR';

  const root = create({ version: '1.0', encoding: 'UTF-8' })
    .ele('rsm:CrossIndustryInvoice', {
      'xmlns:rsm': 'urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100',
      'xmlns:ram': 'urn:un:unece:uncefact:data:standard:ReusableAggregateBusinessInformationEntity:100',
      'xmlns:udt': 'urn:un:unece:uncefact:data:standard:UnqualifiedDataType:100',
      'xmlns:qdt': 'urn:un:unece:uncefact:data:standard:QualifiedDataType:100',
      'xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
    });

  // ── ExchangedDocumentContext ────────────────────────────────────────────────
  root.ele('rsm:ExchangedDocumentContext')
    .ele('ram:GuidelineSpecifiedDocumentContextParameter')
    .ele('ram:ID').txt(resolveGuidelineId(profile)).up()
    .up()
    .up();

  // ── ExchangedDocument ───────────────────────────────────────────────────────
  const doc = root.ele('rsm:ExchangedDocument');
  doc.ele('ram:ID').txt(invoice.invoiceNumber);
  doc.ele('ram:TypeCode').txt(docTypeCode);
  doc.ele('ram:IssueDateTime')
    .ele('udt:DateTimeString', { format: '102' })
    .txt(formatDate(invoice.issueDate))
    .up()
    .up();
  if (invoice.notes) {
    doc.ele('ram:IncludedNote').ele('ram:Content').txt(invoice.notes).up().up();
  }
  doc.up();

  // ── SupplyChainTradeTransaction ─────────────────────────────────────────────
  const tx = root.ele('rsm:SupplyChainTradeTransaction');

  // Satır kalemleri
  lines.forEach((line, idx) => {
    const li = tx.ele('ram:IncludedSupplyChainTradeLineItem');
    li.ele('ram:AssociatedDocumentLineDocument')
      .ele('ram:LineID').txt(String(idx + 1)).up()
      .up();

    const product = li.ele('ram:SpecifiedTradeProduct');
    if (line.productId) product.ele('ram:SellerAssignedID').txt(line.productId).up();
    product.ele('ram:Name').txt(line.productName ?? line.description ?? 'Article').up();
    if (line.description && line.description !== line.productName) {
      product.ele('ram:Description').txt(line.description).up();
    }
    product.up();

    const lineAgreement = li.ele('ram:SpecifiedLineTradeAgreement');
    lineAgreement.ele('ram:NetPriceProductTradePrice')
      .ele('ram:ChargeAmount').txt(formatAmt(line.unitPrice)).up()
      .up()
      .up();

    li.ele('ram:SpecifiedLineTradeDelivery')
      .ele('ram:BilledQuantity', { unitCode: resolveUnitCode(line.unit) })
      .txt(formatQty(line.quantity))
      .up()
      .up();

    const lineSett = li.ele('ram:SpecifiedLineTradeSettlement');
    lineSett.ele('ram:ApplicableTradeTax')
      .ele('ram:TypeCode').txt('VAT').up()
      .ele('ram:CategoryCode').txt(resolveTaxCategory(Number(line.taxRate))).up()
      .ele('ram:RateApplicablePercent').txt(formatAmt(line.taxRate)).up()
      .up();

    lineSett.ele('ram:SpecifiedTradeSettlementLineMonetarySummation')
      .ele('ram:LineTotalAmount').txt(formatAmt(line.lineNet)).up()
      .up()
      .up();

    li.up();
  });

  // ── HeaderTradeAgreement (Satıcı + Alıcı) ──────────────────────────────────
  const agreement = tx.ele('ram:ApplicableHeaderTradeAgreement');

  // BT-10 buyer reference
  if (invoice.buyerReference) {
    agreement.ele('ram:BuyerReference').txt(invoice.buyerReference).up();
  }

  // Satıcı (Seller)
  const sellerParty = agreement.ele('ram:SellerTradeParty');
  sellerParty.ele('ram:Name').txt(seller.companyName ?? '').up();
  if (seller.siretNumber) {
    sellerParty.ele('ram:SpecifiedLegalOrganization')
      .ele('ram:ID', { schemeID: '0002' }).txt(seller.sirenNumber ?? seller.siretNumber.substring(0, 9)).up()
      .ele('ram:TradingBusinessName').txt(seller.companyName ?? '').up()
      .up();
  }
  if (seller.tvaNumber) {
    sellerParty.ele('ram:SpecifiedTaxRegistration')
      .ele('ram:ID', { schemeID: 'VA' }).txt(seller.tvaNumber).up()
      .up();
  }
  if (seller.address) {
    sellerParty.ele('ram:PostalTradeAddress')
      .ele('ram:CountryID').txt('FR').up()
      .ele('ram:LineOne').txt(seller.address).up()
      .up();
  }
  sellerParty.up();

  // Alıcı (Buyer)
  const buyerParty = agreement.ele('ram:BuyerTradeParty');
  buyerParty.ele('ram:Name').txt(buyer.company ?? buyer.name ?? '').up();
  if (buyer.siretNumber) {
    buyerParty.ele('ram:SpecifiedLegalOrganization')
      .ele('ram:ID', { schemeID: '0002' }).txt(buyer.sirenNumber ?? buyer.siretNumber.substring(0, 9)).up()
      .up();
  }
  if (buyer.tvaNumber) {
    buyerParty.ele('ram:SpecifiedTaxRegistration')
      .ele('ram:ID', { schemeID: 'VA' }).txt(buyer.tvaNumber).up()
      .up();
  }
  if (buyer.billingAddress) {
    const ba = buyer.billingAddress;
    buyerParty.ele('ram:PostalTradeAddress')
      .ele('ram:PostcodeCode').txt(ba.postalCode ?? '').up()
      .ele('ram:LineOne').txt(ba.street ?? '').up()
      .ele('ram:CityName').txt(ba.city ?? '').up()
      .ele('ram:CountryID').txt(ba.country ?? 'FR').up()
      .up();
  } else if (buyer.address) {
    buyerParty.ele('ram:PostalTradeAddress')
      .ele('ram:CountryID').txt('FR').up()
      .ele('ram:LineOne').txt(buyer.address).up()
      .up();
  }
  buyerParty.up();

  // BT-12 contract, BT-13 order references
  if (invoice.contractReference) {
    agreement.ele('ram:ContractReferencedDocument')
      .ele('ram:IssuerAssignedID').txt(invoice.contractReference).up()
      .up();
  }
  if (invoice.orderReference) {
    agreement.ele('ram:BuyerOrderReferencedDocument')
      .ele('ram:IssuerAssignedID').txt(invoice.orderReference).up()
      .up();
  }
  agreement.up();

  // ── HeaderTradeDelivery ────────────────────────────────────────────────────
  const delivery = tx.ele('ram:ApplicableHeaderTradeDelivery');
  if (invoice.servicePeriodStart || invoice.servicePeriodEnd) {
    const period = delivery.ele('ram:ActualDeliverySupplyChainEvent')
      .ele('ram:OccurrenceDateTime');
    if (invoice.servicePeriodStart) {
      period.ele('udt:DateTimeString', { format: '102' })
        .txt(formatDate(invoice.servicePeriodStart)).up();
    }
    period.up().up();
  }
  delivery.up();

  // ── HeaderTradeSettlement ──────────────────────────────────────────────────
  const settlement = tx.ele('ram:ApplicableHeaderTradeSettlement');
  settlement.ele('ram:InvoiceCurrencyCode').txt(currency).up();

  // Ödeme bilgileri (BT-81, BT-84, BT-86)
  if (invoice.paymentMethodCode || invoice.paymentIban) {
    const means = settlement.ele('ram:SpecifiedTradeSettlementPaymentMeans');
    means.ele('ram:TypeCode').txt(resolvePaymentMeansCode(invoice.paymentMethodCode)).up();
    if (invoice.paymentIban) {
      means.ele('ram:PayeePartyCreditorFinancialAccount')
        .ele('ram:IBANID').txt(invoice.paymentIban).up()
        .up();
    }
    if (invoice.paymentBic) {
      means.ele('ram:PayeeSpecifiedCreditorFinancialInstitution')
        .ele('ram:BICID').txt(invoice.paymentBic).up()
        .up();
    }
    means.up();
  }

  // TVA breakdown (satır bazlı gruplama)
  const taxGroups = groupByTaxRate(lines);
  for (const [rate, { net, tax }] of taxGroups) {
    settlement.ele('ram:ApplicableTradeTax')
      .ele('ram:CalculatedAmount').txt(formatAmt(tax)).up()
      .ele('ram:TypeCode').txt('VAT').up()
      .ele('ram:BasisAmount').txt(formatAmt(net)).up()
      .ele('ram:CategoryCode').txt(resolveTaxCategory(rate)).up()
      .ele('ram:RateApplicablePercent').txt(String(rate)).up()
      .up();
  }

  // Ödeme vadesi
  settlement.ele('ram:SpecifiedTradePaymentTerms')
    .ele('ram:DueDateDateTime')
    .ele('udt:DateTimeString', { format: '102' })
    .txt(formatDate(invoice.dueDate))
    .up()
    .up()
    .up();

  // Toplamlar
  const subtotal = Number(invoice.subtotal ?? 0);
  const taxTotal = Number(invoice.taxAmount ?? 0);
  const discount = Number(invoice.discountAmount ?? 0);
  const total = Number(invoice.total ?? 0);

  settlement.ele('ram:SpecifiedTradeSettlementHeaderMonetarySummation')
    .ele('ram:LineTotalAmount').txt(formatAmt(subtotal)).up()
    .ele('ram:AllowanceTotalAmount').txt(formatAmt(discount)).up()
    .ele('ram:TaxBasisTotalAmount').txt(formatAmt(subtotal - discount)).up()
    .ele('ram:TaxTotalAmount', { currencyID: currency }).txt(formatAmt(taxTotal)).up()
    .ele('ram:GrandTotalAmount').txt(formatAmt(total)).up()
    .ele('ram:DuePayableAmount').txt(formatAmt(total)).up()
    .up();

  settlement.up();
  tx.up();

  return root.end({ prettyPrint: true });
}

// ── Yardımcı fonksiyonlar ────────────────────────────────────────────────────

function formatDate(d: Date | string | null | undefined): string {
  if (!d) return new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const s = d instanceof Date ? d.toISOString() : String(d);
  return s.slice(0, 10).replace(/-/g, '');
}

function formatAmt(n: number | string | null | undefined): string {
  return Number(n ?? 0).toFixed(2);
}

function formatQty(n: number | string | null | undefined): string {
  return Number(n ?? 0).toFixed(4);
}

function resolveDocTypeCode(docType: InvoiceDocumentType | null | undefined): string {
  switch (docType) {
    case InvoiceDocumentType.CREDIT_NOTE: return '381';
    case InvoiceDocumentType.DEBIT_NOTE:  return '383';
    default:                              return '380'; // INVOICE
  }
}

function resolveGuidelineId(profile: FacturXProfile): string {
  switch (profile) {
    case FacturXProfile.MINIMUM:   return 'urn:factur-x.eu:1p0:minimum';
    case FacturXProfile.BASIC_WL:  return 'urn:factur-x.eu:1p0:basicwl';
    case FacturXProfile.EXTENDED:  return 'urn:factur-x.eu:1p0:extended';
    default:                       return 'urn:cen.eu:en16931:2017#compliant#urn:factur-x.eu:1p0:en16931';
  }
}

function resolveTaxCategory(rate: number): string {
  if (rate === 0) return 'Z'; // sıfır oranlı
  return 'S'; // standart
}

function resolveUnitCode(unit: string | null | undefined): string {
  const map: Record<string, string> = {
    piece: 'C62', pcs: 'C62', adet: 'C62',
    hour: 'HUR', saat: 'HUR',
    day: 'DAY', gün: 'DAY',
    kg: 'KGM', g: 'GRM',
    m: 'MTR', km: 'KMT',
    l: 'LTR', litre: 'LTR',
  };
  return map[unit?.toLowerCase() ?? ''] ?? 'C62';
}

function resolvePaymentMeansCode(method: string | null | undefined): string {
  switch (method) {
    case 'bank_transfer': return '30';
    case 'direct_debit':  return '59';
    case 'card':          return '48';
    case 'cheque':        return '20';
    case 'cash':          return '10';
    default:              return '30';
  }
}

function groupByTaxRate(
  lines: InvoiceLine[],
): Map<number, { net: number; tax: number }> {
  const map = new Map<number, { net: number; tax: number }>();
  for (const line of lines) {
    const rate = Number(line.taxRate ?? 0);
    const existing = map.get(rate) ?? { net: 0, tax: 0 };
    map.set(rate, {
      net: existing.net + Number(line.lineNet ?? 0),
      tax: existing.tax + Number(line.lineTax ?? 0),
    });
  }
  return map;
}
