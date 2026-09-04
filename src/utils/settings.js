/*************************************************************
 * settings.js — port of Config.gs's getSetting()/setSettingInternal(),
 * backed by the Setting collection (models/Setting.js) instead of
 * Script Properties.
 *************************************************************/
const Setting = require("../models/Setting");

async function getSetting(key, fallback) {
  const doc = await Setting.findOne({ key }).lean();
  return doc && doc.value != null ? doc.value : fallback;
}

async function setSetting(key, value) {
  await Setting.updateOne({ key }, { $set: { value } }, { upsert: true });
  return { success: true };
}

module.exports = { getSetting, setSetting };
