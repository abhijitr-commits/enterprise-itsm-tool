const mongoose = require("mongoose");

/**
 * Stock Order Management / Order Register — port of the "Order" sheet
 * in the user-supplied Pashan Stock Register spreadsheet: Item, Order
 * Date, Received Boxes/Loose PC, Reference Bill No, Payment Status/
 * Date, Remarks. Distinct from a plain IN transaction because an order
 * carries a decision/status lifecycle (Hold → Order → Done/Received)
 * and vendor-bill/payment tracking that a raw stock movement doesn't
 * need — the sheet's own "Lists" tab enumerates exactly these values
 * (Status: OK/CRITICAL, Order: HOLD/ORDER/DONE).
 *
 * Marking an order Received (adminStockController.markReceived) writes
 * a real AdminStockTransaction IN row for the received quantity, so the
 * item's current stock actually goes up — same "record a real
 * transaction, don't just flag a status" pattern stockController.js
 * uses for Material Requests.
 */
const adminStockOrderSchema = new mongoose.Schema(
  {
    orderId: { type: String, unique: true, index: true }, // ASTKORD-YYYY-000001

    itemId: { type: String, required: true, trim: true, index: true },
    itemName: { type: String, trim: true },

    orderDate: { type: Date, default: Date.now },
    decision: { type: String, enum: ["Hold", "Order", "Done"], default: "Order" },
    status: { type: String, enum: ["Pending", "Received"], default: "Pending" },

    receivedBoxes: { type: Number, default: 0, min: 0 },
    receivedLoosePieces: { type: Number, default: 0, min: 0 },
    receivedStockPieces: { type: Number, default: 0 }, // receivedBoxes * item.piecesPerBox + receivedLoosePieces, computed on receipt
    receivedDate: { type: Date },

    referenceBillNo: { type: String, trim: true },
    paymentStatus: { type: String, enum: ["Pending", "Paid"], default: "Pending" },
    paymentDate: { type: Date },

    remarks: { type: String, trim: true },
    raisedBy: { type: String, trim: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("AdminStockOrder", adminStockOrderSchema);
