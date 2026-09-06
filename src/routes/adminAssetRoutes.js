const express = require("express");
const router = express.Router();
const adminAssetController = require("../controllers/adminAssetController");
const { requireLogin } = require("../middleware/auth");
const { requireAdminTeam } = require("../utils/teamAccess");

router.use(requireLogin);

// Same read-open/write-gated split as adminVendorRoutes.js.
router.get("/", adminAssetController.listAssets);
router.get("/new", requireAdminTeam, adminAssetController.showNewForm);
router.post("/", requireAdminTeam, adminAssetController.createAsset);
router.get("/:assetId/edit", requireAdminTeam, adminAssetController.showEditForm);
router.post("/:assetId/edit", requireAdminTeam, adminAssetController.updateAsset);

module.exports = router;
