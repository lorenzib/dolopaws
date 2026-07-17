(function(){
  function secureBlankLinks(root){
    const links = [];
    if(root && root.matches && root.matches('a[target="_blank"]')) links.push(root);
    if(root && root.querySelectorAll) links.push(...root.querySelectorAll('a[target="_blank"]'));
    links.forEach(link => {
      const rel = new Set((link.getAttribute('rel') || '').split(/\s+/).filter(Boolean));
      rel.add('noopener');
      link.setAttribute('rel', Array.from(rel).join(' '));
    });
  }

  secureBlankLinks(document);
  if(document.body && typeof MutationObserver !== 'undefined'){
    new MutationObserver(records => records.forEach(record => record.addedNodes.forEach(secureBlankLinks)))
      .observe(document.body, { childList:true, subtree:true });
  }

  const nav = document.querySelector('.topnav');
  const links = nav && nav.querySelector('.links');
  if(!nav || !links || nav.querySelector('.mobile-nav-toggle')) return;

  if(!links.id) links.id = 'primaryNavigation';

  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'mobile-nav-toggle';
  toggle.setAttribute('aria-controls', links.id);
  toggle.setAttribute('aria-expanded', 'false');
  toggle.setAttribute('aria-label', 'Open menu');
  toggle.innerHTML = '<span></span><span></span><span></span>';
  nav.insertBefore(toggle, links);

  function setOpen(open){
    nav.classList.toggle('mobile-nav-open', open);
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  }

  toggle.addEventListener('click', function(e){
    e.stopPropagation();
    setOpen(!nav.classList.contains('mobile-nav-open'));
  });

  links.addEventListener('click', function(e){
    if(e.target.closest('a, #accountBtn')) setOpen(false);
  });

  document.addEventListener('click', function(e){
    if(!nav.contains(e.target)) setOpen(false);
  });

  document.addEventListener('keydown', function(e){
    if(e.key === 'Escape' && nav.classList.contains('mobile-nav-open')){
      setOpen(false);
      toggle.focus();
    }
  });

  window.addEventListener('resize', function(){
    if(window.innerWidth > 700) setOpen(false);
  });
})();
