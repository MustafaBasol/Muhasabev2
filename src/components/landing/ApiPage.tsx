import React from 'react';
import { useTranslation } from 'react-i18next';
import LegalHeader from '../LegalHeader';

const Code: React.FC<{children: React.ReactNode}> = ({ children }) => (
  <code className="px-1.5 py-0.5 bg-slate-100 text-slate-800 rounded font-mono text-[13px]">{children}</code>
);

const Pre: React.FC<{children: React.ReactNode}> = ({ children }) => (
  <pre className="bg-slate-900 text-slate-100 rounded-lg p-4 overflow-x-auto text-sm">
    <code>{children}</code>
  </pre>
);

const Section: React.FC<{title: string; children: React.ReactNode}> = ({ title, children }) => (
  <section className="mt-8">
    <h2 className="text-xl font-semibold text-slate-900 mb-3">{title}</h2>
    <div className="bg-white border border-slate-200 rounded-xl p-5">{children}</div>
  </section>
);

const ApiPage: React.FC = () => {
  const { t } = useTranslation('api');

  const baseUrl = t('gettingStarted.baseUrlValue');

  return (
    <div className="min-h-screen bg-slate-50">
      <LegalHeader />
      <div className="max-w-5xl mx-auto px-4 py-10">
        <h1 className="text-3xl font-bold text-slate-900">{t('title')}</h1>
        <p className="text-slate-600 mt-2">{t('subtitle')}</p>

        <Section title={t('gettingStarted.title')}>
          <div className="space-y-3 text-slate-700">
            <div className="flex gap-2 flex-wrap">
              <span className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 text-sm border border-indigo-100">
                {t('gettingStarted.baseUrl')}: <Code>{baseUrl}</Code>
              </span>
              <span className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 text-sm border border-emerald-100">
                {t('gettingStarted.versioning')}: <Code>/v1</Code>
              </span>
            </div>
            <p className="text-slate-600">{t('gettingStarted.versioningText')}</p>
            <ul className="list-disc pl-5 space-y-1">
              {(t('gettingStarted.prerequisites', { returnObjects: true }) as string[]).map((item, idx) => (
                <li key={idx}>{item}</li>
              ))}
            </ul>
          </div>
        </Section>

        <Section title={t('auth.title')}>
          <div className="space-y-3 text-slate-700">
            <p><b>{t('auth.method')}:</b> {t('auth.pat')}</p>
            <p>{t('auth.how')}</p>
            <div>
              <p className="text-slate-600 mb-2">{t('auth.example')}:</p>
              <Pre>
{`curl -s \
  -H "Authorization: Bearer <TOKEN>" \
  ${baseUrl}/v1/customers`}
              </Pre>
            </div>
          </div>
        </Section>

        <Section title={t('endpoints.title')}>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <h3 className="font-semibold text-slate-900">{t('endpoints.customers.title')}</h3>
              <ul className="mt-2 text-slate-700 space-y-2">
                <li>
                  <div className="text-slate-500 text-sm">{t('endpoints.customers.list')}</div>
                  <Code>{t('endpoints.customers.get')}</Code>
                </li>
                <li>
                  <div className="text-slate-500 text-sm">{t('endpoints.customers.create')}</div>
                  <Code>{t('endpoints.customers.post')}</Code>
                </li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold text-slate-900">{t('endpoints.invoices.title')}</h3>
              <ul className="mt-2 text-slate-700 space-y-2">
                <li>
                  <div className="text-slate-500 text-sm">{t('endpoints.invoices.list')}</div>
                  <Code>{t('endpoints.invoices.get')}</Code>
                </li>
                <li>
                  <div className="text-slate-500 text-sm">{t('endpoints.invoices.create')}</div>
                  <Code>{t('endpoints.invoices.post')}</Code>
                </li>
              </ul>
            </div>
          </div>
        </Section>

        <Section title={t('webhooks.title')}>
          <div className="space-y-3 text-slate-700">
            <p>{t('webhooks.text')}</p>
            <div>
              <p className="text-slate-600 mb-1">Events</p>
              <ul className="list-disc pl-5">
                {(t('webhooks.events', { returnObjects: true }) as string[]).map((ev, idx) => (
                  <li key={idx}>{ev}</li>
                ))}
              </ul>
            </div>
            <p>{t('webhooks.security')}</p>
            <p>{t('webhooks.retries')}</p>
          </div>
        </Section>

        <Section title={t('rateLimits.title')}>
          <p className="text-slate-700">{t('rateLimits.text')}</p>
          <p className="text-slate-700 mt-1">{t('rateLimits.headers')}</p>
        </Section>

        <Section title={t('errors.title')}>
          <div className="space-y-3 text-slate-700">
            <p className="text-slate-600">{t('errors.shape')}:</p>
            <Pre>
{`{
  "status": 401,
  "code": "auth.unauthorized",
  "message": "Unauthorized",
  "details": [
    { "field": "customer.email", "message": "Invalid email" }
  ]
}`}
            </Pre>
            <ul className="list-disc pl-5">
              <li>{t('errors.fields.status')}</li>
              <li>{t('errors.fields.code')}</li>
              <li>{t('errors.fields.message')}</li>
              <li>{t('errors.fields.details')}</li>
            </ul>
          </div>
        </Section>

        <Section title={t('examples.title')}>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <h3 className="font-semibold mb-2">{t('examples.listCustomers')}</h3>
              <Pre>
{`curl -s -X GET \
  -H "Authorization: Bearer <TOKEN>" \
  ${baseUrl}/v1/customers`}
              </Pre>
            </div>
            <div>
              <h3 className="font-semibold mb-2">{t('examples.createInvoice')}</h3>
              <Pre>
{`curl -s -X POST \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "customerId": "cus_123",
    "items": [
      { "description": "Service", "quantity": 1, "unitPrice": 100 }
    ]
  }' \
  ${baseUrl}/v1/invoices`}
              </Pre>
            </div>
          </div>
        </Section>
      </div>
    </div>
  );
};

export default ApiPage;
