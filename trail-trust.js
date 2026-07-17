/**
 * Shared trust language for trail facts.
 *
 * Curated trails have been reviewed by DoloPaws against independent
 * sources. Imported trails are automated interpretations of OpenStreetMap
 * data: mapped facts may be useful, but absence from the map is not evidence
 * that a hazard is absent.
 */
(function (root) {
  'use strict';

  const imported = trail => !!trail && trail.curated === false;

  function translate(key, vars, fallback) {
    const out = typeof root.t === 'function' ? root.t(key, vars) : null;
    if (out && out !== key) return out;
    return Object.entries(vars || {}).reduce(
      (text, [name, value]) => text.replaceAll(`{${name}}`, value),
      fallback
    );
  }

  function riskLabel(trail, baseLabel) {
    if (!imported(trail)) return baseLabel;
    return translate('trust.estimatedRisk', { rating: baseLabel }, `Estimated: ${baseLabel}`);
  }

  function provenanceLabel(trail) {
    return imported(trail)
      ? translate('trust.imported', null, 'Imported · not field reviewed')
      : translate('trust.reviewed', null, 'DoloPaws curated · date unavailable');
  }

  function waterPointLabel(trail, label) {
    if (!imported(trail)) return label;
    return String(label || 'Water point')
      .replace(/Drinking water\s*\(OSM-verified location\)/i, 'Water point mapped in OpenStreetMap')
      .replace(/OSM-verified/gi, 'mapped in OpenStreetMap');
  }

  function startPointLabel(trail, label) {
    if (!imported(trail)) return label;
    const cleaned = String(label || 'Route start')
      .replace(/^Start here\s*[—-]\s*/i, '')
      .replace(/^Route start per OpenStreetMap\s*[—-]\s*/i, '')
      .replace(/\s*\(OSM-verified access point\)/gi, '')
      .replace(/OSM-verified/gi, 'mapped in OpenStreetMap');
    return `Mapped start suggestion — ${cleaned}. Access suitability is not field reviewed.`;
  }

  function waterAssessment(trail) {
    const mapped = Array.isArray(trail.waterSources) && trail.waterSources.length > 0;
    if (imported(trail)) {
      return mapped
        ? { ok: false, title: 'Mapped water point', detail: 'A water point appears in OpenStreetMap, but current flow and seasonal availability are not verified. Carry a full supply.' }
        : { ok: false, title: 'Water unknown', detail: 'No water point is mapped. That does not confirm water is unavailable; carry a full supply and verify locally.' };
    }
    return mapped
      ? { ok: true, title: 'Water', detail: 'A reviewed water point is listed on this route. Seasonal availability can change, so bring a backup supply.' }
      : { ok: false, title: 'Water', detail: 'No water source is listed for this route. Carry enough for the dog, roughly 0.5 l per 10 kg on a warm day.' };
  }

  function heatAssessment(trail) {
    const shade = typeof trail.shadeCoverage === 'number' ? trail.shadeCoverage : null;
    if (imported(trail) && shade === null && !trail.heatRisk) {
      return { ok: false, title: 'Heat & shade unknown', detail: 'Shade and heat exposure have not been field reviewed. Check the forecast and plan as if shade may be limited.' };
    }
    if (shade === null && !trail.heatRisk) return null;
    const shadeText = shade === null ? '' : `${shade}% shade`;
    const highHeat = trail.heatRisk === 'high' || (shade !== null && shade < 25);
    const lowHeat = trail.heatRisk === 'low' && (shade === null || shade >= 40);
    const detail = highHeat
      ? `${shadeText ? shadeText + '. ' : ''}The route is heat-exposed; use the live forecast to choose an early, cool window.`
      : lowHeat
        ? `${shadeText ? shadeText + '. ' : ''}The route has relatively favourable heat exposure.`
        : `${shadeText ? shadeText + '. ' : ''}Plan rests and use the live forecast to choose a cooler window.`;
    return { ok: !highHeat, title: 'Heat & shade', detail };
  }

  function exposureAssessment(trail) {
    if (trail.exposure === true) {
      return { ok: false, title: 'Exposure', detail: 'Narrow ledges or unprotected drop-offs occur on parts of the route. Keep the dog leashed and on the inside.' };
    }
    if (imported(trail) && trail.exposure === undefined) {
      return { ok: false, title: 'Exposure unknown', detail: 'Drop-offs and narrow sections have not been field reviewed. Check recent local reports before committing.' };
    }
    return null;
  }

  function livestockAssessment(trail, combinedText) {
    const noted = /livestock|patou|guardian|cattle|herd|pasture|alpage|graz/.test(combinedText || '');
    if (noted) {
      return { ok: false, title: 'Livestock & leash', detail: 'Grazing animals, possibly with guardian dogs, are reported on or near this route. Leash through pastures and give herds a wide berth.' };
    }
    if (imported(trail)) {
      return { ok: false, title: 'Livestock unknown', detail: 'Livestock and guardian-dog presence has not been field reviewed. Keep a leash ready and verify locally.' };
    }
    return { ok: true, title: 'Leash', detail: 'No livestock is noted in the curated trail information. The review date is unavailable and local leash rules still apply.' };
  }

  function assessmentNote(trail) {
    return imported(trail)
      ? '<strong style="color: var(--ink);">Automated estimate from mapped route data:</strong> distance, elevation and mapped surface influence the match. Exposure, shade, livestock and current conditions remain unverified.'
      : '<strong style="color: var(--ink);">Our assessment of this curated trail:</strong> terrain, listed water, elevation and shade are weighed against your dog\'s profile. The review date is unavailable and current conditions can still change.';
  }

  root.DoloPawsTrailTrust = Object.freeze({
    imported,
    riskLabel,
    provenanceLabel,
    waterPointLabel,
    startPointLabel,
    waterAssessment,
    heatAssessment,
    exposureAssessment,
    livestockAssessment,
    assessmentNote,
  });
})(window);
