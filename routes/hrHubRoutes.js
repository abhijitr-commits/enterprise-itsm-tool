const express = require("express");
const router = express.Router();
const hrHubController = require("../controllers/hrHubController");
const { requireLogin } = require("../middleware/auth");

router.use(requireLogin);

router.get("/", hrHubController.showHub);

module.exports = router;
