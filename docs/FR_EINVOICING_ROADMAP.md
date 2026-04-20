# France E-Invoicing Roadmap for Comptario

## Purpose

This document defines the phased roadmap to prepare Comptario for France 2026 e-invoicing requirements using a third-party provider integration model.

Comptario will not initially aim to become a certified/approved e-invoicing platform itself. Instead, it will act as the user-facing invoicing and financial workflow application while connecting to an external e-invoicing provider for transmission, reception, compliance, status tracking, and interoperability.

## Strategic Positioning

### Target Model
- **Comptario** = invoicing UX, quote-to-invoice workflow, customer management, financial operations
- **External provider** = e-invoicing routing, compliance workflows, transmission, reception, lifecycle/status synchronization

### Initial Provider Candidate
- **Pennylane** is the first provider candidate because of:
  - relatively strong public API documentation
  - clear invoice import/create workflows
  - OAuth-based integration model
  - practical fit for SMB accounting and invoicing workflows

### Architectural Principle
The implementation must remain **provider-agnostic**.
Pennylane is the first target, but the internal domain model must not become Pennylane-specific.

---

# Current Codebase Strengths

The current Comptario codebase already provides a strong foundation:

- multi-tenant backend architecture
- organization / membership structure
- customer module
- product module
- quote and invoice modules
- VAT/tax calculation logic
- subscription/billing infrastructure
- modular NestJS backend structure
- suitable base for adding integration modules

These strengths mean the project does **not** need to be rebuilt from scratch for France e-invoicing.
The main missing pieces are:
- compliance-grade invoice data model
- normalized invoice line persistence
- legal/tax identity model extensions
- partner integration connector layer
- e-invoicing lifecycle tracking

---

# Goals

## Business Goals
- prepare Comptario for France 2026 e-invoicing reform
- allow French SMBs to continue using Comptario as their main invoicing interface
- reduce compliance complexity by delegating routing/compliance to a partner provider
- make Comptario marketplace/integration-partner ready

## Technical Goals
- extend current schema for French e-invoicing requirements
- separate commercial invoice lifecycle from e-invoicing transmission lifecycle
- add provider connection/account mapping infrastructure
- add invoice submission, sync, and error handling flows
- prepare a canonical invoice model for future structured export / Factur-X support

---

# Phased Roadmap

## Phase 1 — Compliance-Oriented Data Model

### Objective
Extend the existing schema so invoice, company, and customer data can support French e-invoicing requirements.

### Deliverables
- tenant/company legal identity fields
- customer legal and tax fields
- invoice compliance fields
- separate `commercialStatus` and `eInvoiceStatus`
- plan or implement normalized invoice lines structure
- preserve existing invoice flows while expanding capabilities

### Success Criteria
- current invoice creation still works
- legal/company/customer data is available for future provider mapping
- invoice records can store provider-related metadata and statuses

---

## Phase 2 — Integration Foundation

### Objective
Create a generic provider integration layer for external e-invoicing partners.

### Deliverables
- `integrations` module structure
- provider account mapping
- outbound job model
- integration logs
- provider interface/abstraction
- retry-safe service boundaries

### Success Criteria
- external provider logic is isolated from core business modules
- a provider can be added without rewriting invoice logic
- tenant-level provider connection model exists

---

## Phase 3 — Pennylane MVP Connector

### Objective
Build the first real provider connector using Pennylane as the initial target.

### Deliverables
- Pennylane module skeleton
- OAuth/token storage model
- customer mapping/sync
- invoice submission workflow
- invoice status polling/sync
- rejection/error handling

### Success Criteria
- a tenant can connect a Pennylane account
- an invoice can be submitted from Comptario to Pennylane
- provider identifiers and statuses are stored locally
- sync jobs can update invoice transmission status

---

## Phase 4 — Product UI and Operational Workflows

### Objective
Expose e-invoicing configuration and lifecycle clearly in the product.

### Deliverables
- company legal settings screen
- customer legal/tax profile fields in UI
- provider connection page
- invoice e-invoicing panel
- sync/rejection/error visibility
- resubmit / retry workflows where appropriate

### Success Criteria
- users can understand whether an invoice is only commercially issued or also successfully transmitted
- support/debugging is easier through visible provider data
- provider connection health is understandable

---

## Phase 5 — Canonical Invoice Model and Structured Export Preparation

### Objective
Prepare Comptario for structured invoice generation such as Factur-X in the future.

### Deliverables
- canonical invoice JSON model
- renderer separation between invoice data and visual PDF generation
- provider-independent mapping layer
- export preparation for structured e-invoice formats

### Success Criteria
- invoice data is no longer tightly coupled to display/PDF only
- future providers can consume a standard internal invoice representation
- Factur-X implementation becomes feasible later without reworking the whole invoice domain

---

## Phase 6 — Marketplace / Partner Readiness

### Objective
Prepare documentation, reliability, and flows for formal integration partnership.

### Deliverables
- stable provider connector
- tenant onboarding flow
- clear error handling and audit logging
- technical documentation for partnership review
- operational demo environment

### Success Criteria
- the integration can be presented to a provider partnership team
- the project can support pilot customers
- the roadmap can evolve from MVP to production-grade partner integration

---

# Scope Priorities

## Must Have
- data model expansion
- provider abstraction
- commercial vs e-invoice status separation
- provider account connection model
- Pennylane MVP connector
- invoice submission and status synchronization

## Should Have
- normalized invoice lines
- legal identity snapshots on invoice
- retry queue and audit trail
- customer/provider mapping admin tools

## Could Have
- Factur-X generation
- multi-provider routing
- inbound supplier invoice synchronization
- advanced reconciliation

---

# Out of Scope for Initial MVP

The following are intentionally out of scope for the first implementation cycle:

- becoming a certified French e-invoicing platform
- direct state/network interoperability as an approved platform
- full structured export implementation from day one
- complex inbound AP automation
- multi-provider orchestration before first provider success

---

# Risks

## Technical Risks
- breaking existing invoice flows while extending the schema
- coupling the invoice model too tightly to a single provider
- keeping invoice lines in JSON too long, which may slow later structured export work

## Product Risks
- unclear user experience between invoice issuance and actual e-invoice transmission
- insufficient legal/tax data collection from tenants and customers
- provider-specific errors not being exposed properly to users/admins

## Delivery Risks
- attempting provider integration before the internal model is ready
- skipping documentation and letting implementation drift
- implementing too much provider-specific logic in core modules

---

# Recommended Delivery Sequence

1. Add roadmap and architecture docs
2. Extend schema for France e-invoicing readiness
3. Introduce integration abstraction layer
4. Build Pennylane MVP connector
5. Expose UI for legal settings and statuses
6. Add audit/retry/sync hardening
7. Prepare structured export model

---

# Definition of Done for the Roadmap Stage

This roadmap stage is complete when:
- the project has documented phases and boundaries
- architecture direction is clear
- the implementation order is agreed
- the agent can follow repo-native documentation for incremental execution

---

# Next Step

The next implementation step after this roadmap is:

**Phase 1 schema preparation**
- analyze existing entities
- document schema gaps
- add/prepare legal, tax, and provider status fields
- avoid breaking current invoice flows