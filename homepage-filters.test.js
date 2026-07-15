const fs = require('fs');
const path = require('path');
const vm = require('vm');

function tForTests(key, params = {}){
  if(key === 'areas.allValleys') return 'All valleys';
  if(key === 'areas.allProvinces') return 'All provinces';
  if(key === 'province.savoie') return 'Savoie';
  if(key === 'province.haute-savoie') return 'Haute-Savoie';
  if(key === 'province.alto-adige') return 'South Tyrol';
  if(key === 'province.trentino') return 'Trentino';
  if(key === 'province.belluno') return 'Belluno';
  if(key === 'region.savoy') return 'Savoy';
  if(key === 'region.theDolomites') return 'the Dolomites';
  if(key === 'region.dolomites') return 'Dolomites';
  if(key === 'home.bubble') return 'Where are we heading today?';
  if(key === 'home.pickArea') return `Pick a province or valley below — trails are ranked for ${params.name || 'your dog'}.`;
  if(key === 'home.pickAreaNoName') return 'Pick a province or valley below — trails are ranked for your dog.';
  if(key === 'home.nTrails') return `${params.n} ${params.n === 1 ? 'trail' : 'trails'}`;
  if(key === 'home.nSaved') return `${params.n} saved trails`;
  if(key === 'home.nSaved1') return '1 saved trail';
  if(key === 'home.savedTrails') return 'Saved trails';
  if(key === 'home.allTrailsBtn') return '← All trails';
  if(key === 'home.editProfile') return 'Edit profile';
  if(key === 'home.noSaved') return 'No saved trails';
  if(key === 'home.noSavedValley') return `No saved trails in ${params.label}`;
  if(key === 'home.noTrailsValley') return `No trails in ${params.label}`;
  if(key === 'filter.all') return 'All';
  if(key === 'filter.verified') return 'Verified';
  if(key === 'filter.imported') return 'Imported';
  if(key === 'safety.low') return 'Low';
  if(key === 'safety.moderate') return 'Moderate';
  if(key === 'safety.caution') return 'Caution';
  if(key === 'page.of') return `${params.a}/${params.b}`;
  if(key === 'page.prev') return 'Prev';
  if(key === 'page.next') return 'Next';
  if(key === 'home.fitLine') return '';
  if(key === 'card.trailRef') return '';
  if(key === 'card.details') return 'Details';
  if(key === 'card.locate') return 'Locate';
  if(key === 'card.save') return 'Save';
  if(key === 'card.saved') return 'Saved';
  if(key === 'card.matchWord') return 'match';
  if(key === 'card.estimated') return 'estimated';
  if(key === 'badge.verified') return 'VERIFIED';
  if(key === 'badge.imported') return 'IMPORTED';
  if(key === 'badge.new') return 'NEW';
  return key;
}

function loadHomepageContext(testTrails){
  document.body.innerHTML = `
    <div id="areaFilterRow"></div>
    <h1 id="returningHeading"></h1>
    <p id="returningSubline"></p>
    <span id="returningCount"></span>
    <div id="returningTrailList"></div>
    <button id="savedTrailsBtn"></button>
    <button id="adjustToggle"></button>
    <div id="adjustPanel"></div>
    <button id="adjustCloseBtn"></button>
  `;

  const context = {
    console,
    setTimeout,
    clearTimeout,
    URLSearchParams,
    Promise,
    module: {},
    exports: {},
    localStorage: {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {},
    },
    navigator: { userAgent: 'jest' },
    location: { search: '' },
    document,
    fetch: jest.fn(),
    trails: testTrails,
    t: tForTests,
    scoreTrail: () => 80,
    effectiveOverrides: () => ({ terrain: '1', distance: '10', heatSensitive: false }),
    pathThumbnailSvg: () => '',
    matchColor: () => '#2E4034',
    SAFETY_DOT: { 'low-risk': '#4a7', moderate: '#d9a441', caution: '#d16a6a' },
    maplibregl: {
      LngLatBounds: function LngLatBounds(){ this.extend = () => this; },
      Popup: function Popup(){ return { setHTML(){ return this; } }; },
      Marker: function Marker(){ return { setLngLat(){ return this; }, setPopup(){ return this; }, addTo(){ return this; }, getElement(){ return { style: {}, addEventListener: () => {} }; }, togglePopup: () => {} }; },
    },
    window: null,
    globalThis: null,
    addEventListener: () => {},
  };
  context.window = context;
  context.globalThis = context;
  context.window.location = context.location;
  context.window.addEventListener = () => {};

  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(__dirname, 'regions-config.js'), 'utf8'), context);
  vm.runInContext(fs.readFileSync(path.join(__dirname, 'script.js'), 'utf8'), context);
  return context;
}

describe('returning homepage province + valley filters', () => {
  const sampleTrails = [
    { id: 'mau', name: 'Maurienne Trail', region: 'savoy', valley: 'Maurienne', province: 'savoie', area: 'Modane', lat: 45.2, lng: 6.6, curated: true, distance: 6, elevation: 300, hours: 3, terrainType: 'Mixed', safetyLevel: 'low-risk' },
    { id: 'tar', name: 'Tarentaise Trail', region: 'savoy', valley: 'Tarentaise – Vanoise', province: 'savoie', area: 'Tignes', lat: 45.46, lng: 6.9, curated: true, distance: 9, elevation: 500, hours: 4, terrainType: 'Mixed', safetyLevel: 'moderate' },
    { id: 'bea', name: 'Beaufortain Trail', region: 'savoy', valley: 'Beaufortain', province: 'savoie', area: 'Beaufort', lat: 45.72, lng: 6.57, curated: true, distance: 8, elevation: 420, hours: 3.5, terrainType: 'Mixed', safetyLevel: 'moderate' },
    { id: 'cha', name: 'Chamonix Trail', region: 'savoy', valley: 'Chamonix – Mont Blanc', province: 'haute-savoie', area: 'Chamonix', lat: 45.92, lng: 6.86, curated: true, distance: 7, elevation: 450, hours: 3.2, terrainType: 'Mixed', safetyLevel: 'moderate' },
    { id: 'ara', name: 'Aravis Trail', region: 'savoy', valley: 'Aravis – Annecy', province: 'haute-savoie', area: 'Annecy', lat: 45.89, lng: 6.12, curated: false, distance: 5, elevation: 220, hours: 2.3, terrainType: 'Mixed', safetyLevel: 'low-risk' },
    { id: 'vag', name: 'Val Gardena Trail', region: 'dolomites', valley: 'Val Gardena', province: 'alto-adige', area: 'Ortisei', lat: 46.57, lng: 11.67, curated: true, distance: 6, elevation: 320, hours: 3, terrainType: 'Mixed', safetyLevel: 'low-risk' },
    { id: 'pri', name: 'Primiero Trail', region: 'dolomites', valley: 'Primiero – Pale', province: 'trentino', area: 'San Martino', lat: 46.26, lng: 11.80, curated: true, distance: 7, elevation: 400, hours: 3.5, terrainType: 'Rocky', safetyLevel: 'moderate' },
    { id: 'bel', name: 'Cortina Trail', region: 'dolomites', valley: 'Cortina – Ampezzo', province: 'belluno', area: 'Cortina', lat: 46.54, lng: 12.13, curated: true, distance: 5, elevation: 280, hours: 2.5, terrainType: 'Mixed', safetyLevel: 'low-risk' },
  ];

  test('renders province chips for Savoy with all/savoie/haute-savoie', () => {
    const context = loadHomepageContext(sampleTrails);
    vm.runInContext('activeRegion = "savoy"; activeProvince = "all"; activeValley = "all";', context);
    vm.runInContext('renderAreaFilters(null);', context);

    const row = document.getElementById('areaFilterRow');
    expect(row.innerHTML).toContain('data-province="all"');
    expect(row.innerHTML).toContain('All provinces');
    expect(row.innerHTML).toContain('Savoie');
    expect(row.innerHTML).toContain('Haute-Savoie');
  });

  test('province selection narrows the visible valley chips', () => {
    const context = loadHomepageContext(sampleTrails);
    vm.runInContext('activeRegion = "savoy"; activeProvince = "savoie"; activeValley = "all";', context);
    vm.runInContext('renderAreaFilters(null);', context);

    const row = document.getElementById('areaFilterRow');
    expect(row.textContent).toContain('Maurienne');
    expect(row.textContent).toContain('Tarentaise – Vanoise');
    expect(row.textContent).toContain('Beaufortain');
    expect(row.textContent).not.toContain('Chamonix – Mont Blanc');
    expect(row.textContent).not.toContain('Aravis – Annecy');
  });

  test('clicking a province resets valley selection to all', () => {
    const context = loadHomepageContext(sampleTrails);
    vm.runInContext('activeRegion = "savoy"; activeProvince = "all"; activeValley = "Maurienne"; renderAreaFilters(null);', context);

    const hauteSavoieChip = document.querySelector('[data-province="haute-savoie"]');
    expect(hauteSavoieChip).not.toBeNull();
    hauteSavoieChip.click();

    expect(vm.runInContext('activeProvince', context)).toBe('haute-savoie');
    expect(vm.runInContext('activeValley', context)).toBe('all');
  });

  test('result count reflects province + valley filters together', async () => {
    const context = loadHomepageContext(sampleTrails);
    vm.runInContext('activeRegion = "savoy"; activeProvince = "savoie"; activeValley = "all"; activeProvenance = "all"; showingSavedOnly = false;', context);
    await vm.runInContext('renderReturningHomepage(null);', context);
    expect(document.getElementById('returningCount').textContent).toBe('3 trails');

    vm.runInContext('activeValley = "Maurienne";', context);
    await vm.runInContext('renderReturningHomepage(null);', context);
    expect(document.getElementById('returningCount').textContent).toBe('1 trail');
  });

  test('renders province chips for Dolomites with south-tyrol/trentino/belluno', () => {
    const context = loadHomepageContext(sampleTrails);
    vm.runInContext('activeRegion = "dolomites"; activeProvince = "all"; activeValley = "all";', context);
    vm.runInContext('renderAreaFilters(null);', context);

    const row = document.getElementById('areaFilterRow');
    expect(row.innerHTML).toContain('data-province="all"');
    expect(row.innerHTML).toContain('All provinces');
    expect(row.textContent).toContain('South Tyrol');
    expect(row.textContent).toContain('Trentino');
    expect(row.textContent).toContain('Belluno');
  });

  test('Dolomites province selection narrows visible valley chips', () => {
    const context = loadHomepageContext(sampleTrails);
    vm.runInContext('activeRegion = "dolomites"; activeProvince = "trentino"; activeValley = "all";', context);
    vm.runInContext('renderAreaFilters(null);', context);

    const row = document.getElementById('areaFilterRow');
    expect(row.textContent).toContain('Primiero – Pale');
    expect(row.textContent).not.toContain('Val Gardena');
    expect(row.textContent).not.toContain('Cortina – Ampezzo');
  });

  test('switching from Savoy to Dolomites resets province and valley', () => {
    const context = loadHomepageContext(sampleTrails);
    vm.runInContext('activeRegion = "savoy"; activeProvince = "savoie"; activeValley = "Maurienne"; renderAreaFilters(null);', context);

    const dolomitesTab = document.querySelector('[data-region="dolomites"]');
    expect(dolomitesTab).not.toBeNull();
    dolomitesTab.click();

    expect(vm.runInContext('activeRegion', context)).toBe('dolomites');
    expect(vm.runInContext('activeProvince', context)).toBe('all');
    expect(vm.runInContext('activeValley', context)).toBe('all');
  });

  test('Dolomites result count reflects province filter', async () => {
    const context = loadHomepageContext(sampleTrails);
    vm.runInContext('activeRegion = "dolomites"; activeProvince = "all"; activeValley = "all"; activeProvenance = "all"; showingSavedOnly = false;', context);
    await vm.runInContext('renderReturningHomepage(null);', context);
    expect(document.getElementById('returningCount').textContent).toBe('3 trails');

    vm.runInContext('activeProvince = "belluno";', context);
    await vm.runInContext('renderReturningHomepage(null);', context);
    expect(document.getElementById('returningCount').textContent).toBe('1 trail');
  });
});
