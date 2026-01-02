import { TFunction } from 'i18next';

// Normalize backend-provided status values like "status.draft", "DRAFT", etc.
export const normalizeStatusKey = (raw: string): string => {
  const k = String(raw || '').toLowerCase().trim();
  const noNs = k.startsWith('status.') ? k.slice(7) : k;
  const map: Record<string, string> = {
    canceled: 'cancelled',
    cancelled: 'cancelled',
    void: 'cancelled',
    voided: 'cancelled',
  };
  return map[noNs] || noNs;
};

// Resolve label from i18n resources. First tries common:status, then status namespace, else returns key.
export const resolveStatusLabel = (t: TFunction, key: string): string => {
  try {
    // Anahtarı içerde normalize et (çağıranların unutma ihtimaline karşı)
    const k = normalizeStatusKey(key);
    // 1) common namespace altında status.*
    const a = t(`status.${k}`, { ns: 'common' } as any);
    if (a && a !== `status.${k}` && a !== k) return a;
    // 2) status namespace root (mergeBusinessStatuses ile dolduruluyor)
    const b = t(`status:${k}`);
    if (b && b !== k && b !== `status:${k}`) return b;
    // 3) status ns'ine açıkça geç (kolon kullanmadan)
    const c = t(k, { ns: 'status' } as any);
    if (c && c !== k) return c as string;
    // 4) common ns altında düz anahtar dene (yanlış yerleştirme ihtimali)
    const d = t(k, { ns: 'common' } as any);
    if (d && d !== k) return d as string;

    if ((import.meta as any)?.env?.DEV) {
      try {
        console.debug('[i18n][status] Translation not found (fallback):', { key: k });
      } catch (error) {
        console.warn('[i18n][status] Debug log failed:', error);
      }
    }
    // Son çare: ilk harfi büyüt
    return k.charAt(0).toUpperCase() + k.slice(1);
  } catch (error) {
    console.warn('[i18n][status] resolveStatusLabel failed, returning raw key.', error);
    return key;
  }
};
