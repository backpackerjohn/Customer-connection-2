# Security Specification - Customer Connect

## Data Invariants
1. A customer record MUST have a `createdBy` field matching the `request.auth.uid`.
2. `createdAt` MUST be set once and never changed.
3. `updatedAt` MUST match `request.time`.
4. Users can only read, update, or delete records they created.
5. All string fields have size limits to prevent "Denial of Wallet" attacks.

## The "Dirty Dozen" Payloads (Red Team Tests)
1. **Identity Spoofing**: Attempt to create a customer with someone else's `createdBy` UID.
2. **Identity Spoofing (Update)**: Attempt to update another user's customer record.
3. **Privilege Escalation**: Attempt to read all customers without filtering by `createdBy`.
4. **Shadow Field Injection**: Attempt to create a customer with a non-schema field `isVerified: true`.
5. **State Shortcut**: Attempt to update `createdAt` after initial creation.
6. **Resource Poisoning (ID)**: Attempt to create a customer with a 2KB document ID.
7. **Resource Poisoning (Field)**: Attempt to inject a 1MB string into the `firstName` field.
8. **Resource Poisoning (Type)**: Attempt to send a boolean for the `firstName` field.
9. **Unauthenticated Access**: Attempt to create a customer without being signed in.
10. **Partial Update Breach**: Attempt to update restricted fields like `createdBy` or `createdAt`.
11. **Email Spoofing**: Attempt to gain access using an unverified email (if verified required).
12. **Recursive Cost Attack**: Attempt a list query that bypasses the `createdBy` filter in the rule.

## The Test Runner
The tests will be implemented in `src/firestore.rules.test.ts` using the Firebase Rules Testing library.
