const path = require('path');

const modulePath = path.join(__dirname, 'homepage-view.js');

function loadHomepageView(search){
  document.body.innerHTML = `
    <button id="accountBtn">Log in</button>
    <section id="defaultHomepageHero"></section>
    <section id="newCustomerHomepage" hidden></section>
    <section id="returningCustomerHomepage" hidden></section>
  `;

  window.history.replaceState({}, '', search ? `/${search}` : '/');
  delete window.DoloPawsHomepageView;
  jest.resetModules();
  return require(modulePath);
}

describe('homepage view switching', () => {
  test('keeps the current homepage when view is missing', () => {
    loadHomepageView('');

    expect(document.body.dataset.homepageView).toBe('default');
    expect(document.getElementById('defaultHomepageHero').hidden).toBe(false);
    expect(document.getElementById('newCustomerHomepage').hidden).toBe(true);
    expect(document.getElementById('returningCustomerHomepage').hidden).toBe(true);
    expect(document.getElementById('accountBtn').textContent).toBe('Log in');
  });

  test('shows the new customer prototype when view=new', () => {
    loadHomepageView('?view=new');

    expect(document.body.dataset.homepageView).toBe('new');
    expect(document.getElementById('defaultHomepageHero').hidden).toBe(true);
    expect(document.getElementById('newCustomerHomepage').hidden).toBe(false);
    expect(document.getElementById('returningCustomerHomepage').hidden).toBe(true);
    expect(document.getElementById('accountBtn').textContent).toBe('Sign in');
  });

  test('shows the returning customer prototype when view=returning', () => {
    loadHomepageView('?view=returning');

    expect(document.body.dataset.homepageView).toBe('returning');
    expect(document.getElementById('defaultHomepageHero').hidden).toBe(true);
    expect(document.getElementById('newCustomerHomepage').hidden).toBe(true);
    expect(document.getElementById('returningCustomerHomepage').hidden).toBe(false);
    expect(document.getElementById('accountBtn').textContent).toBe('My account');
  });

  test('falls back to the default homepage for invalid views', () => {
    const homepageView = loadHomepageView('?view=unknown');

    expect(homepageView.getHomepageView('?view=unknown')).toBeNull();
    expect(document.body.dataset.homepageView).toBe('default');
    expect(document.getElementById('defaultHomepageHero').hidden).toBe(false);
    expect(document.getElementById('newCustomerHomepage').hidden).toBe(true);
    expect(document.getElementById('returningCustomerHomepage').hidden).toBe(true);
  });
});
