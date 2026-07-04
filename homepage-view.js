(function(global){
  const VALID_VIEWS = new Set(['new', 'returning']);

  function getHomepageView(search){
    const params = new URLSearchParams(typeof search === 'string' ? search : global.location.search);
    const view = params.get('view');
    return VALID_VIEWS.has(view) ? view : null;
  }

  function applyHomepageView(win){
    const currentWindow = win || global;
    const doc = currentWindow.document;
    if(!doc) return null;

    const view = getHomepageView(currentWindow.location.search);
    const defaultHero = doc.getElementById('defaultHomepageHero');
    const newHomepage = doc.getElementById('newCustomerHomepage');
    const returningHomepage = doc.getElementById('returningCustomerHomepage');
    const accountBtn = doc.getElementById('accountBtn');

    if(doc.body){
      doc.body.dataset.homepageView = view || 'default';
    }
    if(defaultHero) defaultHero.hidden = !!view;
    if(newHomepage) newHomepage.hidden = view !== 'new';
    if(returningHomepage) returningHomepage.hidden = view !== 'returning';

    if(accountBtn && view){
      accountBtn.textContent = view === 'new' ? 'Sign in' : 'My account';
    }

    return view;
  }

  const api = {
    getHomepageView,
    applyHomepageView,
  };

  global.DoloPawsHomepageView = api;

  if(typeof module !== 'undefined' && module.exports){
    module.exports = api;
  }

  if(global.document){
    // Temporary test hook: `/`, `/?view=new`, and `/?view=returning`.
    applyHomepageView(global);
    global.addEventListener('dolopaws-auth-changed', function(){
      applyHomepageView(global);
    });
  }
})(typeof window !== 'undefined' ? window : globalThis);
