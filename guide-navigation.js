(function(){
  const params = new URLSearchParams(window.location.search);
  const from = params.get('from');
  const validTrailReturn = from && /^trail\.html\?id=[a-z0-9._-]+(?:&tab=(?:overview|safety|reviews))?$/i.test(from);
  const guideBody = document.querySelector('.gp-body');
  const rootPrefix = guideBody ? '../' : '';

  if(validTrailReturn && guideBody){
    const back = document.createElement('a');
    back.className = 'guide-context-return';
    back.href = rootPrefix + from;
    back.textContent = '← Back to trail details';
    guideBody.insertBefore(back, guideBody.firstChild);
  }

  if(validTrailReturn && guideBody){
    guideBody.querySelectorAll('a[href]').forEach(link => {
      const raw = link.getAttribute('href');
      if(!raw || /^(?:https?:|mailto:|tel:|#|\.\.\/trail\.html|\.\.\/browse-trails\.html)/i.test(raw)) return;
      if(!/^(?:[a-z0-9._-]+\.html|\.\.\/safety-guide\.html)(?:#.*)?$/i.test(raw)) return;
      const hashAt = raw.indexOf('#');
      const page = hashAt >= 0 ? raw.slice(0, hashAt) : raw;
      const hash = hashAt >= 0 ? raw.slice(hashAt) : '';
      link.href = page + '?from=' + encodeURIComponent(from) + hash;
    });
  }

  function slug(text, index){
    const clean = String(text || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    return 'section-' + (clean || index + 1);
  }

  function activeArticleBody(){
    if(guideBody) return guideBody;
    return document.querySelector('.guide-article [data-lang-block]:not([hidden])');
  }

  function buildPageNav(){
    document.querySelectorAll('.guide-page-nav[data-generated]').forEach(nav => nav.remove());
    const body = activeArticleBody();
    if(!body) return;
    const headings = guideBody
      ? Array.from(body.children).filter(el => el.tagName === 'H2')
      : Array.from(body.querySelectorAll(':scope > .guide-section > h2'));
    if(headings.length < 3) return;

    const used = new Set();
    headings.forEach((heading, index) => {
      let id = heading.id || slug(heading.textContent, index);
      let unique = id, suffix = 2;
      while(used.has(unique) || (document.getElementById(unique) && document.getElementById(unique) !== heading)) unique = id + '-' + suffix++;
      heading.id = unique;
      heading.classList.add('guide-anchor');
      used.add(unique);
    });

    const isItalian = body.getAttribute('data-lang-block') === 'it';
    const nav = document.createElement('nav');
    nav.className = 'guide-page-nav';
    nav.dataset.generated = 'true';
    nav.setAttribute('aria-label', isItalian ? 'In questa pagina' : 'On this page');
    nav.innerHTML = `<span class="guide-page-nav__label">${isItalian ? 'In questa pagina' : 'On this page'}</span>` +
      `<div class="guide-page-nav__links">${headings.map(h => `<a href="#${h.id}">${h.textContent.trim()}</a>`).join('')}</div>`;
    const back = body.querySelector(':scope > .guide-context-return');
    body.insertBefore(nav, back ? back.nextSibling : body.firstChild);
  }

  buildPageNav();
  const langBlocks = document.querySelectorAll('.guide-article [data-lang-block]');
  if(langBlocks.length){
    const observer = new MutationObserver(buildPageNav);
    langBlocks.forEach(block => observer.observe(block, { attributes:true, attributeFilter:['hidden'] }));
  }
})();
