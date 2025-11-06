// src/utils/pdfGenerator.ts
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import DOMPurify from 'dompurify';
import i18n from '../i18n/config';
import { logger } from '../utils/logger';
import { secureStorage } from '../utils/storage';
import type { Invoice, Expense, Sale, InvoiceItem } from '../types';

// Para birimi tipini uygulamanın CurrencyContext'inden alalım (TRY | USD | EUR | GBP)
import type { Currency } from '../contexts/CurrencyContext';

// Genişletilmiş CompanyProfile (ülke-bazlı opsiyonel alanlar ile)
import type { CompanyProfile as BaseCompanyProfile } from '../types';
export type SettingsLanguage = 'tr' | 'en' | 'fr' | 'de';
export type CountryCode = 'TR' | 'FR' | 'DE' | 'US' | 'OTHER';
export interface CompanyProfile extends BaseCompanyProfile {
  country?: CountryCode;
  // TR
  mersisNumber?: string;
  kepAddress?: string;
  // FR
  siretNumber?: string;
  sirenNumber?: string;
  apeCode?: string;
  tvaNumber?: string;
  rcsNumber?: string;
  // DE
  steuernummer?: string;
  umsatzsteuerID?: string;
  handelsregisternummer?: string;
  geschaeftsfuehrer?: string;
  // US/genel
  einNumber?: string;
  taxId?: string;
  businessLicenseNumber?: string;
  stateOfIncorporation?: string;
  // OTHER/genel
  registrationNumber?: string;
  vatNumberGeneric?: string;
  taxIdGeneric?: string;
  stateOrRegion?: string;
}

// ——— GENEL YARDIMCILAR ———————————————————————
// PDF genel logo yüksekliği (iki şablon için aynı)
const PDF_LOGO_HEIGHT_PX = 80; // Fatura ve Teklif için eşit ve daha büyük

const normalizeLang = (lang?: string): SettingsLanguage => {
  const l = (lang || i18n.language || 'tr').toLowerCase();
  if (l.startsWith('tr')) return 'tr';
  if (l.startsWith('fr')) return 'fr';
  if (l.startsWith('de')) return 'de';
  return 'en';
};

const countryFromLang = (lang: SettingsLanguage): CountryCode => {
  switch (lang) {
    case 'tr': return 'TR';
    case 'fr': return 'FR';
    case 'de': return 'DE';
    default: return 'US';
  }
};

const toNum = (v: unknown): number => {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
};

const formatIban = (iban?: string): string => {
  if (!iban) return '';
  return String(iban).replace(/\s+/g, '').replace(/(.{4})/g, '$1 ').trim();
};

const getSelectedCurrency = (): Currency => {
  const saved = localStorage.getItem('currency') as Currency | null;
  return saved || 'TRY';
};

const makeCurrencyFormatter = (currency: Currency) => (amount: number | string | undefined | null) => {
  const n = toNum(amount ?? 0);
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(n);
  } catch {
    // Bazı tarayıcılarda/ortamlarda "GBP" vs. sorun çıkarsa fallback
    const symbol = currency === 'USD' ? '$' : currency === 'EUR' ? '€' : currency === 'GBP' ? '£' : '₺';
    return `${symbol}${n.toFixed(2)}`;
  }
};

const formatDate = (date: string | number | Date, locale?: string): string => {
  try { return new Date(date).toLocaleDateString(locale || undefined); } catch { return String(date); }
};

// PDF açılış seçenekleri
export interface OpenOpts {
  filename?: string;
  lang?: SettingsLanguage | string;
  currency?: Currency;
  company?: Partial<CompanyProfile>;
  targetWindow?: Window | null;
}

// HTML → PDF (çok segmentli) → Blob
// Her segment ayrı render edilir; segmentler arasında sayfa sınırı korunur.
const htmlSegmentsToPdfBlob = async (segments: string[]): Promise<Blob> => {
  // jsPDF ölçüleri (mm)
  const pdf = new jsPDF('p', 'mm', 'a4');
  const pdfW = pdf.internal.pageSize.getWidth();     // 210mm
  const pdfH = pdf.internal.pageSize.getHeight();    // 297mm

  // Marjinler (mm)
  const topMarginOtherMm = 6;  // 2.+ sayfalar üst boşluk (ilk ürün sayfasını bozmaz)
  const bottomMarginFirstMm = 12; // ilk sayfa alt boşluk (footer güvenliği)
  const bottomMarginMm = 0;   // 2.+ sayfalar alt boşluk (içerik rezervleri ile dengelenir)

  let pagesAdded = 0; // belge seviyesinde eklenen sayfalar

  // Segment renderer
  const renderOne = async (html: string) => {
    // Ekran dışında stabil konteyner
    const tempDiv = document.createElement('div');
    Object.assign(tempDiv.style, {
      position: 'absolute', left: '-10000px', top: '0', width: '794px', background: '#ffffff', fontFamily: 'Arial, sans-serif',
    } as CSSStyleDeclaration);
    tempDiv.innerHTML = DOMPurify.sanitize(html);
    document.body.appendChild(tempDiv);

    try {
      const scale = 2;
      const containerWidthPx = tempDiv.scrollWidth || 794;
      const imgWEst = containerWidthPx * scale;
  const pdfWmm = 210; const pdfHmm = 297;
  const pageCanvasHeightPxEst = (pdfHmm * imgWEst) / pdfWmm;
  const pageCssHeightPxRaw = pageCanvasHeightPxEst / scale;
  // Spacer hizalamaları için "sonraki sayfa" yüksekliğini tahmini hesapla (üst-alt marj sonrası)
  const ratioEst = (pdfW / imgWEst);
  const availableHmmNextEst = pdfH - topMarginOtherMm - bottomMarginMm;
  const pageCanvasHeightPxNextEst = Math.floor(availableHmmNextEst / ratioEst);
  const pageCssHeightPx = (pageCanvasHeightPxNextEst / scale) || pageCssHeightPxRaw;

      // Zorunlu yeni sayfa işareti
      const forceBreakers = Array.from(tempDiv.querySelectorAll('[data-force-new-page="true"]')) as HTMLElement[];
      forceBreakers.forEach(el => {
        try {
          let top = 0; let node: HTMLElement | null = el;
          while (node && node !== tempDiv) { top += node.offsetTop; node = node.offsetParent as HTMLElement | null; }
          const posInPage = top % pageCssHeightPx;
          const spacerH = Math.ceil(pageCssHeightPx - posInPage);
          if (spacerH > 0 && spacerH < pageCssHeightPx) {
            const spacer = document.createElement('div');
            spacer.style.height = `${spacerH}px`;
            spacer.style.width = '100%';
            spacer.style.display = 'block';
            el.parentElement?.insertBefore(spacer, el);
          }
        } catch {}
      });

      // Bölünme korumaları
      const blockers = Array.from(tempDiv.querySelectorAll('[data-avoid-split="true"]')) as HTMLElement[];
      blockers.forEach(el => {
        try {
          let top = 0; let node: HTMLElement | null = el;
          while (node && node !== tempDiv) { top += node.offsetTop; node = node.offsetParent as HTMLElement | null; }
          const blockH = el.offsetHeight || 0;
          const marginBottomReserve = 48;
          const posInPage = top % pageCssHeightPx;
          if (posInPage + blockH > (pageCssHeightPx - marginBottomReserve)) {
            const spacer = document.createElement('div');
            spacer.style.height = `${Math.ceil(pageCssHeightPx - posInPage)}px`;
            spacer.style.width = '100%';
            spacer.style.display = 'block';
            el.parentElement?.insertBefore(spacer, el);
          }
        } catch {}
      });

      // Tablo satırlarını (tr) sayfa arasında bölme: ana bölümdeki ürünler tablosu dahil
      const tableRows = Array.from(tempDiv.querySelectorAll('table tbody tr')) as HTMLElement[];
      tableRows.forEach(rowEl => {
        try {
          let top = 0; let node: HTMLElement | null = rowEl as HTMLElement;
          while (node && node !== tempDiv) { top += node.offsetTop; node = node.offsetParent as HTMLElement | null; }
          const rowH = rowEl.offsetHeight || 0;
          const reserve = 48;
          const posInPage = top % pageCssHeightPx;
          if (posInPage + rowH > (pageCssHeightPx - reserve)) {
            const spacer = document.createElement('div');
            spacer.style.height = `${Math.ceil(pageCssHeightPx - posInPage)}px`;
            spacer.style.width = '100%';
            spacer.style.display = 'block';
            rowEl.parentElement?.insertBefore(spacer, rowEl);
          }
        } catch {}
      });

      // Sadece kapsam alanında ek koruma
      const scopeBlocks = Array.from(tempDiv.querySelectorAll('[data-scope="true"] p, [data-scope="true"] li, [data-scope="true"] h1, [data-scope="true"] h2, [data-scope="true"] h3, [data-scope="true"] h4, [data-scope="true"] h5, [data-scope="true"] h6, [data-scope="true"] ul, [data-scope="true"] ol, [data-scope="true"] table')) as HTMLElement[];
      scopeBlocks.forEach(el => {
        try {
          let top = 0; let node: HTMLElement | null = el;
          while (node && node !== tempDiv) { top += node.offsetTop; node = node.offsetParent as HTMLElement | null; }
          const blockH = el.offsetHeight || 0;
          const reserveScope = 96; // daha cömert alt boşluk
          const posInPage = top % pageCssHeightPx;
          if (posInPage + blockH > (pageCssHeightPx - reserveScope)) {
            const spacer = document.createElement('div');
            spacer.style.height = `${Math.ceil(pageCssHeightPx - posInPage)}px`;
            spacer.style.width = '100%';
            spacer.style.display = 'block';
            el.parentElement?.insertBefore(spacer, el);
          }
        } catch {}
      });

      // Canvas al
      const canvas = await html2canvas(tempDiv, {
        scale, backgroundColor: '#ffffff', useCORS: true, allowTaint: true,
        windowWidth: tempDiv.scrollWidth || 794,
        windowHeight: tempDiv.scrollHeight || tempDiv.clientHeight || 1123,
      });

      const imgW = canvas.width;
      const imgH = canvas.height;
      const ratio = pdfW / imgW;

      const availableHmmFirst = pdfH - bottomMarginFirstMm;
      const pageCanvasHeightPxFirst = Math.floor(availableHmmFirst / ratio);
      const availableHmmNext = pdfH - topMarginOtherMm - bottomMarginMm;
      const pageCanvasHeightPxNext = Math.floor(availableHmmNext / ratio);
        // Not: spacer hizalamaları için gerekirse kullanılabilir
        // const pageCssHeightPx = (pageCanvasHeightPxNext / scale) || pageCssHeightPxRaw;

      // Büyük canvas’ı sayfa sayfa dilimle
      let rendered = 0;
      const pageCanvas = document.createElement('canvas');
      const ctx = pageCanvas.getContext('2d')!;
      pageCanvas.width = imgW;

      let localPageIndex = 0;
      while (rendered < imgH) {
        const perPagePx = localPageIndex === 0 ? pageCanvasHeightPxFirst : pageCanvasHeightPxNext;
        const sliceH = Math.min(perPagePx, imgH - rendered);
        pageCanvas.height = sliceH;

        ctx.clearRect(0, 0, imgW, sliceH);
        ctx.drawImage(canvas, 0, rendered, imgW, sliceH, 0, 0, imgW, sliceH);

        const imgData = pageCanvas.toDataURL('image/png');

        // Segmentler arası: yeni sayfa aç
        if (pagesAdded > 0 || localPageIndex > 0) pdf.addPage();
        const yOffsetMm = pagesAdded === 0 && localPageIndex === 0 ? 0 : topMarginOtherMm;
        pdf.addImage(imgData, 'PNG', 0, yOffsetMm, pdfW, sliceH * ratio);

        rendered += sliceH;
        localPageIndex += 1;
        pagesAdded += 1;
      }
    } finally {
      document.body.removeChild(tempDiv);
    }
  };

  for (const html of segments.filter(Boolean)) {
    await renderOne(html);
  }

  const blob = pdf.output('blob');
  logger.debug('PDF boyutu (byte):', blob.size);
  return blob;
};

// Geriye dönük API: tek segmentli sürüm
const htmlToPdfBlob = async (html: string): Promise<Blob> => htmlSegmentsToPdfBlob([html]);

const localeFromLang = (lang: SettingsLanguage): string => {
  switch (lang) {
    case 'tr': return 'tr-TR';
    case 'fr': return 'fr-FR';
    case 'de': return 'de-DE';
    default: return 'en-US';
  }
};

const buildLegalFieldsHtml = (c: Partial<CompanyProfile>, country: CountryCode) => {
  const row = (label: string, value?: string) => value ? `<div style="font-size:11px;color:#111827;margin-top:2px;"><strong>${label}:</strong> ${value}</div>` : '';
  switch (country) {
    case 'TR':
      return [
        row('VKN', c.taxNumber),
        row('Vergi Dairesi', c.taxOffice),
        row('Mersis', c.mersisNumber),
        row('KEP', c.kepAddress),
      ].join('');
    case 'FR':
      return [
        row('SIRET', c.siretNumber),
        row('SIREN', c.sirenNumber),
        row('APE', c.apeCode),
        row('TVA', c.tvaNumber),
        row('RCS', c.rcsNumber),
      ].join('');
    case 'DE':
      return [
        row('Steuernummer', c.steuernummer),
        row('USt-IdNr', c.umsatzsteuerID),
        row('HRB', c.handelsregisternummer),
        row('Geschäftsführer', c.geschaeftsfuehrer),
      ].join('');
    case 'US':
    default:
      return [
        row('EIN', c.einNumber),
        row('Tax ID', c.taxId),
        row('Business License', c.businessLicenseNumber),
        row('State', c.stateOfIncorporation),
      ].join('');
    case 'OTHER':
      return [
        row('Registration No', c.registrationNumber),
        row('VAT', c.vatNumberGeneric),
        row('Tax ID', c.taxIdGeneric),
        row('State/Region', c.stateOrRegion),
      ].join('');
  }
};

// (Tek segmentli eski fonksiyon artık htmlSegmentsToPdfBlob ile değiştirilmiştir)

// 2) PDF’i yeni sekmede göster (pop-up’a takılmaz, fallback’li)
// Basit ve güvenli dosya adı üretici
// Eski: indirme için dosya adı üretici (artık görüntülüyoruz, şimdilik kullanılmıyor)
// const sanitizeFilename = (name?: string, fallback = 'document.pdf') => {
//   const raw = (name && name.trim()) ? name.trim() : fallback;
//   const withPdf = raw.toLowerCase().endsWith('.pdf') ? raw : `${raw}.pdf`;
//   return withPdf.replace(/[^a-zA-Z0-9._-]+/g, '_').replace(/_+/g, '_');
// };

const openPdfInWindow = (pdfData: Blob | string, _filename: string, targetWindow?: Window | null) => {
  const url = typeof pdfData === 'string'
    ? pdfData
    : URL.createObjectURL(
        pdfData.type === 'application/pdf' ? pdfData : new Blob([pdfData], { type: 'application/pdf' })
      );

  // Hedef sekme varsa doğrudan oraya yönlendir
  if (targetWindow && !targetWindow.closed) {
    try {
      targetWindow.location.href = url;
  targetWindow.addEventListener('unload', () => { try { URL.revokeObjectURL(url); } catch { /* ignore revoke error */ } }, { once: true });
      return;
    } catch { /* anchor fallback'e geç */ }
  }

  // Öncelik: yeni sekme açıp PDF’i görüntülemek
  try {
    const w = window.open(url, '_blank', 'noopener');
    if (w) {
      setTimeout(() => { try { URL.revokeObjectURL(url); } catch { /* ignore revoke error */ } }, 10000);
      return;
    }
  } catch { /* anchor fallback */ }

  // Fallback: programatik anchor → yeni sekme (genelde pop-up sayılmaz)
  try {
    const a = document.createElement('a');
    a.href = url;
    a.target = '_blank';
    a.rel = 'noopener';
    // Not: a.download EKLEME - görüntüleme istiyoruz, indirmeyi zorlamıyoruz
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => { try { URL.revokeObjectURL(url); } catch { /* ignore revoke error */ } }, 10000);
    return;
  } catch { /* devam */ }

  // Son çare: aynı sekmeye yönlendir
  try { window.location.href = url; } catch { /* ignore location change error */ }
};


// ——— ŞABLON ÜRETİCİLERİ ———————————————————————
const buildInvoiceHtml = (invoice: Invoice, c: Partial<CompanyProfile> = {}, lang?: string, currency?: Currency) => {
  // Logo yalnızca geçerli data URL ise gösterilsin; aksi halde boş alan kalmasın
  const hasLogo = !!(c.logoDataUrl && /^data:image\//.test(c.logoDataUrl));
  const activeLang = normalizeLang(lang);
  // Öncelik: şirket ayarlarındaki ülke; yoksa dilden türet
  const country: CountryCode = (c.country as CountryCode) || countryFromLang(activeLang);
  const tf = (k: string) => i18n.t(k, { lng: activeLang });
  const activeCurrency: Currency = currency ?? getSelectedCurrency();
  const fmt = makeCurrencyFormatter(activeCurrency);
  const dloc = localeFromLang(activeLang);

  // Toplamları güvenli biçimde hesapla
  const items = Array.isArray(invoice.items) ? invoice.items : [];
  const computedSubtotal = items.reduce((sum, it: InvoiceItem) => {
    const lineTotal = toNum(it.total) || (toNum(it.unitPrice) * toNum(it.quantity));
    return sum + (Number.isFinite(lineTotal) ? lineTotal : 0);
  }, 0);
  const subtotalVal = toNum(invoice.subtotal) || computedSubtotal;
  const taxVal = toNum(invoice.taxAmount);
  const totalVal = toNum(invoice.total) || (subtotalVal + taxVal);

  const companyBlock = `
    <div>
      <div style="font-size:18px;font-weight:700;color:#111827;">${c.name ?? ''}</div>
      ${c.address ? `<div style="font-size:12px;color:#4B5563;white-space:pre-line;margin-top:2px;">${c.address}</div>` : ''}

      ${buildLegalFieldsHtml(c, country)}

      ${c.iban ? `<div style="font-size:11px;color:#111827;margin-top:4px;"><strong>IBAN:</strong> ${formatIban(c.iban)}</div>` : ''}
      ${c.phone ? `<div style="font-size:11px;color:#111827;margin-top:2px;"><strong>Tel:</strong> ${c.phone}</div>` : ''}
      ${c.email ? `<div style="font-size:11px;color:#111827;margin-top:2px;"><strong>Email:</strong> ${c.email}</div>` : ''}
      ${c.website ? `<div style="font-size:11px;color:#111827;margin-top:2px;"><strong>Web:</strong> ${c.website}</div>` : ''}
    </div>
  `;

  // Teklif PDF'indeki müşteri düzeni ile aynı görünüm ve zenginleştirme
  let invCustomerEmail = invoice.customerEmail || '';
  let invCustomerPhone = '' as string;
  let invCustomerAddress = invoice.customerAddress || '';
  try {
    const raw = localStorage.getItem('customers_cache');
    const arr = raw ? (JSON.parse(raw) as any[]) : [];
    const found = Array.isArray(arr)
      ? arr.find((c: any) => (invoice as any)?.customerId
          ? String(c.id) === String((invoice as any).customerId)
          : c.name === invoice.customerName)
      : null;
    if (found) {
      if (!invCustomerEmail) invCustomerEmail = found.email || '';
      invCustomerPhone = found.phone || '';
      if (!invCustomerAddress) invCustomerAddress = found.address || '';
    }
  } catch {}

  const customerBlock = `
    <div style="text-align:right;">
      <h3 style="color:#1F2937;margin:0 0 6px 0;">${tf('pdf.invoice.customerInfo')}</h3>
      <div style="font-weight:700;margin-bottom:2px;">${invoice.customerName ?? ''}</div>
      ${invCustomerEmail ? `<div style="font-size:12px;margin-top:2px;">${invCustomerEmail}</div>` : ''}
      ${invCustomerPhone ? `<div style="font-size:12px;margin-top:2px;">${invCustomerPhone}</div>` : ''}
      ${invCustomerAddress ? `<div style="font-size:12px;margin-top:2px;white-space:pre-line;">${invCustomerAddress}</div>` : ''}
    </div>
  `;

  const statusLabel = (() => {
    const base = 'pdf.invoice.statusLabels';
    switch (invoice.status) {
      case 'paid': return tf(`${base}.paid`);
      case 'sent': return tf(`${base}.sent`);
      case 'overdue': return tf(`${base}.overdue`);
      default: return tf(`${base}.draft`);
    }
  })();

  return `
    <div style="
      max-width:170mm; margin:0 auto;
      padding-top:22mm; padding-bottom:6mm;
      display:flex; flex-direction:column;
      min-height:263mm; box-sizing:border-box;
    ">
      <!-- Üst satır: logo solda, FATURA sağda; alt çizgiye hizalı -->
      <div style="
        display:flex; justify-content:space-between; align-items:flex-end; gap:16px;
        border-bottom:2px solid #3B82F6; padding-bottom:12px;
      ">
        <div style="display:flex; align-items:flex-end;">
          ${hasLogo ? `<img src="${c.logoDataUrl}" alt="logo"
            style="height:${PDF_LOGO_HEIGHT_PX}px;width:auto;display:block;object-fit:contain;transform:translateY(6px);" />` : ''}
        </div>
        <div style="text-align:right; line-height:1;">
          <div style="color:#3B82F6; font-size:28px; font-weight:800;">${tf('pdf.invoice.title')}</div>
          <div style="color:#6B7280; font-size:12px; margin-top:4px;">${String(tf('pdf.invoice.appSubtitle')).replace(/MoneyFlow/gi, 'comptario')}</div>
        </div>
      </div>

      <!-- Mavi çizginin altında: Sol şirket, sağ müşteri -->
      <div style="display:flex; justify-content:space-between; gap:24px; margin:16px 0 18px 0;">
        <div>${companyBlock}</div>
        <div>${customerBlock}</div>
      </div>

      <!-- Fatura bilgileri -->
      <div style="display:flex; justify-content:space-between; margin-bottom:18px;">
        <div>
          <p style="margin:4px 0;"><strong>${tf('pdf.invoice.invoiceNumber')}:</strong> ${invoice.invoiceNumber}</p>
          <p style="margin:4px 0;"><strong>${tf('pdf.invoice.issueDate')}:</strong> ${formatDate(invoice.issueDate, dloc)}</p>
          <p style="margin:4px 0;"><strong>${tf('pdf.invoice.dueDate')}:</strong> ${formatDate(invoice.dueDate, dloc)}</p>
          <p style="margin:4px 0;"><strong>${tf('pdf.invoice.status')}:</strong> ${statusLabel}</p>
        </div>
        <div></div>
      </div>

      <!-- Kalem tablosu -->
      <table style="width:100%; border-collapse:collapse; margin-bottom:24px;">
        <thead>
          <tr style="background-color:#F3F4F6;">
            <th style="border:1px solid #D1D5DB; padding:10px; text-align:left;">${tf('pdf.invoice.items.description')}</th>
            <th style="border:1px solid #D1D5DB; padding:10px; text-align:center;">${tf('pdf.invoice.items.quantity')}</th>
            <th style="border:1px solid #D1D5DB; padding:10px; text-align:right;">${tf('pdf.invoice.items.unitPrice')}</th>
            <th style="border:1px solid #D1D5DB; padding:10px; text-align:right;">${tf('pdf.invoice.items.total')}</th>
          </tr>
        </thead>
        <tbody>
          ${(invoice.items ?? []).map((item: InvoiceItem) => `
            <tr>
              <td style="border:1px solid #D1D5DB; padding:10px;">${item.description ?? ''}</td>
              <td style="border:1px solid #D1D5DB; padding:10px; text-align:center;">${item.quantity ?? ''}</td>
              <td style="border:1px solid #D1D5DB; padding:10px; text-align:right;">${fmt(item.unitPrice)}</td>
              <td style="border:1px solid #D1D5DB; padding:10px; text-align:right;">${fmt(toNum(item.total) || (toNum(item.unitPrice) * toNum(item.quantity)))}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      <!-- Toplamlar -->
      <div style="display:flex; justify-content:flex-end; margin-bottom:24px;">
        <div style="width:300px;">
          <div style="display:flex; justify-content:space-between; padding:8px 0; border-bottom:1px solid #E5E7EB;">
            <span>${tf('pdf.invoice.totals.subtotal')}:</span><span>${fmt(subtotalVal)}</span>
          </div>
          <div style="display:flex; justify-content:space-between; padding:8px 0; border-bottom:1px solid #E5E7EB;">
            <span>${tf('pdf.invoice.totals.tax')}:</span><span>${fmt(taxVal)}</span>
          </div>
          <div style="display:flex; justify-content:space-between; padding:12px 0; font-weight:bold; font-size:18px; border-top:2px solid #1F2937;">
            <span>${tf('pdf.invoice.totals.grandTotal')}:</span><span>${fmt(totalVal)}</span>
          </div>
        </div>
      </div>

      <!-- Footer: sayfanın dibinde -->
      <div style="text-align:center; margin-top:auto; padding-top:16px; border-top:1px solid #E5E7EB; color:#6B7280; font-size:11px;">
        <p>${String(tf('pdf.invoice.footer')).replace(/MoneyFlow/gi, 'comptario').replace(/Comptario/g, 'comptario')}</p>
      </div>
    </div>
  `;
};




const buildExpenseHtml = (expense: Expense, lang?: string, currency?: Currency) => {
  const activeLang = normalizeLang(lang);
  const tf = (k: string) => i18n.t(k, { lng: activeLang });
  const dloc = localeFromLang(activeLang);
  const statusLabel = ({ draft: tf('pdf.expense.statusLabels.draft'), approved: tf('pdf.expense.statusLabels.approved'), paid: tf('pdf.expense.statusLabels.paid') } as Record<Expense['status'], string>)[expense.status];
  const activeCurrency: Currency = currency ?? getSelectedCurrency();
  const fmt = makeCurrencyFormatter(activeCurrency);
  return `
  <div style="max-width: 170mm; margin: 0 auto;">
    <div style="text-align: center; margin-bottom: 30px; border-bottom: 2px solid #DC2626; padding-bottom: 20px;">
      <h1 style="color: #DC2626; font-size: 28px; margin: 0;">Comptraio</h1>
      <p style="color: #6B7280; margin: 5px 0 0 0;">${String(tf('pdf.invoice.appSubtitle')).replace(/MoneyFlow/gi, 'Comptraio')}</p>
    </div>
    <div style="display: flex; justify-content: space-between; margin-bottom: 30px;">
      <div>
        <h2 style="color: #1F2937; font-size: 24px; margin: 0 0 10px 0;">${tf('pdf.expense.title')}</h2>
        <p style="margin: 5px 0;"><strong>${tf('pdf.expense.expenseNumber')}:</strong> ${expense.expenseNumber}</p>
  <p style="margin: 5px 0;"><strong>${tf('pdf.expense.expenseDate')}:</strong> ${formatDate(expense.expenseDate, dloc)}</p>
  ${expense.dueDate ? `<p style="margin: 5px 0;"><strong>${tf('pdf.expense.paymentDate')}:</strong> ${formatDate(expense.dueDate, dloc)}</p>` : ''}
        <p style="margin: 5px 0;"><strong>${tf('pdf.expense.status')}:</strong> ${statusLabel}</p>
      </div>
      <div style="text-align: right;">
        <h3 style="color: #1F2937; margin: 0 0 10px 0;">${tf('pdf.expense.supplierInfo')}</h3>
        <p style="margin: 5px 0;"><strong>${expense.supplier || i18n.t('common:noSupplier', { lng: activeLang })}</strong></p>
        <p style="margin: 5px 0; background-color: #FEF3C7; padding: 5px 10px; border-radius: 5px; display: inline-block;">
          <strong>${tf('pdf.expense.category')}:</strong> ${tf('expenseCategories.' + expense.category) || expense.category}
        </p>
      </div>
    </div>
    <div style="margin-bottom: 30px;">
      <h3 style="color: #1F2937; margin: 0 0 15px 0;">${tf('pdf.expense.details')}</h3>
      <div style="background-color: #F9FAFB; padding: 20px; border-radius: 8px; border: 1px solid #E5E7EB;">
        <p style="margin: 0; font-size: 16px; line-height: 1.5;">${expense.description}</p>
      </div>
    </div>
    <div style="background-color: #FEF2F2; border: 2px solid #FECACA; border-radius: 12px; padding: 25px; margin-bottom: 30px;">
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <span style="color: #991B1B; font-size: 20px; font-weight: bold;">${tf('pdf.expense.totalAmount')}:</span>
          <span style="color: #DC2626; font-size: 32px; font-weight: bold;">${fmt(expense.amount)}</span>
      </div>
    </div>
    <div style="text-align: center; margin-top: 48px; padding-top: 20px; padding-bottom: 8px; border-top: 1px solid #E5E7EB; color: #6B7280; font-size: 12px;">
      <p>${String(tf('pdf.expense.footer')).replace(/MoneyFlow/gi, 'Comptraio').replace(/comptario/gi, 'Comptraio')}</p>
    </div>
  </div>
`;
};

const buildSaleHtml = (sale: Sale, lang?: string, currency?: Currency) => {
  const activeLang = normalizeLang(lang);
  const tf = (k: string) => i18n.t(k, { lng: activeLang });
  const dloc = localeFromLang(activeLang);
  const statusLabel = ({ completed: tf('pdf.sale.statusLabels.completed'), pending: tf('pdf.sale.statusLabels.pending'), cancelled: tf('pdf.sale.statusLabels.cancelled') } as Record<Sale['status'], string>)[sale.status];
  const payName = sale.paymentMethod ? ({ cash: tf('pdf.sale.paymentMethods.cash'), card: tf('pdf.sale.paymentMethods.card'), transfer: tf('pdf.sale.paymentMethods.transfer'), check: tf('pdf.sale.paymentMethods.check') } as Record<NonNullable<Sale['paymentMethod']>, string>)[sale.paymentMethod] : undefined;
  const activeCurrency: Currency = currency ?? getSelectedCurrency();
  const fmt = makeCurrencyFormatter(activeCurrency);
  return `
  <div style="max-width: 170mm; margin: 0 auto;">
    <div style="text-align: center; margin-bottom: 30px; border-bottom: 2px solid #10B981; padding-bottom: 20px;">
  <h1 style="color: #10B981; font-size: 28px; margin: 0;">comptario</h1>
  <p style="color: #6B7280; margin: 5px 0 0 0;">${String(tf('pdf.invoice.appSubtitle')).replace(/MoneyFlow/gi, 'comptario')}</p>
    </div>
    <div style="display: flex; justify-content: space-between; margin-bottom: 30px;">
      <div>
        <h2 style="color: #1F2937; font-size: 24px; margin: 0 0 10px 0;">${tf('pdf.sale.title')}</h2>
        <p style="margin: 5px 0;"><strong>${tf('pdf.sale.saleNumber')}:</strong> ${sale.saleNumber || `SAL-${sale.id}`}</p>
  <p style="margin: 5px 0;"><strong>${tf('pdf.sale.saleDate')}:</strong> ${formatDate(sale.date, dloc)}</p>
        <p style="margin: 5px 0;"><strong>${tf('pdf.sale.status')}:</strong> ${statusLabel}</p>
  ${payName ? `<p style="margin: 5px 0;"><strong>${tf('pdf.sale.paymentMethod')}:</strong> ${payName}</p>` : ''}
      </div>
      <div style="text-align: right;">
        <h3 style="color: #1F2937; margin: 0 0 10px 0;">${tf('pdf.sale.customerInfo')}</h3>
        <p style="margin: 5px 0;"><strong>${sale.customerName}</strong></p>
        ${sale.customerEmail ? `<p style="margin: 5px 0;">${sale.customerEmail}</p>` : ''}
      </div>
    </div>
    <div style="margin-bottom: 30px;">
      <h3 style="color: #1F2937; margin: 0 0 15px 0;">${tf('pdf.sale.details')}</h3>
      <div style="background-color: #F0FDF4; padding: 20px; border-radius: 8px; border: 1px solid #BBF7D0;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
          <span style="font-size: 18px; font-weight: bold; color: #1F2937;">${sale.productName}</span>
        </div>
        ${sale.quantity && sale.unitPrice ? `
          <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
            <span style="color: #6B7280;">${tf('pdf.sale.quantity')}:</span>
            <span style="font-weight: bold;">${sale.quantity}</span>
          </div>
          <div style="display: flex; justify-content: space-between;">
            <span style="color: #6B7280;">${tf('pdf.sale.unitPrice')}:</span>
             <span style="font-weight: bold;">${fmt(sale.unitPrice)}</span>
          </div>
        ` : ''}
      </div>
    </div>
    <div style="background-color: #ECFDF5; border: 2px solid #BBF7D0; border-radius: 12px; padding: 25px; margin-bottom: 30px;">
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <span style="color: #065F46; font-size: 20px; font-weight: bold;">${tf('pdf.sale.totalAmount')}:</span>
          <span style="color: #10B981; font-size: 32px; font-weight: bold;">${fmt(sale.amount)}</span>
      </div>
    </div>
    <div style="text-align: center; margin-top: 40px; padding-top: 20px; border-top: 1px solid #E5E7EB; color: #6B7280; font-size: 12px;">
      <p>${String(tf('pdf.sale.footer')).replace(/MoneyFlow/gi, 'comptario').replace(/Comptario/g, 'comptario')}</p>
    </div>
  </div>
`;
};

// ——— DIŞA AÇIK API ———————————————————————————————
export const generateInvoicePDF = async (invoice: Invoice, opts: OpenOpts = {}) => {
  const html = buildInvoiceHtml(invoice, opts.company ?? {}, opts.lang, opts.currency);
  const blob = await htmlToPdfBlob(html);
  openPdfInWindow(blob, `${opts.filename ?? invoice.invoiceNumber ?? 'Invoice'}.pdf`, opts.targetWindow);
};

export const generateExpensePDF = async (expense: Expense, opts: OpenOpts = {}) => {
  const html = buildExpenseHtml(expense, opts.lang, opts.currency);
  const blob = await htmlToPdfBlob(html);
  openPdfInWindow(blob, `${opts.filename ?? expense.expenseNumber ?? 'Expense'}.pdf`, opts.targetWindow);
};

export const generateSalePDF = async (sale: Sale, opts: OpenOpts = {}) => {
  const html = buildSaleHtml(sale, opts.lang, opts.currency);
  const blob = await htmlToPdfBlob(html);
  openPdfInWindow(blob, `${opts.filename ?? (sale.saleNumber || `SAL-${sale.id}`)}.pdf`, opts.targetWindow);
};

// ===== QUOTE (TEKLIF) =====
export interface QuoteForPdfItem {
  description?: string;
  quantity?: number;
  unitPrice?: number;
  total?: number;
}

export interface QuoteForPdf {
  id: string;
  quoteNumber: string;
  customerName: string;
  customerId?: string;
  issueDate: string;
  validUntil?: string;
  status?: 'draft' | 'sent' | 'viewed' | 'accepted' | 'declined' | 'expired';
  currency?: Currency;
  total?: number;
  items?: QuoteForPdfItem[];
  // Yeni: İşin kapsamı zengin metin içeriği (HTML)
  scopeOfWorkHtml?: string;
}

const buildQuoteHtml = (
  quote: QuoteForPdf,
  c: Partial<CompanyProfile> = {},
  lang?: string,
  currency?: Currency,
  prepared?: { label: string; name?: string }
) => {
  const hasLogo = !!(c.logoDataUrl && /^data:image\//.test(c.logoDataUrl));
  const activeLang = normalizeLang(lang);
  const country: CountryCode = (c.country as CountryCode) || countryFromLang(activeLang);
  const dloc = localeFromLang(activeLang);
  const activeCurrency: Currency = currency ?? getSelectedCurrency();
  const fmt = makeCurrencyFormatter(activeCurrency);

  // Basit çok dilli metinler
  const L = {
    tr: {
      title: 'Teklif', appSubtitle: 'Teklif dökümanı', customerInfo: 'Müşteri Bilgileri',
      quoteNumber: 'Teklif No', issueDate: 'Düzenleme Tarihi', validUntil: 'Geçerlilik Tarihi', status: 'Durum',
      items: { description: 'Açıklama', quantity: 'Miktar', unitPrice: 'Birim Fiyat', total: 'Toplam' },
      totals: { grandTotal: 'Genel Toplam' }, footer: 'Bu belge bilgi amaçlıdır.'
    },
    en: {
      title: 'Quote', appSubtitle: 'Quotation document', customerInfo: 'Customer Information',
      quoteNumber: 'Quote No', issueDate: 'Issue Date', validUntil: 'Valid Until', status: 'Status',
      items: { description: 'Description', quantity: 'Qty', unitPrice: 'Unit Price', total: 'Total' },
      totals: { grandTotal: 'Grand Total' }, footer: 'This document is for information purposes.'
    },
    fr: {
      title: 'Devis', appSubtitle: 'Document de devis', customerInfo: 'Informations client',
      quoteNumber: 'N° de devis', issueDate: 'Date', validUntil: 'Valable jusqu’au', status: 'Statut',
      items: { description: 'Description', quantity: 'Qté', unitPrice: 'Prix unitaire', total: 'Total' },
      totals: { grandTotal: 'Total général' }, footer: 'Document à titre indicatif.'
    },
    de: {
      title: 'Angebot', appSubtitle: 'Angebotsdokument', customerInfo: 'Kundeninformationen',
      quoteNumber: 'Angebotsnr.', issueDate: 'Datum', validUntil: 'Gültig bis', status: 'Status',
      items: { description: 'Beschreibung', quantity: 'Menge', unitPrice: 'Einzelpreis', total: 'Summe' },
      totals: { grandTotal: 'Gesamtsumme' }, footer: 'Dieses Dokument dient nur zur Information.'
    }
  }[activeLang];

  const companyBlock = `
    <div>
      <div style="font-size:18px;font-weight:700;color:#111827;">${c.name ?? ''}</div>
      ${c.address ? `<div style="font-size:12px;color:#4B5563;white-space:pre-line;margin-top:2px;">${c.address}</div>` : ''}
      ${buildLegalFieldsHtml(c, country)}
      ${c.iban ? `<div style="font-size:11px;color:#111827;margin-top:4px;"><strong>IBAN:</strong> ${formatIban(c.iban)}</div>` : ''}
      ${c.phone ? `<div style="font-size:11px;color:#111827;margin-top:2px;"><strong>Tel:</strong> ${c.phone}</div>` : ''}
      ${c.email ? `<div style="font-size:11px;color:#111827;margin-top:2px;"><strong>Email:</strong> ${c.email}</div>` : ''}
      ${c.website ? `<div style="font-size:11px;color:#111827;margin-top:2px;"><strong>Web:</strong> ${c.website}</div>` : ''}
    </div>
  `;

  // Müşteri bilgilerini customers_cache üzerinden zenginleştir
  let customerEmail = '';
  let customerPhone = '';
  let customerAddress = '';
  try {
    const raw = localStorage.getItem('customers_cache');
    const arr = raw ? (JSON.parse(raw) as any[]) : [];
    const found = Array.isArray(arr) ? arr.find((c: any) => (quote.customerId && String(c.id) === String(quote.customerId)) || (c.name === quote.customerName)) : null;
    if (found) {
      customerEmail = found.email || '';
      customerPhone = found.phone || '';
      customerAddress = found.address || '';
    }
  } catch {}

  const customerBlock = `
    <div style="text-align:right;">
      <h3 style="color:#1F2937;margin:0 0 6px 0;">${L.customerInfo}</h3>
      <div style="font-weight:700;margin-bottom:2px;">${quote.customerName}</div>
      ${customerEmail ? `<div style="font-size:12px;margin-top:2px;">${customerEmail}</div>` : ''}
  ${customerPhone ? `<div style="font-size:12px;margin-top:2px;">${customerPhone}</div>` : ''}
      ${customerAddress ? `<div style="font-size:12px;margin-top:2px;white-space:pre-line;">${customerAddress}</div>` : ''}
    </div>
  `;

  const items = Array.isArray(quote.items) ? quote.items : [];
  const computedTotal = items.reduce((sum, it) => sum + (toNum(it.total) || (toNum(it.unitPrice) * toNum(it.quantity))), 0);
  const totalVal = toNum(quote.total) || computedTotal;
        const statusLabel = (() => {
          const s = String(quote.status || '').toLowerCase();
          switch (activeLang) {
            case 'tr':
              return s === 'accepted' ? 'Kabul Edildi' : s === 'declined' ? 'Reddedildi' : s === 'sent' ? 'Gönderildi' : s === 'viewed' ? 'Görüntülendi' : s === 'expired' ? 'Süresi Doldu' : 'Taslak';
            case 'fr':
              return s === 'accepted' ? 'Accepté' : s === 'declined' ? 'Refusé' : s === 'sent' ? 'Envoyé' : s === 'viewed' ? 'Consulté' : s === 'expired' ? 'Expiré' : 'Brouillon';
            case 'de':
              return s === 'accepted' ? 'Akzeptiert' : s === 'declined' ? 'Abgelehnt' : s === 'sent' ? 'Gesendet' : s === 'viewed' ? 'Gesehen' : s === 'expired' ? 'Abgelaufen' : 'Entwurf';
            default:
              return s || '';
          }
        })();
  const validityDays = (() => {
    if (quote.validUntil) {
      try {
        const start = new Date(quote.issueDate).getTime();
        const end = new Date(quote.validUntil).getTime();
        const diff = Math.round((end - start) / 86400000);
        return diff > 0 ? diff : 30;
      } catch { return 30; }
    }
    return 30;
  })();

  const scopeTitle = (() => {
    switch (activeLang) {
      case 'tr': return 'İşin Kapsamı';
      case 'fr': return 'Périmètre des travaux';
      case 'de': return 'Leistungsumfang';
      default: return 'Scope of Work';
    }
  })();

  const mainHtml = `
    <div style="max-width:170mm;margin:0 auto;padding-top:22mm;padding-bottom:12mm;display:flex;flex-direction:column;min-height:263mm;box-sizing:border-box;">
      <div style="display:flex;justify-content:space-between;align-items:flex-end;gap:16px;border-bottom:2px solid #6366F1;padding-bottom:12px;">
        <div style="display:flex;align-items:flex-end;">
          ${hasLogo ? `<img src="${c.logoDataUrl}" alt="logo" style="height:${PDF_LOGO_HEIGHT_PX}px;width:auto;display:block;object-fit:contain;transform:translateY(6px);" />` : ''}
        </div>
        <div style="text-align:right;line-height:1;">
          <div style="color:#6366F1;font-size:28px;font-weight:800;">${L.title}</div>
          <div style="color:#6B7280;font-size:12px;margin-top:4px;">${L.appSubtitle}</div>
        </div>
      </div>

      <div style="display:flex;justify-content:space-between;gap:24px;margin:16px 0 18px 0;">
        <div>${companyBlock}</div>
        <div>${customerBlock}</div>
      </div>

      <div style="display:flex;justify-content:space-between;margin-bottom:18px;">
        <div>
          <p style="margin:4px 0;"><strong>${L.quoteNumber}:</strong> ${quote.quoteNumber}</p>
          <p style="margin:4px 0;"><strong>${L.issueDate}:</strong> ${formatDate(quote.issueDate, dloc)}</p>
          ${quote.validUntil ? `<p style="margin:4px 0;"><strong>${L.validUntil}:</strong> ${formatDate(quote.validUntil, dloc)}</p>` : ''}
          ${quote.status ? `<p style="margin:4px 0;"><strong>${L.status}:</strong> ${statusLabel}</p>` : ''}
        </div>
        <div></div>
      </div>

      <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
        <thead>
          <tr style="background-color:#F3F4F6;">
            <th style="border:1px solid #D1D5DB;padding:10px;text-align:left;">${L.items.description}</th>
            <th style="border:1px solid #D1D5DB;padding:10px;text-align:center;">${L.items.quantity}</th>
            <th style="border:1px solid #D1D5DB;padding:10px;text-align:right;">${L.items.unitPrice}</th>
            <th style="border:1px solid #D1D5DB;padding:10px;text-align:right;">${L.items.total}</th>
          </tr>
        </thead>
        <tbody>
          ${items.map((it) => `
            <tr>
              <td style="border:1px solid #D1D5DB;padding:10px;">${it.description ?? ''}</td>
              <td style="border:1px solid #D1D5DB;padding:10px;text-align:center;">${it.quantity ?? ''}</td>
              <td style="border:1px solid #D1D5DB;padding:10px;text-align:right;">${fmt(it.unitPrice)}</td>
              <td style="border:1px solid #D1D5DB;padding:10px;text-align:right;">${fmt(toNum(it.total) || (toNum(it.unitPrice) * toNum(it.quantity)))}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      <div style="display:flex;justify-content:flex-end;margin-bottom:24px;" data-avoid-split="true">
        <div style="width:300px;">
          <div style="display:flex;justify-content:space-between;padding:12px 0;font-weight:bold;font-size:18px;border-top:2px solid #1F2937;">
            <span>${L.totals.grandTotal}:</span><span>${fmt(totalVal)}</span>
          </div>
        </div>
      </div>

      <!-- Açıklamalar -->
      <div style="margin-top:12px;" data-avoid-split="true">
        <h4 style="margin:0 0 6px 0;color:#111827;">${activeLang === 'tr' ? 'AÇIKLAMA' : activeLang === 'fr' ? 'REMARQUES' : activeLang === 'de' ? 'ANMERKUNGEN' : 'NOTES'}</h4>
        <div style="margin:0;padding-left:0;color:#111827;">
          <div style="margin:4px 0;">1. ${activeLang === 'tr' ? 'Teklifimiz KDV hariç olarak paylaşılmıştır.' : activeLang === 'fr' ? 'Notre offre est indiquée hors TVA.' : activeLang === 'de' ? 'Unser Angebot ist exkl. MwSt.' : 'Our offer is exclusive of VAT.'}</div>
          <div style="margin:4px 0;">2. ${activeLang === 'tr' ? `Teklifimiz ${validityDays} gün geçerlidir.` : activeLang === 'fr' ? `Notre offre est valable ${validityDays} jours.` : activeLang === 'de' ? `Unser Angebot ist ${validityDays} Tage gültig.` : `Our offer is valid for ${validityDays} days.`}</div>
        </div>
      </div>
      
  ${prepared?.name ? `<div style="text-align:right;margin-top:24px;font-size:12px;color:#111827;" data-avoid-split="true"><strong>${prepared.label}:</strong> ${prepared.name}</div>` : ''}
      
    </div>
  `;
  // İşin kapsamı sayfası (varsa) — yeni bir sayfadan başlat
  const scopeHtml = (() => {
    const raw = quote.scopeOfWorkHtml || '';
    if (!raw) return '';
    // RTE içeriğini geniş izinlerle temizle (img/data URI vb.)
    const safe = DOMPurify.sanitize(raw, {
      ALLOWED_TAGS: ['h1','h2','h3','h4','h5','h6','p','br','strong','b','em','i','u','s','code','pre','blockquote','hr','ul','ol','li','a','img','table','thead','tbody','tr','th','td'],
      ALLOWED_ATTR: ['href','target','rel','src','alt','title','colspan','rowspan'],
      ALLOW_DATA_ATTR: false,
      ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|ftp|tel|file|sms|cid|data):|[^a-z]|[a-z+.-]+(?:[^a-z+.-]|$))/i,
      FORBID_TAGS: ['script','style']
    });
    return `
  <div data-force-new-page="true" data-scope="true" style="max-width:170mm;margin:0 auto;min-height:263mm;box-sizing:border-box;padding:2mm 0 10mm;">
        <style>
          .rte-scope table { width: 100%; border-collapse: collapse; }
          .rte-scope th, .rte-scope td { border: 1px solid #D1D5DB; padding: 6px; }
          .rte-scope thead th { background: #F9FAFB; }
          .rte-scope blockquote { border-left: 3px solid #E5E7EB; padding-left: 8px; color: #111827; }
          .rte-scope pre { background: #111827; color: #F3F4F6; padding: 8px 10px; border-radius: 6px; }
          .rte-scope img { max-width: 100%; height: auto; border-radius: 4px; }
        </style>
        <div style="border-bottom:2px solid #E5E7EB; padding-bottom:8px; margin-bottom:12px;">
          <div style="font-size:22px;font-weight:800;color:#111827;">${scopeTitle}</div>
          <div style="color:#6B7280;font-size:12px;margin-top:2px;">${L.appSubtitle}</div>
        </div>
        <div class="rte-scope" style="font-size:12.5px;color:#111827;line-height:1.6;">${safe}</div>
      </div>
    `;
  })();

  return { mainHtml, scopeHtml };
};

export const generateQuotePDF = async (quote: QuoteForPdf, opts: OpenOpts & { preparedByName?: string } = {}) => {
  let company: Partial<CompanyProfile> | undefined = opts.company;
  if (!company) {
    try {
      const tid = (localStorage.getItem('tenantId') || '').toString();
      const secureKey = tid ? `companyProfile_${tid}` : 'companyProfile';
      company = await secureStorage.getJSON<CompanyProfile>(secureKey) ?? undefined;
      if (!company) {
        const baseKey = tid ? `companyProfile_${tid}` : 'companyProfile';
        const raw = localStorage.getItem(baseKey) || localStorage.getItem(`${baseKey}_plain`) || localStorage.getItem('company');
        if (raw) company = JSON.parse(raw);
      }
    } catch {
      try {
        const raw = localStorage.getItem('companyProfile') || localStorage.getItem('company');
        if (raw) company = JSON.parse(raw);
      } catch {}
    }
  }

  // Hazırlayan adı localStorage'daki user'dan
  let preparedBy = opts.preparedByName;
  if (!preparedBy) {
    try {
      const raw = localStorage.getItem('user');
      if (raw) {
        const u = JSON.parse(raw);
        preparedBy = [u.firstName, u.lastName].filter(Boolean).join(' ') || u.email;
      }
    } catch { /* ignore */ }
  }

  const label = (() => { const l = normalizeLang(opts.lang); return l === 'tr' ? 'Teklifi Hazırlayan' : l === 'fr' ? 'Préparé par' : l === 'de' ? 'Erstellt von' : 'Prepared by'; })();
  const { mainHtml, scopeHtml } = buildQuoteHtml(quote, company ?? {}, opts.lang, opts.currency, { label, name: preparedBy });

  // Segment bazlı render: ürün sayfası + kapsam (varsaysa) ayrı segmentler
  const blob = await htmlSegmentsToPdfBlob([mainHtml, scopeHtml].filter(Boolean));
  openPdfInWindow(blob, `${opts.filename ?? quote.quoteNumber ?? 'Quote'}.pdf`, opts.targetWindow);
};
