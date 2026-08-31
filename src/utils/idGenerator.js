/*************************************************************
 * idGenerator.js — port of generateSequentialID() from Common.gs.
 * Same format: PREFIX-YYYY-NNNNNN (6-digit, zero-padded), with a
 * running counter per prefix that never repeats — even after a
 * record is deleted (the original avoided lastRow-based IDs for
 * exactly this reason). The counter lived in Script Properties;
 * here it's one document per prefix in the Counter collection.
 *************************************************************/
const { Counter } = require("../models/Counter");

async function generateSequentialId(prefix) {
  const doc = await Counter.findByIdAndUpdate(
    prefix,
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );

  const year = new Date().getFullYear();
  const running = String(doc.seq).padStart(6, "0");

  return `${prefix}-${year}-${running}`;
}

module.exports = { generateSequentialId };
