import { TFunction } from 'i18next';
import { safeLocalStorage } from './localStorageSafe';

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
    // 0) Ultra-güvenli: Dil-bazlı sabit sözlük (i18n cache/HMR sorunlarını atlamak için)
    const rawLang = (
      (t as any)?.i18n?.resolvedLanguage ||
      (t as any)?.i18n?.language ||
      safeLocalStorage.getItem('i18nextLng') ||
      (typeof document !== 'undefined' ? document.documentElement.lang : '') ||
      (typeof navigator !== 'undefined' ? navigator.language : '') ||
      ''
    ) as string;
    const lang = String(rawLang).slice(0,2).toLowerCase();
    const F: Record<string, Record<string, string>> = {
      tr: {
        paid: 'Ödendi', unpaid: 'Ödenmedi', pending: 'Bekliyor', overdue: 'Gecikmiş',
        draft: 'Taslak', sent: 'Gönderildi', approved: 'Onaylandı', rejected: 'Reddedildi',
        cancelled: 'İptal Edildi', completed: 'Tamamlandı', active: 'Aktif', inactive: 'Pasif',
        viewed: 'Görüntülendi', accepted: 'Kabul Edildi', declined: 'Reddedildi', expired: 'Süresi Doldu',
        invoiced: 'Faturalandı', created: 'Oluşturuldu', refunded: 'İade Edildi'
      },
      en: {
        paid: 'Paid', unpaid: 'Unpaid', pending: 'Pending', overdue: 'Overdue',
        draft: 'Draft', sent: 'Sent', approved: 'Approved', rejected: 'Rejected',
        cancelled: 'Cancelled', completed: 'Completed', active: 'Active', inactive: 'Inactive',
        viewed: 'Viewed', accepted: 'Accepted', declined: 'Declined', expired: 'Expired',
        invoiced: 'Invoiced', created: 'Created', refunded: 'Refunded'
      },
      de: {
        paid: 'Bezahlt', unpaid: 'Unbezahlt', pending: 'Ausstehend', overdue: 'Überfällig',
        draft: 'Entwurf', sent: 'Gesendet', approved: 'Genehmigt', rejected: 'Abgelehnt',
        cancelled: 'Storniert', completed: 'Abgeschlossen', active: 'Aktiv', inactive: 'Inaktiv',
        viewed: 'Angesehen', accepted: 'Akzeptiert', declined: 'Abgelehnt', expired: 'Abgelaufen',
        invoiced: 'Fakturiert', created: 'Erstellt', refunded: 'Erstattet'
      },
      fr: {
        paid: 'Payé', unpaid: 'Impayé', pending: 'En Attente', overdue: 'En Retard',
        draft: 'Brouillon', sent: 'Envoyé', approved: 'Approuvé', rejected: 'Rejeté',
        cancelled: 'Annulé', completed: 'Terminé', active: 'Actif', inactive: 'Inactif',
        viewed: 'Consulté', accepted: 'Accepté', declined: 'Décliné', expired: 'Expiré',
        invoiced: 'Facturé', created: 'Créé', refunded: 'Remboursé'
      }
    };
    if (F[lang]?.[k]) return F[lang][k];

    // 1) common namespace altında status.*
    const a = t(`common:status.${k}`);
    if (a && a !== `status.${k}` && a !== `common:status.${k}` && a !== k) return a;
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
        console.debug('[i18n][status] Çeviri bulunamadı (fallback):', { key: k, lang });
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
