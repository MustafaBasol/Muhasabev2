# France E-Invoicing Architecture for Comptario

## Purpose

This document describes the technical architecture required to make Comptario ready for France 2026 e-invoicing through a provider integration strategy.

It is intentionally provider-agnostic, with Pennylane as the initial implementation target.

---

# Core Architectural Principles

## 1. Provider-Agnostic Core Domain
The core invoice domain must remain independent from any single provider.
Pennylane is the first integration target, but internal business entities should not depend on Pennylane-specific field naming or constraints.

## 2. Canonical Invoice First
Comptario should maintain a canonical internal invoice model.
External providers should be served through mapping layers, not by reshaping core business logic around provider payloads.

## 3. Separate Commercial Lifecycle from E-Invoicing Lifecycle
Current invoice business status is not enough for e-invoicing.
We must distinguish:
- commercial/business state
- external transmission/compliance/network state

## 4. Incremental Delivery
The architecture must allow phased implementation:
- schema expansion first
- integration foundation second
- first provider connector third
- structured export later

## 5. Avoid Big-Bang Rewrites
Existing invoice and customer modules should be extended safely.
No full rewrite unless required.

---

# High-Level System Model

## Core Functional Layers

### A. Core Business Domain
Responsible for:
- organizations/tenants
- memberships/users
- customers
- products/services
- quotes
- invoices
- payments/subscriptions

### B. E-Invoicing Preparation Layer
Responsible for:
- legal identity completeness
- invoice compliance fields
- normalized invoice lines
- canonical invoice representation
- tax/legal snapshots

### C. Integration Layer
Responsible for:
- provider connection/account storage
- token handling
- provider-specific APIs
- outbound invoice submission
- polling/sync
- mapping external statuses to internal statuses
- logging and retry

### D. Presentation Layer
Responsible for:
- legal settings screens
- provider connection UI
- invoice transmission status UI
- sync/rejection visibility

---

# Proposed Backend Module Structure

```text
backend/src/
  integrations/
    common/
      interfaces/
      dto/
      entities/
      services/
    pennylane/
      dto/
      entities/
      services/
      pennylane.module.ts
  einvoicing/
    dto/
    services/
    mappers/
    validators/
  invoices/
  customers/
  tenants/
  organizations/