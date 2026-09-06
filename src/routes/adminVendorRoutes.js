const express = require("express");
const router = express.Router();
const adminVendorController = require("../controllers/adminVendorController");
const { requireLogin } = require("../middleware/auth");
const { requireAdminTeam } = require("../utils/teamAccess");

router.use(requireLogin);

// Reads are open to everyone signed in — same policy as the IT Vendor
// directory (vendorRoutes.js) and Stock/Inventory (stockRoutes.js):
// a directory lookup needs no special permission. Writes are gated to
// the Admin team (Administrator, or Manager + Department="Administration"),
// matching how Stock/Inventory already gates its writes and how
// teamAccess.js's own comment describes this as "the operational side
// of Admin Console."
router.get("/", adminVendorController.listVendors);
router.get("/new", requireAdminTeam, adminVendorController.showNewForm);
router.post("/", requireAdminTeam, adminVendorController.createVendor);
router.get("/:id/edit", requireAdminTeam, adminVendorController.showEditForm);
router.post("/:id", requireAdminTeam, adminVendorController.updateVendor);

module.exports = router;
