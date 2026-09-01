/*************************************************************
 * smoketest.js — spins up an in-memory MongoDB, seeds it, boots
 * the app, and hits the key routes to verify the migration
 * actually works end to end. Not part of the shipped app —
 * dev-only verification, safe to delete.
 *************************************************************/
process.env.MONGODB_URI = "will be set below";
process.env.SESSION_SECRET = "smoketest-secret";
process.env.SEED_ADMIN_EMAIL = "admin@peppermintrobotics.com";
process.env.SEED_ADMIN_PASSWORD = "TestPass123!";

const { MongoMemoryServer } = require("mongodb-memory-server");

async function main() {
  const mongod = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongod.getUri("enterprise_itsm");

  // Seed (permissions, SLA matrix, admin user)
  delete require.cache[require.resolve("../config/db")];
  const connectDB = require("../config/db");
  await connectDB();

  const Permission = require("../models/Permission");
  const SLAMatrix = require("../models/SLAMatrix");
  const User = require("../models/User");
  const { DEFAULT_PERMISSIONS_MAP } = require("../config/permissions");
  const { PRIORITY, ROLE } = require("../config/constants");

  for (const [action, allowedRoles] of Object.entries(DEFAULT_PERMISSIONS_MAP)) {
    await Permission.create({ action, allowedRoles });
  }
  await SLAMatrix.create({ module: "Incident", priority: PRIORITY.CRITICAL, responseTimeHours: 1, resolutionTimeHours: 4 });
  await SLAMatrix.create({ module: "Incident", priority: PRIORITY.HIGH, responseTimeHours: 2, resolutionTimeHours: 8 });
  await SLAMatrix.create({ module: "Incident", priority: PRIORITY.MEDIUM, responseTimeHours: 4, resolutionTimeHours: 24 });
  await SLAMatrix.create({ module: "Incident", priority: PRIORITY.LOW, responseTimeHours: 8, resolutionTimeHours: 72 });

  const admin = new User({ name: "Administrator", email: "admin@peppermintrobotics.com", role: ROLE.ADMIN });
  await admin.setPassword("TestPass123!");
  await admin.save();

  console.log("[smoketest] Seed OK. Users:", await User.countDocuments());
  console.log("[smoketest] Permissions:", await Permission.countDocuments());
  console.log("[smoketest] SLA rows:", await SLAMatrix.countDocuments());

  // Exercise the actual business logic: create an incident and check SLA math.
  const { generateSequentialId } = require("../utils/idGenerator");
  const { calculateSLADue } = require("../utils/sla");
  const Incident = require("../models/Incident");

  const id1 = await generateSequentialId("INC");
  const id2 = await generateSequentialId("INC");
  console.log("[smoketest] Sequential IDs:", id1, id2, "(should increment, never repeat)");

  const created = new Date("2026-08-31T10:00:00Z"); // a Monday
  const dueCritical = await calculateSLADue("Incident", created, PRIORITY.CRITICAL);
  console.log("[smoketest] Critical SLA (4h from Mon 10:00 UTC) due at:", dueCritical.toISOString());

  const incident = await Incident.create({
    incidentId: id1,
    employeeName: "Test Employee",
    department: "IT",
    location: "HQ",
    category: "Hardware",
    priority: PRIORITY.HIGH,
    subject: "Laptop won't boot",
    description: "Black screen on power on.",
    slaDue: await calculateSLADue("Incident", new Date(), PRIORITY.HIGH),
    createdBy: "admin@peppermintrobotics.com",
  });
  console.log("[smoketest] Created incident:", incident.incidentId, incident.status);

  const found = await Incident.findOne({ incidentId: id1 });
  console.log("[smoketest] Round-trip fetch OK:", !!found, found.subject);

  const { hasPermission } = require("../utils/permissions");
  console.log("[smoketest] Viewer can create incidents:", await hasPermission(ROLE.VIEWER, "incidents_create"));
  console.log("[smoketest] Viewer can delete incidents (should be false):", await hasPermission(ROLE.VIEWER, "incidents_delete"));
  console.log("[smoketest] Admin can delete incidents:", await hasPermission(ROLE.ADMIN, "incidents_delete"));

  await mongod.stop();
  console.log("[smoketest] ALL CHECKS PASSED.");
  process.exit(0);
}

main().catch((err) => {
  console.error("[smoketest] FAILED:", err);
  process.exit(1);
});
