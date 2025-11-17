// DEPRECATED: Bu yardımcı artık i18n kaynaklarına delegasyon yapıyor.
// Tüm yeni kullanımlar doğrudan `t('presets.*')` ile yapılmalı.
import i18n from '../i18n/config';

export type PresetKey =
  | 'this-month'
  | 'last-month'
  | 'this-year'
  | 'added-this-month'
  | 'with-email'
  | 'with-phone'
  | 'with-company';

const KEY_MAP: Record<PresetKey, string> = {
  'this-month': 'presets.thisMonth',
  'last-month': 'presets.lastMonth',
  'this-year': 'presets.thisYear',
  'added-this-month': 'presets.addedThisMonth',
  'with-email': 'presets.withEmail',
  'with-phone': 'presets.withPhone',
  'with-company': 'presets.withCompany',
};

export function getPresetLabel(key: PresetKey, language?: string): string {
  const k = KEY_MAP[key];
  try {
    const lng = language || i18n.language;
    const t = i18n.getFixedT(lng, 'common');
    return t(k) as string;
  } catch {
    return (i18n.t(k) as string) || key;
  }
}
