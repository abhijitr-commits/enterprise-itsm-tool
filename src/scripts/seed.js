/*************************************************************
 * seed.js — one-time setup, equivalent to running setupDatabase()
 * from the original Setup.gs the first time. Seeds:
 *   - the Permissions collection from DEFAULT_PERMISSIONS_MAP
 *   - a starter SLA Matrix for Incidents (EDIT THESE HOURS to
 *     match your actual SLA Matrix sheet — this export only
 *     contained the Apps Script code, not the spreadsheet's
 *     row data, so these are sensible ITSM defaults, not your
 *     real numbers)
 *   - one Administrator account so you can log in and take it
 *     from there via the Admin Console (Phase 2)
 *
 * Run with: npm run seed
 *************************************************************/
require("dotenv").config();
const connectDB = require("../config/db");
const Permission = require("../models/Permission");
const SLAMatrix = require("../models/SLAMatrix");
const User = require("../models/User");
const { DEFAULT_PERMISSIONS_MAP } = require("../config/permissions");
const { PRIORITY, ROLE, COMPANY_EMAIL_DOMAIN } = require("../config/constants");

const DEFAULT_INCIDENT_SLA_HOURS = {
  [PRIORITY.CRITICAL]: { response: 1, resolution: 4 },
  [PRIORITY.HIGH]: { response: 2, resolution: 8 },
  [PRIORITY.MEDIUM]: { response: 4, resolution: 24 },
  [PRIORITY.LOW]: { response: 8, resolution: 72 },
};

async function seedPermissions() {
  for (const [action, allowedRoles] of Object.entries(DEFAULT_PERMISSIONS_MAP)) {
    await Permission.updateOne({ action }, { $set: { allowedRoles } }, { upsert: true });
  }
  console.log(`[seed] Permissions: ${Object.keys(DEFAULT_PERMISSIONS_MAP).length} actions seeded.`);
}

async function seedSLAMatrix() {
  for (const [priority, hours] of Object.entries(DEFAULT_INCIDENT_SLA_HOURS)) {
    await SLAMatrix.updateOne(
      { module: "Incident", priority },
      {
        $set: {
          responseTimeHours: hours.response,
          resolutionTimeHours: hours.resolution,
        },
      },
      { upsert: true }
    );
  }
  console.log("[seed] SLA Matrix (Incident): seeded with placeholder hours — adjust to match your real SLA policy.");
}

async function seedAdminUser() {
  const email = process.env.SEED_ADMIN_EMAIL || `admin@${COMPANY_EMAIL_DOMAIN}`;
  const password = process.env.SEED_ADMIN_PASSWORD || "ChangeMe123!";

  const existing = await User.findOne({ email });
  if (existing) {
    console.log(`[seed] Admin user ${email} already exists — skipping.`);
    return;
  }

  const user = new User({ name: "Administrator", email, role: ROLE.ADMIN });
  await user.setPassword(password);
  await user.save();

  console.log(`[seed] Created admin user: ${email} / ${password} — CHANGE THIS PASSWORD after first login.`);
}

async function run() {
  await connectDB();
  await seedPermissions();
  await seedSLAMatrix();
  await seedAdminUser();
  console.log("[seed] Done.");
  process.exit(0);
}

run().catch((err) => {
  console.error("[seed] Failed:", err);
  process.exit(1);
});
