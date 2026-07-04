const path = require('path');

const modulePath = path.join(__dirname, 'homepage-view.js');

function loadHomepageView(search, authUser){
  document.body.innerHTML = `
    <button id="accountBtn">Log in</button>
    <div id="defaultHomepageHero"></div>
    <section id="newCustomerHomepage" hidden></section>
    <section id="returningCustomerHomepage" hidden></section>
    <span id="returningHeroName"></span>
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
  });

  test('shows returning hero when logged in', () => {
    loadHomepageView('', { displayName: 'Alex', uid: 'u1' });

    expect(document.body.dataset.homepageView).toBe('returning');
    expect(document.getElementById('defaultHomepageHero').hidden).toBe(true);
    expect(document.getElementById('newCustomerHomepage').hidden).toBe(true);
    expect(document.getElementById('returningCustomerHomepage').hidden).toBe(false);
    expect(document.getElementById('accountBtn').textContent).toBe('My account');
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

describe('returning view — map-first layout hooks', () => {
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
        </div>
        <div class="hero-right"><div id="trailMap" aria-label="Trail map"></div></div>
      </div>
      <div id="results"></div>
    `;

    window.history.replaceState({}, '', '/');
    window.DoloPawsAuth = authUser !== undefined ? { currentUser: authUser } : undefined;
    if (authUser === undefined) delete window.DoloPawsAuth;
    delete window.DoloPawsHomepageView;
    jest.resetModules();
    require(modulePath);
  }

  test('body carries data-homepage-view="returning" enabling map-first CSS layout when logged in', () => {
    loadReturningWithLayout({ displayName: 'Alex', uid: 'u1' });

    expect(document.body.dataset.homepageView).toBe('returning');
  });

  test('map element is inside .hero-right sibling to #finder for CSS ordering to apply', () => {
    loadReturningWithLayout({ displayName: 'Alex', uid: 'u1' });

    const trailMap = document.getElementById('trailMap');
    const finder = document.getElementById('finder');
    const wrap = document.querySelector('.wrap');

    expect(trailMap).not.toBeNull();
    expect(finder).not.toBeNull();
    // Both must be direct children of .wrap for CSS order to affect their visual position
    expect(trailMap.closest('.wrap')).toBe(wrap);
    expect(finder.parentElement).toBe(wrap);
    // Map is inside .hero-right which gets order:-1 via CSS in returning view
    expect(trailMap.closest('.hero-right')).not.toBeNull();
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

  test('body has data-homepage-view="new" (not returning) when logged out — layout not affected', () => {
    loadReturningWithLayout(null);

    expect(document.body.dataset.homepageView).toBe('new');
  });
});
