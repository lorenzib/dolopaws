const fs = require('fs');
const path = require('path');
const vm = require('vm');

function loadTrailScript(overrides = {}){
  const context = {
    console,
    setTimeout,
    clearTimeout,
    URLSearchParams,
    Promise,
    module: {},
    exports: {},
    maplibregl: {},
    localStorage: {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {},
    },
    navigator: { userAgent: 'jest' },
    location: { search: '' },
    document: {
      readyState: 'loading',
      getElementById: () => null,
      querySelector: () => null,
      querySelectorAll: () => [],
      createElement: () => ({
        style: {},
        className: '',
        textContent: '',
        innerHTML: '',
        hidden: false,
        appendChild: () => {},
        addEventListener: () => {},
        setAttribute: () => {},
      }),
      addEventListener: () => {},
    },
    t: (key, params) => {
      const translations = {
        'legendTrail.start': '🚩 Start',
        'legendTrail.dir': '➤ Direction of travel',
        'legendTrail.switch': '🔀 Trail switch',
        'legend.hut': 'Mountain hut',
        'legend.food': 'Food stop',
        'legend.water': 'Water source',
        'safety.low': 'Easy',
        'safety.moderate': 'Moderate',
        'safety.caution': 'Caution',
        'trail.route': `Route · ${(params && params.label) || ''}`.trim(),
      };
      return translations[key] || key;
    },
    window: null,
    globalThis: null,
    ...overrides,
  };
  context.window = context;
  context.globalThis = context;
  context.window.location = context.location;
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(__dirname, 'trail.js'), 'utf8'), context);
  return context;
}

describe('trail page map legend', () => {
  test('docked map key is open by default so the legend is visible on load', () => {
    const html = fs.readFileSync(path.join(__dirname, 'trail.html'), 'utf8');
    document.body.innerHTML = html;
    const legendDock = document.querySelector('.map-key--dock');

    expect(legendDock).not.toBeNull();
    expect(legendDock.hasAttribute('open')).toBe(true);
    expect(document.getElementById('legendChips')).not.toBeNull();
  });

  test('contains a dedicated Nearby trails section and no bottom decision banner', () => {
    const html = fs.readFileSync(path.join(__dirname, 'trail.html'), 'utf8');
    document.body.innerHTML = html;

    const nearbyWrap = document.getElementById('nearbyTrails');
    expect(nearbyWrap).not.toBeNull();
    expect(nearbyWrap.querySelector('h2').textContent).toMatch(/Nearby trails/i);

    expect(document.getElementById('decisionBar')).toBeNull();
    expect(html).not.toContain('Gentler nearby');
  });

  test('renderLegendChips populates trail legend entries', () => {
    const legendChips = { innerHTML: '' };
    const context = loadTrailScript({
      document: {
        readyState: 'loading',
        getElementById: (id) => (id === 'legendChips' ? legendChips : null),
        querySelector: () => null,
        querySelectorAll: () => [],
        createElement: () => ({
          style: {},
          className: '',
          textContent: '',
          innerHTML: '',
          hidden: false,
          appendChild: () => {},
          addEventListener: () => {},
          setAttribute: () => {},
        }),
        addEventListener: () => {},
      },
    });

    context.renderLegendChips({
      path: [[46.6, 12.1], [46.61, 12.11]],
      safetyLevel: 'moderate',
      decisionPoints: [{ km: 2.1, instruction: 'Keep left onto 104' }],
      rifugi: [],
      waterSources: [],
      lat: 46.6,
      lng: 12.1,
    });

    expect(legendChips.innerHTML).toContain('Start');
    expect(legendChips.innerHTML).toContain('Route · Moderate');
    expect(legendChips.innerHTML).toContain('Direction of travel');
    expect(legendChips.innerHTML).toContain('Trail switch');
    expect(legendChips.innerHTML).toContain('Mountain hut');
    expect(legendChips.innerHTML).toContain('Food stop');
    expect(legendChips.innerHTML).toContain('Water source');
  });

  test('addTerrainToggle creates a terrain button anchored with the terrain-specific class', () => {
    const createdButtons = [];
    const mapContainer = {
      style: {},
      appendChild: (el) => createdButtons.push(el),
    };
    const context = loadTrailScript({
      document: {
        readyState: 'loading',
        getElementById: (id) => (id === 'trailDetailMap' ? mapContainer : null),
        querySelector: () => null,
        querySelectorAll: () => [],
        createElement: () => ({
          style: {},
          className: '',
          textContent: '',
          innerHTML: '',
          hidden: false,
          appendChild: () => {},
          addEventListener: () => {},
          setAttribute: () => {},
        }),
        addEventListener: () => {},
      },
    });

    context.addTerrainToggle({}, 'trailDetailMap', 1.5, 45);

    expect(createdButtons).toHaveLength(1);
    expect(createdButtons[0].textContent).toBe('trail.view3d');
    expect(createdButtons[0].className).toContain('map-btn--terrain');
    expect(createdButtons[0].style.left).toBeUndefined();
  });
});
