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
- `src/services/aiService.ts` — `processCustomerChat`. Powers the single-customer chat overlay. Owns its own response schema, system instruction, and response parsing. Post-processes extracted fields to force `hasTradeIn = true` when any trade field is returned, and BOTH `stillOwe = true` AND `hasTradeIn = true` when any financial field (lienholder/payoffAmount/monthlyPayment/monthsRemaining) is returned (ensures fields hidden behind profile UI toggles are visible; mirrors how Bulk Intake forces hasTradeIn).
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
- `src/lib/templateRenderer.ts` — `renderTemplate(template, customer, modelYear)` for the Today-page text-template feature, plus `getDefaultModelYear()` (current year Jan–Aug, next year Sep–Dec). Pure function, deterministic substitution (NOT an AI call). Fully tested in `templateRenderer.test.ts`.
- `src/lib/duplicateDetection.ts` — `findDuplicates`. Used by Bulk Intake to flag rows that match existing customers or earlier rows in the same batch. Returns `strong` / `weak` / `household` levels.
- `src/lib/formSlots.ts` — `FORM_SLOTS` registry of PDF template filenames + labels. Used by Settings → Forms.
- `src/lib/pdfFieldMappings.ts` — per-template field mappings (Customer property → PDF AcroForm field name).
- `src/lib/timing.ts` — `timed(label, fn)` performance instrumentation helper.
- `src/lib/leadSource.ts` — the single source of truth for the Lead Source picker taxonomy (parent groups Walk-In / CRM / Referral / Social and their children, with labels), plus `findLeadSourceGroup()`. Typed against `Customer['leadSourceType']`.

### Components
- `src/components/` — atomic UI primitives: `InputField`, `Toggle`, `StatusBadge`, `SaveStatusIndicator`, `MenuButton`, `SubButton`, `NavItem`, `NavIconButton`, `AIChatOverlay` (accepts pasted images via Ctrl+V/Cmd+V in addition to Upload and Camera, routing through `handleSend`), `RescheduleButton`, `TextedCheckbox`, `TradeEquityPanel`, `VinLookupButtons`, `EditableChip` (click-to-expand chip with popover, used for status + leadSourceType on Bulk Intake rows), `CopyButton` (click-to-copy icon button with checkmark flash; used on the Today page for customer name + phone + rendered template text), `SegmentedControl` (always-visible fast segmented control pill for Status), `ChipSelect` (flat row of single-select chips with clearance support), `LeadSourceChips` (two-level hierarchal grouped chip picker).

### Views
- `src/views/LoginView.tsx` — Google sign-in screen.
- `src/views/DashboardView.tsx` — customer list grid.
- `src/views/TodayView.tsx` — reminder dashboard. Aggregates `getDueReminders(...)` across all customers. Each row has a `TextedCheckbox` (close reminders + roll cadence), a `RescheduleButton` (push to a specific date with a reason), and inline `CopyButton`s for customer name + phone. A template bar at the top accepts a dealer-pasted text template; when non-empty, each row renders a personalized preview via `renderTemplate` with a `CopyButton`. Template text and current model year persist in `localStorage` (`todayTemplate` + `latestModelYear`), NOT in Firestore. Each row also has an inline expandable Notes panel — a collapsed "Notes" strip below the row that, when clicked, opens an inline panel mirroring the profile's `TimelineNotesSection` (add-note input + scrollable notes feed). Only one row is expanded at a time; a single `subscribeToNotes` listener is active for the expanded customer, torn down on collapse.
- `src/views/CustomerProfileView.tsx` — sticky header (displays always-visible Status, Lead Source, and Contact controls using SegmentedControl, LeadSourceChips, and ChipSelect respectively, replacing the old popover-style EditableChips), the 6 form sections (composed from `src/views/profile/`), and the bottom action bar (App menu / AI menu / Insights menu / Customer menu).
- `src/views/BulkIntakeView.tsx` — screenshot(s) → AI extraction → review/edit table → batch commit. Accepts **up to 8 images per batch** (drag, browse, or paste — multiple at once). Thumbnails shown in a grid in the right column with per-image remove buttons. Each image fires its own `extractBulkCustomers` call; calls run in parallel via `Promise.allSettled` so a single failure doesn't kill the batch (failed image gets a red "Failed" thumbnail badge). Per-row Vehicle of Interest + Trade-In sub-cards, per-row + bulk-set Follow-Up date, duplicate flagging (works across images via the same `findDuplicates` logic), lead source chip, pending-interest banner.
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
- When multiple reminders combine into one card, the card's anchor (display) date is the date of the **heaviest-weight** member **among items that are due today or overdue**. Weight order (heaviest → lightest, defined in `REMINDER_WEIGHT`): `manual` > `anniversary` == `birthday` > `holiday` > `cadence`. Ties broken by earlier date. Future members in the same group still contribute to `reasons` and `labels` but cannot push the anchor date into the future. A group is dropped from today's view only when ALL its members are in the future; it resurfaces when the soonest item arrives. (Prior design absorbed a cadence-today into an upcoming holiday and dropped the card — fixed in the result loop of `getDueReminders`.)
- `getDueReminders(customer, today, config)` aggregates everything anchored to today (or overdue) for one customer; `TodayView` calls it once per customer.
- `recordContact(customer, when, closedKinds, config)` rolls the cadence forward and updates `lastContactedAt`. Wired to the "Texted" checkbox via `TextedCheckbox` → `App.handleTexted` → `customersService.updateCustomer` AND `contactsService.createContact`.
- The dealer can manually edit `nextCadenceDue` inline on the customer profile (pencil icon next to the date in the Relationship Cadence card) and add custom follow-ups via the same modal used by `RescheduleButton` on the Today view. Both flows ride the existing `handleReschedule` / `onChange` paths.
- To add a new `ReminderKind`: extend the union in `src/lib/reminders/engine.ts`, add a weight to `REMINDER_WEIGHT`, optionally add a knob to `REMINDER_CONFIG`, add a case inside `getDueReminders`, update `REASON_LABELS` in `TodayView.tsx`, allow the new kind in `isValidContact` (in `firestore.rules` AND `DRAFT_firestore.rules`), and add tests in `engine.test.ts`.
- Manual reminders live as an array on the customer doc (`manualReminders: { date, reason }[]`, rule-capped at 50 entries).

### Bulk Intake (`src/views/BulkIntakeView.tsx` + `src/services/bulkIntakeService.ts`)
- Drag-drop, upload, OR paste (Ctrl+V / ⌘V) **up to 8 screenshots per batch** (cap is `MAX_IMAGES` in `BulkIntakeView.tsx`). Each image fires its own Gemini call via `extractBulkCustomers`; all calls run in parallel via `Promise.allSettled` and results are merged into one review list. A single failure surfaces as a "Failed" thumbnail badge but doesn't block the other images.
- Source-CRM tags are recognized: `(New)` / `(Used)` → `vehicleXxx`; `(Trade-In)` → `tradeXxx` + `hasTradeIn=true`. Multiple "interest" vehicles: first wins for `vehicleXxx`, the rest concatenated into `pendingInterestNotes` for the dealer to handle manually. **A vehicle listed in a "Currently Owns" / "Garage" / "Current Vehicle" / "Currently Owned" section with NO explicit `(New)` / `(Used)` tag is treated as the trade-in** (sets `hasTradeIn=true`); if multiple vehicles appear in such a section, the newest by model year wins for `tradeXxx`. Explicit tags still override (a `(New)` or `(Used)` tagged vehicle inside a Garage section maps to vehicleXxx regardless).
- Lead metadata captured per row: `leadSource`, `leadGeneratedDate` (ISO-normalized).
- Each row gets a follow-up date (default = today + 30 days, chip presets 3d/7d/14d/30d, bulk-set bar at top).
- On commit, each customer doc is written with `nextCadenceDue = followUpDate` and `lastContactedAt = today` so the lead drops cleanly into the reminder engine.
- Duplicate detection (`findDuplicates`) flags rows matching existing customers OR earlier rows in the batch as `strong` / `weak` / `household`. The default action is `duplicate` (skip) for strong matches; user can override per row.

### Status, Source & Contact taxonomy

- `status: 'lead' | 'sold' | 'inactive'` — funnel position. Default `'lead'` (via `emptyCustomer`). The internal value `'lead'` displays as **"Unsold"** in `StatusBadge` and `SegmentedControl`. The Sold button auto-flips to `'sold'`; dealers can also manually edit via the segmented control row above the Customer Info card on the customer profile, or per-row in the Bulk Intake review screen using EditableChip.
- `leadSourceType` — optional structured source tag. The **pickable** values are grouped under four parents: `'walk-in'`, `'crm'` (with children `'vep'`, `'dealer-wizard'`, `'orphan'`), `'referral'` (with children `'referral-sold-customer'`, `'referral-friend'`, `'referral-family'`), and `'social'` (with children `'fb-marketplace'`, `'snap'`, `'fb-ads'`, `'tiktok'`). The TypeScript union ALSO carries four legacy values (`'showroom' | 'phone' | 'web' | 'other'`) so existing customer docs continue to type-check. Evaluated via taxonomy defined in `src/lib/leadSource.ts`. Coexists with the free-text `leadSource` (raw CRM-extracted string preserved for context).
- **AI extraction is restricted**: only `'walk-in'`, `'crm'`, and `'vep'` are auto-derivable. Other values are dealer-only via the chip picker options. `aiService.processCustomerChat` extracts only those three values (rest is UNCHANGED). `bulkIntakeService.extractBulkCustomers` deliberately does NOT extract `leadSourceType` at all — the bulk path uses the `deriveLeadSourceType` heuristic in `BulkIntakeView.tsx` + dealer chip override. Intentional exception to the "both extractors must stay in sync" gotcha.
- `deriveLeadSourceType(leadSource)` parses the **3rd slash-separated field** of CRM source strings. Maps `Service Customer` / contains `vep` → `'vep'`; `Phone Up` → `'crm'`; contains `walk` → `'walk-in'`. Anything else (Showroom, blank, missing 3rd field) → undefined; dealer picks via chip.
- `contactChannel: 'text' | 'crm-text' | 'email' | 'snapchat' | 'facebook'` — optional dealer-preferred communication channel for this customer. Profile-only, NEVER extracted by AI. Picker lives in the same top section on the profile as a flat single-select row of chips (ChipSelect). Not surfaced in Bulk Intake.
- Bulk Intake commit branches on row status: if `status === 'sold'`, applies the full Sold flow (stamp `purchaseDate`, roll buyer cadence via `rollNextCadence('buyer')`, override followUpDate to today, stamp `lastContactedAt = today`). Otherwise the lead path: `nextCadenceDue = row.followUpDate` (smart-computed; see next bullet), `lastContactedAt = row.lastActionDate` when the AI extracted a Note/Text last action, otherwise today.
- **Bulk Intake cadence from "Last Action"**: `bulkIntakeService` extracts transient `lastActionType` (`'note' | 'text' | 'task'`) and `lastActionDate` from the source CRM's Last Action column. These do NOT live on the Customer doc — they're returned via the `BulkExtractedRow` wrapper type and consumed in `BulkIntakeView`. The helper `followUpFromAction` sets the row's `followUpDate`: Note/Text > 30 days ago → today (overdue); Note/Text within 30 days → action date + 30; everything else (Task, missing) → today + 30 (default).
- The chip UI is implemented by `src/components/EditableChip.tsx` — generic over the option string type, supports a `color` (blue/emerald/gray/amber), `placeholder` (when value is undefined), and optional `allowClear` (adds a "— None —" entry). **EditableChip has been removed from the profile view (replaced by SegmentedControl, LeadSourceChips, and ChipSelect) but remains actively used by Bulk Intake rows.**

### Today page text templates

- The Today page has a deterministic text-template feature: dealer pastes a template with `[placeholder]` tokens, each customer row renders a personalized preview, dealer copies and texts via their CRM.
- Renderer lives in `src/lib/templateRenderer.ts`. **Deterministic, not AI** — pure string substitution. Six supported placeholders: `[name]`, `[trade model]`, `[trade year]`, `[vehicle model]`, `[vehicle year]`, `[latest model year]`. Matching is case-insensitive and tolerates whitespace inside brackets (`[Name]`, `[ name ]`, `[NAME]` all match).
- Fallback rules: `[vehicle model]` falls back to `tradeModel` if `vehicleModel` is missing ("newer version of what they drive"). `[vehicle year]` falls back to the dealer's current-model-year setting. `[latest model year]` always uses the setting, ignoring customer data. Missing data leaves the literal placeholder visible (`[trade model]` stays in the rendered text) so the dealer sees gaps before sending.
- Current model year setting: stored in `localStorage` under `latestModelYear`. Auto-suggested initial value via `getDefaultModelYear()`: current calendar year for months Jan–Aug, next year for Sep–Dec. Dealer can override anytime; setting persists per-device, NOT synced to Firestore.
- Template text also persists per-device via `localStorage` under `todayTemplate`. Debounced 500ms write on change.
- The Today row also shows inline `CopyButton`s for the customer name and phone. These render regardless of whether a template is active.

### Today page inline Notes panel

- Each Today row has a collapsible inline Notes panel. State lives in `TodayView`: `expandedCustomerId` (single-open), `expandedNotes`, `newNoteText`.
- Subscription model: at most ONE Firestore listener active at any time. The `useEffect` on `[expandedCustomerId, user]` calls `subscribeToNotes(expandedCustomerId, user.uid, setExpandedNotes, ...)` and returns the unsubscribe. No per-row preloading — collapsed rows show only "Notes" with no count.
- Adding a note goes through `App.tsx`'s `handleAddNoteForCustomer(customerId, content)`, which calls `createNote(customerId, { content, type: 'manual', authorId: user.uid })`. This is intentionally a SEPARATE handler from the profile-page `handleAddNote` — do not collapse them; the profile handler closes over `<currentCustomer.id>` and would mis-target.
- The TodayView panel visually mirrors `TimelineNotesSection.tsx`'s add-note row and notes feed (same Tailwind classes, same AI Discovery / Manual Entry badge logic, same date formatting). Cross-view sync is free because both call `subscribeToNotes` with the same `(customerId, authorId)` scope.
- No animations on expand/collapse — plain conditional render.

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
- There are TWO Gemini customer extractors with independent schemas (`aiService.processCustomerChat` for chat, `bulkIntakeService.extractBulkCustomers` for screenshots). Adding a Customer field means updating BOTH schemas, BOTH system instructions, AND (for dates) both normalization blocks. Exceptions: `leadSourceType` is intentionally extracted only by `aiService` (and only the 3 auto-derivable values: walk-in/crm/vep), while `bulkIntakeService` uses the `deriveLeadSourceType` heuristic + dealer chip override. `contactChannel` is never AI-extracted at all — profile-only via dealer chip. `bulkIntakeService` ALSO emits two transient fields (`lastActionType`, `lastActionDate`) that are NOT on the Customer type — they're returned in the `BulkExtractedRow` wrapper interface and consumed by `BulkIntakeView` to compute cadence dates at commit time.
- Setting `purchaseDate` is not just a date stamp — it triggers a cadence-mode transition in the reminder engine (lead → fresh buyer → standard buyer). The "Sold" button writes it; manual edits in `NewVehicleSection` also flip the customer's reminder behavior.
- Setting `purchaseDate` is not just a date stamp — it triggers a cadence-mode transition in the reminder engine (lead → fresh buyer → standard buyer). The "Sold" button writes it, proactively rolls a buyer-mode `nextCadenceDue` (3–6 months out), AND flips `status='sold'`. **Gating: the full `handleSold` patch (stamp / cadence / status flip) runs only when `currentCustomer.status !== 'sold'`** — already-sold customers get just a PDF regenerate, not a re-stamp. This means clicking Sold on a lead whose `purchaseDate` was previously populated (e.g. AI-extracted from a document or typed manually as a wrong value) WILL overwrite that `purchaseDate` to today — correct behavior, since clicking Sold means "they're buying NOW". The Bulk Intake commit path mirrors this when a preview row is marked Sold before commit (stamps `purchaseDate`, rolls buyer cadence, overrides the row's followUpDate). Manual edits to `purchaseDate` in `NewVehicleSection` flip reminder behavior but do NOT roll the cadence or change `status` — leftover lead state persists until the next Texted event or explicit profile edit.
- The Sold flow deliberately does NOT stamp `lastContactedAt` at sale time. The fresh-buyer engine closes the day-1 `followUp24h` reminder when `lastContactedAt > purchaseDate`; stamping the two equal (or off-by-microseconds) risks accidentally suppressing the day-1 follow-up. The dealer's first Texted post-sale stamps `lastContactedAt` correctly.
- `noUnusedLocals` is on. If you add a destructured variable you don't use, prefix with underscore or destructure differently — don't add `eslint-disable` unless there's a real reason (`id` strip in `customersService` and the `hasAnyData` destructure in `App.tsx` are the canonical examples).
- Auto-save's effect dependency array includes `pendingAINotes` and `pendingImages`. Buffering either one resets the 2s debounce. This is acceptable.
- Rules tests 6 and 7 fail not because of a rule bug but because newer Firebase client SDKs reject oversized doc IDs and 1MB strings with `INVALID_ARGUMENT` BEFORE the rule even runs. The assertions expect `PERMISSION_DENIED`. Leave them alone unless explicitly fixing.
- There are now TWO add-note paths in `App.tsx`: `handleAddNote` (profile view; closes over `<currentCustomer.id>`) and `handleAddNoteForCustomer(customerId, content)` (Today view; takes the id as an arg). Do not consolidate them — the profile handler depends on `currentCustomer` state that is not populated when the dealer is on the Today page. Likewise, the Today view manages its own `expandedNotes` state and subscription independently from the profile's `notes` state.

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
