const fs = require('fs');
const path = require('path');

const mobileNav = fs.readFileSync(path.join(__dirname, 'mobile-nav.js'), 'utf8');

describe('shared navigation hardening', () => {
  beforeEach(() => {
    document.body.innerHTML = '<nav class="topnav"><a class="brand" href="index.html">DoloPaws</a><div class="links"><a href="browse-trails.html">Trails</a></div></nav>';
    window.eval(mobileNav);
  });

  test('adds an accessible mobile menu control', () => {
    const toggle = document.querySelector('.mobile-nav-toggle');
    expect(toggle).not.toBeNull();
    expect(toggle.getAttribute('aria-controls')).toBe('primaryNavigation');
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(toggle.getAttribute('aria-label')).toBe('Open menu');
  });

  test('protects dynamically inserted new-tab links', async () => {
    const link = document.createElement('a');
    link.target = '_blank';
    link.href = 'https://example.com';
    document.body.appendChild(link);
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(link.rel.split(/\s+/)).toContain('noopener');
  });
});
