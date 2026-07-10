const icons = require('./icon-system.js');

describe('DoloPaws icon system', () => {
  test('provides icon-based chip labels without emoji fallbacks', () => {
    const html = icons.chipHtml('adjust', "Adjust for today's conditions");
    expect(html).toContain('svg');
    expect(html).toContain("Adjust for today&#39;s conditions");
    expect(html).not.toContain('⚡');
  });

  test('returns shared map icon expressions with unknown fallback', () => {
    const expr = icons.getPoiMapIconExpression('huts');
    expect(expr).toContain(icons.getMapImageName('hut-alpine'));
    expect(expr[expr.length - 1]).toBe(icons.getMapImageName('unknown'));
  });

  test('uses matching circle colors for water categories', () => {
    const expr = icons.getPoiCircleColorExpression('water');
    expect(expr).toContain('#4E90A8');
    expect(expr).toContain('#228B22');
    expect(expr[expr.length - 1]).toBe('#5A5548');
  });
});
