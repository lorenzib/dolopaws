(function(){
  let mode = 'login'; // 'login' | 'signup'

  const modal = document.getElementById('authModal');
  const accountBtn = document.getElementById('accountBtn');
  const closeBtn = document.getElementById('authClose');
  const title = document.getElementById('authTitle');
  const hint = document.getElementById('authHint');
  const form = document.getElementById('authForm');
  const emailInput = document.getElementById('authEmail');
  const passwordInput = document.getElementById('authPassword');
  const submitBtn = document.getElementById('authSubmit');
  const errorBox = document.getElementById('authError');
  const googleBtn = document.getElementById('googleBtn');
  const toggleText = document.getElementById('authToggleText');
  const toggleBtn = document.getElementById('authToggleBtn');
  const forgotBtn = document.getElementById('forgotPasswordBtn');
  const requestedNext = new URLSearchParams(window.location.search).get('next');
  let returnFocus = null;
  const focusableSelector = 'button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

  function safeReturnTarget(value){
    if(!value || /^(?:[a-z]+:|\/\/|\/)/i.test(value)) return '';
    return /^[a-z0-9][a-z0-9._/-]*\.html(?:\?[^#]*)?(?:#.*)?$/i.test(value) ? value : '';
  }

  function finishAuth(){
    closeModal();
    const target = safeReturnTarget(requestedNext);
    if(target) window.location.replace(target);
  }

  function openModal(){
    if(window.DoloPawsAuth && window.DoloPawsAuth.currentUser){
      window.location.href = 'account.html';
      return;
    }
    // Pages like trail.html and safety-guide.html don't carry the modal
    // markup. Open it on the homepage, then return to the page and query
    // state the visitor came from after authentication.
    if(!modal){
      const currentPage = (window.location.pathname.split('/').pop() || 'index.html')
        + window.location.search + window.location.hash;
      window.location.href = 'index.html?login=1&next=' + encodeURIComponent(currentPage);
      return;
    }
    errorBox.hidden = true;
    form.reset();
    returnFocus = document.activeElement && document.activeElement !== document.body
      ? document.activeElement : accountBtn;
    modal.hidden = false;
    document.body.classList.add('auth-modal-open');
    setTimeout(() => emailInput.focus(), 0);
  }
  function closeModal(){
    if(!modal) return;
    modal.hidden = true;
    document.body.classList.remove('auth-modal-open');
    if(returnFocus && document.contains(returnFocus)) returnFocus.focus();
    returnFocus = null;
  }

  function setMode(newMode){
    mode = newMode;
    if(!modal) return;
    errorBox.hidden = true;
    if(mode === 'login'){
      title.textContent = window.t('nav.login');
      submitBtn.textContent = window.t('nav.login');
      toggleText.textContent = window.t('auth.noAccount');
      toggleBtn.textContent = window.t('auth.signup');
      passwordInput.autocomplete = 'current-password';
    } else {
      title.textContent = window.t('auth.createTitle');
      submitBtn.textContent = window.t('auth.signup');
      toggleText.textContent = window.t('auth.haveAccount');
      toggleBtn.textContent = window.t('nav.login');
      passwordInput.autocomplete = 'new-password';
    }
  }

  if(accountBtn) accountBtn.addEventListener('click', openModal);

  // Everything below only exists on pages that include the auth modal
  // (index, browse). Wiring it unguarded crashed this whole script on the
  // other pages, which froze the account button on its static text and
  // silently disabled every login gate that relies on DoloPawsAuthUI.
  if(modal){

  closeBtn.addEventListener('click', closeModal);
  modal.addEventListener('click', (e) => { if(e.target === modal) closeModal(); });
  modal.addEventListener('keydown', (e) => {
    if(e.key === 'Escape'){
      e.preventDefault();
      closeModal();
      return;
    }
    if(e.key !== 'Tab') return;
    const focusable = Array.from(modal.querySelectorAll(focusableSelector)).filter(el => !el.hidden);
    if(!focusable.length) return;
    const first = focusable[0], last = focusable[focusable.length - 1];
    if(e.shiftKey && document.activeElement === first){ e.preventDefault(); last.focus(); }
    else if(!e.shiftKey && document.activeElement === last){ e.preventDefault(); first.focus(); }
  });
  toggleBtn.addEventListener('click', () => setMode(mode === 'login' ? 'signup' : 'login'));

  forgotBtn.addEventListener('click', async () => {
    if(!window.DoloPawsAuth) return;
    const email = emailInput.value.trim();
    if(!email){
      errorBox.textContent = window.t('auth.forgotFirst');
      errorBox.hidden = false;
      return;
    }
    const result = await window.DoloPawsAuth.resetPassword(email);
    errorBox.hidden = false;
    if(result.ok){
      errorBox.style.background = '#DCEBDD';
      errorBox.style.color = '#2C5C34';
      errorBox.textContent = `Password reset link sent to ${email} — check your inbox.`;
    } else {
      errorBox.style.background = '';
      errorBox.style.color = '';
      errorBox.textContent = result.message;
    }
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if(!window.DoloPawsAuth) return;
    submitBtn.disabled = true;
    submitBtn.textContent = mode === 'login' ? 'Logging in…' : 'Signing up…';
    const email = emailInput.value.trim();
    const password = passwordInput.value;
    const result = mode === 'login'
      ? await window.DoloPawsAuth.signIn(email, password)
      : await window.DoloPawsAuth.signUp(email, password);
    submitBtn.disabled = false;
    setMode(mode);
    if(result.ok){
      finishAuth();
    } else {
      errorBox.textContent = result.message;
      errorBox.hidden = false;
    }
  });

  googleBtn.addEventListener('click', async () => {
    if(!window.DoloPawsAuth) return;
    const result = await window.DoloPawsAuth.signInGoogle();
    if(result.ok){
      finishAuth();
    } else {
      errorBox.textContent = result.message;
      errorBox.hidden = false;
    }
  });

  // Arriving from a modal-less page that asked for login? Open it now.
  if(new URLSearchParams(window.location.search).get('login') === '1'){
    const openRequestedLogin = () => {
      if(!(window.DoloPawsAuth && window.DoloPawsAuth.currentUser)) openModal();
    };
    if(window.DoloPawsAuthReady) openRequestedLogin();
    else window.addEventListener('dolopaws-auth-ready', openRequestedLogin, { once: true });
  }

  } // end if(modal)

  // Expose a way for other scripts (e.g. the homepage teaser CTA) to open
  // the modal already in signup mode.
  window.DoloPawsAuthUI = {
    openSignup(){ setMode('signup'); openModal(); },
    openLogin(){ setMode('login'); openModal(); },
  };

  function waitForAuth(cb){
    if(window.DoloPawsAuth){ cb(); return; }
    window.addEventListener('dolopaws-auth-ready', cb, { once: true });
  }

  waitForAuth(() => {
    window.DoloPawsAuth.onChange((user) => {
      if(accountBtn){
        accountBtn.textContent = user ? window.t('nav.account') : window.t('nav.login');
      }
      window.dispatchEvent(new CustomEvent('dolopaws-auth-changed', { detail: { user } }));
    });
  });
})();
