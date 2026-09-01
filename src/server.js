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
const dashboardRoutes = require("./routes/dashboardRoutes");

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
