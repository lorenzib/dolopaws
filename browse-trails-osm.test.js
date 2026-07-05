'use strict';

const fs = require('fs');
const path = require('path');

describe('browse-trails OSM integration', () => {
  test('browse page includes OSM trails map/list shell and attribution', () => {
    const html = fs.readFileSync(path.join(__dirname, 'browse-trails.html'), 'utf8');

    expect(html).toContain('id="osmTrailsMap"');
    expect(html).toContain('id="osmTrailsList"');
    expect(html).toContain('OpenStreetMap contributors');
    expect(html).toContain('dolomites-trails.js');
  });
});
