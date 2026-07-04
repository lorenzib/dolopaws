'use strict';

const fs = require('fs');
const path = require('path');

const homepageViewModulePath = path.join(__dirname, 'homepage-view.js');

function loadHtml(relativePath) {
  return fs.readFileSync(path.join(__dirname, relativePath), 'utf8');
}

function loadHomepageViewWithNav(authUser) {
  document.body.innerHTML = `
    <div class="topnav">
      <a class="brand" href="index.html">DoloPaws</a>
      <div class="links">
        <a id="browseLink" href="trails/">
          <span>Browse our trails</span>
        </a>
        <button id="accountBtn">Log in</button>
      </div>
    </div>
    <div id="defaultHomepageHero"></div>
    <section id="newCustomerHomepage" hidden></section>
    <section id="returningCustomerHomepage" hidden></section>
    <span id="returningHeroName"></span>
  `;

  window.history.replaceState({}, '', '/');
  window.DoloPawsAuth = { currentUser: authUser };

  delete window.DoloPawsHomepageView;
  jest.resetModules();
  require(homepageViewModulePath);

  return document.getElementById('browseLink');
}

describe('Browse our trails routing', () => {
  test('homepage nav uses dedicated trails route instead of homepage hash anchor', () => {
    const indexHtml = loadHtml('index.html');

    document.documentElement.innerHTML = indexHtml;
    const browseLink = Array.from(document.querySelectorAll('.topnav .links a'))
      .find((link) => link.textContent.includes('Browse our trails'));

    expect(browseLink).not.toBeNull();
    expect(browseLink.getAttribute('href')).toBe('trails/');
    expect(browseLink.getAttribute('href').startsWith('#')).toBe(false);
  });

  test('browse nav link remains dedicated route for logged-out and logged-in homepage views', () => {
    const loggedOutLink = loadHomepageViewWithNav(null);
    expect(loggedOutLink.getAttribute('href')).toBe('trails/');

    const loggedInLink = loadHomepageViewWithNav({ displayName: 'Alex', uid: 'u1' });
    expect(loggedInLink.getAttribute('href')).toBe('trails/');
  });

  test('dedicated /trails page includes catalog shell sections', () => {
    const trailsHtml = loadHtml('trails/index.html');

    document.documentElement.innerHTML = trailsHtml;

    expect(document.querySelector('.browse-wrap')).not.toBeNull();
    expect(document.querySelector('.filters')).not.toBeNull();
    expect(document.getElementById('trailList')).not.toBeNull();
  });

  test('legacy browse-trails path redirects to dedicated /trails route', () => {
    const legacyHtml = loadHtml('browse-trails.html');

    expect(legacyHtml).toContain('http-equiv="refresh" content="0; url=trails/"');
    expect(legacyHtml).toContain("window.location.replace('trails/')");
  });

  test('logged-out homepage includes a two-column guest landing hero and preview CTA section', () => {
    const indexHtml = loadHtml('index.html');

    document.documentElement.innerHTML = indexHtml;

    const guestHomepage = document.getElementById('newCustomerHomepage');
    const hero = guestHomepage.querySelector('.guest-homepage__hero');
    const preview = guestHomepage.querySelector('.guest-homepage__preview');
    const primaryCta = document.getElementById('heroSignupBtn');
    const previewCta = document.getElementById('previewSignupBtn');

    expect(guestHomepage).not.toBeNull();
    expect(hero).not.toBeNull();
    expect(preview).not.toBeNull();
    expect(primaryCta).not.toBeNull();
    expect(previewCta).not.toBeNull();
    expect(preview.querySelectorAll('.guest-preview-card')).toHaveLength(3);
    expect(guestHomepage.textContent).toContain('Find Dolomite trails that match your dog before the hike gets hard.');
    expect(preview.textContent).toContain('Unlock matches for your dog');
  });

  test('guest landing keeps concise value points for first-time visitors', () => {
    const indexHtml = loadHtml('index.html');

    document.documentElement.innerHTML = indexHtml;

    const valuePoints = Array.from(
      document.querySelectorAll('#newCustomerHomepage .guest-homepage__value-points li')
    ).map((item) => item.textContent.trim());

    expect(valuePoints).toEqual([
      'Dog-first scoring',
      'Terrain & heat factors',
      'Fast matching in minutes',
    ]);
  });
});
