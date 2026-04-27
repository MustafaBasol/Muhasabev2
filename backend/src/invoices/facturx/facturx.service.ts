import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PDFDocument, PDFName, PDFString, PDFArray, StandardFonts, rgb } from 'pdf-lib';
import { Invoice } from '../entities/invoice.entity';
import { InvoiceLine } from '../entities/invoice-line.entity';
import { buildCiiXml } from './cii-xml.builder';
import { FacturXProfile, FACTURX_CONFORMANCE_LEVEL } from './facturx-profile.enum';

/**
 * FacturXService — PDF/A-3b + Factur-X CII XML embedding.
 *
 * Bir faturanın CII XML'ini üretir ve varolan bir PDF bufferına gömer.
 * PDF yoksa temel bir boş PDF oluşturur (MVP için).
 *
 * Referans: Factur-X 1.0 Spesifikasyonu, Bölüm 7 (XMP + Dosya Eki)
 */
@Injectable()
export class FacturXService {
  private readonly logger = new Logger(FacturXService.name);

  constructor(
    @InjectRepository(Invoice)
    private readonly invoiceRepo: Repository<Invoice>,

    @InjectRepository(InvoiceLine)
    private readonly lineRepo: Repository<InvoiceLine>,
  ) {}

  /**
   * Bir fatura için Factur-X uyumlu PDF üretir.
   *
   * @param invoiceId — Fatura ID (UUID)
   * @param tenantId  — Kiracı ID (güvenlik kontrolü)
   * @param sourcePdf — Mevcut PDF buffer (opsiyonel). Yoksa boş PDF kullanılır.
   * @param profile   — Factur-X profili (varsayılan: EN_16931)
   */
  async generate(
    invoiceId: string,
    tenantId: string,
    sourcePdf?: Buffer,
    profile: FacturXProfile = FacturXProfile.EN_16931,
  ): Promise<{ pdf: Buffer; filename: string }> {
    const invoice = await this.invoiceRepo.findOne({
      where: { id: invoiceId, tenantId },
      relations: ['customer'],
    });

    if (!invoice) {
      throw new NotFoundException(`Invoice not found: ${invoiceId}`);
    }

    const lines = await this.lineRepo.find({ where: { invoiceId } });

    // 1. CII XML üret
    const xmlString = buildCiiXml(invoice, lines, profile);
    const xmlBytes = Buffer.from(xmlString, 'utf-8');

    // 2. PDF yükle (veya boş oluştur)
    const pdfDoc = sourcePdf
      ? await PDFDocument.load(sourcePdf, { ignoreEncryption: true })
      : await this.createEmptyPdf(invoice, lines);

    // 3. XML dosyasını PDF'e göm (EmbeddedFile)
    await this.embedXml(pdfDoc, xmlBytes, profile);

    // 4. XMP metadata ekle
    this.setXmpMetadata(pdfDoc, invoice, profile);

    // 5. PDF kaydet
    const pdfBytes = await pdfDoc.save();

    const filename = `factur-x-${invoice.invoiceNumber.replace(/[^a-zA-Z0-9-_]/g, '_')}.pdf`;

    this.logger.log(
      `Factur-X PDF generated: invoiceId=${invoiceId} profile=${profile} size=${pdfBytes.byteLength}`,
    );

    return { pdf: Buffer.from(pdfBytes), filename };
  }

  // ── Özel yardımcılar ─────────────────────────────────────────────────────

  private async createEmptyPdf(invoice: Invoice, lines: InvoiceLine[]): Promise<PDFDocument> {
    const doc = await PDFDocument.create();

    // Sayfa yüksekliğini satır sayısına göre dinamik ayarla
    const minH = 842;
    const estimatedH = 400 + Math.max(lines.length, 1) * 16 + 120;
    const pageH = Math.max(minH, estimatedH);
    const pageW = 595;
    const margin = 40;
    const page = doc.addPage([pageW, pageH]);

    const font     = await doc.embedFont(StandardFonts.Helvetica);
    const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);

    /**
     * WinAnsi (Windows-1252) kodlaması Türkçe özgün karakterleri desteklemez.
     * pdf-lib StandardFonts bu kodlamayı kullanır → encode sırasında hata fırlatır.
     * Transliterasyon ile güvenli ASCII/Latin-1 karşılıklarına dönüştür.
     */
    const toWinAnsi = (s: string): string =>
      s
        .replace(/ı/g, 'i').replace(/İ/g, 'I')
        .replace(/ğ/g, 'g').replace(/Ğ/g, 'G')
        .replace(/ş/g, 's').replace(/Ş/g, 'S')
        .replace(/[\x00-\x08\x0B-\x1F\x7F]/g, ''); // control chars

    let y = pageH - 40;

    /** Metin çiz */
    const draw = (
      t: string,
      x: number,
      yPos: number,
      size = 9,
      bold = false,
      color = rgb(0, 0, 0),
    ) => {
      if (!t) return;
      page.drawText(toWinAnsi(String(t)), {
        x,
        y: yPos,
        size,
        font: bold ? fontBold : font,
        color,
      });
    };

    /** Sağa hizalı metin */
    const rDraw = (
      t: string,
      rightEdge: number,
      yPos: number,
      size = 9,
      bold = false,
      color = rgb(0, 0, 0),
    ) => {
      const safe = toWinAnsi(String(t));
      const w = (bold ? fontBold : font).widthOfTextAtSize(safe, size);
      draw(safe, rightEdge - w, yPos, size, bold, color);
    };

    /** Yatay çizgi */
    const hLine = (
      yPos: number,
      x1 = margin,
      x2 = pageW - margin,
      thickness = 0.5,
      c = rgb(0.7, 0.7, 0.7),
    ) =>
      page.drawLine({ start: { x: x1, y: yPos }, end: { x: x2, y: yPos }, thickness, color: c });

    /** Sayı formatlama */
    const fmt = (n: unknown) => {
      const num = Number(n ?? 0);
      return (isNaN(num) ? 0 : num).toFixed(2);
    };
    const fmtC = (n: unknown) =>
      `${fmt(n)} ${invoice.invoiceCurrency || 'EUR'}`;

    // ── BAŞLIK ──────────────────────────────────────────────────────────────
    draw('FACTURE', margin, y, 22, true, rgb(0.1, 0.1, 0.1));
    rDraw(`N° ${invoice.invoiceNumber}`, pageW - margin, y, 13, true);
    y -= 8;
    hLine(y, margin, pageW - margin, 2, rgb(0.15, 0.15, 0.15));
    y -= 20;

    // ── SATICI / ALICI BİLGİLERİ ────────────────────────────────────────────
    const seller  = invoice.sellerSnapshot;
    const buyer   = invoice.buyerSnapshot;
    const cust    = (invoice as any).customer; // lazy-loaded relation
    const col1    = margin;
    const col2    = 330;
    const savedY  = y;

    // Satıcı bloğu (sol)
    if (seller?.companyName) {
      draw(seller.companyName, col1, y, 10, true);
      y -= 13;
    }
    if (seller?.address) {
      for (const part of seller.address.split('\n').slice(0, 3)) {
        draw(part.trim(), col1, y, 9);
        y -= 11;
      }
    }
    if (seller?.siretNumber) { draw(`SIRET : ${seller.siretNumber}`, col1, y, 8); y -= 11; }
    if (seller?.tvaNumber)   { draw(`N° TVA : ${seller.tvaNumber}`, col1, y, 8); y -= 11; }

    // Fatura bilgileri (sağ)
    const issueDate = new Date(invoice.issueDate).toLocaleDateString('fr-FR');
    const dueDate   = new Date(invoice.dueDate ?? invoice.issueDate).toLocaleDateString('fr-FR');
    draw(`Date d'émission :`, col2, savedY, 8, false, rgb(0.4, 0.4, 0.4));
    draw(issueDate, col2 + 115, savedY, 9, true);
    draw(`Date d'échéance :`,  col2, savedY - 14, 8, false, rgb(0.4, 0.4, 0.4));
    draw(dueDate,  col2 + 115, savedY - 14, 9, true);
    if (invoice.orderReference) {
      draw('Réf. commande :', col2, savedY - 28, 8, false, rgb(0.4, 0.4, 0.4));
      draw(invoice.orderReference, col2 + 115, savedY - 28, 9);
    }

    y -= 20;

    // Alıcı kutusu
    const buyerName = buyer?.company || buyer?.name ||
      cust?.company || cust?.name || '';
    const buyerAddrParts: string[] = [];
    if (buyer?.billingAddress) {
      const ba = buyer.billingAddress;
      if (ba.street) buyerAddrParts.push(ba.street);
      const cityLine = [ba.postalCode, ba.city].filter(Boolean).join(' ');
      if (cityLine) buyerAddrParts.push(cityLine);
      if (ba.country) buyerAddrParts.push(ba.country);
    } else if (buyer?.address) {
      buyer.address.split('\n').forEach((l: string) => l.trim() && buyerAddrParts.push(l.trim()));
    }
    if (buyer?.tvaNumber) buyerAddrParts.push(`N° TVA : ${buyer.tvaNumber}`);

    const boxH = Math.max(55, 20 + buyerAddrParts.length * 12);
    page.drawRectangle({
      x: col2, y: y - boxH,
      width: pageW - col2 - margin, height: boxH,
      borderColor: rgb(0.75, 0.75, 0.75), borderWidth: 0.75,
    });
    let by = y - 9;
    draw('FACTURER À', col2 + 6, by, 7, false, rgb(0.5, 0.5, 0.5));
    by -= 12;
    if (buyerName) { draw(buyerName, col2 + 6, by, 9, true); by -= 12; }
    for (const line of buyerAddrParts.slice(0, 4)) {
      draw(line, col2 + 6, by, 8);
      by -= 10;
    }

    y = Math.min(y, y - boxH) - 18;

    // ── KALEMLER TABLOSU ────────────────────────────────────────────────────
    // Sütun tanımları: x başlangıcı + genişlik
    // Toplam içerik genişliği: pageW - 2*margin = 515
    const C = {
      num:   { x: margin,        w: 18,  align: 'left'  },
      desc:  { x: margin + 18,   w: 185, align: 'left'  },
      qty:   { x: margin + 203,  w: 42,  align: 'right' },
      unit:  { x: margin + 245,  w: 28,  align: 'left'  },
      pu:    { x: margin + 273,  w: 66,  align: 'right' },
      rate:  { x: margin + 339,  w: 38,  align: 'right' },
      tax:   { x: margin + 377,  w: 65,  align: 'right' },
      total: { x: margin + 442,  w: 73,  align: 'right' },
    };
    const rowH = 16;

    // Başlık satırı
    page.drawRectangle({
      x: margin, y: y - rowH,
      width: pageW - 2 * margin, height: rowH,
      color: rgb(0.15, 0.15, 0.15),
    });
    const headers: [string, keyof typeof C][] = [
      ['#',        'num'],
      ['Description', 'desc'],
      ['Qté',      'qty'],
      ['U.',       'unit'],
      ['P.U. HT',  'pu'],
      ['TVA%',     'rate'],
      ['TVA',      'tax'],
      ['Total HT', 'total'],
    ];
    for (const [label, key] of headers) {
      const col = C[key];
      if (col.align === 'right') {
        // Sayısal başlıklar: sağa hizalı — veri ile aynı hizaya gelir
        const w = fontBold.widthOfTextAtSize(toWinAnsi(label), 7.5);
        draw(label, col.x + col.w - w - 2, y - 11, 7.5, true, rgb(1, 1, 1));
      } else {
        draw(label, col.x + 2, y - 11, 7.5, true, rgb(1, 1, 1));
      }
    }
    y -= rowH;

    // Veri satırları
    const sorted = [...lines].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
    for (let i = 0; i < sorted.length; i++) {
      const ln = sorted[i];
      if (i % 2 === 1) {
        page.drawRectangle({
          x: margin, y: y - rowH,
          width: pageW - 2 * margin, height: rowH,
          color: rgb(0.95, 0.95, 0.95),
        });
      }
      const qty     = Number(ln.quantity);
      const uPrice  = Number(ln.unitPrice);
      const taxRate = Number(ln.taxRate);
      const lNet    = Number(ln.lineNet) || qty * uPrice;
      const lTax    = Number(ln.lineTax) || (lNet * taxRate) / 100;
      const name    = (ln.productName || ln.description || '').slice(0, 34);

      draw(String(i + 1),      C.num.x  + 2,              y - 11, 8);
      draw(name,               C.desc.x + 2,              y - 11, 7.5);
      rDraw(fmt(qty),          C.qty.x  + C.qty.w  - 2,   y - 11, 8);
      draw(ln.unit || 'u.',    C.unit.x + 2,              y - 11, 8);
      rDraw(fmt(uPrice),       C.pu.x   + C.pu.w   - 2,  y - 11, 8);
      rDraw(`${fmt(taxRate)}%`, C.rate.x + C.rate.w - 2,  y - 11, 8);
      rDraw(fmt(lTax),         C.tax.x  + C.tax.w  - 2,  y - 11, 8);
      rDraw(fmt(lNet),         C.total.x + C.total.w - 2, y - 11, 8);
      y -= rowH;
    }
    hLine(y);
    y -= 14;

    // ── TOPLAMLAR ────────────────────────────────────────────────────────────
    const subtotal = Number(invoice.subtotal);
    const taxAmt   = Number(invoice.taxAmount);
    const total    = Number(invoice.total);
    const discount = Number(invoice.discountAmount || 0);
    const totLX    = 350;
    const totRX    = pageW - margin;

    draw('Sous-total HT :',  totLX, y, 8.5); rDraw(fmtC(subtotal), totRX, y, 8.5); y -= 13;
    if (discount > 0) {
      draw('Remise :',       totLX, y, 8.5); rDraw(`- ${fmtC(discount)}`, totRX, y, 8.5); y -= 13;
    }
    draw('TVA :',            totLX, y, 8.5); rDraw(fmtC(taxAmt),   totRX, y, 8.5);
    y -= 6;
    hLine(y, totLX - 5, totRX, 0.5, rgb(0.5, 0.5, 0.5));
    y -= 14;
    page.drawRectangle({
      x: totLX - 5, y: y - 6,
      width: totRX - totLX + 5, height: 20,
      color: rgb(0.15, 0.15, 0.15),
    });
    draw('TOTAL TTC :',       totLX, y, 9.5, true, rgb(1, 1, 1));
    rDraw(fmtC(total), totRX - 2,   y, 9.5, true, rgb(1, 1, 1));
    y -= 28;

    // ── ÖDEME BİLGİSİ ────────────────────────────────────────────────────────
    if (invoice.paymentIban) {
      draw(`Paiement par virement — IBAN : ${invoice.paymentIban}`, margin, y, 8);
      y -= 11;
      if (invoice.paymentBic) { draw(`BIC : ${invoice.paymentBic}`, margin, y, 8); y -= 11; }
      y -= 5;
    }

    // ── NOTLAR ───────────────────────────────────────────────────────────────
    if (invoice.notes) {
      draw('Notes :', margin, y, 8, true); y -= 12;
      for (const l of invoice.notes.split('\n').slice(0, 5)) {
        draw(l.slice(0, 90), margin, y, 8); y -= 10;
      }
      y -= 5;
    }

    // ── ALT BİLGİ — HUKUKİ NOTLAR ────────────────────────────────────────────
    if (seller) {
      const parts: string[] = [];
      if (seller.companyType)    parts.push(seller.companyType);
      if (seller.capitalSocial)  parts.push(`Capital ${seller.capitalSocial}`);
      if (seller.rcsNumber)      parts.push(`RCS ${seller.rcsNumber}`);
      if (seller.siretNumber)    parts.push(`SIRET ${seller.siretNumber}`);
      if (seller.tvaNumber)      parts.push(`N° TVA : ${seller.tvaNumber}`);
      if (parts.length > 0) {
        hLine(45, margin, pageW - margin, 0.5, rgb(0.85, 0.85, 0.85));
        draw(parts.join(' — '), margin, 32, 7, false, rgb(0.5, 0.5, 0.5));
      }
    }

    return doc;
  }

  /**
   * XML dosyasını PDF'e EmbeddedFile stream olarak gömer.
   * Factur-X spesifikasyonu: dosya adı "factur-x.xml" olmalıdır.
   */
  private async embedXml(
    pdfDoc: PDFDocument,
    xmlBytes: Buffer,
    profile: FacturXProfile,
  ): Promise<void> {
    // pdf-lib'in embedFile API'si stream oluşturur, Names dizisinde kayıt eder
    const embeddedFile = await pdfDoc.attach(xmlBytes, 'factur-x.xml', {
      mimeType: 'application/xml',
      description: `Factur-X ${profile} Invoice`,
      creationDate: new Date(),
      modificationDate: new Date(),
    });

    // AF ilişkisini (Associated Files) kök dictige ekle — PDF/A-3b zorunluluğu
    const ref = pdfDoc.context.getObjectRef(embeddedFile as any);
    if (ref) {
      const afArray = pdfDoc.context.obj([ref]);
      pdfDoc.catalog.set(PDFName.of('AF'), afArray);
    }
  }

  /**
   * Factur-X uyumlu XMP metadata bloğu yazar.
   * PDF viewer'ların Factur-X'i tanıması için zorunludur.
   */
  private setXmpMetadata(
    pdfDoc: PDFDocument,
    invoice: Invoice,
    profile: FacturXProfile,
  ): void {
    const conformanceLevel = FACTURX_CONFORMANCE_LEVEL[profile];
    const now = new Date().toISOString();

    const xmp = `<?xpacket begin="\uFEFF" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/">
  <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">

    <rdf:Description rdf:about=""
      xmlns:dc="http://purl.org/dc/elements/1.1/"
      xmlns:xmp="http://ns.adobe.com/xap/1.0/"
      xmlns:pdf="http://ns.adobe.com/pdf/1.3/"
      xmlns:pdfaid="http://www.aiim.org/pdfa/ns/id/"
      xmlns:fx="urn:factur-x:pdfa:CrossIndustryDocument:invoice:1p0#">

      <pdfaid:part>3</pdfaid:part>
      <pdfaid:conformance>B</pdfaid:conformance>

      <fx:DocumentType>INVOICE</fx:DocumentType>
      <fx:DocumentFileName>factur-x.xml</fx:DocumentFileName>
      <fx:Version>1.0</fx:Version>
      <fx:ConformanceLevel>${conformanceLevel}</fx:ConformanceLevel>

      <dc:title>
        <rdf:Alt>
          <rdf:li xml:lang="x-default">Facture ${invoice.invoiceNumber}</rdf:li>
        </rdf:Alt>
      </dc:title>
      <xmp:CreateDate>${now}</xmp:CreateDate>
      <xmp:ModifyDate>${now}</xmp:ModifyDate>
    </rdf:Description>

  </rdf:RDF>
</x:xmpmeta>
<?xpacket end="w"?>`;

    pdfDoc.setTitle(`Facture ${invoice.invoiceNumber}`);
    pdfDoc.setCreator('Comptario e-Invoicing');
    pdfDoc.setProducer('Comptario / pdf-lib');

    const xmpStream = pdfDoc.context.stream(xmp, {
      Type: 'Metadata',
      Subtype: 'XML',
    });
    const xmpRef = pdfDoc.context.register(xmpStream);
    pdfDoc.catalog.set(PDFName.of('Metadata'), xmpRef);
  }
}
