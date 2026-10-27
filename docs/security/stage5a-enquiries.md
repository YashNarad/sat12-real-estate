# SAT12 Stage 5A enquiry privacy and operations

## Access model

- Anyone may complete the public form for a currently published, non-archived property after Stage 5B enables the guarded database function.
- The database derives both the current published revision and recipient. The browser cannot choose an owner, recipient, status, or revision.
- Anonymous callers can execute only `submit_property_enquiry`; they cannot select, insert, update, or delete enquiry rows directly.
- The Owner/Agent snapshotted as `recipient_id` may read the buyer details and change only status to `new`, `contacted`, or `closed`.
- AAL2 administrators may inspect and update enquiries only for moderation or support. AAL1 administrators receive no administrative enquiry access.
- Authenticated senders may read their own enquiry under the existing participant model. They cannot change its status or contents.

## Property lifecycle

An enquiry retains the stable property ID, exact published revision at submission, and recipient at submission. If a property is unpublished, archived, or transferred, the historic lead remains visible to its original recipient. A later owner does not inherit historic buyer contact information. New submissions are rejected unless the stable property still points to a `published` revision and is not archived.

## Abuse controls and activation

Stage 5A includes strict length validation, a honeypot, a 15-minute same-property/email duplicate lock, and a three-per-hour email limit inside PostgreSQL. These controls do not constitute reliable distributed or IP-based rate limiting; email addresses can be rotated.

Submission is therefore fail-closed twice:

1. `SAT12_ENQUIRIES_ENABLED` must be `true` in the server runtime.
2. PostgreSQL setting `app.settings.enquiry_submissions_enabled` must be `on` for the guarded RPC.

Stage 5B must not enable both gates until an enforceable edge/API rate limit (or equivalent approved abuse-control service), monitoring, incident response, and privacy notice are configured and verified.

## Retention and consent decisions

The existing design proposes anonymizing closed enquiries 12 months after closure while retaining property, status, and aggregate-safe identifiers. That period, the exact anonymization fields, deletion-request procedure, legal-hold behavior, and notice language still require operational/legal approval. No automatic deletion is implemented in Stage 5A.

Buyer-facing copy states that contact details are shared with the assigned Owner/Agent to answer the enquiry and explicitly notes that production retention terms are pending. It makes no unsupported legal or response-time promises.
