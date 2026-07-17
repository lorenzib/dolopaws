const fs = require('fs');
const path = require('path');

const read = file => fs.readFileSync(path.join(__dirname, file), 'utf8');

describe('empty states and long-form navigation', () => {
  test('saved and journal empty states explain the next action', () => {
    document.body.innerHTML = read('saved.html');
    expect(document.querySelector('#savedEmpty.empty-state')).not.toBeNull();
    expect(document.querySelector('#savedEmpty .empty-state__action').textContent).toMatch(/Find a trail/i);

    document.body.innerHTML = read('journal.html');
    expect(document.querySelector('#jnEmpty.empty-state')).not.toBeNull();
    expect(document.getElementById('jnEmptyLogBtn').textContent).toMatch(/first walk/i);
  });

  test('browse and trail community content provide purposeful empty states', () => {
    const browse = read('browse-trails.html');
    const trail = read('trail.html');
    const reports = read('trail-reports.js');
    expect(browse).toContain('data-clear-empty');
    expect(browse).toContain('No trails match this combination');
    expect(reports).toContain('No trail photos yet');
    expect(reports).toContain('No reviews yet');
    expect(reports).toContain('No recent hazard reports');
    expect(trail).toContain('No trail photos yet');
    expect(trail).toContain('No reviews yet');
  });

  test('about page receives generated section navigation', () => {
    document.documentElement.innerHTML = read('about.html');
    window.eval(read('guide-navigation.js'));
    const nav = document.querySelector('.guide-page-nav[data-generated]');
    expect(nav).not.toBeNull();
    expect(nav.querySelectorAll('a')).toHaveLength(3);
    expect(document.querySelectorAll('[data-lang-block="en"] .guide-anchor')).toHaveLength(3);
  });

  test('long guide articles receive navigation while short ones stay focused', () => {
    document.documentElement.innerHTML = read('guides/dogs-on-cable-cars.html');
    window.eval(read('guide-navigation.js'));
    expect(document.querySelectorAll('.guide-page-nav a')).toHaveLength(5);

    document.documentElement.innerHTML = read('guides/heat-overheating.html');
    window.eval(read('guide-navigation.js'));
    expect(document.querySelector('.guide-page-nav')).toBeNull();
  });
});
