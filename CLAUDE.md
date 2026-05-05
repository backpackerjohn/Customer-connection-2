# Customer Connect — AI Agent Guide

## What this app is
A mobile-first dealer CRM. Dealers sign in with Google, create customer profiles, capture license/insurance/VIN data via AI photo extraction, and track notes per customer. All data lives in Firestore, scoped to the signed-in user.

## Stack
- React 19 + TypeScript + Vite
- Tailwind v4
- Firebase Auth + Firestore
- Google Gemini API (`@google/genai`, model `gemini-2.5-flash`) for vision + structured JSON extraction
- Motion (Framer Motion) for animations
- Vitest + @firebase/rules-unit-testing for tests

## File layout
- `src/App.tsx` — owns ALL state and effects (auth, customers list, current customer, notes, auto-save, AI overlay open/closed). Routes between LoginView, DashboardView, and CustomerProfileView. Pure prop drilling — no Context, no Redux, no React Query.
- `src/types.ts` — `Customer`, `Note`, `emptyCustomer`. The single source of truth for the data model.
- `src/lib/firebase.ts` — Firebase init, `db`, `auth`, `handleFirestoreError`. Don't touch unless changing Firebase config.
- `src/lib/imageNormalizer.ts` — pre-Gemini image processing.
- `src/lib/dateNormalizer.ts` — `toISODate`. Tested.
- `src/services/customersService.ts` — `createCustomer`, `updateCustomer`, `subscribeToCustomers`. THE ONLY PLACE outside this file that should call `addDoc`/`updateDoc`/`onSnapshot` for the customers collection.
- `src/services/notesService.ts` — same chokepoint for the notes subcollection.
- `src/services/aiService.ts` — `processCustomerChat`. Owns the Gemini schema, system instruction, and response parsing.
- `src/services/inventoryService.ts` — mock inventory (3 vehicles). Will be replaced by a real feed eventually; do not redesign yet.
- `src/components/` — atomic UI primitives (InputField, Toggle, StatusBadge, SaveStatusIndicator, MenuButton, SubButton, NavItem, NavIconButton, AIChatOverlay).
- `src/views/LoginView.tsx` — Google sign-in screen.
- `src/views/DashboardView.tsx` — customer list grid.
- `src/views/CustomerProfileView.tsx` — sticky header, the 6 form sections (composed from `src/views/profile/`), and the bottom action bar.
- `src/views/profile/*Section.tsx` — one file per form card (CustomerInfo, Insurance, NewVehicle, TradeIn, Goals, TimelineNotes). Each takes `{ customer, onChange }` (TimelineNotes takes additional notes/newNote/onAddNote props).
- `firestore.rules` — security rules. Strict; rejects unknown fields on update, oversized strings, identity spoofing.
- `security_spec.md` — the "dirty dozen" attack scenarios. Mapped to tests in `tests/firestore.rules.test.ts`.

## Conventions

### Adding a new Customer field
This is the most common change and the most error-prone. To add a field you MUST update FIVE places. Missing any one of them produces a silent bug.

1. `src/types.ts` — add to the `Customer` interface.
2. `src/services/aiService.ts` — add to `responseSchema.properties.updatedFields.properties` AND to `propertyOrdering` AND to the "EXTRACT THESE FIELDS" list in the system instruction.
3. `firestore.rules` — add a type/size check inside `isValidCustomer`, AND add the field name to the `affectedKeys().hasOnly([...])` list in the update rule.
4. `src/views/profile/*Section.tsx` — render an `<InputField>` (or `<Toggle>`) wired to `customer.<field>` and `onChange({ <field>: v })`.
5. If the field is a date — add it to the `toISODate` normalization block at the bottom of `processCustomerChat`.

### Adding Firestore reads/writes
Always go through `src/services/customersService.ts` or `src/services/notesService.ts`. Never call `addDoc`, `updateDoc`, or `onSnapshot` directly from a view or component.

### Date fields
HTML `<input type="date">` only displays values formatted as YYYY-MM-DD. The AI is instructed to return ISO; the `toISODate` helper is the safety net. Don't accept raw user date strings elsewhere without normalizing.

### Auto-save behavior (App.tsx)
- Debounced 2 seconds after the last edit.
- Will not fire unless `isDirty && user && hasAnyData`. `hasAnyData` checks 8 fields (firstName, lastName, phone, email, dlNumber, vehicleVin, address, insuranceCompany) — adding new "anchor" fields here is fine; removing one might prevent saves for valid edge cases.
- After first create, the doc id is stashed into local state at `setCurrentCustomer(prev => ({ ...prev, id }))`. The `id` field is stripped before being sent back to Firestore — see `customersService.updateCustomer`. **Do not remove that destructure** — Firestore rules reject `id` as a writable field, and removing the strip will cause "Missing or insufficient permissions" on every update.
- AI-generated notes for a brand-new customer are buffered in `pendingAINotes` and flushed inside the auto-save's create branch.

## Do not touch

- **Unwired placeholder sub-buttons** in `src/views/CustomerProfileView.tsx` bottom action bar:
  - App menu: Dashboard, Customers, Leads
  - AI menu: Test Drive, Sold (Chat IS wired)
  - Insights menu: Vehicle Selector, Summary, Objections
  - Customer menu: Profile, Call, Text
  These are intentional placeholders for future features. Leave them in place with their current icons and labels.
- **Mock inventory** in `src/services/inventoryService.ts` (P1234, N5678, U9999). Replace with a real feed only when explicitly requested.
- **The dual stock fields** (`vehicleStock` + `inventoryStockFound` in the AI response). There's a deliberate fallback in `AIChatOverlay.tsx` that copies `inventoryStockFound` into `vehicleStock` when the inventory lookup misses. Keep both fields.
- **`emailVerified` enforcement in firestore.rules.** Currently not enforced. The corresponding test in `tests/firestore.rules.test.ts` is `it.skip`. If you add the enforcement, unskip the test in the same change.

## Common gotchas

- The Gemini model id is `gemini-2.5-flash`. `gemini-3-flash-preview` was a real bug that returned an empty response and silently broke extraction. Don't change the model id without verifying it exists.
- The Gemini response schema MUST include `propertyOrdering` on every object. Without it, Gemini omits later properties and you get partial extraction.
- The `noUnusedLocals` typecheck is on. If you add a destructured variable you don't use, prefix with underscore or destructure differently — don't add `eslint-disable` unless there's a real reason (`id` strip in customersService is the canonical example).
- Auto-save's effect dependency array includes `pendingAINotes`. Buffering a note resets the 2s debounce. This is acceptable.

## Running

- `npm install` — install
- `npm run dev` — local dev (port 3000); requires `GEMINI_API_KEY` and Firebase config
- `npm run lint` — typecheck + ESLint
- `npm run build` — production build
- `npm run test` — Vitest unit tests (no emulator needed)
- `npm run test:rules` — Firestore rules tests (auto-starts the emulator via firebase-tools)

## Where to get more context

- `security_spec.md` — the security model and the "dirty dozen" attack scenarios that the rules tests cover.
- `firebase-blueprint.json` — declarative schema of the Firestore collections.
- `README.md` — quick-start.
