# Quotes — Rollout Plan (High-level)

Phased enablement with feature flags and guardrails. No low-level implementation details.

## Phase 0 — Internal Alpha
- Enable feature flag for internal org only
- Validate creation, sending (sandbox email), public page, accept/decline, PDF, and audit
- Metrics: creation-to-send time, email delivery success, public link error rate

## Phase 1 — Selected Tenants (Beta)
- Enable for pilot customers in TR/FR
- Collect feedback on templates, localization, optional items, and tax models (KDV/TVA)
- Guardrails: rate limits on public endpoints; PDF/email retry with alerts

## Phase 2 — Wider EU + TR
- Add DE templates and legal blocks
- Monitor acceptance rate, reminder efficacy, and expired rate
- Introduce saved views and dashboard widgets

## Phase 3 — US and Multi-currency
- Add US sales tax notes and ABA bank display
- Ensure FX storage (transaction/base amounts, exchange rate) and display

## Success Metrics
- Quote acceptance rate ≥ target (e.g., 30–40%)
- Time to first view ≤ 24h median
- Email delivery ≥ 99% success; public link error rate < 0.1%
- PDF generation failure rate < 0.2%; retry success ≥ 95%

## Guardrails & Ops
- Feature flag per organization; kill switch
- Alerting on email/PDF failures, abnormal error spikes
- Export and audit log availability for support
