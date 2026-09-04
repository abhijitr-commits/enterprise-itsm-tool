const express = require("express");
const router = express.Router();
const lettersController = require("../controllers/lettersController");
const { requireLogin } = require("../middleware/auth");
const { requireHRTeam } = require("../utils/teamAccess");

router.use(requireLogin);

router.get("/templates", requireHRTeam, lettersController.showTemplates);
router.post("/templates", requireHRTeam, lettersController.saveTemplates);

router.get("/", requireHRTeam, lettersController.listLetters);
router.get("/offer/new", requireHRTeam, lettersController.showOfferForm);
router.post("/offer", requireHRTeam, lettersController.generateOfferLetter);
router.get("/appointment/new", requireHRTeam, lettersController.showAppointmentForm);
router.post("/appointment", requireHRTeam, lettersController.generateAppointmentLetter);
router.get("/relieving/new", requireHRTeam, lettersController.showRelievingForm);
router.post("/relieving", requireHRTeam, lettersController.generateRelievingLetter);

// Viewing one letter is self-or-HR-team, checked inside the controller
// (the recipient can view/print their own copy) — not HR-team gated here.
router.get("/:letterId", lettersController.showLetter);

module.exports = router;
