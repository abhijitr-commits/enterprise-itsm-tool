/*************************************************************
 * knowledgeController.js — port of KnowledgeEngine.gs.
 * Version history: each update snapshots the current version
 * into priorVersions before overwriting, same as the original's
 * KB History sheet.
 *************************************************************/
const KnowledgeArticle = require("../models/KnowledgeArticle");
const { generateSequentialId } = require("../utils/idGenerator");
const { logAudit } = require("../utils/auditLog");

async function listArticles(req, res) {
  const { q, category, status } = req.query;

  const filter = {};
  if (category) filter.category = category;
  if (status) filter.status = status;
  if (q) {
    const rx = new RegExp(q, "i");
    filter.$or = ["articleId", "title", "content", "category"].map((f) => ({ [f]: rx }));
  }

  const articles = await KnowledgeArticle.find(filter).sort({ lastUpdated: -1 }).lean();

  res.render("knowledge/list", {
    articles,
    query: { q: q || "", category: category || "", status: status || "" },
  });
}

function showNewForm(req, res) {
  res.render("knowledge/new", { error: null, form: {} });
}

async function createArticle(req, res) {
  try {
    const data = req.body;
    for (const field of ["title", "content"]) {
      if (!data[field]) throw new Error(`${field} is required.`);
    }

    const articleId = await generateSequentialId("KB");

    const article = await KnowledgeArticle.create({
      articleId,
      title: data.title,
      category: data.category || "Other",
      content: data.content,
      author: req.user.email,
      status: "Published",
    });

    await logAudit({
      user: req.user._id,
      action: "Create",
      entityType: "Knowledge Base",
      entityId: article._id,
      details: data.title,
    });

    res.redirect(`/knowledge/${article._id}?created=1`);
  } catch (err) {
    res.status(400).render("knowledge/new", { error: err.message, form: req.body });
  }
}

async function showArticle(req, res) {
  const article = await KnowledgeArticle.findById(req.params.id).lean();
  if (!article) return res.status(404).render("errors/404");

  const history = [...(article.priorVersions || [])].reverse();

  res.render("knowledge/detail", {
    article,
    history,
    justCreated: req.query.created === "1",
  });
}

async function updateArticle(req, res) {
  try {
    const data = req.body;
    const article = await KnowledgeArticle.findById(req.params.id);
    if (!article) return res.status(404).render("errors/404");

    // Snapshot the current version before overwriting it.
    article.priorVersions.push({
      version: article.priorVersions.length + 1,
      title: article.title,
      category: article.category,
      content: article.content,
      author: article.author,
    });

    article.title = data.title;
    article.category = data.category || "Other";
    article.content = data.content;
    article.author = req.user.email;
    article.status = data.status || "Published";

    await article.save();

    await logAudit({
      user: req.user._id,
      action: "Update",
      entityType: "Knowledge Base",
      entityId: article._id,
      details: data.title,
    });

    res.redirect(`/knowledge/${article._id}`);
  } catch (err) {
    res.status(400).send(err.message);
  }
}

module.exports = { listArticles, showNewForm, createArticle, showArticle, updateArticle };
