const fs = require('fs');
const path = require('path');
const vm = require('vm');

function loadTrails() {
  const context = { window: {} };
  vm.createContext(context);
  for (const file of ['trails-data.js', 'osm-trails-data.js', 'osm-trails-savoy-data.js', 'trail-audits.js']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, file), 'utf8'), context, { filename: file });
  }
  return vm.runInContext('trails', context);
}

describe('trail presentation audits', () => {
  test('Albanne has a dated, sourced route audit and a complete profile', () => {
    const albanne = loadTrails().find((trail) => trail.id === 'osm-14381570');
    expect(albanne.reviewedAt).toBe('2026-07-17');
    expect(albanne.routeAudit).toEqual(expect.objectContaining({
      photo: expect.any(String),
      route: expect.any(String),
      mapPoints: expect.any(String),
      elevation: expect.any(String),
    }));
    expect(albanne.sourceLinks.length).toBeGreaterThanOrEqual(2);
    expect(albanne.path.length).toBeGreaterThan(100);
    expect(albanne.elevation).toBe(249);
    expect(albanne.elevationProfile[0].km).toBe(0);
    expect(albanne.elevationProfile.at(-1).km).toBe(albanne.distance);
  });

  test('every Albanne water point retains its source GPS location', () => {
    const albanne = loadTrails().find((trail) => trail.id === 'osm-14381570');
    expect(albanne.waterSources.length).toBeGreaterThan(0);
    albanne.waterSources.forEach((point) => {
      expect(Number.isFinite(point.lat)).toBe(true);
      expect(Number.isFinite(point.lng)).toBe(true);
      expect(point.osmId).toMatch(/^node\//);
    });
  });

  test('map waypoints are never guessed from rounded kilometre values', () => {
    const detailScript = fs.readFileSync(path.join(__dirname, 'trail.js'), 'utf8');
    expect(detailScript).toContain("typeof waypoint.lat !== 'number'");
    expect(detailScript).toContain('.setLngLat([waypoint.lng, waypoint.lat])');
    expect(detailScript).not.toContain("addWaypoint(r.km, 'hut'");
    expect(detailScript).not.toContain("addWaypoint(w.km, 'water'");
  });
});
