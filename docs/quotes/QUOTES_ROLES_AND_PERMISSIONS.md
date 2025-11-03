# Quotes — Roles & Permissions

Define who can create, send, approve, discount, and revise.

## Roles
- Admin
  - Manage templates, numbering, legal blocks, role policies
  - Full override (with audit log)
- Approver (Manager)
  - Can send quotes, approve revisions, and apply high discounts
  - Set approval thresholds and exception notes
- Sales (Creator)
  - Create/edit drafts, propose discounts up to threshold, send if allowed
- Viewer
  - Read-only access to quotes and PDFs

## Capabilities by Role
- Create/Edit Draft: Sales, Approver, Admin
- Send/Resend/Remind: Approver, Admin (optionally Sales by policy)
- Apply Line/Global Discounts:
  - Sales ≤ X% (configurable per org)
  - Approver > X%
- Approve Revision: Approver, Admin
- Convert to Invoice/Order: Approver, Admin (optionally Sales)
- Manage Templates/Numbering/Legal: Admin only
- Export CSV/PDF Bundle: Sales, Approver, Admin

## Approval Rules (Examples)
- Discounts > 15% require Approver approval
- Deposits/Advances > 50% require Approver approval
- Currency changes after Sent require revision approval

## Audit & Notifications
- All sensitive actions (send, discount > X, approve, convert) logged in audit with actor and timestamp
- Optional notifications to relevant managers when approvals are needed
