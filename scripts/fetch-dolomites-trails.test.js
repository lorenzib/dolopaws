'use strict';

const {
  buildOverpassQuery,
  normalizeElements,
  sampleGeometry
} = require('./fetch-dolomites-trails');

describe('dolomites trails pipeline', () => {
  test('buildOverpassQuery targets only expected Italian regions', () => {
    const query = buildOverpassQuery();

    expect(query).toContain('IT-25');
    expect(query).toContain('IT-32');
    expect(query).toContain('IT-34');
    expect(query).toContain('IT-36');
    expect(query).toContain('route"~"^(hiking|foot)$');
  });

  test('normalizeElements produces sorted deterministic trail entries', () => {
    const normalized = normalizeElements([
      {
        type: 'way',
        id: 10,
        tags: { name: 'Trail B', sac_scale: 'mountain_hiking', route: 'hiking' },
        center: { lat: 46.45, lon: 12.22 },
        geometry: [{ lat: 46.45, lon: 12.21 }, { lat: 46.46, lon: 12.22 }]
      },
      {
        type: 'relation',
        id: 2,
        tags: { ref: 'AV1', route: 'hiking' },
        center: { lat: 46.5, lon: 11.9 },
        geometry: []
      }
    ]);

    expect(normalized).toEqual([
      {
        id: 'relation/2',
        osmType: 'relation',
        osmId: 2,
        name: null,
        ref: 'AV1',
        difficulty: null,
        center: [11.9, 46.5],
        geometry: [],
        sourceTags: { route: 'hiking' }
      },
      {
        id: 'way/10',
        osmType: 'way',
        osmId: 10,
        name: 'Trail B',
        ref: null,
        difficulty: 'mountain_hiking',
        center: [12.22, 46.45],
        geometry: [[12.21, 46.45], [12.22, 46.46]],
        sourceTags: { route: 'hiking', sac_scale: 'mountain_hiking' }
      }
    ]);
  });

  test('sampleGeometry keeps compact line with fixed max points', () => {
    const geometry = Array.from({ length: 200 }, (_, i) => ({ lon: 11 + i / 1000, lat: 46 + i / 1000 }));
    const sampled = sampleGeometry(geometry);
    expect(sampled).toHaveLength(80);
    expect(sampled[0]).toEqual([11, 46]);
    expect(sampled[sampled.length - 1]).toEqual([11.199, 46.199]);
  });
});

