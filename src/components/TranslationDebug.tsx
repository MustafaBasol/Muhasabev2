import React from 'react';
import { useTranslation } from 'react-i18next';

// Basit tanılama bileşeni: TR dilinde hangi anahtarlar gerçekten yüklenmiş?
// Hem namespace belirtilmeden hem de explicit common: prefix ile test eder.
export default function TranslationDebug() {
  const { t, i18n } = useTranslation();

  const keys = [
    'chartOfAccounts.title',
    'chartOfAccounts.subtitle',
    'chartOfAccounts.accountNames.101',
    'chartOfAccounts.accountNames.201',
    'chartOfAccounts.accountNames.600',
    'chartOfAccounts.accountNames.601',
    'chartOfAccounts.accountNames.602',
    'chartOfAccounts.accountTypes.asset',
    'chartOfAccounts.accountTypesPlural.expense',
    'status.paid',
    'status.draft',
    'status.sent',
    'status.overdue',
    'status.pending',
    'status.cancelled',
    'status.completed',
    'status.approved',
    'status.rejected'
  ];

  const results = keys.map(k => ({
    key: k,
    direct: t(k),
    commonPrefixed: t(`common:${k}`),
  }));

  const rawStore = (i18n as any).services?.resourceStore?.data?.[i18n.language];
  const hasCommon = !!rawStore?.common;
  const hasStatusNs = !!rawStore?.status;

  return (
    <div style={{ padding: 16, fontFamily: 'monospace' }}>
      <h2>🔍 Translation Debug ({i18n.language})</h2>
      <p>Common yüklü: {String(hasCommon)} | Status ns yüklü: {String(hasStatusNs)}</p>
      <table style={{ borderCollapse: 'collapse', width: '100%', marginTop: 12 }}>
        <thead>
          <tr>
            <th style={{ border: '1px solid #ccc', padding: 4 }}>Key</th>
            <th style={{ border: '1px solid #ccc', padding: 4 }}>t(key)</th>
            <th style={{ border: '1px solid #ccc', padding: 4 }}>t(common:key)</th>
          </tr>
        </thead>
        <tbody>
          {results.map(r => (
            <tr key={r.key}>
              <td style={{ border: '1px solid #ccc', padding: 4 }}>{r.key}</td>
              <td style={{ border: '1px solid #ccc', padding: 4 }}>{r.direct}</td>
              <td style={{ border: '1px solid #ccc', padding: 4 }}>{r.commonPrefixed}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <details style={{ marginTop: 16 }}>
        <summary>Ham resourceStore (kısaltılmış)</summary>
        <pre style={{ maxHeight: 300, overflow: 'auto', fontSize: 11 }}>
{JSON.stringify({
  language: i18n.language,
  commonKeysSample: Object.keys(rawStore?.common || {}).slice(0, 50),
  statusKeys: Object.keys(rawStore?.status || {}),
}, null, 2)}
        </pre>
      </details>
    </div>
  );
}
