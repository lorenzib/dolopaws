(function(global){
  const ICON_MIN_ZOOM = 12;

  const BASE_COLORS = {
    adjust: '#2E4034',
    routes: '#2C5C34',
    lifts: '#4E90A8',
    water: '#4E90A8',
    hut: '#8A5A16',
    food: '#C4652F',
    dog: '#2E4034',
    start: '#2E4034',
    switch: '#D6A038',
    unknown: '#5A5548',
  };

  const MAP_ICON_VARIANTS = {
    lifts: { icon: 'lifts', color: '#4E90A8' },
    'water-drinking': { icon: 'water', color: '#4E90A8' },
    'water-fountain': { icon: 'water', color: '#2E7FA8' },
    'water-spring': { icon: 'water', color: '#228B22' },
    'water-tap': { icon: 'water', color: '#0077BE' },
    'water-point': { icon: 'water', color: '#5DB8D0' },
    'hut-alpine': { icon: 'hut', color: '#8A5A16' },
    'hut-wilderness': { icon: 'hut', color: '#B0741C' },
    'hut-shelter': { icon: 'hut', color: '#5A5548' },
    'food-bar': { icon: 'food', color: '#9C3A25' },
    'food-pub': { icon: 'food', color: '#7A2818' },
    'food-cafe': { icon: 'food', color: '#D6A038' },
    'food-restaurant': { icon: 'food', color: '#C4652F' },
    'food-fast': { icon: 'food', color: '#C4652F' },
    'food-icecream': { icon: 'food', color: '#D6A038' },
    'food-biergarten': { icon: 'food', color: '#9C3A25' },
    unknown: { icon: 'unknown', color: '#5A5548' },
  };

  const ICON_PATHS = {
    adjust: `
      <path d="M6 7h12"></path>
      <path d="M6 12h12"></path>
      <path d="M6 17h12"></path>
      <circle cx="9" cy="7" r="2"></circle>
      <circle cx="15" cy="12" r="2"></circle>
      <circle cx="11" cy="17" r="2"></circle>
    `,
    routes: `
      <path d="M6 18c2-5 5.5-9 12-12"></path>
      <circle cx="7" cy="18" r="1.5"></circle>
      <circle cx="18" cy="6" r="1.5"></circle>
      <path d="M10.2 13.4h1.8"></path>
      <path d="M13.7 10h1.8"></path>
    `,
    lifts: `
      <path d="M5 6h14"></path>
      <path d="M9 6v3"></path>
      <path d="M15 6v3"></path>
      <rect x="8" y="9" width="8" height="7" rx="2"></rect>
      <path d="M10.5 16v2"></path>
      <path d="M13.5 16v2"></path>
    `,
    water: `
      <path d="M12 5c2.6 3 4.1 5.4 4.1 7.5a4.1 4.1 0 1 1-8.2 0C7.9 10.4 9.4 8 12 5Z"></path>
    `,
    hut: `
      <path d="M5 11l7-6 7 6"></path>
      <path d="M7 10.5V18h10v-7.5"></path>
      <path d="M10 18v-4h4v4"></path>
    `,
    food: `
      <path d="M8 5v6"></path>
      <path d="M6 5v4"></path>
      <path d="M10 5v4"></path>
      <path d="M8 11v8"></path>
      <path d="M15 5v14"></path>
      <path d="M15 5c2 0 3 2 3 4s-1 4-3 4"></path>
    `,
    dog: `
      <circle cx="8" cy="8.2" r="1.6"></circle>
      <circle cx="12" cy="6.6" r="1.6"></circle>
      <circle cx="16" cy="8.2" r="1.6"></circle>
      <path d="M8.4 16.5c0-2.4 1.5-4.2 3.6-4.2s3.6 1.8 3.6 4.2c0 1.4-1.1 2.5-2.5 2.5-.7 0-1.1-.3-1.7-.7-.5.4-1 .7-1.7.7-1.3 0-2.3-1.1-2.3-2.5Z"></path>
    `,
    start: `
      <path d="M8 19V5"></path>
      <path d="M8 6h8l-2 3 2 3H8"></path>
    `,
    switch: `
      <path d="M12 19v-7"></path>
      <path d="M12 12 7 7"></path>
      <path d="M12 12l5-5"></path>
      <path d="M7 7h4"></path>
      <path d="M13 7h4"></path>
    `,
    unknown: `
      <circle cx="12" cy="12" r="7"></circle>
      <path d="M9.8 10a2.5 2.5 0 1 1 4 2c-.9.6-1.8 1.1-1.8 2.3"></path>
      <path d="M12 17h.01"></path>
    `,
  };

  function escapeHtml(value){
    return String(value).replace(/[&<>"']/g, (char) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    }[char]));
  }

  function svgDataUri(markup){
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`;
  }

  function getIconMarkup(iconKey){
    return ICON_PATHS[iconKey] || ICON_PATHS.unknown;
  }

  function getCategoryColor(iconKey){
    return BASE_COLORS[iconKey] || BASE_COLORS.unknown;
  }

  function renderIconSvg(iconKey, options = {}){
    const mode = options.mode || 'inline';
    const size = options.size || (mode === 'legend' ? 18 : mode === 'marker' || mode === 'map' ? 28 : 16);
    const color = options.color || getCategoryColor(iconKey);
    const badge = mode === 'legend' || mode === 'marker' || mode === 'map';
    const stroke = badge ? '#ffffff' : color;
    const strokeWidth = badge ? 1.8 : 1.9;
    const background = badge ? `<circle cx="12" cy="12" r="9" fill="${color}" stroke="#ffffff" stroke-width="1.5"></circle>` : '';
    return `<svg class="dp-icon-svg dp-icon-svg--${escapeHtml(mode)}" viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" aria-hidden="true">
      ${background}
      <g stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round">
        ${getIconMarkup(iconKey)}
      </g>
    </svg>`;
  }

  function chipHtml(iconKey, label){
    return `<span class="dp-chip-label">${renderIconSvg(iconKey, { mode: 'inline', color: 'currentColor', size: 16 })}<span>${escapeHtml(label)}</span></span>`;
  }

  function legendItemHtml(iconKey, label, options = {}){
    const color = options.color || getCategoryColor(iconKey);
    return `<span class="dp-legend-item">${renderIconSvg(iconKey, { mode: 'legend', color, size: 18 })}<span>${escapeHtml(label)}</span></span>`;
  }

  function createMarkerElement(iconKey, options = {}){
    const el = global.document.createElement('div');
    el.className = 'dp-marker dp-marker--icon';
    el.innerHTML = renderIconSvg(iconKey, { mode: 'marker', color: options.color || getCategoryColor(iconKey), size: options.size || 30 });
    return el;
  }

  function getMapImageName(variantKey){
    return `dp-map-icon-${variantKey}`;
  }

  function getPoiCircleColorExpression(group){
    if(group === 'water'){
      return [
        'case',
        ['==', ['get', 'amenity'], 'drinking_water'], '#4E90A8',
        ['==', ['get', 'amenity'], 'fountain'], '#2E7FA8',
        ['==', ['get', 'natural'], 'spring'], '#228B22',
        ['==', ['get', 'man_made'], 'water_tap'], '#0077BE',
        ['==', ['get', 'amenity'], 'water_point'], '#5DB8D0',
        '#5A5548',
      ];
    }
    if(group === 'huts'){
      return [
        'case',
        ['==', ['get', 'tourism'], 'alpine_hut'], '#8A5A16',
        ['==', ['get', 'tourism'], 'wilderness_hut'], '#B0741C',
        '#5A5548',
      ];
    }
    if(group === 'food'){
      return [
        'case',
        ['==', ['get', 'amenity'], 'bar'], '#9C3A25',
        ['==', ['get', 'amenity'], 'pub'], '#7A2818',
        ['==', ['get', 'amenity'], 'cafe'], '#D6A038',
        ['==', ['get', 'amenity'], 'restaurant'], '#C4652F',
        ['==', ['get', 'amenity'], 'fast_food'], '#C4652F',
        ['==', ['get', 'amenity'], 'ice_cream'], '#D6A038',
        ['==', ['get', 'amenity'], 'biergarten'], '#9C3A25',
        '#5A5548',
      ];
    }
    return '#5A5548';
  }

  function getPoiClusterColor(group){
    if(group === 'water') return '#4E90A8';
    if(group === 'huts') return '#8A5A16';
    if(group === 'food') return '#9C3A25';
    return '#5A5548';
  }

  function getPoiMapIconExpression(group){
    if(group === 'water'){
      return [
        'case',
        ['==', ['get', 'amenity'], 'drinking_water'], getMapImageName('water-drinking'),
        ['==', ['get', 'amenity'], 'fountain'], getMapImageName('water-fountain'),
        ['==', ['get', 'natural'], 'spring'], getMapImageName('water-spring'),
        ['==', ['get', 'man_made'], 'water_tap'], getMapImageName('water-tap'),
        ['==', ['get', 'amenity'], 'water_point'], getMapImageName('water-point'),
        getMapImageName('unknown'),
      ];
    }
    if(group === 'huts'){
      return [
        'case',
        ['==', ['get', 'tourism'], 'alpine_hut'], getMapImageName('hut-alpine'),
        ['==', ['get', 'tourism'], 'wilderness_hut'], getMapImageName('hut-wilderness'),
        ['==', ['get', 'amenity'], 'shelter'], getMapImageName('hut-shelter'),
        getMapImageName('unknown'),
      ];
    }
    if(group === 'food'){
      return [
        'case',
        ['==', ['get', 'amenity'], 'bar'], getMapImageName('food-bar'),
        ['==', ['get', 'amenity'], 'pub'], getMapImageName('food-pub'),
        ['==', ['get', 'amenity'], 'cafe'], getMapImageName('food-cafe'),
        ['==', ['get', 'amenity'], 'restaurant'], getMapImageName('food-restaurant'),
        ['==', ['get', 'amenity'], 'fast_food'], getMapImageName('food-fast'),
        ['==', ['get', 'amenity'], 'ice_cream'], getMapImageName('food-icecream'),
        ['==', ['get', 'amenity'], 'biergarten'], getMapImageName('food-biergarten'),
        getMapImageName('unknown'),
      ];
    }
    return getMapImageName('unknown');
  }

  function registerMapImages(map){
    if(!map || typeof map.loadImage !== 'function') return Promise.resolve();
    const loads = Object.entries(MAP_ICON_VARIANTS).map(([variantKey, config]) => {
      const imageName = getMapImageName(variantKey);
      if(map.hasImage && map.hasImage(imageName)) return Promise.resolve();
      const svg = renderIconSvg(config.icon, { mode: 'map', color: config.color, size: 30 });
      return new Promise((resolve) => {
        map.loadImage(svgDataUri(svg), (error, image) => {
          if(!error && image && (!map.hasImage || !map.hasImage(imageName))){
            map.addImage(imageName, image, { pixelRatio: 2 });
          }
          resolve();
        });
      });
    });
    return Promise.all(loads);
  }

  function hydrate(root){
    if(!root || typeof root.querySelectorAll !== 'function') return;
    root.querySelectorAll('[data-dp-icon]').forEach((el) => {
      const iconKey = el.getAttribute('data-dp-icon') || 'unknown';
      const mode = el.getAttribute('data-dp-icon-mode') || 'inline';
      const color = el.getAttribute('data-dp-icon-color') || getCategoryColor(iconKey);
      const size = Number(el.getAttribute('data-dp-icon-size')) || undefined;
      el.classList.add('dp-icon-host', `dp-icon-host--${mode}`);
      el.innerHTML = renderIconSvg(iconKey, { mode, color, size });
    });
  }

  const api = {
    ICON_MIN_ZOOM,
    chipHtml,
    createMarkerElement,
    escapeHtml,
    getCategoryColor,
    getMapImageName,
    getPoiCircleColorExpression,
    getPoiClusterColor,
    getPoiMapIconExpression,
    hydrate,
    legendItemHtml,
    registerMapImages,
    renderIconSvg,
  };

  global.DoloPawsIcons = api;

  if(typeof module !== 'undefined' && module.exports){
    module.exports = api;
  }

  if(global.document){
    if(global.document.readyState === 'loading'){
      global.document.addEventListener('DOMContentLoaded', () => hydrate(global.document));
    } else {
      hydrate(global.document);
    }
  }
})(typeof window !== 'undefined' ? window : globalThis);
