# Subprocessors Documentation

This document serves as the source of truth for all subprocessors used by MoneyFlow/Comptario in personal data processing activities. This information is displayed on the public `/legal/subprocessors` page.

**Last Updated**: January 1, 2025  
**Document Version**: 2.0  
**Review Schedule**: Quarterly  
**Next Review**: April 1, 2025

## Current Subprocessors

The following table lists all current subprocessors used by MoneyFlow:

| Provider | Purpose | Region | Data Categories | DPA Status | DPA Link | Added Date | Status |
|----------|---------|--------|-----------------|------------|----------|------------|--------|
| Amazon Web Services (AWS) | Cloud infrastructure and data storage | EU (Frankfurt), US | Personal data, financial records, metadata | Active | [AWS DPA](https://aws.amazon.com/service-terms/data-processing-addendum/) | 2024-01-01 | Active |
| Stripe | Payment processing and invoice management | EU, US | Payment data, customer information, invoices | Active | [Stripe DPA](https://stripe.com/privacy/dpa) | 2024-01-01 | Active |
| SendGrid (Twilio) | Email delivery and communication | EU, US | Email addresses, communication logs | Active | [SendGrid DPA](https://www.twilio.com/legal/data-protection-addendum) | 2024-01-01 | Active |
| Intercom | Customer support and live chat | EU, US | Support tickets, chat logs, user data | Active | [Intercom DPA](https://www.intercom.com/legal/dpa) | 2024-01-01 | Active |
| Google Analytics | Website analytics and usage statistics | EU, US | Usage data, analytics, anonymized metrics | Active | [Google DPA](https://privacy.google.com/businesses/processorterms/) | 2024-01-01 | Active |

## Safeguards and Security Measures

### Data Transfer Mechanisms

All international data transfers are protected under GDPR Chapter V with the following mechanisms:

1. **EU Adequacy Decisions**: For transfers to countries with adequate data protection
2. **Standard Contractual Clauses (SCC)**: For transfers to third countries
3. **Binding Corporate Rules (BCR)**: For multinational group transfers
4. **Certifications**: International security certifications (ISO 27001, SOC 2, etc.)

### Security Certifications by Provider

| Provider | Certifications | Adequacy Status | Additional Safeguards |
|----------|---------------|-----------------|----------------------|
| AWS | ISO 27001, SOC 2 Type II, PCI DSS | EU Adequacy (partial) | Data Transfer Agreement |
| Stripe | PCI DSS Level 1, SOC 2 | EU Adequacy (partial) | Data Processing Agreement |
| SendGrid | SOC 2 Type II, ISO 27001 | EU Adequacy (partial) | Data Transfer Agreement |
| Intercom | ISO 27001, SOC 2 | EU Adequacy (partial) | Data Processing Agreement |
| Google Analytics | ISO 27001, SOC 2 | EU Adequacy (partial) | Data Minimization, Google Cloud DPA |

## Data Categories Processed

### Personal Data Categories

1. **Identity Data**: Names, usernames, email addresses
2. **Contact Data**: Email addresses, phone numbers, company information
3. **Financial Data**: Payment information, transaction records, invoices
4. **Technical Data**: IP addresses, browser data, usage logs
5. **Communication Data**: Support tickets, chat logs, email communications
6. **Usage Data**: Analytics, feature usage, performance metrics

### Special Categories

- **Financial Records**: Accounting data, transaction history
- **Business Data**: Company information, supplier/customer details
- **Authentication Data**: Login credentials, two-factor authentication data

## Monitoring and Auditing Schedule

### Regular Monitoring Activities

| Activity | Frequency | Responsible Team | Next Due Date |
|----------|-----------|-----------------|---------------|
| Security Audits | Annual | Security Team | March 1, 2025 |
| Certification Reviews | Quarterly | Compliance Team | February 1, 2025 |
| DPA Compliance Check | Monthly | Legal Team | February 1, 2025 |
| Access Reviews | Quarterly | IT Team | February 1, 2025 |
| Data Minimization Review | Semi-annual | Data Protection Team | March 1, 2025 |

### Audit Trail

- All subprocessor activities are logged
- Regular compliance assessments conducted
- Annual third-party security audits
- Continuous monitoring of data processing activities

## CHANGELOG

### 2025-01-01 - Version 2.0
- **Updated**: Added comprehensive data categories table
- **Added**: Detailed security certifications for each provider
- **Added**: Monitoring and auditing schedule
- **Updated**: Enhanced DPA links and status tracking
- **Added**: CHANGELOG section for transparency

### 2024-12-01 - Version 1.5
- **Updated**: Google Analytics configuration for enhanced privacy
- **Added**: Data minimization measures for analytics data
- **Updated**: SendGrid DPA link following Twilio acquisition

### 2024-06-01 - Version 1.2
- **Added**: Intercom as customer support subprocessor
- **Updated**: AWS region specification (Frankfurt primary)
- **Enhanced**: Security certification details

### 2024-01-01 - Version 1.0
- **Initial**: First version of subprocessors documentation
- **Added**: Core subprocessors (AWS, Stripe, SendGrid, Google Analytics)
- **Established**: Basic DPA framework and compliance structure

## Customer Notification Process

### Notification Timeline

- **30 days advance notice** for any changes to subprocessors
- **7 days advance notice** for security-related updates
- **Immediate notification** for any data breaches or security incidents

### Notification Methods

1. **Email notifications** to all registered users
2. **In-app notifications** for active users
3. **Website updates** on the legal pages
4. **Blog announcements** for major changes

### Customer Rights

Customers have the right to:
- Object to new subprocessors (within 30 days)
- Request data portability before changes take effect
- Terminate service if they object to subprocessor changes
- Request additional information about any subprocessor

## Email Notification Template

### New Subprocessor Addition

```
Subject: Important Update: New Subprocessor Addition - [Subprocessor Name]

Dear [Customer Name],

We are writing to inform you of an upcoming change to our subprocessors list in accordance with our Data Processing Agreement and GDPR Article 28.

**What's Changing:**
We will be adding [Subprocessor Name] as a new subprocessor for [Purpose] services, effective [Date - 30 days from notice].

**Subprocessor Details:**
- Company: [Subprocessor Name]
- Purpose: [Purpose]
- Location: [Region]
- Data Categories: [Categories]
- Safeguards: [Security measures]
- DPA: [DPA Link]

**Your Rights:**
You have the right to object to this change within 30 days of this notice. If you object, we will work with you to find an alternative solution or, if necessary, provide you with data portability options.

**How to Object:**
If you wish to object to this subprocessor addition, please contact us at dpo@moneyflow.com within 30 days of this notice (by [Objection Deadline]).

**Questions:**
If you have any questions about this change, please don't hesitate to contact our Data Protection Team at dpo@moneyflow.com.

Thank you for your continued trust in MoneyFlow.

Best regards,
The MoneyFlow Team
Data Protection Office
```

### Subprocessor Removal

```
Subject: Subprocessor Update: Removal of [Subprocessor Name]

Dear [Customer Name],

We are writing to inform you that we will be discontinuing our use of [Subprocessor Name] as a subprocessor, effective [Date].

**What's Changing:**
- [Subprocessor Name] will no longer process personal data on our behalf
- All data processing activities have been migrated to [Alternative/Internal Solution]
- This change enhances [Benefit - e.g., security, privacy, performance]

**Data Handling:**
All personal data previously processed by [Subprocessor Name] has been:
- ✓ Securely migrated to [New Location/Processor]
- ✓ Deleted from [Subprocessor Name]'s systems
- ✓ Verified through audit procedures

**No Action Required:**
This change improves our data protection measures and requires no action from you.

**Questions:**
If you have any questions, please contact us at dpo@moneyflow.com.

Best regards,
The MoneyFlow Team
```

## Contact Information

**Data Protection Officer**: dpo@moneyflow.com  
**Legal Team**: legal@moneyflow.com  
**Customer Support**: support@moneyflow.com  

**Office Address**:  
MoneyFlow Data Protection Office  
[Company Address]  
[City, Country]  

## Compliance Framework

### GDPR Compliance

- Article 28: Processor obligations
- Article 44-49: Transfers to third countries
- Article 33-34: Data breach notifications
- Article 35: Data protection impact assessments

### Industry Standards

- ISO 27001: Information Security Management
- SOC 2 Type II: Service Organization Controls
- PCI DSS: Payment Card Industry Data Security Standard
- NIST Cybersecurity Framework

### Regular Reviews

This document is reviewed quarterly and updated as needed. All changes are tracked in the CHANGELOG section and communicated to customers according to our notification procedures.

---

**Document Control**:
- Owner: Data Protection Team
- Approver: Legal Team
- Distribution: Public (via website), Internal (compliance team)
- Classification: Public
- Retention: Permanent (with version control)