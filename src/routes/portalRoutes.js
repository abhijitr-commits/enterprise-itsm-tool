const express = require("express");
const router = express.Router();
const portalController = require("../controllers/portalController");
const { requireLogin } = require("../middleware/auth");

router.use(requireLogin);
router.get("/", portalController.showPortal);

module.exports = router;
