require("dotenv").config();
const path = require("path");
const express = require("express");
const session = require("express-session");
const MongoStore = require("connect-mongo");
const morgan = require("morgan");
const cookieParser = require("cookie-parser");

const connectDB = require("./config/db");
const { attachUser } = require("./middleware/auth");
const { attachModuleVisibility } = require("./middleware/moduleVisibility");
const authRoutes = require("./routes/authRoutes");
const incidentRoutes = require("./routes/incidentRoutes");
const requestRoutes = require("./routes/requestRoutes");
const problemRoutes = require("./routes/problemRoutes");
const changeRoutes = require("./routes/changeRoutes");
const assetRoutes = require("./routes/assetRoutes");
const cmdbRoutes = require("./routes/cmdbRoutes");
const knowledgeRoutes = require("./routes/knowledgeRoutes");
const reportRoutes = require("./routes/reportRoutes");
const adminRoutes = require("./routes/adminRoutes");
const masterDataRoutes = require("./routes/masterDataRoutes");
const employeeRoutes = require("./routes/employeeRoutes");
const checklistRoutes = require("./routes/checklistRoutes");
const resignationRoutes = require("./routes/resignationRoutes");
const profileRoutes = require("./routes/profileRoutes");
const myWorkRoutes = require("./routes/myWorkRoutes");
const orgChartRoutes = require("./routes/orgChartRoutes");
const leaveRoutes = require("./routes/leaveRoutes");
const attendanceRoutes = require("./routes/attendanceRoutes");
const shiftRoutes = require("./routes/shiftRoutes");
const recruitmentRoutes = require("./routes/recruitmentRoutes");
const referralRoutes = require("./routes/referralRoutes");
const performanceRoutes = require("./routes/performanceRoutes");
const successionRoutes = require("./routes/successionRoutes");
const trainingRoutes = require("./routes/trainingRoutes");
const benefitsRoutes = require("./routes/benefitsRoutes");
const wellnessRoutes = require("./routes/wellnessRoutes");
const policyRoutes = require("./routes/policyRoutes");
const lettersRoutes = require("./routes/lettersRoutes");
const documentRoutes = require("./routes/documentRoutes");
const hrHubRoutes = require("./routes/hrHubRoutes");
const helpdeskRoutes = require("./routes/helpdeskRoutes");
const itAllocationRoutes = require("./routes/itAllocationRoutes");
const itClearanceRoutes = require("./routes/itClearanceRoutes");
const accessRequestRoutes = require("./routes/accessRequestRoutes");
const vendorRoutes = require("./routes/vendorRoutes");
const vendorServiceRoutes = require("./routes/vendorServiceRoutes");
const purchaseRoutes = require("./routes/purchaseRoutes");
const requirementRoutes = require("./routes/requirementRoutes");
const stockRoutes = require("./routes/stockRoutes");
const licenseRoutes = require("./routes/licenseRoutes");
const roomRoutes = require("./routes/roomRoutes");
const complaintRoutes = require("./routes/complaintRoutes");
const maintenanceRoutes = require("./routes/maintenanceRoutes");
const expenseRoutes = require("./routes/expenseRoutes");
const dashboardRoutes = require("./routes/dashboardRoutes");
const itHubRoutes = require("./routes/itHubRoutes");
const systemPolicyRoutes = require("./routes/systemPolicyRoutes");
const publicIntakeRoutes = require("./routes/publicIntakeRoutes");
const attachmentRoutes = require("./routes/attachmentRoutes");
const searchRoutes = require("./routes/searchRoutes");
const safetyRoutes = require("./routes/safetyRoutes");
const salesRoutes = require("./routes/salesRoutes");
const workOrderRoutes = require("./routes/workOrderRoutes");
const ecrRoutes = require("./routes/ecrRoutes");
const shipmentRoutes = require("./routes/shipmentRoutes");
const materialRequestRoutes = require("./routes/materialRequestRoutes");
const operationsHubRoutes = require("./routes/operationsHubRoutes");

/*************************************************************
 * Auto-seed on boot — runs automatically every time the server
 * starts (safe/idempotent). This exists so a free host with no
 * shell/console access (e.g. Render's free tier) still ends up
 * with Permissions, an SLA Matrix, and one Administrator login,
 * with zero manual "run this command" steps required.
 *
 * - Permissions and SLA Matrix are always upserted (cheap, safe
 *   to repeat, and picks up new actions as more modules ship).
 * - The Administrator account is created ONLY if the User
 *   collection is completely empty, so it never overwrites real
 *   accounts/passwords created later.
 *************************************************************/
async function autoSeed() {
  const Permission = require("./models/Permission");
  const SLAMatrix = require("./models/SLAMatrix");
  const User = require("./models/User");
  const Room = require("./models/Room");
  const Department = require("./models/Department");
  const Category = require("./models/Category");
  const Holiday = require("./models/Holiday");
  const { generateSequentialId } = require("./utils/idGenerator");
  const { DEFAULT_PERMISSIONS_MAP } = require("./config/permissions");
  const { PRIORITY, ROLE, COMPANY_EMAIL_DOMAIN } = require("./config/constants");

  for (const [action, allowedRoles] of Object.entries(DEFAULT_PERMISSIONS_MAP)) {
    await Permission.updateOne({ action }, { $set: { allowedRoles } }, { upsert: true });
  }

  const DEFAULT_INCIDENT_SLA_HOURS = {
    [PRIORITY.CRITICAL]: { response: 1, resolution: 4 },
    [PRIORITY.HIGH]: { response: 2, resolution: 8 },
    [PRIORITY.MEDIUM]: { response: 4, resolution: 24 },
    [PRIORITY.LOW]: { response: 8, resolution: 72 },
  };
  for (const [priority, hours] of Object.entries(DEFAULT_INCIDENT_SLA_HOURS)) {
    await SLAMatrix.updateOne(
      { module: "Incident", priority },
      { $set: { responseTimeHours: hours.response, resolutionTimeHours: hours.resolution } },
      { upsert: true }
    );
  }

  // Master Data -> SLA Matrix supports Problem/Change/Request too (see
  // masterDataController.js's module options), but only Incident ever
  // had default rows — the other three modules had nothing to compare
  // against for SLA reporting/breach checks out of the box. Same
  // upsert-on-every-start pattern as Incident above, just looser
  // targets since these are lower-urgency than a live Incident.
  const DEFAULT_OTHER_SLA_HOURS = {
    Problem: {
      [PRIORITY.CRITICAL]: { response: 4, resolution: 48 },
      [PRIORITY.HIGH]: { response: 8, resolution: 96 },
      [PRIORITY.MEDIUM]: { response: 24, resolution: 168 },
      [PRIORITY.LOW]: { response: 48, resolution: 336 },
    },
    Change: {
      [PRIORITY.CRITICAL]: { response: 4, resolution: 24 },
      [PRIORITY.HIGH]: { response: 8, resolution: 48 },
      [PRIORITY.MEDIUM]: { response: 24, resolution: 120 },
      [PRIORITY.LOW]: { response: 48, resolution: 240 },
    },
    Request: {
      [PRIORITY.CRITICAL]: { response: 4, resolution: 24 },
      [PRIORITY.HIGH]: { response: 8, resolution: 48 },
      [PRIORITY.MEDIUM]: { response: 24, resolution: 96 },
      [PRIORITY.LOW]: { response: 48, resolution: 168 },
    },
  };
  for (const [module, byPriority] of Object.entries(DEFAULT_OTHER_SLA_HOURS)) {
    for (const [priority, hours] of Object.entries(byPriority)) {
      await SLAMatrix.updateOne(
        { module, priority },
        { $set: { responseTimeHours: hours.response, resolutionTimeHours: hours.resolution } },
        { upsert: true }
      );
    }
  }

  // Port of RoomBookingEngine.gs's seedDefaultConferenceRooms() — seeds
  // the company's real conference rooms once, so there's something to
  // book immediately instead of an empty list. Idempotent: only runs
  // when the Room collection is completely empty.
  const roomCount = await Room.countDocuments();
  if (roomCount === 0) {
    const defaultRooms = ["Board Room", "Mechanical Meeting Room", "Tech-Ops Meeting Room1", "Tech-Ops Meeting Room2", "Cabin1", "Cabin2"];
    for (const roomName of defaultRooms) {
      const roomId = await generateSequentialId("ROOM");
      await Room.create({ roomId, roomName });
    }
    console.log(`[auto-seed] First run: created ${defaultRooms.length} default conference room(s).`);
  }

  // Seeds the Department master list (Admin Console -> Master Data ->
  // Departments) so every "Department" field across the app — Employee
  // Directory, Incidents, Assets, Work Orders, and the rest — has a
  // real list to pick from instead of a blank free-text box. Names
  // match exactly what src/utils/teamAccess.js compares against
  // (case-insensitive) for HR/IT/Administration team gating, plus the
  // real business departments this company's other modules (Sales,
  // Work Orders, Safety, etc.) already assume. Idempotent: only runs
  // when the Department collection is completely empty, so an Admin's
  // own edits/additions on the Master Data page are never overwritten.
  const departmentCount = await Department.countDocuments();
  if (departmentCount === 0) {
    const defaultDepartments = [
      "HR",
      "IT",
      "Administration",
      "Sales",
      "Production",
      "Engineering",
      "Robotics",
      "Electrical",
      "Electronics",
      "Software",
      "Technical",
      "Logistics",
      "Safety",
      "Finance",
      "Quality",
    ];
    await Department.insertMany(defaultDepartments.map((name) => ({ name })));
    console.log(`[auto-seed] First run: created ${defaultDepartments.length} default department(s).`);
  }

  // Master Data -> Categories already existed and is already Admin-
  // editable, but no controller ever consumed it and it was never
  // seeded, so Incidents' Category field and Assets' Type field were
  // both plain free text with nothing to suggest. incidentController.js
  // and assetController.js now offer these as <datalist> suggestions —
  // seed a starting set so that isn't a blank list on day one.
  // Idempotent: only runs when the whole Category collection is empty,
  // so an Admin's own edits/additions are never overwritten.
  const categoryCount = await Category.countDocuments();
  if (categoryCount === 0) {
    const defaultCategories = [
      ...["Hardware", "Software", "Network", "Access", "Robotics/Equipment"].map((name) => ({ name, module: "Incident" })),
      ...["Laptop", "Desktop", "Monitor", "Printer", "Network Equipment", "Robot Arm", "Sensor Module", "Actuator", "Controller Board", "Software License"].map(
        (name) => ({ name, module: "Asset" })
      ),
    ];
    await Category.insertMany(defaultCategories);
    console.log(`[auto-seed] First run: created ${defaultCategories.length} default categor(y/ies).`);
  }

  // Holiday already existed as a model read by the SLA business-hours
  // calculator and the Earned Leave accrual calc (see src/utils/sla.js
  // / leaveBalances.js), but until masterDataController.js added a
  // "holidays" table there was no screen anywhere that could write to
  // it, so both calculations silently ran as if the company observed
  // zero holidays. This doesn't try to guess a full regional holiday
  // calendar (that's a real business decision for an Admin to make at
  // Master Data -> Holidays) — it just seeds one universally-safe
  // placeholder so the collection isn't empty, and so the new screen
  // has something to show the first time an Admin opens it.
  const holidayCount = await Holiday.countDocuments();
  if (holidayCount === 0) {
    const currentYear = new Date().getFullYear();
    await Holiday.create({ date: new Date(currentYear, 0, 1), description: "New Year's Day" });
    console.log(`[auto-seed] First run: created 1 starter holiday (New Year's Day, ${currentYear}) — add the rest at Master Data -> Holidays.`);
  }

  const userCount = await User.countDocuments();
  if (userCount === 0) {
    const email = process.env.SEED_ADMIN_EMAIL || `admin@${COMPANY_EMAIL_DOMAIN}`;
    const password = process.env.SEED_ADMIN_PASSWORD || "ChangeMe123!";
    const admin = new User({ name: "Administrator", email, role: ROLE.ADMIN });
    await admin.setPassword(password);
    await admin.save();
    console.log(`[auto-seed] First run: created Administrator login -> ${email} / ${password} (change this password after logging in)`);
  } else {
    console.log(`[auto-seed] Permissions + SLA Matrix refreshed. Users already exist (${userCount}) — admin account not touched.`);
  }
}

const app = express();
const PORT = process.env.PORT || 3000;

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "..", "views"));

// Cache-busting suffix for the stylesheet <link> (see partials/header.ejs) —
// picks up Render's auto-set commit SHA so every deploy forces browsers to
// fetch the new CSS instead of an old cached copy; falls back to process
// start time locally where that env var isn't set.
app.locals.assetVersion = process.env.RENDER_GIT_COMMIT || String(Date.now());

app.use(morgan("dev"));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "..", "public")));

async function start() {
  await connectDB();
  await autoSeed();

  app.use(
    session({
      secret: process.env.SESSION_SECRET || "change-me-in-.env",
      resave: false,
      saveUninitialized: false,
      store: MongoStore.create({ mongoUrl: process.env.MONGODB_URI }),
      cookie: { maxAge: 1000 * 60 * 60 * 8 }, // 8 hours
    })
  );

  app.use(attachUser);
  app.use(attachModuleVisibility);

  app.use("/", authRoutes);
  app.use("/", dashboardRoutes);
  app.use("/incidents", incidentRoutes);
  app.use("/requests", requestRoutes);
  app.use("/problems", problemRoutes);
  app.use("/changes", changeRoutes);
  app.use("/assets", assetRoutes);
  app.use("/cmdb", cmdbRoutes);
  app.use("/knowledge", knowledgeRoutes);
  app.use("/reports", reportRoutes);
  app.use("/admin", adminRoutes);
  app.use("/masterdata", masterDataRoutes);
  app.use("/employees", employeeRoutes);
  app.use("/onboarding", checklistRoutes);
  app.use("/resignations", resignationRoutes);
  app.use("/profile", profileRoutes);
  app.use("/mywork", myWorkRoutes);
  app.use("/orgchart", orgChartRoutes);
  app.use("/leave", leaveRoutes);
  app.use("/attendance", attendanceRoutes);
  app.use("/shifts", shiftRoutes);
  app.use("/recruitment", recruitmentRoutes);
  app.use("/referrals", referralRoutes);
  app.use("/performance", performanceRoutes);
  app.use("/succession", successionRoutes);
  app.use("/training", trainingRoutes);
  app.use("/benefits", benefitsRoutes);
  app.use("/wellness", wellnessRoutes);
  app.use("/policies", policyRoutes);
  app.use("/letters", lettersRoutes);
  app.use("/documents", documentRoutes);
  app.use("/hr", hrHubRoutes);
  app.use("/helpdesk", helpdeskRoutes);
  app.use("/asset-allocation", itAllocationRoutes);
  app.use("/it-clearance", itClearanceRoutes);
  app.use("/access-requests", accessRequestRoutes);
  app.use("/vendors", vendorRoutes);
  app.use("/vendor-service", vendorServiceRoutes);
  app.use("/purchases", purchaseRoutes);
  app.use("/requirements", requirementRoutes);
  app.use("/stock", stockRoutes);
  app.use("/licenses", licenseRoutes);
  app.use("/rooms", roomRoutes);
  app.use("/complaints", complaintRoutes);
  app.use("/maintenance", maintenanceRoutes);
  app.use("/expenses", expenseRoutes);
  app.use("/it", itHubRoutes);
  app.use("/system-policies", systemPolicyRoutes);
  app.use("/support", publicIntakeRoutes);
  app.use("/attachments", attachmentRoutes);
  app.use("/search", searchRoutes);
  app.use("/safety", safetyRoutes);
  app.use("/sales", salesRoutes);
  app.use("/work-orders", workOrderRoutes);
  app.use("/engineering-changes", ecrRoutes);
  app.use("/shipments", shipmentRoutes);
  app.use("/material-requests", materialRequestRoutes);
  app.use("/operations", operationsHubRoutes);

  app.use((req, res) => res.status(404).render("errors/404"));

  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).send(`Something went wrong: ${err.message}`);
  });

  app.listen(PORT, () => {
    console.log(`[server] Enterprise ITSM Tool running on http://localhost:${PORT}`);
  });
}

start().catch((err) => {
  console.error("[server] Failed to start:", err);
  process.exit(1);
});
