const mongoose = require("mongoose");

/**
 * Stock Order Management / Order Register — field-for-field port of
 * the "Order" sheet in the user-supplied Pashan Stock Register
 * spreadsheet: Item Code, Item Name, PC per Box, Order Date, Received
 * Boxes, Received Loose PC, Received Stock (PC), Reference Bill No,
 * Payment Status, Payment Date, Remark. The one addition beyond the
 * sheet's own columns is `status` (Pending/Received) — the sheet
 * tracked this implicitly by leaving the Received/Bill/Payment fields
 * blank until filled in; a real lifecycle field does the same job
 * without relying on "are these fields empty" as the signal.
 *
 * The sheet's per-row "Order" decision flag (Hold/Order/Done) lives on
 * the item itself instead (AdminStockItem.orderFlag) — this Order
 * Register is the append-only history of actual orders placed against
 * an item, which the sheet could only ever hold one of per row. Raising
 * an order here sets the item's orderFlag to "Order"; marking one
 * Received sets it to "Done" — see adminStockController.js.
 *
 * Marking an order Received also writes a real AdminStockTransaction IN
 * row for the received quantity, so the item's current stock actually
 * goes up — same "record a real transaction, don't just flag a status"
 * pattern stockController.js uses for Material Requests.
 */
const adminStockOrderSchema = new mongoose.Schema(
  {
    orderId: { type: String, unique: true, index: true }, // ASTKORD-YYYY-000001

    itemId: { type: String, required: true, trim: true, index: true },
    itemCode: { type: String, trim: true }, // sheet's "Item Code" — snapshot from the item at order time
    itemName: { type: String, trim: true }, // sheet's "Item Name"
    piecesPerBox: { type: Number, default: 1 }, // sheet's "PC per Box" — snapshot from the item at order time

    orderDate: { type: Date, default: Date.now }, // sheet's "Order Date"
    status: { type: String, enum: ["Pending", "Received"], default: "Pending" },

    receivedBoxes: { type: Number, default: 0, min: 0 }, // sheet's "Received Boxes"
    receivedLoosePieces: { type: Number, default: 0, min: 0 }, // sheet's "Received Loose PC"
    receivedStockPieces: { type: Number, default: 0 }, // sheet's "Received Stock (PC)" — receivedBoxes * piecesPerBox + receivedLoosePieces, computed on receipt
    receivedDate: { type: Date },

    referenceBillNo: { type: String, trim: true }, // sheet's "Reference Bill No"
    paymentStatus: { type: String, enum: ["Pending", "Paid"], default: "Pending" }, // sheet's "Payment Status"
    paymentDate: { type: Date }, // sheet's "Payment Date"

    remarks: { type: String, trim: true }, // sheet's "Remark"
    raisedBy: { type: String, trim: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("AdminStockOrder", adminStockOrderSchema);
