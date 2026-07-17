const fs = require('fs');
const path = require('path');
const vm = require('vm');

function loadTrust(){
  const context = { window: {}, console };
  context.window.window = context.window;
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(__dirname, 'trail-trust.js'), 'utf8'), context);
  return context.window.DoloPawsTrailTrust;
}

function loadScoring(){
  const context = {};
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(__dirname, 'scoring.js'), 'utf8'), context);
  return trail => vm.runInContext(`scoreTrail(${JSON.stringify(trail)}, {terrain:'2', distance:'99', heatSensitive:false})`, context);
}

describe('trail data trust states', () => {
  const imported = { curated:false, safetyLevel:'low-risk', waterSources:[] };
  const reviewed = { safetyLevel:'low-risk', waterSources:[{ km:1, label:'Fountain' }], heatRisk:'low', shadeCoverage:60, exposure:false };

  test('imported risk labels are explicitly estimates', () => {
    const trust = loadTrust();
    expect(trust.riskLabel(imported, 'Low-risk terrain')).toBe('Estimated: Low-risk terrain');
    expect(trust.provenanceLabel(imported)).toMatch(/not field reviewed/i);
    expect(trust.provenanceLabel(reviewed)).toMatch(/curated.*date unavailable/i);
  });

  test('missing imported observations render as unknown, not safe', () => {
    const trust = loadTrust();
    expect(trust.waterAssessment(imported).title).toBe('Water unknown');
    expect(trust.heatAssessment(imported).title).toBe('Heat & shade unknown');
    expect(trust.exposureAssessment(imported).title).toBe('Exposure unknown');
    expect(trust.livestockAssessment(imported, '').title).toBe('Livestock unknown');
    expect(trust.assessmentNote(imported)).toMatch(/remain unverified/i);
    expect(trust.waterPointLabel(imported, 'Drinking water (OSM-verified location)')).toBe('Water point mapped in OpenStreetMap');
    expect(trust.startPointLabel(imported, 'Start here — Bus stop (OSM-verified access point)')).toMatch(/Mapped start suggestion.*not field reviewed/i);
  });

  test('reviewed observations retain qualified positive states', () => {
    const trust = loadTrust();
    expect(trust.waterAssessment(reviewed).ok).toBe(true);
    expect(trust.heatAssessment(reviewed).ok).toBe(true);
    expect(trust.exposureAssessment(reviewed)).toBeNull();
    expect(trust.livestockAssessment(reviewed, '').detail).toMatch(/curated trail information/i);
  });

  test('partial source reviews expose progress and keep unchecked categories unverified', () => {
    const trust = loadTrust();
    const partial = {
      safetyLevel:'caution', terrainRank:2, terrainType:'Rocky path', exposure:true,
      reviewedAt:'2026-07-17', verified:{ categories:['exposure','surfaceHazards'], date:'2026-07-17' },
      waterSources:[{ km:2, label:'Stream' }], shadeCoverage:40, heatRisk:'moderate',
    };
    expect(trust.provenanceLabel(partial)).toBe('DoloPaws source review · 17 Jul 2026 · 2/6 checks');
    expect(trust.riskLabel(partial, 'Caution')).toBe('Estimated: Caution');
    expect(trust.reviewProgress(partial).checked).toBe(2);
    expect(trust.waterAssessment(partial).title).toBe('Water availability unverified');
    expect(trust.heatAssessment(partial).title).toBe('Heat & shade unverified');
    expect(trust.exposureAssessment(partial).title).toBe('Exposure');
    expect(trust.surfaceAssessment(partial).title).toBe('Surface hazards');
    expect(trust.livestockAssessment(partial, '').title).toBe('Livestock unverified');
  });

  test('unknown imported fields cap match confidence at 80 percent', () => {
    const score = loadScoring();
    expect(score({
      curated:false,
      safetyLevel:'low-risk',
      terrainRank:0,
      distance:3,
      surfaceHazards:[],
    })).toBe(80);
  });

  test('route audits show a date without pretending safety checks are complete', () => {
    const trust = loadTrust();
    const audited = { curated:false, reviewedAt:'2026-07-17', routeAudit:{ route:'checked' } };
    expect(trust.provenanceLabel(audited)).toBe('DoloPaws route audit · 17 Jul 2026');
    expect(trust.reviewProgress(audited)).toBeNull();
  });

  test('partial source reviews also cap match confidence at 80 percent', () => {
    const score = loadScoring();
    expect(score({
      safetyLevel:'low-risk', terrainRank:0, distance:3, surfaceHazards:[], exposure:false,
      shadeCoverage:80, heatRisk:'low',
      verified:{ categories:['access','surfaceHazards'] },
    })).toBe(80);
  });

  test('catalog and detail templates include trust explanations', () => {
    const browse = fs.readFileSync(path.join(__dirname, 'browse-trails.html'), 'utf8');
    const detail = fs.readFileSync(path.join(__dirname, 'trail-blueprint.js'), 'utf8');
    const home = fs.readFileSync(path.join(__dirname, 'script.js'), 'utf8');

    expect(browse).toContain('browse.trustNote');
    expect(browse).toContain('trust.riskLabel(t, s[0])');
    expect(detail).toContain('trust.exposureAssessment(t)');
    expect(detail).toContain('trust.livestockAssessment(t, text)');
    expect(home).toContain("{ l: 'Unknown'");
    expect(detail).not.toContain('No livestock noted in our field data');

    const importedPage = fs.readFileSync(path.join(__dirname, 'trails/planetenweg-sentiero-dei-pianeti.html'), 'utf8');
    const reviewedPage = fs.readFileSync(path.join(__dirname, 'trails/lago-di-braies-loop.html'), 'utf8');
    expect(importedPage).toContain('Imported · not field reviewed');
    expect(importedPage).toContain('Estimated: Low-risk');
    expect(importedPage).not.toContain('verified map data');
    expect(reviewedPage).toContain('DoloPaws curated · date unavailable');
    expect(reviewedPage).toContain('A dated source record is not yet available');
  });
});
