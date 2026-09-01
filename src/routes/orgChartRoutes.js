const express = require("express");
const router = express.Router();
const orgChartController = require("../controllers/orgChartController");
const { requireLogin } = require("../middleware/auth");

router.get("/", requireLogin, orgChartController.showOrgChart);

module.exports = router;
