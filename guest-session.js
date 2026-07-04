(function(global){
  const PENDING_AUTH_ACTION_KEY = 'dolopaws-pending-auth-action';
  const GUEST_TRAIL_CONTEXT_KEY = 'dolopaws-guest-trail-context';
  const FIRST_GUEST_ACTION_KEY = 'dolopaws-first-meaningful-action';

  function getStorage(storageName){
    try{
      return global[storageName] || null;
    }catch(err){
      return null;
    }
  }

  function readJson(storageName, key){
    const storage = getStorage(storageName);
    if(!storage) return null;
    try{
      const raw = storage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    }catch(err){
      return null;
    }
  }

  function writeJson(storageName, key, value){
    const storage = getStorage(storageName);
    if(!storage) return false;
    try{
      storage.setItem(key, JSON.stringify(value));
      return true;
    }catch(err){
      return false;
    }
  }

  function removeItem(storageName, key){
    const storage = getStorage(storageName);
    if(!storage) return;
    try{
      storage.removeItem(key);
    }catch(err){}
  }

  function track(eventName, detail){
    const payload = {
      eventName,
      detail: detail || {},
    };

    if(typeof global.CustomEvent === 'function' && global.dispatchEvent){
      global.dispatchEvent(new global.CustomEvent('dolopaws-analytics', { detail: payload }));
    }

    if(Array.isArray(global.dataLayer)){
      global.dataLayer.push({
        event: eventName,
        ...payload.detail,
      });
    }

    return payload;
  }

  function trackFirstGuestAction(action, detail){
    const storage = getStorage('sessionStorage');
    if(storage && storage.getItem(FIRST_GUEST_ACTION_KEY)) return false;
    if(storage){
      try{
        storage.setItem(FIRST_GUEST_ACTION_KEY, action);
      }catch(err){}
    }
    track('guest_first_meaningful_action', { action, ...(detail || {}) });
    return true;
  }

  function rememberPendingAuthAction(action){
    writeJson('sessionStorage', PENDING_AUTH_ACTION_KEY, action);
  }

  function consumePendingAuthAction(){
    const action = readJson('sessionStorage', PENDING_AUTH_ACTION_KEY);
    removeItem('sessionStorage', PENDING_AUTH_ACTION_KEY);
    return action;
  }

  function rememberGuestTrailContext(context){
    writeJson('localStorage', GUEST_TRAIL_CONTEXT_KEY, context);
  }

  function loadGuestTrailContext(){
    return readJson('localStorage', GUEST_TRAIL_CONTEXT_KEY);
  }

  const api = {
    track,
    trackFirstGuestAction,
    rememberPendingAuthAction,
    consumePendingAuthAction,
    rememberGuestTrailContext,
    loadGuestTrailContext,
  };

  global.DoloPawsGuestSession = api;

  if(typeof module !== 'undefined' && module.exports){
    module.exports = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
