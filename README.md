# Enterprise ITSM Tool — Node.js + MongoDB (Phase 1 + 2 + 3 + 4A + 4B + 4C)

This is the Node.js/Express + MongoDB migration of the Enterprise ITSM
Tool off Google Apps Script + Google Sheets. It replaces the Sheets-based
storage (which has hard limits: 10M cells per spreadsheet, 6-minute Apps
Script execution caps, and no real concurrent-write handling) with a real
database that scales with your team.

**Phase 1 scope**: authentication, roles/permissions, and the full
Incident Register module (create, list, search/filter, update, close,
delete, bulk-close, comments, SLA due-date calculation with business-hours
+ holiday awareness) — ported field-for-field and logic-for-logic from the
original `IncidentEngine.gs`, `Security.gs`, and `Common.gs`.

**Phase 2 scope** (adds): Service Requests (with manager approval
workflow), Problems, Changes (with CAB approval + implementation status +
post-implementation review), Assets (issue/return/decommission with a
full history log), CMDB, Knowledge Base (with per-article version
history), and cross-module Reports (SLA compliance, monthly volume,
engineer performance, ticket aging, department workload, asset warranty
expiry).

**Phase 3 scope** (adds): the Admin Console — user management (create
logins, set role + department, activate/deactivate, reset passwords),
a permission matrix editor (control which role can do what, per action,
with a safety guard so Administrators can never lock themselves out),
Master Data management (Departments, Locations, Categories, SLA
Matrix — this is where you set your real SLA hours), and role-based
sidebar visibility (a module's link disappears for a role once its
permissions for that module are fully removed).

Once you're logged in as an Administrator, the sidebar shows an
**Admin** section (Admin Console / Users / Permissions / Master Data)
that no other role sees.

**Phase 4A scope** (adds, first slice of the HR suite): an Employee
Directory (with the same "New" status → onboarding automation and
"Left" status → offboarding automation as the original), Onboarding/
Offboarding checklists (standard + facilities/admin versions),
Resignations with 5-way clearance tracking and structured Exit
Interviews, a self-service "My Profile" page, a personal "My Work"
page (your tickets + your pending approvals), an Org Chart, and
department-aware access (HR team / Admin team / IT team, alongside
the existing role-based Permission Matrix).

**Phase 4B scope** (adds): Leave (apply/approve/reject, with the same
four-way balance calculation as the original — Casual, Sick, Earned,
and Unpaid), Attendance (self check-in/check-out, honor-system not
biometric), and Shifts &amp; Roster (shift definitions plus a
date-range roster). My Profile's Leave Balance and My Work's Leave
Approvals, both placeholders in 4A, are now wired to real data.

**Phase 4C scope** (adds): Recruitment (job postings + a candidate
pipeline through Applied → Screening → Interview → Offer → Hired/
Rejected, with "Hired" auto-starting a Pre-Onboarding checklist) and
Employee Referrals (any employee can refer a candidate; the
recruitment team tracks status and reward payout).

The rest of the HR suite (Performance/Learning, Benefits/Wellness,
and the IT-ops modules) are **not yet ported** — see `MIGRATION.md`
for the phased roadmap and what's needed for each.

## Stack (100% free tier)

- **Backend**: Node.js + Express
- **Database**: MongoDB Atlas (M0 free cluster, 512MB)
- **Frontend**: server-rendered EJS + plain CSS (no build step)
- **Hosting**: Render.com or Railway.app free web service tier
- **Sessions**: stored in MongoDB itself (`connect-mongo`) — no separate Redis needed

## Local setup

1. **Install dependencies**
   ```
   npm install
   ```

2. **Create a free MongoDB Atlas cluster**
   - Sign up at https://www.mongodb.com/cloud/atlas/register
   - Create a free "M0" cluster (512MB, $0/month forever)
   - Under "Database Access", create a database user + password
   - Under "Network Access", add your IP (or `0.0.0.0/0` for simplicity while testing)
   - Click "Connect" → "Drivers" → copy the connection string

3. **Configure environment**
   ```
   cp .env.example .env
   ```
   Paste your Atlas connection string into `MONGODB_URI`, and set a random
   `SESSION_SECRET`.

4. **Seed the database** (creates default permissions, a starter SLA
   matrix, and one Administrator login)
   ```
   npm run seed
   ```
   This prints the admin email/password it created — **change that
   password after your first login**. The SLA hours it seeds are sensible
   defaults (Critical: 4h, High: 8h, Medium: 24h, Low: 72h resolution),
   **not** your real SLA Matrix sheet's values — the Apps Script export
   only contains code, not spreadsheet row data, so adjust these once you
   have your real numbers (either edit `src/scripts/seed.js` and re-run,
   or edit the `SLAMatrix` collection directly in Atlas).

5. **Run it**
   ```
   npm run dev
   ```
   Visit http://localhost:3000 and sign in with the admin account from step 4.

## Deploying for free (Render.com)

1. Push this project to a GitHub repo (private is fine).
2. On https://render.com, create a new **Web Service**, connect the repo.
3. Build command: `npm install` — Start command: `npm start`.
4. Add the same environment variables from your `.env` (`MONGODB_URI`,
   `SESSION_SECRET`, etc.) in Render's dashboard.
5. Deploy. Render's free web service tier spins down after inactivity and
   wakes on the next request (a few seconds' delay) — fine for an internal
   tool with occasional use; upgrade later if that delay becomes annoying.

Railway.app works the same way if you prefer it over Render.

## What carried over exactly, and what changed

| Original (Apps Script) | This app | Notes |
|---|---|---|
| `Config.gs` constants | `src/config/constants.js` | Same values |
| `Common.gs` → `generateSequentialID()` | `src/utils/idGenerator.js` | Same format: `PREFIX-YYYY-NNNNNN` |
| `IncidentEngine.gs` → `calculateSLADue()` / `addBusinessHours()` | `src/utils/sla.js` | Same algorithm — skips Sat/Sun + holidays |
| `Security.gs` → `DEFAULT_PERMISSIONS_MAP` | `src/config/permissions.js` + `Permission` collection | Same action→role map, now DB-backed instead of sheet-backed |
| `Security.gs` → `hasPermission()`/`requirePermission()` | `src/utils/permissions.js` | Same logic, Express middleware instead of a thrown Error |
| Incident Register sheet (15 columns) | `Incident` model | Same fields, same names conceptually |
| Audit Log sheet | `AuditLog` collection | Same write-on-every-action pattern |
| Public incident form + honeypot/CAPTCHA/rate-limit | *(not yet ported)* | See MIGRATION.md — needs a public route + a CAPTCHA library |
| Email Queue + notifyUser() | *(not yet ported)* | See MIGRATION.md — needs an email provider (e.g. free-tier Resend/SendGrid) |
| Approval delegation (leave-based) | *(not yet ported)* | Depends on the Leave module, which isn't migrated yet |
| `AdminEngine.gs` (user mgmt + permission matrix) | `src/controllers/adminController.js` + `views/admin/*` | Same safety guard: Administrator can't lose `admin_manage_users`/`admin_manage_settings`; also guards against demoting/deactivating the last active Administrator |
| `MasterDataEngine.gs` (departments/locations/categories/SLA matrix) | `src/controllers/masterDataController.js` + `views/masterdata/*` | Same generic config-driven CRUD idea, now Mongoose models instead of sheets |
| `Navigation.gs`'s `moduleVisibility` | `src/middleware/moduleVisibility.js` | A sidebar link vanishes once a role's permissions for that module are all removed |
| `Setup.gs`, `MakeMeAdmin.gs` | *(superseded)* | Auto-seed-on-boot + the Admin Console itself replace both |
| `EmployeeEngine.gs` | `src/controllers/employeeController.js` + `views/employees/*` | Same New/Left status automation; login provisioning now generates a one-time temporary password instead of a passwordless row (see MIGRATION.md) |
| `OnboardingEngine.gs` (checklists + resignations) | `src/controllers/checklistController.js` + `resignationController.js` | 4 checklist sheets collapsed into one `ChecklistItem` collection with a `type` field; same 5-way clearance auto-complete for resignations |
| `ProfileEngine.gs`, `OrgChartEngine.gs`, `MyWorkEngine.gs` | `views/profile`, `views/orgchart`, `views/mywork` | Same aggregation logic; My Profile matches by email instead of by name |
| `Security.gs`'s `isHRTeam()`/`isITTeam()`/`isAdminTeam()` | `src/utils/teamAccess.js` | Department + Role gating, alongside the Phase 3 Permission Matrix |
| `LeaveEngine.gs` | `src/controllers/leaveController.js` + `src/utils/leaveBalances.js` | Same 4-way balance calc (Casual/Sick/Earned/Unpaid); `leaveType` tightened to an enum since the balance math needs exact strings |
| `AttendanceEngine.gs`, `ShiftEngine.gs` | `src/controllers/attendanceController.js` + `shiftController.js` | Same honor-system check-in/out and date-range roster |
| `ATSEngine.gs`, `ReferralEngine.gs` | `src/controllers/recruitmentController.js` + `referralController.js` | Same pipeline + "Hired" → Pre-Onboarding checklist; referral→candidate permission bug fixed (see MIGRATION.md) |

## Original source, kept for reference

The complete original 116-file Apps Script project (all modules — ITSM,
HR, IT ops, etc.) was exported and is included in `../original-source/`
alongside this app, so nothing is lost — it's the reference for every
future migration phase.
