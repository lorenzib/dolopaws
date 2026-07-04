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

  test('logged-out homepage shows a guest landing strip with a sign-up CTA', () => {
    const indexHtml = loadHtml('index.html');

    document.documentElement.innerHTML = indexHtml;

    const guestHomepage = document.getElementById('newCustomerHomepage');
    const signupBtn = document.getElementById('heroSignupBtn');

    expect(guestHomepage).not.toBeNull();
    expect(guestHomepage.classList.contains('homepage-intro-strip')).toBe(true);
    expect(signupBtn).not.toBeNull();
    expect(document.getElementById('heroLoginBtn')).toBeNull();
    expect(guestHomepage.textContent).toContain("Trails scored for your dog's safety");
  });

  test('guest landing strip does not include the complex preview card section', () => {
    const indexHtml = loadHtml('index.html');

    document.documentElement.innerHTML = indexHtml;

    expect(document.querySelector('.guest-homepage__preview')).toBeNull();
    expect(document.querySelectorAll('.guest-preview-card')).toHaveLength(0);
  });

  test('logged-in homepage finder contains location filter group', () => {
    const indexHtml = loadHtml('index.html');

    document.documentElement.innerHTML = indexHtml;

    expect(document.getElementById('locationGroup')).not.toBeNull();
    const provinceRow = document.querySelector('#locationGroup .pill-row[data-group="province"]');
    expect(provinceRow).not.toBeNull();
  });

  test('dog-specific question groups have IDs for CSS-based hiding in logged-in view', () => {
    const indexHtml = loadHtml('index.html');

    document.documentElement.innerHTML = indexHtml;

    expect(document.getElementById('dogTerrainGroup')).not.toBeNull();
    expect(document.getElementById('dogShadeGroup')).not.toBeNull();
    expect(document.getElementById('dogWaterGroup')).not.toBeNull();
    expect(document.getElementById('dogPawsGroup')).not.toBeNull();
    expect(document.getElementById('dogHeatGroup')).not.toBeNull();
    expect(document.getElementById('dogExposureGroup')).not.toBeNull();
  });

  test('map is in #trailMapWrap after .wrap and before #results in the HTML', () => {
    const indexHtml = loadHtml('index.html');

    document.documentElement.innerHTML = indexHtml;

    const wrap = document.querySelector('.wrap');
    const trailMapWrap = document.getElementById('trailMapWrap');
    const trailMap = document.getElementById('trailMap');
    const results = document.getElementById('results');

    expect(trailMapWrap).not.toBeNull();
    expect(trailMap).not.toBeNull();
    expect(trailMap.parentElement).toBe(trailMapWrap);

    // trailMapWrap comes after .wrap
    expect(
      wrap.compareDocumentPosition(trailMapWrap) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();

    // trailMapWrap comes before #results
    expect(
      trailMapWrap.compareDocumentPosition(results) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });
});
