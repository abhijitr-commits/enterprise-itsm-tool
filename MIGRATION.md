# Migration roadmap — what's left

Phase 1 ported **Config, Common, Security, and the Incident Register
module**. Phase 2 ported **Service Requests (with approval workflow),
Problems, Changes (with CAB approval), Assets, CMDB, Knowledge Base
(with version history), and cross-module Reports**. Phase 3 (done)
ported **Admin & Identity — user management, the permission matrix
editor, Master Data (Departments/Locations/Categories/SLA Matrix), and
role-based sidebar visibility** — 15 of the original 116 files. The rest
of the original project is preserved in `../original-source/` (all 116
files, exactly as exported from Apps Script) so every future phase has
the real logic to port from, not a guess.

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

## Phase 3 — Admin & identity (done)

- `AdminEngine.gs` → `src/controllers/adminController.js`, `src/routes/adminRoutes.js`, `views/admin/*` — user management (create/edit, role + department, activate/deactivate, password reset — no email provider yet, so an admin sets the new password directly) and the permission matrix editor (toggle grid of action × role, backed by the `Permission` collection). The original's safety guard — Administrator can never lose `admin_manage_settings`/`admin_manage_users` — is enforced server-side (those two checkboxes are also disabled in the UI), plus an equivalent guard preventing the *last active Administrator* from being demoted or deactivated by anyone (there's no sheet to hand-edit as a fallback here, so locking everyone out would be unrecoverable without direct database access).
- `MasterDataEngine.gs` → `src/controllers/masterDataController.js`, `src/routes/masterDataRoutes.js`, `views/masterdata/*` — generic config-driven CRUD, same shape as the original's `MASTER_DATA_SHEETS`, covering Departments, Locations, Categories, and the SLA Matrix (this is where you set your **real** SLA hours, replacing the seeded defaults). "Roles" wasn't carried over as an editable table — roles are a fixed enum wired directly into the permission system (`config/constants.js` → `ROLE`), so there's nothing free-form to CRUD there; changing the role list is a code change, same as it effectively was in the original once `Security.gs` referenced role names directly.
- The `moduleVisibility` block in `Navigation.gs` → `src/middleware/moduleVisibility.js`, wired into `views/partials/header.ejs` — a sidebar link disappears entirely once a role has zero permissions left for that module (toggle it off in the new Permission Matrix and watch it vanish for that role), instead of staying as a dead link that just 403s.
- `Setup.gs`, `MakeMeAdmin.gs` — reviewed, not ported: their entire purpose (seed default rows, force one account to Administrator when you're locked out) is now handled automatically by `server.js`'s auto-seed-on-boot, plus the new Admin Console itself is the safe way to fix a role from now on.
- `QuickFix.gs` — reviewed, not ported: it's a one-off script for seeding 6 named conference rooms, unrelated to Admin/Identity — it belongs with Room Booking in Phase 5 if that data is still wanted then.
- `Navigation.gs`, `Style.html`, `Index.html`, `SignIn.html`, `Welcome.html` — reviewed, confirmed fully superseded by Express routing + `views/partials/header.ejs`/`footer.ejs` + `views/login.ejs`. Nothing else worth carrying over — the original's page-shell/menu logic is what `moduleVisibility` above already replaces, and the sign-in flow here uses a real login form instead of Google identity + a company-domain check (that domain check doesn't apply — logins are now app-level accounts, not Google accounts).
- `DriveConfigEngine.gs`, `BackupEngine.gs`, `MonitoringEngine.gs` — still deferred; re-think rather than port literally (e.g. backups become `mongodump` on a schedule, not a Drive export). Not blocking anything — revisit once there's real data worth backing up on a schedule.

## Phase 4 — HR suite

The largest remaining chunk, 20 modules — being delivered in sub-phases
(4A, 4B, …) rather than one giant update, same reasoning as grouping
ITSM's remaining modules into Phase 2: each sub-phase is a coherent,
testable slice instead of one enormous untestable drop.

### Phase 4A — Employee lifecycle core (done)

The foundation everything else in this phase builds on: a real employee
directory, self-service, and the onboarding/offboarding lifecycle.

- `EmployeeEngine.gs` → `src/models/Employee.js`, `src/controllers/employeeController.js`, `src/routes/employeeRoutes.js`, `views/employees/*` — full directory CRUD. Status-driven automation ported exactly: setting Status to "New" auto-creates onboarding Service Requests + an Onboarding checklist (+ Admin Onboarding checklist, on create only — matching the original's own asymmetry between `createEmployee()` and `updateEmployee()`) + a login; setting Status to "Left" auto-creates offboarding Service Requests (flagging any assets still assigned to them) + an Offboarding checklist + deactivates their login. Directory reads are open to any signed-in user (matches the original — `getAllEmployees()` had no permission check at all); create/edit are HR-team gated.
- `OnboardingEngine.gs` (checklists + resignations) → `src/models/Checklist.js`, `src/models/Resignation.js`, `src/models/ExitInterview.js`, `src/controllers/checklistController.js` + `resignationController.js`, `views/onboarding/*` + `views/resignations/*` — the four checklist sheets (Onboarding/Offboarding/Admin Onboarding/Admin Offboarding) became one collection with a `type` field; Resignations keep the same 5-way IT/Finance/HR/Manager/Admin clearance tracking, with the same auto-complete-on-all-clearances behavior (employee status flips to "Left", login deactivated) plus the structured Exit Interview form.
- `ProfileEngine.gs` → `src/controllers/profileController.js`, `views/profile/index.ejs` ("My Profile") — aggregates the signed-in user's Employee record + assets currently assigned to them. Matches by email against the Employee Directory (more reliable than the original's name-matching, since this app's logins already carry a canonical email). Leave balance and Trainings sections are placeholders — see Phase 4B/4D below.
- `OrgChartEngine.gs` → `src/controllers/orgChartController.js`, `views/orgchart/index.ejs` — same "Reports To" name-based hierarchy, anyone without a resolvable manager becomes a top-level root.
- `MyWorkEngine.gs` → `src/controllers/myWorkController.js`, `views/mywork/index.ejs` ("My Work") — My Tickets (incidents/requests where you're the reporter/requester or assigned engineer) + My Approvals (pending Service Requests/Changes you can act on) + a personal snapshot. Leave approvals will join this list once Phase 4B ships.
- `Security.gs`'s `isHRTeam()`/`isITTeam()`/`isAdminTeam()` → `src/utils/teamAccess.js` — the other half of the original's access model besides the Permission Matrix: some actions are gated by "does this person actually work in that team" (Department **and** Role together — Administrator, or Manager + the matching department), not just "can this role do this action." This directly extends the "department-wise access" requirement from Phase 3 to modules where a plain role check isn't enough (an IT Manager shouldn't manage HR's employee records just because they're a Manager).

Deliberately deferred within 4A, both because they depend on infrastructure this app doesn't have yet (same reasoning as Phase 2's RecordEngine/AttachmentEngine/EmailEngine deferral):
- `PreOnboardingDetailEngine.gs` (BGV vendor emails, IT-provisioning emails, a document vault with base64 uploads, a Welcome Kit sub-checklist) — needs both an email provider and file-upload storage, neither wired up yet.
- The automatic No Dues Certificate generation-and-email on resignation completion — needs a letter/PDF generator and an email provider. Completion is recorded in the audit log instead, same as every other "would have emailed someone" point so far.
- Auto user provisioning had to change shape, not just get deferred: the original could create a login with zero password because identity came from Google Sign-In; this app authenticates with email + password (no Google Workspace/SSO dependency — keeps everything free), so provisioning now generates a one-time temporary password shown once to whoever created the Employee record (a flash message), the same pattern as the auto-seed Administrator password printed to the server log on first boot.

### Phase 4B — Leave, Attendance & Shift (done)

- `LeaveEngine.gs` → `src/models/LeaveRequest.js`, `src/utils/leaveBalances.js`, `src/controllers/leaveController.js`, `views/leave/*` — apply/approve/reject (+ bulk decide) same as the Service Request/Change approval workflows; the four-balance calculation (Casual/Sick/Earned/Unpaid) is ported exactly, including Earned Leave's real accrual rule (a day only counts if the employee checked in AND it was a weekend/holiday AND they weren't actually rostered to work it). `leaveType` is tightened from free text to a fixed enum (`config/constants.js`'s `LEAVE_TYPE`) — the original's balance math already assumed exact strings like "Casual Leave", so a typo there would have silently broken someone's balance; this just makes that assumption explicit. Leave quotas (18/12/30 days) are fixed constants for the same reason `MIGRATION.md`'s Phase 3 SLA defaults were: the original read them from a "Settings" sheet with these numbers as the fallback, and there's no generic Settings screen here yet — genuinely adequate for a small company in the meantime.
- `AttendanceEngine.gs` → `src/models/Attendance.js`, `src/controllers/attendanceController.js`, `views/attendance/*` — same honor-system Check In/Check Out (not biometric/geofenced), same identity guarantee (you can only check yourself in/out — the employee name comes from your session, never from a form field). Viewing everyone's attendance is gated to `reports_view`, matching the original's `getAllAttendanceSafe()`.
- `ShiftEngine.gs` → `src/models/Shift.js` + `RosterEntry.js`, `src/controllers/shiftController.js`, `views/shifts/index.ejs` — shift definitions + a date-range roster; assigning a shift replaces any existing roster entry for that employee+date rather than double-booking them, same rule as the original.
- My Profile's Leave Balance section and My Work's Leave Approvals (both placeholders in 4A) are now wired to real data; the dashboard's "Pending Approvals" count now includes pending leave requests too.

Deferred within 4B, same email-provider reasoning as everywhere else: notifying a manager by email when leave is submitted, and notifying the employee by email on the decision (both recorded in the audit log instead), and Security.gs's approval-delegation mechanic (a Manager/Admin going on leave can name a delegate who temporarily inherits their approval rights) — the "Delegate To" field is captured and stored on the leave request, but doesn't do anything yet server-side.

### Phase 4C — Recruitment & referrals (done)

- `ATSEngine.gs` → `src/models/JobPosting.js` + `Candidate.js`, `src/controllers/recruitmentController.js`, `views/recruitment/*` — job postings + a candidate pipeline (Applied → Screening → Interview → Offer → Hired/Rejected). Moving a candidate to "Hired" automatically starts their Pre-Onboarding checklist, same as the original — which meant picking that checklist type back up: it turned out to belong to `OnboardingEngine.gs` itself (not the deferred `PreOnboardingDetailEngine.gs`), so it's now a 5th `CHECKLIST_TYPE` alongside the four from Phase 4A. Only the checklist (task tracking) is ported — the actual work behind each task (emailing a background-check vendor, emailing IT, a Welcome Kit sub-checklist) still needs `PreOnboardingDetailEngine.gs`'s email/document infrastructure and stays deferred.
- `ReferralEngine.gs` → `src/models/Referral.js`, `src/controllers/referralController.js`, `views/referrals/*` — any employee can refer a candidate for an open posting; the recruitment team tracks status and reward payout. **Bug fix vs. the original**: `addCandidate()` there unconditionally required `recruitment_manage`, but `submitReferral()` (open to every role) called it directly to drop the referred candidate into the pipeline — so in the original, anyone without `recruitment_manage` submitting a referral would hit a permission error *after* their referral was already recorded, a confusing half-success. This port splits that into an ungated internal function (used by both the referral flow and the guarded "add a candidate" route) plus the permission check only on the direct route — the same internal/public split already used for onboarding checklists.

Deferred alongside `PreOnboardingDetailEngine.gs` (see Phase 4A): the automatic hand-off details (BGV/IT-provisioning emails) that would normally follow a "Hired" stage change.

### Phase 4D — Performance & growth

`PMSEngine` (performance reviews), `SuccessionEngine`, `LMSEngine` (learning/training) — all HR-team gated like Employee Directory management. My Profile's Trainings section gets wired up once LMS lands.

### Phase 4E — Remaining employee-lifecycle modules

`BenefitsEngine`, `WellnessEngine`, `PolicyAcknowledgmentEngine`, `LetterEngine`, `EmployeeDocumentEngine` — `LetterEngine` and `EmployeeDocumentEngine` both need the same document-storage/PDF-generation infrastructure `PreOnboardingDetailEngine.gs` is waiting on, so they'll likely land together.

### Phase 4F — HR hub & wiring

`HR.gs`/`HR.html` (there's no separate HR.gs backend in the original — it's a client-side tab shell over the engines above) → a landing page tiling links to every HR module once they all exist, same idea as the Admin Console's summary page. Plus `MyWorkEngine`'s remaining pieces if any, `ExecutiveSummary`, final nav/permissions pass across all of Phase 4, and full verification + packaging.

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
