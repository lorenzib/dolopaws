#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const context = { window: {} };
vm.createContext(context);

for (const file of ['trails-data.js', 'osm-trails-data.js', 'osm-trails-savoy-data.js']) {
  vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context, { filename:file });
}

const trails = vm.runInContext('trails', context);
const reviewed = trails.filter(t => t.curated !== false);
const imported = trails.filter(t => t.curated === false);
const missing = (list, field) => list.filter(t => t[field] === undefined || t[field] === null).length;
const risks = list => Object.fromEntries(['low-risk', 'moderate', 'caution'].map(level => [level, list.filter(t => t.safetyLevel === level).length]));

const report = {
  total: trails.length,
  reviewed: {
    count: reviewed.length,
    missingReviewDate: missing(reviewed, 'reviewedAt'),
    missingCoreSource: missing(reviewed, 'source'),
    missingShade: missing(reviewed, 'shadeCoverage'),
    missingHeat: missing(reviewed, 'heatRisk'),
    riskRatings: risks(reviewed),
  },
  imported: {
    count: imported.length,
    missingExposure: missing(imported, 'exposure'),
    missingShade: missing(imported, 'shadeCoverage'),
    missingHeat: missing(imported, 'heatRisk'),
    missingElevation: missing(imported, 'elevation'),
    missingDuration: missing(imported, 'hours'),
    riskRatings: risks(imported),
  },
};

console.log(JSON.stringify(report, null, 2));

const invalid = trails.filter(t =>
  !t.id || !t.name || !Number.isFinite(Number(t.distance)) ||
  !['low-risk', 'moderate', 'caution'].includes(t.safetyLevel)
);

if (invalid.length) {
  console.error(`\n${invalid.length} trails are missing an id, name, distance, or valid safety rating.`);
  process.exitCode = 1;
} else {
  console.log('\nCore trail records are structurally valid. Missing observations must remain labelled unknown until reviewed.');
}
