(function(){
  if(typeof L === 'undefined') return; // Leaflet failed to load — fail quietly, map area just stays blank
  if(typeof trails === 'undefined') return;

  const map = L.map('trailMap', { scrollWheelZoom:false }).setView([46.55, 12.05], 9);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom:16,
    attribution:'&copy; OpenStreetMap contributors',
  }).addTo(map);

  const markers = {};

  function pinIcon(label, isTop){
    return L.divIcon({
      className:'',
      html:`<div class="leaflet-marker-pin${isTop ? ' top' : ''}">${label}</div>`,
      iconSize: isTop ? [30,30] : [26,26],
      iconAnchor: isTop ? [15,15] : [13,13],
    });
  }

  trails.forEach((t, i) => {
    if(typeof t.lat !== 'number' || typeof t.lng !== 'number') return;
    const marker = L.marker([t.lat, t.lng], { icon: pinIcon(i+1, false) });
    marker.on('click', () => focusTrail(t.id));
    markers[t.id] = marker;
  });

  function focusTrail(id){
    const card = document.querySelector(`.trail-card-v2[data-id="${id}"]`);
    if(card){
      card.scrollIntoView({behavior:'smooth', block:'center'});
      const detail = document.getElementById(`detail-${id}`);
      if(detail) detail.classList.add('open');
    }
  }

  function updateFloatingCard(topTrail){
    let box = document.getElementById('mapFloatingCard');
    if(!topTrail){
      if(box) box.remove();
      return;
    }
    if(!box){
      box = document.createElement('div');
      box.id = 'mapFloatingCard';
      box.className = 'map-floating-card';
      document.querySelector('.hero-right').appendChild(box);
      box.addEventListener('click', () => focusTrail(box.dataset.id));
    }
    box.dataset.id = topTrail.id;
    const safetyClass = topTrail.safetyLevel === 'low-risk' ? 'low' : topTrail.safetyLevel === 'moderate' ? 'moderate' : 'caution';
    const safetyText = topTrail.safetyLevel === 'low-risk' ? 'Low-risk terrain' : topTrail.safetyLevel === 'moderate' ? 'Moderate — some caution' : 'Caution — exposed sections';
    box.innerHTML = `
      <span class="safety-badge safety-${safetyClass}">${safetyText}</span>
      <h4>${topTrail.name}</h4>
      <div class="meta">${topTrail.distance} km · ${topTrail.elevation} m gain · <b>${topTrail.score}% match</b></div>
    `;
  }

  window.updateMapMarkers = function(scored){
    const visibleIds = new Set(scored.map(t => t.id));
    const rankOf = {};
    scored.forEach((t, i) => { rankOf[t.id] = i + 1; });

    Object.keys(markers).forEach(id => {
      const marker = markers[id];
      if(visibleIds.has(id)){
        const rank = rankOf[id];
        marker.setIcon(pinIcon(rank, rank === 1));
        if(!map.hasLayer(marker)) marker.addTo(map);
      } else {
        if(map.hasLayer(marker)) map.removeLayer(marker);
      }
    });

    updateFloatingCard(scored[0] || null);
  };

  // initial paint once trails have been scored for the first time
  if(window.getScoredTrails){
    window.updateMapMarkers(window.getScoredTrails());
  }
})();
