/*************************************************************
 * trainingController.js — port of LMSEngine.gs. A lightweight
 * Learning & Development tracker: it does NOT host actual course
 * videos/content (that's what a real LMS platform is for). It
 * tracks WHAT training exists, WHO is enrolled, and completion
 * status, whether the course itself happens online (a link) or
 * offline (in-person session).
 *
 * The course catalog is viewable by everyone signed in (matches the
 * original — getAllCoursesSafe() has no permission check); creating
 * courses, enrolling people, and updating enrollment status are all
 * gated to "training_manage" (Admin/Manager by default), same as the
 * original's requirePermission("training_manage") calls. Completing
 * an enrollment auto-issues a certificate, same chain as the
 * original's updateEnrollmentStatus() -> createCertificate().
 *
 * Deferred vs. the original: notifying the employee by email on
 * enrollment/certificate — no email provider yet (see MIGRATION.md);
 * recorded in the audit log instead. Certificates aren't PDFs — a
 * printable page (views/training/certificate.ejs) the employee can
 * print/save via their browser, exactly as the original intended.
 *************************************************************/
const Course = require("../models/Course");
const Enrollment = require("../models/Enrollment");
const Certificate = require("../models/Certificate");
const { generateSequentialId } = require("../utils/idGenerator");
const { logAudit } = require("../utils/auditLog");
const { hasPermission } = require("../utils/permissions");

/* ---------- COURSE CATALOG ---------- */

async function listCourses(req, res) {
  const courses = await Course.find().sort({ title: 1 }).lean();
  res.render("training/courses", { courses, message: req.query.message || null });
}

function showNewCourseForm(req, res) {
  res.render("training/course-new", { error: null, form: {} });
}

async function createCourse(req, res) {
  try {
    const data = req.body;
    if (!data.title) throw new Error("Title is required.");
    if (!data.type) throw new Error("Type (Online/Offline) is required.");

    const courseId = await generateSequentialId("CRS");
    const course = await Course.create({
      courseId,
      title: data.title,
      type: data.type,
      category: data.category || "General",
      durationHours: data.durationHours || undefined,
      provider: data.provider || "",
      description: data.description || "",
      linkOrLocation: data.linkOrLocation || "",
      createdBy: req.user.email,
    });

    await logAudit({ user: req.user._id, action: "Create Course", entityType: "Course", entityId: course._id, details: data.title });

    res.redirect("/training/courses?message=Course Added Successfully");
  } catch (err) {
    res.status(400).render("training/course-new", { error: err.message, form: req.body });
  }
}

/* ---------- ENROLLMENTS ---------- */

async function listEnrollments(req, res) {
  const [enrollments, courses] = await Promise.all([
    Enrollment.find().sort({ enrollmentDate: -1 }).lean(),
    Course.find({ status: "Active" }).sort({ title: 1 }).lean(),
  ]);
  res.render("training/enrollments", { enrollments, courses, error: null, message: req.query.message || null });
}

async function enrollEmployee(req, res) {
  try {
    const { employee, courseId } = req.body;
    if (!employee) throw new Error("Employee is required.");
    if (!courseId) throw new Error("Course is required.");

    const course = await Course.findOne({ courseId });
    if (!course) throw new Error("Course not found.");

    const enrollmentId = await generateSequentialId("ENR");
    const enrollment = await Enrollment.create({
      enrollmentId,
      employee,
      courseId,
      courseTitle: course.title,
    });

    await logAudit({ user: req.user._id, action: "Enroll", entityType: "Enrollment", entityId: enrollment._id, details: `${employee} -> ${course.title}` });

    res.redirect("/training/enrollments?message=Enrolled Successfully");
  } catch (err) {
    const [enrollments, courses] = await Promise.all([
      Enrollment.find().sort({ enrollmentDate: -1 }).lean(),
      Course.find({ status: "Active" }).sort({ title: 1 }).lean(),
    ]);
    res.status(400).render("training/enrollments", { enrollments, courses, error: err.message, message: null });
  }
}

async function updateEnrollmentStatus(req, res) {
  try {
    const { status, scoreNotes } = req.body;
    const enrollment = await Enrollment.findById(req.params.id);
    if (!enrollment) return res.status(404).render("errors/404");

    enrollment.status = status;
    enrollment.scoreNotes = scoreNotes || "";

    let certificateId = "";
    if (status === "Completed") {
      enrollment.completionDate = new Date();
      certificateId = await createCertificateInternal(enrollment.employee, enrollment.courseTitle, enrollment.enrollmentId, req.user._id);
    }
    await enrollment.save();

    await logAudit({ user: req.user._id, action: "Status Update", entityType: "Enrollment", entityId: enrollment._id, details: status });

    res.redirect(`/training/enrollments?message=${encodeURIComponent(`Enrollment updated to ${status}.${certificateId ? " Certificate issued." : ""}`)}`);
  } catch (err) {
    res.status(400).send(err.message);
  }
}

/* ---------- CERTIFICATES ---------- */

/** INTERNAL — no permission check, mirrors createCertificate() in the original (called only from updateEnrollmentStatus). */
async function createCertificateInternal(employeeName, courseTitle, enrollmentId, actorId) {
  const certificateId = await generateSequentialId("CERT");
  const cert = await Certificate.create({ certificateId, employee: employeeName, courseTitle, enrollmentId });

  await logAudit({ user: actorId, action: "Certificate Issued", entityType: "Certificate", entityId: cert._id, details: `${employeeName} — ${courseTitle}` });

  return certificateId;
}

async function myCertificates(req, res) {
  const certificates = await Certificate.find({ employee: req.user.name }).sort({ issuedDate: -1 }).lean();
  res.render("training/my-certificates", { certificates });
}

async function showCertificate(req, res) {
  const cert = await Certificate.findOne({ certificateId: req.params.certificateId }).lean();
  if (!cert) return res.status(404).render("errors/404");

  // Same self-or-HR-team ownership boundary as Goals/Reviews — an
  // employee can view/print their own certificate; anyone managing
  // training (Admin/Manager) can view any certificate too.
  const isOwner = String(req.user.name || "").trim().toLowerCase() === String(cert.employee || "").trim().toLowerCase();
  const canManage = await hasPermission(req.user.role, "training_manage");
  if (!isOwner && !canManage) {
    return res.status(403).render("errors/403", { action: "view this certificate" });
  }

  res.render("training/certificate", { cert });
}

module.exports = {
  listCourses,
  showNewCourseForm,
  createCourse,
  listEnrollments,
  enrollEmployee,
  updateEnrollmentStatus,
  myCertificates,
  showCertificate,
};
