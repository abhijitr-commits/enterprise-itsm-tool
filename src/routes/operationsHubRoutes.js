const express = require("express");
const router = express.Router();
const operationsHubController = require("../controllers/operationsHubController");
const { requireLogin } = require("../middleware/auth");

router.use(requireLogin);

router.get("/", operationsHubController.showHub);

module.exports = router;
