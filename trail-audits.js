/**
 * Trail-by-trail presentation audits.
 *
 * Generated OSM trail files remain reproducible and untouched. This small
 * overlay records the human checks that cannot safely live in generated data:
 * official route facts, exact mapped waypoint coordinates, photo attribution,
 * and the date those presentation details were last reviewed.
 */
(function () {
  'use strict';

  if (typeof trails === 'undefined' || !Array.isArray(trails)) return;

  const audits = {
    'osm-14381570': {
      // Route audit: 17 July 2026. Official route 09 record checked against
      // the stored OSM relation; mapped water coordinates checked against the
      // source GeoJSON; elevation compared with the official route figure.
      distance: 7.7,
      elevation: 249,
      hours: '3.5',
      elevationProfile: [
        { km: 0, elev: 1605 },
        { km: 0.6, elev: 1631 },
        { km: 1.3, elev: 1622 },
        { km: 1.8, elev: 1661 },
        { km: 2.3, elev: 1647 },
        { km: 2.9, elev: 1646 },
        { km: 3.5, elev: 1619 },
        { km: 4.1, elev: 1715 },
        { km: 4.7, elev: 1756 },
        { km: 5.3, elev: 1778 },
        { km: 5.8, elev: 1771 },
        { km: 6.4, elev: 1683 },
        { km: 7.0, elev: 1671 },
        { km: 7.6, elev: 1605 },
        { km: 7.7, elev: 1605 }
      ],
      imagePlaceholder: true,
      reviewedAt: '2026-07-17',
      reviewedBy: 'DoloPaws route audit',
      routeAudit: {
        photo: 'No licensed trail photo is currently used; no credit is due.',
        route: 'Full route geometry present and matched to Les Karellis route 09.',
        mapPoints: 'Mapped water points checked at their source GPS coordinates.',
        elevation: 'Profile present; headline ascent corrected to the official 249 m figure.'
      },
      sourceLinks: [
        {
          label: 'Les Karellis — Randonnée vers Albanne (official route 09)',
          url: 'https://www.karellis.com/activites-hiver/randonnee-vers-albanne/'
        },
        {
          label: 'Waymarked Trails — Albanne, OSM relation 14381570',
          url: 'https://hiking.waymarkedtrails.org/#route?id=14381570'
        },
        {
          label: 'OpenStreetMap contributors',
          url: 'https://www.openstreetmap.org/relation/14381570'
        }
      ],
      startPoint: {
        lat: 45.2271183,
        lng: 6.404797,
        label: 'Route 09 start at Les Karellis; the official itinerary starts from the tourist office'
      },
      waterSources: [
        {
          km: 3.6,
          lat: 45.2057217,
          lng: 6.419306,
          label: 'Fountain mapped in Albanne village',
          osmId: 'node/10879608101'
        },
        {
          km: 3.6,
          lat: 45.205582,
          lng: 6.4194452,
          label: 'Public toilets with drinking water mapped in Albanne village',
          osmId: 'node/1105132294'
        },
        {
          km: 6.9,
          lat: 45.2220273,
          lng: 6.406229,
          label: 'Mapped spring box near the route',
          osmId: 'node/8996798123'
        },
        {
          km: 7.1,
          lat: 45.2229978,
          lng: 6.4045513,
          label: 'Mapped spring box near the route',
          osmId: 'node/8996798121'
        },
        {
          km: 7.1,
          lat: 45.2231275,
          lng: 6.4045236,
          label: 'Mapped spring box near the route',
          osmId: 'node/8996798122'
        },
        {
          km: 7.7,
          lat: 45.2278921,
          lng: 6.4048539,
          label: 'Mapped water tap at Les Karellis',
          osmId: 'node/13990407012'
        }
      ],
      desc: 'Official Les Karellis route 09: a 7.7 km loop from Les Karellis to Albanne through forest and alpine pasture, following green waymarks. The official route lists 249 m ascent and about 3½ hours.'
    }
  };

  trails.forEach((trail) => {
    const audit = audits[trail.id];
    if (audit) Object.assign(trail, audit);
  });
})();
