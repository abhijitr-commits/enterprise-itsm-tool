const express = require("express");
const router = express.Router();
const publicIntakeController = require("../controllers/publicIntakeController");

// Deliberately no requireLogin — this is the one page in the whole app
// meant to be reached by someone who isn't signed in at all, same as
// the original's public=true doGet() branch.
router.get("/", publicIntakeController.showForm);
router.post("/", publicIntakeController.submitForm);

module.exports = router;
