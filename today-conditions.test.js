const modulePath = './today-conditions.js';

function loadWithMarkup(view){
  document.body.dataset.homepageView = view;
  document.body.innerHTML = `
    <button id="todayConditionsToggle" aria-expanded="false" aria-controls="todayConditionsPanel">Adjust for today’s conditions</button>
    <section id="todayConditionsPanel">
      <button id="todayConditionsClose" type="button">Close</button>
      <button id="todayConditionsReset" type="button">Reset</button>
      <div class="pill-row" data-group="terrain">
        <button class="pill active" data-value="0" type="button">Mostly paved</button>
        <button class="pill" data-value="1" type="button">Mixed gravel</button>
      </div>
      <div class="pill-row" data-group="distance">
        <button class="pill active" data-value="10" type="button">Up to 10 km</button>
        <button class="pill" data-value="99" type="button">Any distance</button>
      </div>
    </section>
  `;

  delete window.DoloPawsTodayConditions;
  jest.resetModules();
  const api = require(modulePath);
  api.setupTodayConditions(window);
  return api;
}

describe('today conditions panel', () => {
  test('returning view starts collapsed and toggle opens/closes panel', () => {
    loadWithMarkup('returning');
    const toggle = document.getElementById('todayConditionsToggle');
    const panel = document.getElementById('todayConditionsPanel');
    const close = document.getElementById('todayConditionsClose');

    expect(toggle.hidden).toBe(false);
    expect(panel.hidden).toBe(true);
    expect(toggle.getAttribute('aria-expanded')).toBe('false');

    toggle.click();
    expect(panel.hidden).toBe(false);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');

    close.click();
    expect(panel.hidden).toBe(true);
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
  });

  test('single-select swaps active pill and reset restores defaults', () => {
    loadWithMarkup('returning');
    const toggle = document.getElementById('todayConditionsToggle');
    const panel = document.getElementById('todayConditionsPanel');
    const reset = document.getElementById('todayConditionsReset');
    const terrainRow = panel.querySelector('.pill-row[data-group="terrain"]');
    const initialTerrain = terrainRow.querySelector('.pill.active').dataset.value;

    toggle.click();
    terrainRow.querySelector('.pill[data-value="1"]').click();

    expect(terrainRow.querySelector('.pill.active').dataset.value).toBe('1');

    reset.click();
    expect(panel.hidden).toBe(true);
    expect(terrainRow.querySelector('.pill.active').dataset.value).toBe(initialTerrain);
  });
});
