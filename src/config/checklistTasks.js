/*************************************************************
 * checklistTasks.js — the four standard task lists from
 * OnboardingEngine.gs (ONBOARDING_TASKS, OFFBOARDING_TASKS,
 * ADMIN_ONBOARDING_TASKS, ADMIN_OFFBOARDING_TASKS), keyed by the
 * same CHECKLIST_TYPE discriminator used in models/Checklist.js.
 *************************************************************/
const { CHECKLIST_TYPE } = require("../models/Checklist");

const TASK_LISTS = {
  [CHECKLIST_TYPE.ONBOARDING]: [
    ["Welcome & Induction", "Day 1"],
    ["Workstation & Email Setup", "Day 1"],
    ["Introduce to Team", "Day 1"],
    ["Policy Acknowledgement", "Week 1"],
    ["Department Orientation", "Week 1"],
    ["Assign Buddy/Mentor", "Week 1"],
    ["Complete Mandatory Training", "Month 1"],
    ["30-Day Check-in with Manager", "Month 1"],
  ],
  [CHECKLIST_TYPE.OFFBOARDING]: [
    ["Manager Handover Discussion", "Pre-Exit"],
    ["Knowledge Transfer Documentation", "Pre-Exit"],
    ["Return Company Assets", "Last Day"],
    ["Revoke System Access", "Last Day"],
    ["Exit Interview", "Last Day"],
    ["Final Settlement Processing", "Post-Exit"],
  ],
  [CHECKLIST_TYPE.ADMIN_ONBOARDING]: [
    ["ID Card / Access Card Issued", "Facilities"],
    ["Locker/Cabin Assigned", "Facilities"],
    ["Parking Pass Issued (if applicable)", "Facilities"],
    ["Desk/Furniture Allocated", "Facilities"],
    ["Stationery Kit Handed Over", "Facilities"],
  ],
  [CHECKLIST_TYPE.ADMIN_OFFBOARDING]: [
    ["ID Card / Access Card Returned", "Physical Return"],
    ["Physical Assets Returned (keys, furniture, etc.)", "Physical Return"],
    ["Locker/Cabin Vacated", "Physical Return"],
    ["Final Documents Handover", "Documentation"],
  ],
};

module.exports = { TASK_LISTS };
