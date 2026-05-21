# Customer Connect — AI Agent Guide

## What this app is
A mobile-first dealer CRM. Dealers sign in with Google, create customer profiles, capture license/insurance/VIN data via AI photo extraction, run trade-in valuations, generate Test Drive and Sold paperwork, bulk-import contacts from screenshots of other CRMs, and follow a reminder engine that tracks pre-sale lead cadence and post-sale outreach. All data lives in Firestore, scoped to the signed-in user.

## Stack
- React 19 + TypeScript + Vite
- Tailwind v4
- Firebase Auth + Firestore + Storage
- Google Gemini API (`@google/genai`, model `gemini-2.5-flash`) for vision + structured JSON extraction (chat extraction, screenshot extraction, trade valuation, VIN image reading)
- NHTSA vPIC API for VIN decoding
- pdf-lib for filling and merging packet PDFs
- Motion (Framer Motion) for animations
- Vitest + @firebase/rules-unit-testing for tests

## File layout

### Entry & state
- `src/main.tsx` — Vite entry.
- `src/App.tsx` — owns ALL state and effects. Routes between five views: `dashboard`, `today`, `profile`, `settings`, `bulk-intake`. State includes auth, customers list, current customer, notes, save status, AI overlay open/closed, Test Drive packet generation, Sold packet generation, trade valuation, plus error toasts for each. Pure prop drilling — no Context, no Redux, no React Query.
- `src/types.ts` — `Customer`, `Note`, `emptyCustomer`, `FirestoreTimestamp`. The single source of truth for the data model.

### Firebase / Firestore
- `src/lib/firebase.ts` — Firebase init, `db`, `auth`, `storage`, `OperationType`, `handleFirestoreError`. Don't touch unless changing Firebase config.
- `src/services/customersService.ts` — `createCustomer`, `updateCustomer`, `subscribeToCustomers`. THE ONLY PLACE outside this file that should call `addDoc`/`updateDoc`/`onSnapshot` for the customers collection.
- `src/services/notesService.ts` — chokepoint for the `notes` subcollection.
- `src/services/contactsService.ts` — chokepoint for the `contacts` subcollection. Each record represents one dealer outreach (text, call, etc.); the reminder engine uses these to mark cadence reminders closed.
- `src/services/imagesService.ts` — Firebase Storage operations (customer images + blank PDF retrieval).

### Gemini extractors (two of them — keep their schemas in sync)
- `src/services/aiService.ts` — `processCustomerChat`. Powers the single-customer chat overlay. Owns its own response schema, system instruction, and response parsing.
- `src/services/bulkIntakeService.ts` — `extractBulkCustomers`. Powers Bulk Intake's screenshot OCR. Owns its own response schema, system instruction (with tag recognition for `(New)`/`(Used)`/`(Trade-In)` and lead-source/lead-generated-date extraction), and post-processing pipeline.

### Domain services
- `src/services/inventoryService.ts` — mock inventory (3 vehicles: P1234, N5678, U9999). Will be replaced by a real feed eventually; do not redesign yet.
- `src/services/valuationService.ts` — `getTradeValuation`. Uses Gemini to look up trade-in valuation tiers (excellent / very good / good / fair). VIN+mileage cached in-memory.
- `src/services/vinService.ts` — `decodeVin` via NHTSA vPIC, `extractVinFromImage` via Gemini.
- `src/services/pdfService.ts` — owns BOTH Test Drive and Sold packet generation. `buildTestDrivePacket` and `buildSoldPacket` merge filled templates; `selectSoldForms(customer)` conditionally picks slots (always: `delivery-report`, `deal-checklist`, `privacy-policy`; if `payingCash`: `three-liner`; if `hasTradeIn && stillOwe`: `payoff`).

### Reminders engine
- `src/lib/reminders/config.ts` — `REMINDER_CONFIG`: cadence windows (lead 26–30d, fresh buyer 7d window, standard buyer 3–6 months), holiday list, follow-up timing knobs.
- `src/lib/reminders/engine.ts` — `getDueReminders(customer, today, config)`, `recordContact(...)`, `computeNextCadenceDue(...)`, `rollNextCadence(...)`, `ReminderKind` type union, `REMINDER_WEIGHT` constant. Customer lifecycle: **lead** → (Sold button stamps `purchaseDate` AND rolls a buyer-mode `nextCadenceDue` 3–6 months out) → **fresh buyer** (7-day window, no combining; fires `followUp24h`, `referral48to72h`, birthday, manual) → **standard buyer** (3–6 month cadence) → anniversary forever.
- `src/lib/reminders/engine.test.ts` — exhaustive coverage of cadence, fresh buyer follow-ups, referrals, anniversary, holiday combining, manual reminders, and the weighted-anchor combining behavior. The clearest spec for how reminders fire.

### Other libs
- `src/lib/imageNormalizer.ts` — pre-Gemini image processing.
- `src/lib/dateNormalizer.ts` — `toISODate`. Tested.
- `src/lib/duplicateDetection.ts` — `findDuplicates`. Used by Bulk Intake to flag rows that match existing customers or earlier rows in the same batch. Returns `strong` / `weak` / `household` levels.
- `src/lib/formSlots.ts` — `FORM_SLOTS` registry of PDF template filenames + labels. Used by Settings → Forms.
- `src/lib/pdfFieldMappings.ts` — per-template field mappings (Customer property → PDF AcroForm field name).
- `src/lib/timing.ts` — `timed(label, fn)` performance instrumentation helper.

### Components
- `src/components/` — atomic UI primitives: `InputField`, `Toggle`, `StatusBadge`, `SaveStatusIndicator`, `MenuButton`, `SubButton`, `NavItem`, `NavIconButton`, `AIChatOverlay`, `RescheduleButton`, `TextedCheckbox`, `TradeEquityPanel`, `VinLookupButtons`, `EditableChip` (click-to-expand chip with popover, used for status + leadSourceType on profile and Bulk Intake rows).

### Views
- `src/views/LoginView.tsx` — Google sign-in screen.
- `src/views/DashboardView.tsx` — customer list grid.
- `src/views/TodayView.tsx` — reminder dashboard. Aggregates `getDueReminders(...)` across all customers. Each row has a `TextedCheckbox` (close reminders + roll cadence) and `RescheduleButton` (push the reminder to a specific date with a reason).
- `src/views/CustomerProfileView.tsx` — sticky header, the 6 form sections (composed from `src/views/profile/`), and the bottom action bar (App menu / AI menu / Insights menu / Customer menu).
- `src/views/BulkIntakeView.tsx` — screenshot → AI extraction → review/edit table → batch commit. Per-row Vehicle of Interest + Trade-In sub-cards, per-row + bulk-set Follow-Up date, paste support (Ctrl+V / ⌘V), duplicate flagging, lead source chip, pending-interest banner.
- `src/views/SettingsView.tsx` — Settings screen.
- `src/views/profile/*Section.tsx` — one file per form card: `CustomerInfoSection`, `InsuranceSection`, `NewVehicleSection`, `TradeInSection`, `GoalsSection`, `TimelineNotesSection`. Each takes `{ customer, onChange }` (`TimelineNotesSection` also takes `notes`/`newNote`/`onAddNote`/`onReschedule` props — the last drives the inline cadence edit and the Add Custom Follow-Up button; `TradeInSection` takes valuation props).
- `src/views/settings/FormsManagerSection.tsx` — upload / replace / delete blank PDF templates.

### Rules & schema
- `firestore.rules` — security rules. Strict; rejects unknown fields on update, oversized strings, identity spoofing.
- `DRAFT_firestore.rules` — byte-identical work-in-progress mirror. Any change to `firestore.rules` MUST be applied to this file too; `diff firestore.rules DRAFT_firestore.rules` must produce no output.
- `storage.rules` — Storage security rules. Per-user customer images + signed-in-reads on `forms/`.
- `tests/firestore.rules.test.ts` — runs against the Firebase emulator. Covers the "dirty dozen" attack scenarios plus per-field size limits.
- `security_spec.md` — the "dirty dozen" attack scenarios mapped to the tests.
- `firebase-blueprint.json` — declarative schema of the Firestore collections.

## Conventions

### Adding a new Customer field
The most common change and the most error-prone. To add a field you MUST update EIGHT places. Missing any one of them produces a silent bug.

1. `src/types.ts` — add to the `Customer` interface. If the field is non-optional, also add to `emptyCustomer`.
2. `src/services/aiService.ts` — add to `responseSchema.properties.updatedFields.properties` AND `propertyOrdering` AND the "EXTRACT THESE FIELDS" list in the system instruction.
3. `src/services/bulkIntakeService.ts` — add to `responseSchema.properties.customers.items.properties` AND `propertyOrdering` AND the system instruction.
4. `firestore.rules` — add a type/size check inside `isValidCustomer`, AND add the field name to BOTH the create rule's `keys().hasOnly([...])` list and the update rule's `affectedKeys().hasOnly([...])` list.
5. `DRAFT_firestore.rules` — apply identical edits. `diff firestore.rules DRAFT_firestore.rules` must produce no output.
6. `src/views/profile/*Section.tsx` — render an `<InputField>` (or `<Toggle>`) wired to `customer.<field>` and `onChange({ <field>: v })`.
7. If the field is a date — add it to the `toISODate` normalization block in BOTH `aiService.ts` (`processCustomerChat`) AND `bulkIntakeService.ts` (`extractBulkCustomers`).
8. If the field is a Storage URL — also update `storage.rules` and ensure the upload path matches the rule pattern.

Strongly recommended: add a size-validation test case to `tests/firestore.rules.test.ts` (`assertSucceeds` for a valid value, `assertFails` for an oversize or wrong-type value).

### Adding Firestore reads/writes
Always go through `src/services/customersService.ts`, `notesService.ts`, or `contactsService.ts`. Never call `addDoc`, `updateDoc`, or `onSnapshot` directly from a view or component.

### Adding a new PDF form template
1. Append a new entry to `FORM_SLOTS` in `src/lib/formSlots.ts`.
2. Settings → Forms shows it automatically.
3. To USE it, add a mapping array in `pdfFieldMappings.ts` and a fill function in `pdfService.ts`, then wire it into the Test Drive (`buildTestDrivePacket`) or Sold (`buildSoldPacket` + `selectSoldForms`) flow.

### Date fields
HTML `<input type="date">` only displays values formatted as YYYY-MM-DD. The AI is instructed to return ISO; the `toISODate` helper is the safety net. Don't accept raw user date strings elsewhere without normalizing.

### Auto-save behavior (`src/App.tsx`)
- Debounced 2 seconds after the last edit. Effect dep array: `[currentCustomer, isDirty, user, pendingAINotes, pendingImages]`.
- Will not fire unless `isDirty && user && hasAnyData`. `hasAnyData` strips system/control fields (`id`, `status`, `hasTradeIn`, `stillOwe`, `createdAt`, `updatedAt`) and checks whether ANY remaining field is non-empty OR either toggle (`hasTradeIn` / `stillOwe`) has been flipped. It does NOT enumerate specific "anchor" fields.
- After first create, the doc id is stashed into local state at `setCurrentCustomer(prev => ({ ...prev, id }))`. The `id` field is stripped before being sent back to Firestore — see `customersService.updateCustomer`. **Do not remove that destructure** — Firestore rules reject `id` as a writable field, and removing the strip will cause "Missing or insufficient permissions" on every update.
- AI-generated notes for a brand-new customer are buffered in `pendingAINotes` and flushed inside the auto-save's create branch.
- AI-extracted images (license / insurance) for a brand-new customer are buffered in `pendingImages` and flushed similarly, with URLs patched into the just-created doc.

### Reminders engine (`src/lib/reminders/`)
- Customer lifecycle: **lead** (cadence 26–30 days, configurable; reminder kind `cadence`) → after the Sold button stamps `purchaseDate` AND rolls a buyer-mode `nextCadenceDue` → **fresh buyer** (7-day window, no combining; fires `followUp24h`, `referral48to72h`, plus birthday/manual) → after the window → **standard buyer** (cadence 3–6 months; reminder kind `cadence`) → `anniversary` reminder yearly forever.
- **Today's view shows ONLY what is anchored to today or overdue.** Calendar events (holidays, birthdays, anniversaries) do NOT surface early — they wait for their actual date (with backward grace). The `combineWindow` (7 days, in `REMINDER_CONFIG.lead.combineWindowDays` and `REMINDER_CONFIG.buyer.combineWindowDays`) is used to (a) pull in upcoming cadence/manual/calendar items within the next 7 days so the engine can detect same-week absorption, and (b) group items that fall within 7 days of each other into a single reminder card.
- When multiple reminders combine into one card, the card's anchor (display) date is the date of the **heaviest-weight** member. Weight order (heaviest → lightest, defined in `REMINDER_WEIGHT`): `manual` > `anniversary` == `birthday` > `holiday` > `cadence`. Ties broken by earlier date. Cards whose anchor date is in the future are dropped from today's view and resurface when their anchor arrives.
- `getDueReminders(customer, today, config)` aggregates everything anchored to today (or overdue) for one customer; `TodayView` calls it once per customer.
- `recordContact(customer, when, closedKinds, config)` rolls the cadence forward and updates `lastContactedAt`. Wired to the "Texted" checkbox via `TextedCheckbox` → `App.handleTexted` → `customersService.updateCustomer` AND `contactsService.createContact`.
- The dealer can manually edit `nextCadenceDue` inline on the customer profile (pencil icon next to the date in the Relationship Cadence card) and add custom follow-ups via the same modal used by `RescheduleButton` on the Today view. Both flows ride the existing `handleReschedule` / `onChange` paths.
- To add a new `ReminderKind`: extend the union in `src/lib/reminders/engine.ts`, add a weight to `REMINDER_WEIGHT`, optionally add a knob to `REMINDER_CONFIG`, add a case inside `getDueReminders`, update `REASON_LABELS` in `TodayView.tsx`, allow the new kind in `isValidContact` (in `firestore.rules` AND `DRAFT_firestore.rules`), and add tests in `engine.test.ts`.
- Manual reminders live as an array on the customer doc (`manualReminders: { date, reason }[]`, rule-capped at 50 entries).

### Bulk Intake (`src/views/BulkIntakeView.tsx` + `src/services/bulkIntakeService.ts`)
- Drag-drop, upload, OR paste (Ctrl+V / ⌘V) a screenshot. Gemini extracts multiple customers in one call.
- Source-CRM tags are recognized: `(New)` / `(Used)` → `vehicleXxx`; `(Trade-In)` → `tradeXxx` + `hasTradeIn=true`. Multiple "interest" vehicles: first wins for `vehicleXxx`, the rest concatenated into `pendingInterestNotes` for the dealer to handle manually.
- Lead metadata captured per row: `leadSource`, `leadGeneratedDate` (ISO-normalized).
- Each row gets a follow-up date (default = today + 30 days, chip presets 3d/7d/14d/30d, bulk-set bar at top).
- On commit, each customer doc is written with `nextCadenceDue = followUpDate` and `lastContactedAt = today` so the lead drops cleanly into the reminder engine.
- Duplicate detection (`findDuplicates`) flags rows matching existing customers OR earlier rows in the batch as `strong` / `weak` / `household`. The default action is `duplicate` (skip) for strong matches; user can override per row.

### Status & Source taxonomy

- `status: 'lead' | 'sold' | 'inactive'` — funnel position. Default `'lead'` (via `emptyCustomer`). The internal value `'lead'` displays as **"Unsold"** in `StatusBadge` and `EditableChip`. The Sold button auto-flips to `'sold'`; dealers can also manually edit via the chip row above the Customer Info card on the customer profile, or per-row in the Bulk Intake review screen.
- `leadSourceType: 'walk-in' | 'crm' | 'referral' | 'vep' | 'showroom' | 'phone' | 'web' | 'other'` — optional structured source tag. Coexists with the free-text `leadSource` (raw CRM-extracted string preserved for context). The structured tag drives chip displays and is filter-friendly.
- Bulk Intake derives `leadSourceType` client-side from raw `leadSource` text via the `deriveLeadSourceType` heuristic in `BulkIntakeView.tsx`. The dealer can override per row via the chip BEFORE commit.
- `aiService.processCustomerChat` extracts `leadSourceType` from chat input. `bulkIntakeService.extractBulkCustomers` deliberately does NOT — the bulk path uses the heuristic + chip override. Intentional exception to the "both extractors must stay in sync" gotcha.
- Bulk Intake commit branches on row status: if `status === 'sold'`, applies the full Sold flow (stamp `purchaseDate`, roll buyer cadence via `rollNextCadence('buyer')`, override followUpDate to today). Otherwise the lead path: `nextCadenceDue = row.followUpDate`, `lastContactedAt = today`.
- The chip UI is implemented by `src/components/EditableChip.tsx` — generic over the option string type, supports a `color` (blue/emerald/gray/amber), `placeholder` (when value is undefined), and optional `allowClear` (adds a "— None —" entry).

## Do not touch

- **Unwired placeholder sub-buttons** in `src/views/CustomerProfileView.tsx` bottom action bar:
  - App menu: Dashboard, Customers, Leads
  - Insights menu: Vehicle Selector, Summary, Objections
  - Customer menu: Profile, Call, Text
  These are intentional placeholders for future features. Leave them in place with their current icons and labels. (AI menu: Chat, Test Drive, and Sold are ALL wired — `handleChat`, `handleTestDrive`, `handleSold` in `App.tsx`.)
- **Mock inventory** in `src/services/inventoryService.ts` (P1234, N5678, U9999). Replace with a real feed only when explicitly requested.
- **The dual stock fields** (`vehicleStock` + `inventoryStockFound` in the AI chat response). There's a deliberate fallback in `AIChatOverlay.tsx` that copies `inventoryStockFound` into `vehicleStock` when the inventory lookup misses. Keep both fields.
- **`emailVerified` enforcement in `firestore.rules`.** Currently not enforced. The corresponding test in `tests/firestore.rules.test.ts` (test 11) is `it.skip`. If you add the enforcement, unskip the test in the same change.
- **The exact filenames in `formSlots.ts`** — `pdfService.ts` references them by literal string. Renaming silently breaks Test Drive and/or Sold packets.
- **`PRIVACY_POLICY_FIELDS` in `pdfFieldMappings.ts` is intentionally empty.** The Privacy Policy template is treated as static legal text — there are no fillable AcroForm fields to map. The other four Sold-packet arrays (`DELIVERY_REPORT_FIELDS`, `DEAL_CHECKLIST_FIELDS`, `PAYOFF_FIELDS`, `THREE_LINER_FIELDS`) are populated and guarded by length-assertion tests in `pdfFieldMappings.test.ts` to prevent silent regression back to empty.
- **The `isValidCustomer` validator is at the Firestore 1000-expression evaluation cliff.** Adding new optional fields is OK (each adds ~3 expressions and is well-tested), but a refactor that meaningfully widens the rule (e.g. nested object validators) needs careful budget accounting or legitimate writes will start failing with `PERMISSION_DENIED`. If you see "maximum of 1000 expressions to evaluate has been reached" in the rules-test stderr after a change, you've blown the budget.

## Common gotchas

- The Gemini model id is `gemini-2.5-flash`. `gemini-3-flash-preview` was a real bug that returned an empty response and silently broke extraction. Don't change the model id without verifying it exists.
- The Gemini response schema MUST include `propertyOrdering` on every object. Without it, Gemini omits later properties and you get partial extraction.
- There are TWO Gemini customer extractors with independent schemas (`aiService.processCustomerChat` for chat, `bulkIntakeService.extractBulkCustomers` for screenshots). Adding a Customer field means updating BOTH schemas, BOTH system instructions, AND (for dates) both normalization blocks. Exception: `leadSourceType` is intentionally extracted only by `aiService`; the bulk path uses the `deriveLeadSourceType` heuristic in `BulkIntakeView.tsx` + dealer chip override.
- Setting `purchaseDate` is not just a date stamp — it triggers a cadence-mode transition in the reminder engine (lead → fresh buyer → standard buyer). The "Sold" button writes it; manual edits in `NewVehicleSection` also flip the customer's reminder behavior.
- Setting `purchaseDate` is not just a date stamp — it triggers a cadence-mode transition in the reminder engine (lead → fresh buyer → standard buyer). The "Sold" button writes it, proactively rolls a buyer-mode `nextCadenceDue` (3–6 months out), AND flips `status='sold'`. The Bulk Intake commit path mirrors this when a preview row is marked Sold before commit (stamps `purchaseDate`, rolls buyer cadence, overrides the row's followUpDate). Manual edits to `purchaseDate` in `NewVehicleSection` flip reminder behavior but do NOT roll the cadence or change `status` — leftover lead state persists until the next Texted event or explicit profile edit.
- The Sold flow deliberately does NOT stamp `lastContactedAt` at sale time. The fresh-buyer engine closes the day-1 `followUp24h` reminder when `lastContactedAt > purchaseDate`; stamping the two equal (or off-by-microseconds) risks accidentally suppressing the day-1 follow-up. The dealer's first Texted post-sale stamps `lastContactedAt` correctly.
- `noUnusedLocals` is on. If you add a destructured variable you don't use, prefix with underscore or destructure differently — don't add `eslint-disable` unless there's a real reason (`id` strip in `customersService` and the `hasAnyData` destructure in `App.tsx` are the canonical examples).
- Auto-save's effect dependency array includes `pendingAINotes` and `pendingImages`. Buffering either one resets the 2s debounce. This is acceptable.
- Rules tests 6 and 7 fail not because of a rule bug but because newer Firebase client SDKs reject oversized doc IDs and 1MB strings with `INVALID_ARGUMENT` BEFORE the rule even runs. The assertions expect `PERMISSION_DENIED`. Leave them alone unless explicitly fixing.

## Running

- `npm install` — install
- `npm run dev` — local dev (port 3000); requires `GEMINI_API_KEY` and Firebase config
- `npm run lint` — typecheck + ESLint (`tsc --noEmit && eslint .`)
- `npm run build` — production build
- `npm run test` — Vitest unit tests (no emulator needed)
- `npm run test:watch` — Vitest in watch mode
- `npm run test:rules` — Firestore rules tests (auto-starts the emulator via firebase-tools)

## Where to get more context

- `security_spec.md` — the security model and the "dirty dozen" attack scenarios that the rules tests cover.
- `firebase-blueprint.json` — declarative schema of the Firestore collections.
- `README.md` — quick-start.
- `src/lib/reminders/engine.test.ts` — exhaustive coverage of cadence/freshBuyer/anniversary/holiday behavior. The clearest spec for how reminders fire.
- `DRAFT_firestore.rules` — should always be byte-identical to `firestore.rules`.
