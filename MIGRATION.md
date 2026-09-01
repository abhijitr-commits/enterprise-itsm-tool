# Migration roadmap — what's left

Phase 1 ported **Config, Common, Security, and the Incident Register
module**. Phase 2 (done) ported **Service Requests (with approval
workflow), Problems, Changes (with CAB approval), Assets, CMDB,
Knowledge Base (with version history), and cross-module Reports** — 12
of the original 116 files. The rest of the original project is preserved
in `../original-source/` (all 116 files, exactly as exported from Apps
Script) so every future phase has the real logic to port from, not a
guess.

The remaining files fall into four natural phases, in the order I'd
recommend tackling them:

## Phase 2 — Finish core ITSM (done)

- `ServiceRequestEngine.gs` → `src/models/ServiceRequest.js`, `src/controllers/serviceRequestController.js`, `src/routes/requestRoutes.js`, `views/requests/*` — approval workflow (single + bulk decide) included.
- `ProblemEngine.gs` → `src/models/Problem.js`, `src/controllers/problemController.js`, `src/routes/problemRoutes.js`, `views/problems/*`.
- `ChangeEngine.gs` → `src/models/Change.js`, `src/controllers/changeController.js`, `src/routes/changeRoutes.js`, `views/changes/*` — CAB approval + implementation status + PIR close included.
- `AssetEngine.gs` → `src/models/Asset.js` + `AssetHistory.js`, `src/controllers/assetController.js`, `src/routes/assetRoutes.js`, `views/assets/*` — issue/return/decommission with history log included.
- `CMDBEngine.gs` → `src/models/ConfigurationItem.js`, `src/controllers/cmdbController.js`, `src/routes/cmdbRoutes.js`, `views/cmdb/*`.
- `KnowledgeEngine.gs` → `src/models/KnowledgeArticle.js`, `src/controllers/knowledgeController.js`, `src/routes/knowledgeRoutes.js`, `views/knowledge/*` — version history embedded per-article instead of a second collection.
- `ReportEngine.gs` → `src/controllers/reportController.js`, `views/reports/index.ejs` — SLA Compliance, Monthly Volume, Engineer Performance, Ticket Aging, Department Workload, Asset Warranty Expiry. The HR-dependent reports (Headcount, Attrition, Training Completion, Contract Expiry, Executive Summary) need the Phase 4 HR suite first.

Not yet ported from the original Phase 2 scope — need infrastructure this app doesn't have yet:
- `RecordEngine.gs`, `AttachmentEngine.gs` — shared record/attachment helpers (file upload storage isn't wired up yet; `multer` is installed but unused).
- `EmailEngine.gs` — needs a real email provider now (Apps Script used `MailApp`/`GmailApp` for free; a free-tier transactional email API like Resend or Brevo replaces it). Approval/decision events are currently recorded in history + the audit log instead of emailing anyone.
- `PublicIntake.html` + the public-form part of `IncidentEngine.gs` (honeypot + CAPTCHA + rate limit) — needs a CAPTCHA library (e.g. `hcaptcha` free tier).

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
