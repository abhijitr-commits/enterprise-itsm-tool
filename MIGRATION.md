# Migration roadmap — what's left

Phase 1 (this app, done) ported **Config, Common, Security, and the
Incident Register module** — 5 of the original 116 files. The rest of the
original project is preserved in `../original-source/` (all 116 files,
exactly as exported from Apps Script) so every future phase has the real
logic to port from, not a guess.

The remaining files fall into five natural phases, in the order I'd
recommend tackling them:

## Phase 2 — Finish core ITSM

Same pattern as Incidents (a `*Engine.gs` file + its `.html`/`.js.html`
view), so this phase is the fastest per file since the scaffolding
(auth, permissions, SLA, audit log) already exists.

- `ServiceRequestEngine.gs` + `ServiceRequest.html` / `.js.html` — includes approval workflow
- `ProblemEngine.gs` + `ProblemRegister.html` / `.js.html`
- `ChangeEngine.gs` + `ChangeRegister.html` / `.js.html` — includes change approval
- `AssetEngine.gs` + `AssetRegister.html` / `.js.html`
- `CMDBEngine.gs` + `CMDB.html` / `.js.html`
- `KnowledgeEngine.gs` + `KnowledgeBase.html` / `.js.html` — includes version history
- `ReportEngine.gs` + `Reports.html` / `.js.html`
- `RecordEngine.gs`, `AttachmentEngine.gs` — shared record/attachment helpers used across modules
- `EmailEngine.gs` — needs a real email provider now (Apps Script used `MailApp`/`GmailApp` for free; a free-tier transactional email API like Resend or Brevo replaces it)
- `PublicIntake.html` + the public-form part of `IncidentEngine.gs` (honeypot + CAPTCHA + rate limit) — needs a CAPTCHA library (e.g. `hcaptcha` free tier) since there's no Apps Script `CacheService` equivalent built in

Mongoose models for all of these already exist in `src/models/` (`ServiceRequest.js`, `Problem.js`, `Change.js`, `Asset.js`, `AssetHistory.js`, `ConfigurationItem.js`, `KnowledgeArticle.js`, `Vendor.js`) — only the routes/controllers/views need writing, following `incidentController.js` as the template.

## Phase 3 — Admin & identity

- `AdminEngine.gs` + `AdminConsole.html` / `.js.html` — user management, permission matrix editor (replaces hand-editing the `Permission` collection)
- `MasterDataEngine.gs` — departments/locations/categories/SLA matrix management UI
- `Setup.gs` — becomes largely unnecessary (Mongoose handles schema setup), but check it for any one-time defaults worth keeping
- `MakeMeAdmin.gs`, `QuickFix.gs` — one-off admin utility scripts; review before porting, may not be needed long-term
- `Navigation.gs`, `Style.html`, `Index.html`, `SignIn.html`, `Welcome.html` — the original's shell/nav/login chrome, superseded by `views/partials/` and `views/login.ejs`, but check for any menu items or copy worth carrying over
- `DriveConfigEngine.gs`, `BackupEngine.gs`, `MonitoringEngine.gs` — infra/ops helpers specific to the Sheets+Drive setup; re-think rather than port literally (e.g. backups become `mongodump` on a schedule, not a Drive export)

## Phase 4 — HR suite

The largest remaining chunk. Each is its own module with an Engine + view pair, same pattern as ITSM:

`EmployeeEngine`, `OnboardingEngine`, `PreOnboardingDetailEngine`, `ProfileEngine` + `MyProfile`, `OrgChartEngine` + `OrgChart`, `LeaveEngine`, `AttendanceEngine`, `ShiftEngine`, `BenefitsEngine`, `PMSEngine` (performance), `SuccessionEngine`, `LMSEngine` (learning), `ATSEngine` + `Recruitment` (hiring), `ReferralEngine`, `WellnessEngine`, `PolicyAcknowledgmentEngine`, `LetterEngine`, `EmployeeDocumentEngine`, `HR.gs` + `HR.html`/`.js.html`, `MyWorkEngine` + `MyWork`, `ExecutiveSummary`.

Recommend seeding the `Employee`/`Department`/`Location` collections (models already exist) from your real HR data before building this phase, since almost everything here references an employee record.

## Phase 5 — IT operations & facilities

`ITHelpdeskEngine` + `ITHelpdesk`, `ITAssetAllocationEngine` + `ITAssetAllocation`, `ITClearanceEngine` + `ITClearance`, `ITVendor`, `ITManagement` + `.js.html`, `VendorServiceEngine`, `MaintenanceEngine` + `Maintenance`, `SoftwareLicenseEngine`, `StockEngine`, `PurchaseEngine` + `PurchaseVendor`, `VendorEngine`, `RequirementEngine` + `Requirement`, `RoomBookingEngine` + `RoomBooking`, `ComplaintEngine` + `ComplaintBooking`, `AccessRequestEngine`, `NotificationChannelEngine`, `AutomationEngine`, `ExpenseEngine`.

## How to port each module (the pattern used for Incidents)

1. Read the original `*Engine.gs` file in `../original-source/` — note the sheet's exact columns and every function's validation/permission checks.
2. Add or adjust the Mongoose model in `src/models/` to match those columns.
3. Add the module's actions to `src/config/permissions.js` (they're already listed in the full `DEFAULT_PERMISSIONS_MAP` you can find inside `../original-source/Security.gs` — Phase 1 only copied the ITSM-relevant subset).
4. Write a controller in `src/controllers/` porting each function 1:1 (same validation, same audit log calls, same notification points).
5. Write routes in `src/routes/`, guarded with `requirePermission()`/`guard()` matching the original's checks.
6. Write EJS views under `views/` following the Incident views as a template for consistent look and feel.
7. Add a smoke test following `src/scripts/smoketest.js`'s pattern before calling the module done.
