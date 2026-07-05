#!/usr/bin/env node
'use strict';

const fs = require('fs/promises');
const path = require('path');

const DATA_PATH = path.resolve(__dirname, '..', 'data', 'dolomites-trails.json');

function validateTrail(trail, index) {
  if (!trail || typeof trail !== 'object') return `Trail #${index}: expected object`;
  if (typeof trail.id !== 'string' || !trail.id) return `Trail #${index}: missing id`;
  if (!Array.isArray(trail.center) || trail.center.length !== 2) return `Trail #${index}: invalid center`;
  if (!trail.center.every((n) => typeof n === 'number' && Number.isFinite(n))) {
    return `Trail #${index}: center must be [lon, lat] numbers`;
  }
  if (!Array.isArray(trail.geometry)) return `Trail #${index}: geometry must be an array`;
  return null;
}

async function main() {
  const content = await fs.readFile(DATA_PATH, 'utf8');
  const parsed = JSON.parse(content);

  if (!parsed || typeof parsed !== 'object') throw new Error('JSON root must be an object');
  if (!Array.isArray(parsed.trails)) throw new Error('Missing `trails` array');

  const firstError = parsed.trails.map(validateTrail).find(Boolean);
  if (firstError) throw new Error(firstError);

  console.log(`[ok] ${DATA_PATH} is valid (${parsed.trails.length} trails)`);
}

if (require.main === module) {
  main().catch((error) => {
    console.error('[error]', error.message);
    process.exitCode = 1;
  });
}

