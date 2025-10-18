// src/utils/pdfGenerator.ts
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

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
};

type OpenOpts = { targetWindow?: Window | null; filename?: string; company?: CompanyProfile };

// ——— Yardımcılar ——————————————————————————————————
const mm = (v: number) => v; // sadeleştirme

const formatDate = (dateString: string) => {
  try { return new Date(dateString).toLocaleDateString('tr-TR'); } catch { return ''; }
};

const formatAmount = (amount: number) => {
  const n = Number(amount);
  const safe = Number.isFinite(n) ? n : 0;
  return `₺${safe.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}`;
};

const formatIban = (v?: string) => (v || '').replace(/\s+/g, '').replace(/(.{4})/g, '$1 ').trim();

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
  tempDiv.innerHTML = html;
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
const openPdfInWindow = (pdfData: Blob | string, filename: string, targetWindow?: Window | null) => {
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

  // Programatik anchor → yeni sekme (genelde pop-up sayılmaz)
  try {
    const a = document.createElement('a');
    a.href = url;
    a.target = '_blank';
    a.rel = 'noopener';
    // a.download = filename; // görüntülemek yerine indirmeye zorlamak istersen aç
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
const buildInvoiceHtml = (invoice: Invoice, c: CompanyProfile = {}) => {
  const hasLogo = !!c.logoDataUrl;

  const companyBlock = `
    <div>
      <div style="font-size:18px;font-weight:700;color:#111827;">${c.name ?? ''}</div>
      ${c.address ? `<div style="font-size:12px;color:#4B5563;white-space:pre-line;margin-top:2px;">${c.address}</div>` : ''}

      ${c.taxNumber ? `<div style="font-size:12px;color:#111827;margin-top:6px;"><strong>VKN:</strong> ${c.taxNumber}</div>` : ''}
      ${c.iban ? `<div style="font-size:12px;color:#111827;margin-top:4px;"><strong>IBAN:</strong> ${formatIban(c.iban)}</div>` : ''}

      ${c.phone ? `<div style="font-size:12px;color:#111827;margin-top:4px;"><strong>Tel:</strong> ${c.phone}</div>` : ''}
      ${c.email ? `<div style="font-size:12px;color:#111827;margin-top:2px;"><strong>Email:</strong> ${c.email}</div>` : ''}
    </div>
  `;

  const customerBlock = `
    <div style="text-align:right;">
      <h3 style="color:#1F2937;margin:0 0 6px 0;">Müşteri Bilgileri</h3>
      <div style="font-weight:700;margin-bottom:2px;">${invoice.customerName}</div>
      ${invoice.customerEmail ? `<div style="margin-bottom:2px;">${invoice.customerEmail}</div>` : ''}
      ${invoice.customerAddress ? `<div>${invoice.customerAddress}</div>` : ''}
    </div>
  `;

  const statusTR =
    invoice.status === 'paid' ? 'Ödendi' :
    invoice.status === 'sent' ? 'Gönderildi' :
    invoice.status === 'overdue' ? 'Gecikmiş' : 'Taslak';

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
          <div style="color:#3B82F6; font-size:28px; font-weight:800;">FATURA</div>
          <div style="color:#6B7280; font-size:12px; margin-top:4px;">MoneyFlow Muhasebe Sistemi</div>
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
          <p style="margin:4px 0;"><strong>Fatura No:</strong> ${invoice.invoiceNumber}</p>
          <p style="margin:4px 0;"><strong>Düzenleme Tarihi:</strong> ${formatDate(invoice.issueDate)}</p>
          <p style="margin:4px 0;"><strong>Vade Tarihi:</strong> ${formatDate(invoice.dueDate)}</p>
          <p style="margin:4px 0;"><strong>Durum:</strong> ${statusTR}</p>
        </div>
        <div></div>
      </div>

      <!-- Kalem tablosu -->
      <table style="width:100%; border-collapse:collapse; margin-bottom:24px;">
        <thead>
          <tr style="background-color:#F3F4F6;">
            <th style="border:1px solid #D1D5DB; padding:10px; text-align:left;">Açıklama</th>
            <th style="border:1px solid #D1D5DB; padding:10px; text-align:center;">Miktar</th>
            <th style="border:1px solid #D1D5DB; padding:10px; text-align:right;">Birim Fiyat</th>
            <th style="border:1px solid #D1D5DB; padding:10px; text-align:right;">Toplam</th>
          </tr>
        </thead>
        <tbody>
          ${(invoice.items ?? []).map((item: any) => `
            <tr>
              <td style="border:1px solid #D1D5DB; padding:10px;">${item.description ?? ''}</td>
              <td style="border:1px solid #D1D5DB; padding:10px; text-align:center;">${item.quantity ?? ''}</td>
              <td style="border:1px solid #D1D5DB; padding:10px; text-align:right;">${formatAmount(item.unitPrice ?? 0)}</td>
              <td style="border:1px solid #D1D5DB; padding:10px; text-align:right;">${formatAmount(item.total ?? 0)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      <!-- Toplamlar -->
      <div style="display:flex; justify-content:flex-end; margin-bottom:24px;">
        <div style="width:300px;">
          <div style="display:flex; justify-content:space-between; padding:8px 0; border-bottom:1px solid #E5E7EB;">
            <span>Ara Toplam:</span><span>${formatAmount(invoice.subtotal)}</span>
          </div>
          <div style="display:flex; justify-content:space-between; padding:8px 0; border-bottom:1px solid #E5E7EB;">
            <span>KDV (%18):</span><span>${formatAmount(invoice.taxAmount)}</span>
          </div>
          <div style="display:flex; justify-content:space-between; padding:12px 0; font-weight:bold; font-size:18px; border-top:2px solid #1F2937;">
            <span>Genel Toplam:</span><span>${formatAmount(invoice.total)}</span>
          </div>
        </div>
      </div>

      <!-- Footer: sayfanın dibinde -->
      <div style="text-align:center; margin-top:auto; padding-top:16px; border-top:1px solid #E5E7EB; color:#6B7280; font-size:11px;">
        <p>Bu fatura MoneyFlow ile oluşturulmuştur.</p>
      </div>
    </div>
  `;
};




const buildExpenseHtml = (expense: Expense) => `
  <div style="max-width: 170mm; margin: 0 auto;">
    <div style="text-align: center; margin-bottom: 30px; border-bottom: 2px solid #DC2626; padding-bottom: 20px;">
      <h1 style="color: #DC2626; font-size: 28px; margin: 0;">MoneyFlow</h1>
      <p style="color: #6B7280; margin: 5px 0 0 0;">Muhasebe Sistemi</p>
    </div>
    <div style="display: flex; justify-content: space-between; margin-bottom: 30px;">
      <div>
        <h2 style="color: #1F2937; font-size: 24px; margin: 0 0 10px 0;">GİDER BELGESİ</h2>
        <p style="margin: 5px 0;"><strong>Gider No:</strong> ${expense.expenseNumber}</p>
        <p style="margin: 5px 0;"><strong>Gider Tarihi:</strong> ${formatDate(expense.expenseDate)}</p>
        ${expense.dueDate ? `<p style="margin: 5px 0;"><strong>Ödeme Tarihi:</strong> ${formatDate(expense.dueDate)}</p>` : ''}
        <p style="margin: 5px 0;"><strong>Durum:</strong> ${({ draft:'Taslak',approved:'Onaylandı',paid:'Ödendi' } as any)[expense.status]}</p>
      </div>
      <div style="text-align: right;">
        <h3 style="color: #1F2937; margin: 0 0 10px 0;">Tedarikçi Bilgileri</h3>
        <p style="margin: 5px 0;"><strong>${expense.supplier}</strong></p>
        <p style="margin: 5px 0; background-color: #FEF3C7; padding: 5px 10px; border-radius: 5px; display: inline-block;">
          <strong>Kategori:</strong> ${expense.category}
        </p>
      </div>
    </div>
    <div style="margin-bottom: 30px;">
      <h3 style="color: #1F2937; margin: 0 0 15px 0;">Gider Detayları</h3>
      <div style="background-color: #F9FAFB; padding: 20px; border-radius: 8px; border: 1px solid #E5E7EB;">
        <p style="margin: 0; font-size: 16px; line-height: 1.5;">${expense.description}</p>
      </div>
    </div>
    <div style="background-color: #FEF2F2; border: 2px solid #FECACA; border-radius: 12px; padding: 25px; margin-bottom: 30px;">
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <span style="color: #991B1B; font-size: 20px; font-weight: bold;">Toplam Gider Tutarı:</span>
        <span style="color: #DC2626; font-size: 32px; font-weight: bold;">${formatAmount(expense.amount)}</span>
      </div>
    </div>
    <div style="text-align: center; margin-top: 40px; padding-top: 20px; border-top: 1px solid #E5E7EB; color: #6B7280; font-size: 12px;">
      <p>Bu gider belgesi MoneyFlow ile oluşturulmuştur.</p>
      <p style="margin-top: 10px;">Belge Oluşturma Tarihi: ${formatDate(new Date().toISOString())}</p>
    </div>
  </div>
`;

const buildSaleHtml = (sale: Sale) => `
  <div style="max-width: 170mm; margin: 0 auto;">
    <div style="text-align: center; margin-bottom: 30px; border-bottom: 2px solid #10B981; padding-bottom: 20px;">
      <h1 style="color: #10B981; font-size: 28px; margin: 0;">MoneyFlow</h1>
      <p style="color: #6B7280; margin: 5px 0 0 0;">Muhasebe Sistemi</p>
    </div>
    <div style="display: flex; justify-content: space-between; margin-bottom: 30px;">
      <div>
        <h2 style="color: #1F2937; font-size: 24px; margin: 0 0 10px 0;">SATIŞ BELGESİ</h2>
        <p style="margin: 5px 0;"><strong>Satış No:</strong> ${sale.saleNumber || `SAL-${sale.id}`}</p>
        <p style="margin: 5px 0;"><strong>Satış Tarihi:</strong> ${formatDate(sale.date)}</p>
        <p style="margin: 5px 0;"><strong>Durum:</strong> ${({ completed:'Tamamlandı', pending:'Bekliyor', cancelled:'İptal' } as any)[sale.status]}</p>
        ${sale.paymentMethod ? `<p style="margin: 5px 0;"><strong>Ödeme Yöntemi:</strong> ${({cash:'Nakit',card:'Kredi/Banka Kartı',transfer:'Havale/EFT',check:'Çek'} as any)[sale.paymentMethod]}</p>` : ''}
      </div>
      <div style="text-align: right;">
        <h3 style="color: #1F2937; margin: 0 0 10px 0;">Müşteri Bilgileri</h3>
        <p style="margin: 5px 0;"><strong>${sale.customerName}</strong></p>
        ${sale.customerEmail ? `<p style="margin: 5px 0;">${sale.customerEmail}</p>` : ''}
      </div>
    </div>
    <div style="margin-bottom: 30px;">
      <h3 style="color: #1F2937; margin: 0 0 15px 0;">Ürün/Hizmet Detayları</h3>
      <div style="background-color: #F0FDF4; padding: 20px; border-radius: 8px; border: 1px solid #BBF7D0;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
          <span style="font-size: 18px; font-weight: bold; color: #1F2937;">${sale.productName}</span>
        </div>
        ${sale.quantity && sale.unitPrice ? `
          <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
            <span style="color: #6B7280;">Miktar:</span>
            <span style="font-weight: bold;">${sale.quantity}</span>
          </div>
          <div style="display: flex; justify-content: space-between;">
            <span style="color: #6B7280;">Birim Fiyat:</span>
            <span style="font-weight: bold;">${formatAmount(sale.unitPrice)}</span>
          </div>
        ` : ''}
      </div>
    </div>
    <div style="background-color: #ECFDF5; border: 2px solid #BBF7D0; border-radius: 12px; padding: 25px; margin-bottom: 30px;">
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <span style="color: #065F46; font-size: 20px; font-weight: bold;">Toplam Satış Tutarı:</span>
        <span style="color: #10B981; font-size: 32px; font-weight: bold;">${formatAmount(sale.amount)}</span>
      </div>
    </div>
    <div style="text-align: center; margin-top: 40px; padding-top: 20px; border-top: 1px solid #E5E7EB; color: #6B7280; font-size: 12px;">
      <p>Bu satış belgesi MoneyFlow ile oluşturulmuştur.</p>
      <p style="margin-top: 10px;">Belge Oluşturma Tarihi: ${formatDate(new Date().toISOString())}</p>
    </div>
  </div>
`;

// ——— DIŞA AÇIK API ———————————————————————————————
export const generateInvoicePDF = async (invoice: Invoice, opts: OpenOpts = {}) => {
  const html = buildInvoiceHtml(invoice, opts.company ?? {});
  const blob = await htmlToPdfBlob(html);
  openPdfInWindow(blob, `${opts.filename ?? invoice.invoiceNumber ?? 'Invoice'}.pdf`, opts.targetWindow);
};

export const generateExpensePDF = async (expense: Expense, opts: OpenOpts = {}) => {
  const html = buildExpenseHtml(expense);
  const blob = await htmlToPdfBlob(html);
  openPdfInWindow(blob, `${opts.filename ?? expense.expenseNumber ?? 'Expense'}.pdf`, opts.targetWindow);
};

export const generateSalePDF = async (sale: Sale, opts: OpenOpts = {}) => {
  const html = buildSaleHtml(sale);
  const blob = await htmlToPdfBlob(html);
  openPdfInWindow(blob, `${opts.filename ?? (sale.saleNumber || `SAL-${sale.id}`)}.pdf`, opts.targetWindow);
};
