
---

## `docs/FR_EINVOICING_TASKLIST.md`

```md
# France E-Invoicing Task List

This checklist is the execution reference for implementing France e-invoicing readiness in Comptario.

The implementation must remain provider-agnostic, with Pennylane as the first provider candidate.

---

# Phase 0 — Documentation and Analysis

- [ ] Review current backend structure relevant to tenants, customers, invoices, invoice items, and statuses
- [ ] Confirm where legal company data is currently stored
- [ ] Confirm how customer tax/legal data is currently stored
- [ ] Confirm current invoice and invoice item persistence model
- [ ] Confirm current invoice status lifecycle usage across backend and frontend
- [ ] Add/update roadmap documentation if implementation assumptions change

---

# Phase 1 — Schema Preparation

## Tenant / Company Legal Profile
- [ ] Review existing tenant legal fields
- [ ] Decide whether to extend current tenant entity or create a dedicated legal profile entity
- [ ] Add fields for company legal identity
- [ ] Add fields for VAT and payment defaults
- [ ] Add fields for default e-invoicing provider linkage
- [ ] Add migrations for tenant/company legal fields
- [ ] Update DTOs and validation rules
- [ ] Ensure existing flows are not broken

## Customer Legal / Tax Profile
- [ ] Review current customer entity structure
- [ ] Add business/legal identity fields
- [ ] Add VAT and customer type fields
- [ ] Add billing and delivery address completeness fields
- [ ] Add external provider customer mapping fields
- [ ] Add migrations for customer fields
- [ ] Update DTOs and validators
- [ ] Keep backward compatibility for existing customer creation/update flows

## Invoice Compliance Fields
- [ ] Review current invoice entity structure
- [ ] Add `commercialStatus`
- [ ] Add `eInvoiceStatus`
- [ ] Add `eInvoiceStatusReason`
- [ ] Add document type field
- [ ] Add currency and language fields
- [ ] Add delivery and service period fields
- [ ] Add provider linkage fields
- [ ] Add provider sync timestamps
- [ ] Add provider error fields
- [ ] Add migrations for invoice fields
- [ ] Update invoice DTOs and validators
- [ ] Avoid breaking current invoice issue/list/detail flows

## Invoice Snapshot Strategy
- [ ] Decide what seller legal fields should be snapshotted onto invoices
- [ ] Decide what buyer legal fields should be snapshotted onto invoices
- [ ] Define payment terms snapshot model
- [ ] Define storage format for tax breakdown by rate
- [ ] Document snapshot approach before implementation

---

# Phase 1.5 — Invoice Line Normalization

- [ ] Review current JSON-based invoice item model
- [ ] Design normalized `invoice_lines` structure
- [ ] Decide migration strategy from JSON items to normalized rows
- [ ] Add invoice line entity
- [ ] Add migration for invoice lines table
- [ ] Update service-layer calculations if needed
- [ ] Preserve compatibility with existing invoice creation logic during transition
- [ ] Define whether JSON items remain temporary, derived, or deprecated

---

# Phase 2 — Integration Foundation

## Common Integration Layer
- [ ] Create `backend/src/integrations/common` module structure
- [ ] Add provider interface/abstraction
- [ ] Add shared provider DTO patterns
- [ ] Add shared error mapping strategy
- [ ] Add shared serialization/sanitization helpers if needed

## Provider Account
- [ ] Create provider account entity
- [ ] Add tenant-to-provider account mapping
- [ ] Add token storage fields
- [ ] Add connection status fields
- [ ] Add migration for provider account entity
- [ ] Add repository/service layer
- [ ] Consider encryption strategy for sensitive tokens

## Integration Logs
- [ ] Create integration log entity
- [ ] Add request/response/error storage model
- [ ] Add migration for integration logs
- [ ] Add service methods for structured logging

## Outbound Jobs / Retry
- [ ] Create outbound job entity
- [ ] Add idempotency key support
- [ ] Add retry count and next retry fields
- [ ] Add migration for outbound jobs
- [ ] Add job processing service skeleton
- [ ] Define retry policy
- [ ] Define failure state model

---

# Phase 3 — E-Invoicing Domain Support

- [ ] Create `backend/src/einvoicing` module structure
- [ ] Add canonical invoice builder service
- [ ] Add validation rules for France-required invoice data completeness
- [ ] Add provider-independent mapping contracts
- [ ] Add status mapping utilities
- [ ] Add rejection/error normalization helpers

---

# Phase 4 — Pennylane MVP Connector

## Module Setup
- [ ] Create `backend/src/integrations/pennylane` module structure
- [ ] Add Pennylane config handling
- [ ] Add Pennylane DTOs
- [ ] Add Pennylane service skeletons

## Authentication / Connection
- [ ] Design OAuth/token flow storage
- [ ] Implement tenant connection model
- [ ] Add connect/disconnect endpoints or service methods
- [ ] Add connection status checks

## Customer Sync
- [ ] Design customer mapping from Comptario to Pennylane
- [ ] Add provider customer lookup/upsert service
- [ ] Store Pennylane customer identifier locally
- [ ] Handle missing/invalid customer legal data gracefully

## Invoice Submission
- [ ] Design invoice payload mapping
- [ ] Add invoice submit service
- [ ] Store external invoice/provider identifiers
- [ ] Update local `eInvoiceStatus` after submission
- [ ] Log submission request/response
- [ ] Prevent duplicate submission without intent

## Status Synchronization
- [ ] Add polling/sync service
- [ ] Fetch provider invoice state updates
- [ ] Map provider statuses to local `eInvoiceStatus`
- [ ] Store rejection reasons and timestamps
- [ ] Update `lastProviderSyncAt`
- [ ] Log sync activity

## Rejection / Retry
- [ ] Define rejection handling flow
- [ ] Add resubmit strategy where possible
- [ ] Surface actionable provider errors
- [ ] Keep audit trail of retries and failures

---

# Phase 5 — UI / Product Layer

## Company Settings
- [ ] Add company legal profile form
- [ ] Add VAT and payment defaults UI
- [ ] Add provider selection/connection section
- [ ] Add validation and completion guidance

## Customer Management
- [ ] Add legal/tax fields to customer forms
- [ ] Add business vs individual customer type
- [ ] Add billing/delivery distinction where needed
- [ ] Show provider mapping indicators if relevant

## Invoice UI
- [ ] Add commercial status display
- [ ] Add e-invoice status display
- [ ] Add provider reference display
- [ ] Add rejection reason visibility
- [ ] Add last sync info
- [ ] Add submit/resubmit actions where applicable

## Operational Visibility
- [ ] Add sync/job monitoring UI if appropriate
- [ ] Add admin/support visibility for provider errors
- [ ] Add audit visibility for important transmission actions

---

# Phase 6 — Canonical Model and Structured Export Preparation

- [ ] Define canonical invoice JSON shape
- [ ] Add canonical builder from invoice + lines + snapshots
- [ ] Decouple PDF generation from core invoice data
- [ ] Add provider mapper from canonical model
- [ ] Prepare structured export architecture for future Factur-X support
- [ ] Document future export paths clearly

---

# Phase 7 — Hardening and Production Readiness

- [ ] Review idempotency on invoice submission
- [ ] Review retry safety
- [ ] Review audit coverage
- [ ] Review token security
- [ ] Review migration safety
- [ ] Review status consistency between old and new flows
- [ ] Add test coverage for core integration scenarios
- [ ] Add operational notes for support/debugging
- [ ] Prepare demo/pilot tenant flow

---

# Implementation Rules

- [ ] Do not break current invoice flows while expanding schema
- [ ] Do not hard-code Pennylane-specific logic into core invoice services
- [ ] Do not use provider-specific statuses as the only internal statuses
- [ ] Prefer additive migrations over destructive rewrites
- [ ] Keep backward compatibility where reasonably possible
- [ ] Document architectural decisions when important changes are made

---

# Immediate Next Execution Step

The next execution step is:

## Phase 1 Only
- analyze current entities and DTOs
- add or prepare legal/tax/compliance fields
- separate commercial and e-invoicing statuses
- prepare invoice line normalization path

Do **not** implement provider business logic yet.