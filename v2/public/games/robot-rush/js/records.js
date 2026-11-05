// @ts-check
// What Robot Rush keeps on the device (docs/v2/PLAN.md 9.1, stage rr-b): only keys of its
// own (lifexp-robotrush-*), through the Rush engine's records (../../_engine/records.js).
import { createRecords } from '../../_engine/records.js';

/** @typedef {import('../../_engine/records.js').GameStorage} GameStorage */

const records = createRecords('lifexp-robotrush-');

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
