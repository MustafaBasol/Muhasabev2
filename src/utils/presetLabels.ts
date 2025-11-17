// Basit ve merkezi hazır filtre etiketleri sözlüğü
// Amaç: Bileşenlerde sabit TR metinleri yerine dil seçimine saygılı etiket üretmek

export type PresetKey =
  | 'this-month'
  | 'last-month'
  | 'this-year'
  | 'added-this-month'
  | 'with-email'
  | 'with-phone'
  | 'with-company';

const DICT: Record<string, Record<PresetKey, string>> = {
  tr: {
    'this-month': 'Bu Ay',
    'last-month': 'Geçen Ay',
    'this-year': 'Bu Yıl',
    'added-this-month': 'Bu Ay Eklenenler',
    'with-email': 'E-posta var',
    'with-phone': 'Telefon var',
    'with-company': 'Şirketi olanlar',
  },
  en: {
    'this-month': 'This Month',
    'last-month': 'Last Month',
    'this-year': 'This Year',
    'added-this-month': 'Added This Month',
    'with-email': 'Has Email',
    'with-phone': 'Has Phone',
    'with-company': 'Has Company',
  },
  fr: {
    'this-month': 'Ce mois-ci',
    'last-month': 'Mois dernier',
    'this-year': 'Cette année',
    'added-this-month': 'Ajoutés ce mois-ci',
    'with-email': 'Avec e-mail',
    'with-phone': 'Avec téléphone',
    'with-company': 'Avec société',
  },
  de: {
    'this-month': 'Dieser Monat',
    'last-month': 'Letzter Monat',
    'this-year': 'Dieses Jahr',
    'added-this-month': 'Diesen Monat hinzugefügt',
    'with-email': 'E-Mail vorhanden',
    'with-phone': 'Telefon vorhanden',
    'with-company': 'Mit Firma',
  },
};

// i18next dil kodundan güvenli 2 harfli dil kodu çıkar
const lang2 = (raw?: string) => String(raw || 'en').slice(0, 2).toLowerCase();

export function getPresetLabel(key: PresetKey, language?: string): string {
  const l = lang2(language);
  const dict = DICT[l] || DICT.en;
  return dict[key] || (DICT.en[key] as string);
}
