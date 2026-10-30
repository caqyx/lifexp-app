// @ts-check
// What Wave Rush keeps on the device (docs/v2/PLAN.md 9.1, stage w-1): only keys of its
// own (lifexp-waverush-*), through the shared records (../../_engine/records.js).
import { createRecords } from '../../_engine/records.js';

/** @typedef {import('../../_engine/records.js').GameStorage} GameStorage */
/** @typedef {import('../../_engine/records.js').Progress} Progress */

const records = createRecords('lifexp-waverush-');

export const {
  KEYS,
  readBest,
  saveBest,
  readAttempts,
  countAttempt,
  readSkin,
  saveSkin,
  readProgress,
  unlock,
  readCheckpointBy,
  saveCheckpointBy,
} = records;
export { records };
