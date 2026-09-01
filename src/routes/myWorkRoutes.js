const express = require("express");
const router = express.Router();
const myWorkController = require("../controllers/myWorkController");
const { requireLogin } = require("../middleware/auth");

router.get("/", requireLogin, myWorkController.showMyWork);

module.exports = router;
