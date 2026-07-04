(function(global){
  function isReturningView(doc){
    return !!(doc && doc.body && doc.body.dataset.homepageView === 'returning');
  }

  function setPanelVisibility(toggleBtn, panel, open){
    if(!toggleBtn || !panel) return;
    panel.hidden = !open;
    toggleBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
  }

  function setDefaults(panel){
    if(!panel) return;
    panel.querySelectorAll('.pill-row[data-group]').forEach((row) => {
      const active = row.querySelector('.pill.active');
      row.dataset.defaultValue = active ? active.dataset.value : '';
    });
  }

  function resetToDefaults(panel){
    if(!panel) return;
    panel.querySelectorAll('.pill-row[data-group]').forEach((row) => {
      const fallback = row.querySelector('.pill');
      const target = row.querySelector(`.pill[data-value="${row.dataset.defaultValue || ''}"]`) || fallback;
      if(target) target.click();
    });
  }

  function setupTodayConditions(win){
    const currentWindow = win || global;
    const doc = currentWindow.document;
    if(!doc) return;

    const toggleBtn = doc.getElementById('todayConditionsToggle');
    const panel = doc.getElementById('todayConditionsPanel');
    const closeBtn = doc.getElementById('todayConditionsClose');
    const resetBtn = doc.getElementById('todayConditionsReset');
    if(!toggleBtn || !panel) return;

    function syncForView(){
      const returning = isReturningView(doc);
      toggleBtn.hidden = !returning;
      if(returning){
        setPanelVisibility(toggleBtn, panel, false);
      } else {
        setPanelVisibility(toggleBtn, panel, true);
      }
    }

    if(toggleBtn.dataset.todayConditionsBound === 'true'){
      syncForView();
      return;
    }
    toggleBtn.dataset.todayConditionsBound = 'true';

    setDefaults(panel);

    toggleBtn.addEventListener('click', function(){
      const isOpen = panel.hidden;
      setPanelVisibility(toggleBtn, panel, isOpen);
    });

    if(closeBtn){
      closeBtn.addEventListener('click', function(){
        setPanelVisibility(toggleBtn, panel, false);
      });
    }

    if(resetBtn){
      resetBtn.addEventListener('click', function(){
        resetToDefaults(panel);
        setPanelVisibility(toggleBtn, panel, false);
      });
    }

    panel.querySelectorAll('.pill-row[data-group]').forEach((row) => {
      row.addEventListener('click', function(e){
        const btn = e.target.closest('.pill');
        if(!btn) return;
        row.querySelectorAll('.pill').forEach((pill) => pill.classList.remove('active'));
        btn.classList.add('active');
      });
    });

    currentWindow.addEventListener('dolopaws-auth-changed', syncForView);
    syncForView();
  }

  const api = { setupTodayConditions, resetToDefaults, setDefaults };
  global.DoloPawsTodayConditions = api;

  if(typeof module !== 'undefined' && module.exports){
    module.exports = api;
  }

  if(global.document){
    setupTodayConditions(global);
  }
})(typeof window !== 'undefined' ? window : globalThis);
