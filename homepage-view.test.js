const path = require('path');

const modulePath = path.join(__dirname, 'homepage-view.js');

function loadHomepageView(search, authUser){
  document.body.innerHTML = `
    <button id="accountBtn">Log in</button>
    <div id="defaultHomepageHero"></div>
    <section id="newCustomerHomepage" hidden></section>
    <section id="returningCustomerHomepage" hidden></section>
    <span id="returningHeroName"></span>
    <div id="finder"></div>
    <div id="trailMap"></div>
    <div id="results"></div>
  `;

  window.history.replaceState({}, '', search ? `/${search}` : '/');

  // Simulate DoloPawsAuth presence/absence and logged-in state.
  if(authUser !== undefined){
    window.DoloPawsAuth = { currentUser: authUser };
  } else {
    delete window.DoloPawsAuth;
  }

  delete window.DoloPawsHomepageView;
  jest.resetModules();
  return require(modulePath);
}

describe('homepage view switching — auth-based', () => {
  test('shows new-customer hero when logged out (null user)', () => {
    loadHomepageView('', null);

    expect(document.body.dataset.homepageView).toBe('new');
    expect(document.getElementById('defaultHomepageHero').hidden).toBe(true);
    expect(document.getElementById('newCustomerHomepage').hidden).toBe(false);
    expect(document.getElementById('returningCustomerHomepage').hidden).toBe(true);
    expect(document.getElementById('accountBtn').textContent).toBe('Log in');
    expect(document.getElementById('finder').hidden).toBe(true);
    expect(document.getElementById('trailMap').hidden).toBe(false);
    // Results are shown for guests (script.js limits visible trails to a teaser subset).
    expect(document.getElementById('results').hidden).toBe(false);
  });

  test('shows returning hero when logged in', () => {
    loadHomepageView('', { displayName: 'Alex', uid: 'u1' });

    expect(document.body.dataset.homepageView).toBe('returning');
    expect(document.getElementById('defaultHomepageHero').hidden).toBe(true);
    expect(document.getElementById('newCustomerHomepage').hidden).toBe(true);
    expect(document.getElementById('returningCustomerHomepage').hidden).toBe(false);
    expect(document.getElementById('accountBtn').textContent).toBe('My account');
    expect(document.getElementById('finder').hidden).toBe(false);
    expect(document.getElementById('trailMap').hidden).toBe(false);
    expect(document.getElementById('results').hidden).toBe(false);
  });

  test('personalises returning hero with the user display name', () => {
    loadHomepageView('', { displayName: 'Alex', uid: 'u1' });

    expect(document.getElementById('returningHeroName').textContent).toBe('Alex');
  });

  test('falls back to "you" when display name is missing', () => {
    loadHomepageView('', { displayName: null, uid: 'u1' });

    expect(document.getElementById('returningHeroName').textContent).toBe('you');
  });

  test('defaults to new-customer hero when DoloPawsAuth is unavailable', () => {
    loadHomepageView('', undefined);

    expect(document.body.dataset.homepageView).toBe('new');
    expect(document.getElementById('defaultHomepageHero').hidden).toBe(true);
    expect(document.getElementById('newCustomerHomepage').hidden).toBe(false);
    expect(document.getElementById('returningCustomerHomepage').hidden).toBe(true);
    // Results are shown for guests (script.js handles the teaser limit).
    expect(document.getElementById('results').hidden).toBe(false);
  });
});

describe('homepage view switching — dev override via ?view=', () => {
  test('?view=new forces new-customer view regardless of auth', () => {
    loadHomepageView('?view=new', { displayName: 'Alex', uid: 'u1' });

    expect(document.body.dataset.homepageView).toBe('new');
    expect(document.getElementById('newCustomerHomepage').hidden).toBe(false);
    expect(document.getElementById('returningCustomerHomepage').hidden).toBe(true);
  });

  test('?view=returning forces returning view regardless of auth', () => {
    loadHomepageView('?view=returning', null);

    expect(document.body.dataset.homepageView).toBe('returning');
    expect(document.getElementById('newCustomerHomepage').hidden).toBe(true);
    expect(document.getElementById('returningCustomerHomepage').hidden).toBe(false);
    expect(document.getElementById('accountBtn').textContent).toBe('My account');
  });

  test('invalid ?view= falls through to auth-based logic (logged out → new)', () => {
    loadHomepageView('?view=unknown', null);

    expect(document.body.dataset.homepageView).toBe('new');
    expect(document.getElementById('defaultHomepageHero').hidden).toBe(true);
    expect(document.getElementById('newCustomerHomepage').hidden).toBe(false);
  });

  test('getDevOverrideView returns valid views and null for invalid', () => {
    const hv = loadHomepageView('?view=new', null);

    expect(hv.getDevOverrideView('?view=new')).toBe('new');
    expect(hv.getDevOverrideView('?view=returning')).toBe('returning');
    expect(hv.getDevOverrideView('?view=invalid')).toBeNull();
    expect(hv.getDevOverrideView('')).toBeNull();
  });

  test('getHomepageView legacy alias behaves like getDevOverrideView', () => {
    const hv = loadHomepageView('', null);

    expect(hv.getHomepageView('?view=new')).toBe('new');
    expect(hv.getHomepageView('?view=unknown')).toBeNull();
  });
});

describe('returning view — layout hooks', () => {
  function loadReturningWithLayout(authUser) {
    document.body.innerHTML = `
      <button id="accountBtn">Log in</button>
      <div id="defaultHomepageHero"></div>
      <section id="newCustomerHomepage" hidden></section>
      <section id="returningCustomerHomepage" hidden></section>
      <span id="returningHeroName"></span>
      <div class="wrap">
        <div class="panel" id="finder">
          <p class="filter-eyebrow">Filter trails</p>
          <div class="q-group" id="locationGroup"></div>
          <div class="q-group" id="dogTerrainGroup"></div>
          <div class="q-group" id="dogShadeGroup"></div>
        </div>
      </div>
      <div id="trailMapWrap"><div id="trailMap" aria-label="Trail map"></div></div>
      <div id="results"></div>
    `;

    window.history.replaceState({}, '', '/');
    window.DoloPawsAuth = authUser !== undefined ? { currentUser: authUser } : undefined;
    if (authUser === undefined) delete window.DoloPawsAuth;
    delete window.DoloPawsHomepageView;
    jest.resetModules();
    require(modulePath);
  }

  test('body carries data-homepage-view="returning" when logged in', () => {
    loadReturningWithLayout({ displayName: 'Alex', uid: 'u1' });

    expect(document.body.dataset.homepageView).toBe('returning');
    expect(document.getElementById('finder').hidden).toBe(false);
  });

  test('map element is in #trailMapWrap after .wrap and before #results', () => {
    loadReturningWithLayout({ displayName: 'Alex', uid: 'u1' });

    const trailMap = document.getElementById('trailMap');
    const trailMapWrap = document.getElementById('trailMapWrap');
    const wrap = document.querySelector('.wrap');
    const results = document.getElementById('results');

    expect(trailMap).not.toBeNull();
    expect(trailMapWrap).not.toBeNull();
    expect(trailMap.parentElement).toBe(trailMapWrap);

    // trailMapWrap must come after .wrap in the DOM
    expect(
      wrap.compareDocumentPosition(trailMapWrap) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();

    // trailMapWrap must come before #results in the DOM
    expect(
      trailMapWrap.compareDocumentPosition(results) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });

  test('filter-eyebrow element is present inside #finder for returning-view label', () => {
    loadReturningWithLayout({ displayName: 'Alex', uid: 'u1' });

    const eyebrow = document.querySelector('#finder .filter-eyebrow');
    expect(eyebrow).not.toBeNull();
    expect(eyebrow.textContent).toBe('Filter trails');
  });

  test('results container is rendered after .wrap for filters-before-list ordering', () => {
    loadReturningWithLayout({ displayName: 'Alex', uid: 'u1' });

    const wrap = document.querySelector('.wrap');
    const results = document.getElementById('results');
    expect(wrap).not.toBeNull();
    expect(results).not.toBeNull();
    // results must come after .wrap in DOM (filter panel precedes trail list)
    expect(
      wrap.compareDocumentPosition(results) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });

  test('location filter group is present in #finder', () => {
    loadReturningWithLayout({ displayName: 'Alex', uid: 'u1' });

    expect(document.getElementById('locationGroup')).not.toBeNull();
  });

  test('dog-specific question groups are present in the DOM (visibility controlled via CSS)', () => {
    loadReturningWithLayout({ displayName: 'Alex', uid: 'u1' });

    expect(document.getElementById('dogTerrainGroup')).not.toBeNull();
    expect(document.getElementById('dogShadeGroup')).not.toBeNull();
  });

  test('body has data-homepage-view="new" (not returning) when logged out — layout not affected', () => {
    loadReturningWithLayout(null);

    expect(document.body.dataset.homepageView).toBe('new');
    expect(document.getElementById('finder').hidden).toBe(true);
  });
});
