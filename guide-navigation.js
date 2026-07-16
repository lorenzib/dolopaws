(function(){
  const params = new URLSearchParams(window.location.search);
  const from = params.get('from');
  if(!from || !/^trail\.html\?id=[a-z0-9._-]+(?:&tab=(?:overview|safety|reviews))?$/i.test(from)) return;

  const body = document.querySelector('.gp-body');
  if(body){
    const back = document.createElement('a');
    back.className = 'guide-context-return';
    back.href = '../' + from;
    back.textContent = '← Back to trail details';
    body.insertBefore(back, body.firstChild);
  }

  document.querySelectorAll('.gp-body a[href]').forEach(link => {
    const raw = link.getAttribute('href');
    if(!raw || /^(?:https?:|mailto:|tel:|#|\.\.\/trail\.html|\.\.\/browse-trails\.html)/i.test(raw)) return;
    if(!/^(?:[a-z0-9._-]+\.html|\.\.\/safety-guide\.html)(?:#.*)?$/i.test(raw)) return;
    const hashAt = raw.indexOf('#');
    const page = hashAt >= 0 ? raw.slice(0, hashAt) : raw;
    const hash = hashAt >= 0 ? raw.slice(hashAt) : '';
    link.href = page + '?from=' + encodeURIComponent(from) + hash;
  });
})();
