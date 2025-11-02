// src/utils/pdfGenerator.ts
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import DOMPurify from 'dompurify';
import i18n from '../i18n/config';

// ——— Tipler ——————————————————————————————————————
interface Invoice {
  id: string;
  invoiceNumber: string;
  customerName: string;
  customerEmail: string;
  customerAddress: string;
  total: number;
  subtotal: number;
  taxAmount: number;
  status: 'draft' | 'sent' | 'paid' | 'overdue';
  issueDate: string;
  dueDate: string;
  items: any[];
  notes?: string;
  type?: 'product' | 'service';
}

interface Expense {
  id: string;
  expenseNumber: string;
  description: string;
  supplier: string;
  amount: number;
  category: string;
  status: 'draft' | 'approved' | 'paid';
  expenseDate: string;
  dueDate: string;
  receiptUrl?: string;
}

interface Sale {
  id: string;
  saleNumber?: string;
  customerName: string;
  customerEmail?: string;
  productName: string;
  quantity?: number;
  unitPrice?: number;
  amount: number;
  status: 'completed' | 'pending' | 'cancelled';
  date: string;
  paymentMethod?: 'cash' | 'card' | 'transfer' | 'check';
  notes?: string;
}

export type CompanyProfile = {
  name?: string;
  address?: string;
  taxNumber?: string;
  taxOffice?: string;
  phone?: string;
  email?: string;
  website?: string;
  logoDataUrl?: string; // data:image/png;base64,...
  iban?: string;
  bankAccountId?: string;
  // Ülke seçimi (dilden bağımsız PDF ve ayarlar için)
  country?: 'TR' | 'US' | 'DE' | 'FR' | 'OTHER';
  
  // === Türkiye Yasal Alanları ===
  mersisNumber?: string;
  kepAddress?: string;
  
  // === Fransa Yasal Alanları ===
  siretNumber?: string;
  sirenNumber?: string;
  apeCode?: string;
  tvaNumber?: string;
  rcsNumber?: string;
  
  // === Almanya Yasal Alanları ===
  steuernummer?: string;
  umsatzsteuerID?: string;
  handelsregisternummer?: string;
  geschaeftsfuehrer?: string;
  
  // === Amerika Yasal Alanları ===
  einNumber?: string;
  taxId?: string;
  businessLicenseNumber?: string;
  stateOfIncorporation?: string;

  // === Diğer Ülkeler (genel alanlar) ===
  registrationNumber?: string; // Ticaret sicil / kayıt no
  vatNumberGeneric?: string;   // KDV/VAT no
  taxIdGeneric?: string;       // Vergi kimliği
  stateOrRegion?: string;      // Eyalet/Bölge/İl
};

type OpenOpts = { targetWindow?: Window | null; filename?: string; company?: CompanyProfile; lang?: string; currency?: Currency };
type Currency = 'TRY' | 'USD' | 'EUR';

// ——— Yardımcılar ——————————————————————————————————

const formatDate = (dateString: string, locale?: string) => {
  try { return new Date(dateString).toLocaleDateString(locale || 'tr-TR'); } catch { return ''; }
};

// Not: Eski formatAmount kullanılmıyor; geriye dönük kalabilir, ancak uyarıyı önlemek için kaldırıyoruz.

// Para birimi belirleme ve biçimlendirme yardımcıları (Context ile uyumlu mantık)
const toNum = (v: any): number => {
  if (v == null) return 0;
  if (typeof v === 'number' && isFinite(v)) return v;
  const s = String(v).replace(/[^0-9+\-.,]/g, '');
  // virgül/nokta varyasyonlarına karşı basit normalize
  const normalized = s.includes(',') && !s.includes('.') ? s.replace(',', '.') : s;
  const n = Number(normalized);
  return Number.isFinite(n) ? n : 0;
};
const getSelectedCurrency = (): Currency => {
  try {
    const saved = localStorage.getItem('currency') as Currency | null;
    if (saved === 'TRY' || saved === 'USD' || saved === 'EUR') return saved;
  } catch {}
  return 'TRY';
};

const getCurrencySymbol = (cur: Currency): string => {
  switch (cur) {
    case 'TRY': return '₺';
    case 'USD': return '$';
    case 'EUR': return '€';
    default: return '₺';
  }
};

const makeCurrencyFormatter = (cur: Currency) => (amount: any): string => {
  const safe = toNum(amount);
  const symbol = getCurrencySymbol(cur);
  switch (cur) {
    case 'TRY':
      return `${symbol}${safe.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    case 'USD':
    case 'EUR':
      return `${symbol}${safe.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    default:
      return `${symbol}${safe.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
};

const formatIban = (v?: string) => (v || '').replace(/\s+/g, '').replace(/(.{4})/g, '$1 ').trim();

// Dil -> Ülke eşlemesi (SettingsPage ile aynı mantık)
type SettingsLanguage = 'tr' | 'en' | 'fr' | 'de';
type CountryCode = 'TR' | 'FR' | 'DE' | 'US' | 'OTHER';

const normalizeLang = (lang?: string): SettingsLanguage => {
  const raw = (lang || i18n?.language || 'en').toLowerCase();
  const two = raw.substring(0, 2) as SettingsLanguage;
  return (['tr', 'en', 'fr', 'de'] as const).includes(two) ? two : 'en';
};

const countryFromLang = (lang: SettingsLanguage): CountryCode => {
  switch (lang) {
    case 'tr': return 'TR';
    case 'fr': return 'FR';
    case 'de': return 'DE';
    default: return 'US';
  }
};

const localeFromLang = (lang: SettingsLanguage): string => {
  switch (lang) {
    case 'tr': return 'tr-TR';
    case 'fr': return 'fr-FR';
    case 'de': return 'de-DE';
    default: return 'en-US';
  }
};

const buildLegalFieldsHtml = (c: CompanyProfile, country: CountryCode) => {
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

// HTML → PDF (jsPDF.html) → Blob
// 1) HTML → (html2canvas) → Çok sayfalı PDF Blob
const htmlToPdfBlob = async (html: string): Promise<Blob> => {
  // Ekran dışında ama ölçüleri stabil bir konteyner kuralım
  const tempDiv = document.createElement('div');
  Object.assign(tempDiv.style, {
    position: 'absolute',
    left: '-10000px',
    top: '0',
    width: '794px',            // A4 genişliği @96dpi ≈ 794px (8.27in * 96)
    background: '#ffffff',
    fontFamily: 'Arial, sans-serif',
  } as CSSStyleDeclaration);
  // XSS koruması: HTML içeriğini sanitize et
  tempDiv.innerHTML = DOMPurify.sanitize(html);
  document.body.appendChild(tempDiv);

  try {
    // Yüksek kaliteli canvas
    const canvas = await html2canvas(tempDiv, {
      scale: 2,                 // kalite
      backgroundColor: '#ffffff',
      useCORS: true,
      allowTaint: true,
      windowWidth: tempDiv.scrollWidth || 794,
      windowHeight: tempDiv.scrollHeight || tempDiv.clientHeight || 1123,
    });

    // jsPDF ölçüleri (mm)
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pdfW = pdf.internal.pageSize.getWidth();     // 210mm
    const pdfH = pdf.internal.pageSize.getHeight();    // 297mm

    // Canvas → PDF’e ölçek
    const imgW = canvas.width;
    const imgH = canvas.height;
    const ratio = pdfW / imgW;
    const pageCanvasHeightPx = Math.floor(pdfH / ratio); // Bir PDF sayfasına sığacak piksel yüksekliği

    // Büyük canvas’ı sayfa sayfa dilimle
    let rendered = 0;
    const pageCanvas = document.createElement('canvas');
    const ctx = pageCanvas.getContext('2d')!;
    pageCanvas.width = imgW;

    while (rendered < imgH) {
      const sliceH = Math.min(pageCanvasHeightPx, imgH - rendered);
      pageCanvas.height = sliceH;

      // Ana canvas’tan bir dilim kopyala
      ctx.clearRect(0, 0, imgW, sliceH);
      ctx.drawImage(
        canvas,
        0, rendered,           // kaynaktaki üst başlangıç (sx, sy)
        imgW, sliceH,          // kaynak genişlik-yükseklik
        0, 0,                  // hedef başlangıç (dx, dy)
        imgW, sliceH           // hedef genişlik-yükseklik
      );

      const imgData = pageCanvas.toDataURL('image/png');

      // Sayfaya ekle
      if (rendered > 0) pdf.addPage();
      pdf.addImage(imgData, 'PNG', 0, 0, pdfW, sliceH * ratio);

      rendered += sliceH;
    }

    const blob = pdf.output('blob');
    // Debug için istersen:
    console.log('PDF boyutu (byte):', blob.size);
    return blob;
  } finally {
    document.body.removeChild(tempDiv);
  }
};

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
      targetWindow.addEventListener('unload', () => { try { URL.revokeObjectURL(url); } catch {} }, { once: true });
      return;
    } catch { /* anchor fallback'e geç */ }
  }

  // Öncelik: yeni sekme açıp PDF’i görüntülemek
  try {
    const w = window.open(url, '_blank', 'noopener');
    if (w) {
      setTimeout(() => { try { URL.revokeObjectURL(url); } catch {} }, 10000);
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
    setTimeout(() => { try { URL.revokeObjectURL(url); } catch {} }, 10000);
    return;
  } catch { /* devam */ }

  // Son çare: aynı sekmeye yönlendir
  try { window.location.href = url; } catch {}
};


// ——— ŞABLON ÜRETİCİLERİ ———————————————————————
const buildInvoiceHtml = (invoice: Invoice, c: CompanyProfile = {}, lang?: string, currency?: Currency) => {
  const hasLogo = !!c.logoDataUrl;
  const activeLang = normalizeLang(lang);
  // Öncelik: şirket ayarlarındaki ülke; yoksa dilden türet
  const country: CountryCode = (c.country as CountryCode) || countryFromLang(activeLang);
  const tf = (k: string) => i18n.t(k, { lng: activeLang });
  const activeCurrency: Currency = currency ?? getSelectedCurrency();
  const fmt = makeCurrencyFormatter(activeCurrency);
  const dloc = localeFromLang(activeLang);

  // Toplamları güvenli biçimde hesapla
  const items = Array.isArray(invoice.items) ? invoice.items : [];
  const computedSubtotal = items.reduce((sum, it: any) => {
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

  const customerBlock = `
    <div style="text-align:right;">
      <h3 style="color:#1F2937;margin:0 0 6px 0;">${tf('pdf.invoice.customerInfo')}</h3>
      <div style="font-weight:700;margin-bottom:2px;">${invoice.customerName}</div>
      ${invoice.customerEmail ? `<div style="margin-bottom:2px;">${invoice.customerEmail}</div>` : ''}
      ${invoice.customerAddress ? `<div>${invoice.customerAddress}</div>` : ''}
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
      padding-top:22mm; padding-bottom:12mm;
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
            style="height:144px;width:auto;display:block;object-fit:contain;transform:translateY(6px);" />` : ''}
        </div>
        <div style="text-align:right; line-height:1;">
          <div style="color:#3B82F6; font-size:28px; font-weight:800;">${tf('pdf.invoice.title')}</div>
          <div style="color:#6B7280; font-size:12px; margin-top:4px;">${tf('pdf.invoice.appSubtitle')}</div>
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
          ${(invoice.items ?? []).map((item: any) => `
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
        <p>${tf('pdf.invoice.footer')}</p>
      </div>
    </div>
  `;
};




const buildExpenseHtml = (expense: Expense, lang?: string, currency?: Currency) => {
  const activeLang = normalizeLang(lang);
  const tf = (k: string) => i18n.t(k, { lng: activeLang });
  const dloc = localeFromLang(activeLang);
  const statusLabel = ({ draft: tf('pdf.expense.statusLabels.draft'), approved: tf('pdf.expense.statusLabels.approved'), paid: tf('pdf.expense.statusLabels.paid') } as any)[expense.status];
  const activeCurrency: Currency = currency ?? getSelectedCurrency();
  const fmt = makeCurrencyFormatter(activeCurrency);
  return `
  <div style="max-width: 170mm; margin: 0 auto;">
    <div style="text-align: center; margin-bottom: 30px; border-bottom: 2px solid #DC2626; padding-bottom: 20px;">
      <h1 style="color: #DC2626; font-size: 28px; margin: 0;">MoneyFlow</h1>
      <p style="color: #6B7280; margin: 5px 0 0 0;">${tf('pdf.invoice.appSubtitle')}</p>
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
        <p style="margin: 5px 0;"><strong>${expense.supplier}</strong></p>
        <p style="margin: 5px 0; background-color: #FEF3C7; padding: 5px 10px; border-radius: 5px; display: inline-block;">
          <strong>${tf('pdf.expense.category')}:</strong> ${expense.category}
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
    <div style="text-align: center; margin-top: 40px; padding-top: 20px; border-top: 1px solid #E5E7EB; color: #6B7280; font-size: 12px;">
  <p>${tf('pdf.expense.footer')}</p>
  <p style="margin-top: 10px;">${formatDate(new Date().toISOString(), dloc)}</p>
    </div>
  </div>
`;
};

const buildSaleHtml = (sale: Sale, lang?: string, currency?: Currency) => {
  const activeLang = normalizeLang(lang);
  const tf = (k: string) => i18n.t(k, { lng: activeLang });
  const dloc = localeFromLang(activeLang);
  const statusLabel = ({ completed: tf('pdf.sale.statusLabels.completed'), pending: tf('pdf.sale.statusLabels.pending'), cancelled: tf('pdf.sale.statusLabels.cancelled') } as any)[sale.status];
  const payName = sale.paymentMethod ? ({ cash: tf('pdf.sale.paymentMethods.cash'), card: tf('pdf.sale.paymentMethods.card'), transfer: tf('pdf.sale.paymentMethods.transfer'), check: tf('pdf.sale.paymentMethods.check') } as any)[sale.paymentMethod] : undefined;
  const activeCurrency: Currency = currency ?? getSelectedCurrency();
  const fmt = makeCurrencyFormatter(activeCurrency);
  return `
  <div style="max-width: 170mm; margin: 0 auto;">
    <div style="text-align: center; margin-bottom: 30px; border-bottom: 2px solid #10B981; padding-bottom: 20px;">
      <h1 style="color: #10B981; font-size: 28px; margin: 0;">MoneyFlow</h1>
      <p style="color: #6B7280; margin: 5px 0 0 0;">${tf('pdf.invoice.appSubtitle')}</p>
    </div>
    <div style="display: flex; justify-content: space-between; margin-bottom: 30px;">
      <div>
        <h2 style="color: #1F2937; font-size: 24px; margin: 0 0 10px 0;">${tf('pdf.sale.title')}</h2>
        <p style="margin: 5px 0;"><strong>${tf('pdf.sale.saleNumber')}:</strong> ${sale.saleNumber || `SAL-${sale.id}`}</p>
  <p style="margin: 5px 0;"><strong>${tf('pdf.sale.saleDate')}:</strong> ${formatDate(sale.date, dloc)}</p>
        <p style="margin: 5px 0;"><strong>${tf('pdf.sale.status')}:</strong> ${statusLabel}</p>
        ${payName ? `<p style=\"margin: 5px 0;\"><strong>${tf('pdf.sale.paymentMethod')}:</strong> ${payName}</p>` : ''}
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
  <p>${tf('pdf.sale.footer')}</p>
  <p style="margin-top: 10px;">${formatDate(new Date().toISOString(), dloc)}</p>
    </div>
  </div>
`;
};

// ——— DIŞA AÇIK API ———————————————————————————————
export const generateInvoicePDF = async (invoice: Invoice, opts: OpenOpts = {}) => {
  const html = buildInvoiceHtml(invoice, opts.company ?? {}, opts.lang, (opts as any).currency);
  const blob = await htmlToPdfBlob(html);
  openPdfInWindow(blob, `${opts.filename ?? invoice.invoiceNumber ?? 'Invoice'}.pdf`, opts.targetWindow);
};

export const generateExpensePDF = async (expense: Expense, opts: OpenOpts = {}) => {
  const html = buildExpenseHtml(expense, opts.lang, (opts as any).currency);
  const blob = await htmlToPdfBlob(html);
  openPdfInWindow(blob, `${opts.filename ?? expense.expenseNumber ?? 'Expense'}.pdf`, opts.targetWindow);
};

export const generateSalePDF = async (sale: Sale, opts: OpenOpts = {}) => {
  const html = buildSaleHtml(sale, opts.lang, (opts as any).currency);
  const blob = await htmlToPdfBlob(html);
  openPdfInWindow(blob, `${opts.filename ?? (sale.saleNumber || `SAL-${sale.id}`)}.pdf`, opts.targetWindow);
};
