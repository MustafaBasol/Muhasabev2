import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PDFDocument, PDFName, PDFString, PDFArray } from 'pdf-lib';
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
      relations: [],
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
      : await this.createEmptyPdf(invoice);

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

  private async createEmptyPdf(invoice: Invoice): Promise<PDFDocument> {
    const doc = await PDFDocument.create();
    const page = doc.addPage([595, 842]); // A4

    // Basit başlık (MVP)
    page.drawText(
      `Facture N° ${invoice.invoiceNumber} — ${new Date(invoice.issueDate).toLocaleDateString('fr-FR')}`,
      { x: 50, y: 800, size: 14 },
    );
    page.drawText(
      'Ce document Factur-X contient une facture électronique intégrée.',
      { x: 50, y: 775, size: 10 },
    );

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
