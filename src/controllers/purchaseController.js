/*************************************************************
 * purchaseController.js — port of PurchaseEngine.gs.
 *
 * A purchase can optionally create a matching Asset Register entry
 * when marked "Received" — closing the loop between "we bought it"
 * and "we're tracking it." Reuses assetController.js's logAssetHistory()
 * so the new Asset gets the same history trail every other Asset does.
 *************************************************************/
const PurchaseOrder = require("../models/PurchaseOrder");
const { PURCHASE_STATUS } = PurchaseOrder;
const Asset = require("../models/Asset");
const Vendor = require("../models/Vendor");
const { generateSequentialId } = require("../utils/idGenerator");
const { logAudit } = require("../utils/auditLog");
const { logAssetHistory } = require("./assetController");

async function listPurchases(req, res) {
  const [purchases, vendors] = await Promise.all([
    PurchaseOrder.find().sort({ date: -1 }).lean(),
    Vendor.find({ status: "Active" }).sort({ name: 1 }).lean(),
  ]);

  res.render("purchases/list", { purchases, vendors, PURCHASE_STATUS, message: req.query.message || null });
}

async function createPurchase(req, res) {
  try {
    const data = req.body;
    if (!data.vendor) throw new Error("Vendor is required.");
    if (!data.itemDescription) throw new Error("Item Description is required.");
    if (!data.quantity) throw new Error("Quantity is required.");
    if (!data.amount) throw new Error("Amount is required.");

    const poId = await generateSequentialId("PO");
    const purchase = await PurchaseOrder.create({
      poId,
      vendor: data.vendor,
      itemDescription: data.itemDescription,
      quantity: data.quantity,
      amount: data.amount,
    });

    await logAudit({
      user: req.user._id,
      action: "Create",
      entityType: "Purchase",
      entityId: purchase._id,
      details: `${data.itemDescription} x${data.quantity}`,
    });

    res.redirect(`/purchases?message=${encodeURIComponent("Purchase Order Created Successfully")}`);
  } catch (err) {
    res.redirect(`/purchases?message=${encodeURIComponent(err.message)}`);
  }
}

/**
 * Port of updatePurchaseStatus() — when status changes TO "Received"
 * and the caller asked to create an asset, a matching Asset Register
 * entry is created automatically (status "In Storage", ready to be
 * Issued from Asset Management).
 */
async function updateStatus(req, res) {
  try {
    const { status, createAsset, assetType } = req.body;
    if (!Object.values(PURCHASE_STATUS).includes(status)) throw new Error(`Invalid status: ${status}`);

    const purchase = await PurchaseOrder.findById(req.params.id);
    if (!purchase) return res.status(404).render("errors/404");

    purchase.status = status;
    await purchase.save();

    await logAudit({ user: req.user._id, action: "Status Update", entityType: "Purchase", entityId: purchase._id, details: status });

    let assetId = "";

    if (status === PURCHASE_STATUS.RECEIVED && createAsset === "1") {
      assetId = await generateSequentialId("AST");

      const asset = await Asset.create({
        assetId,
        assetName: purchase.itemDescription,
        type: assetType || "Other",
        department: "Unassigned",
        location: "Unassigned",
        status: Asset.ASSET_STATUS.IN_STORAGE,
        vendor: purchase.vendor,
        createdBy: req.user.email,
      });

      await logAssetHistory(assetId, "Created from Purchase", "", "", `Linked to ${purchase.poId}`);
      await logAudit({ user: req.user._id, action: "Create from Purchase", entityType: "Asset", entityId: asset._id, details: purchase.poId });
    }

    const message = `Purchase status updated to ${status}.${assetId ? ` Asset ${assetId} created.` : ""}`;
    res.redirect(`/purchases?message=${encodeURIComponent(message)}`);
  } catch (err) {
    res.status(400).send(err.message);
  }
}

module.exports = { listPurchases, createPurchase, updateStatus };
