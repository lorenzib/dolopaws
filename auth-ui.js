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

  function openModal(){
    if(window.DoloPawsAuth && window.DoloPawsAuth.currentUser){
      window.location.href = 'account.html';
      return;
    }
    errorBox.hidden = true;
    form.reset();
    modal.hidden = false;
  }
  function closeModal(){ modal.hidden = true; }

  function setMode(newMode){
    mode = newMode;
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
  closeBtn.addEventListener('click', closeModal);
  modal.addEventListener('click', (e) => { if(e.target === modal) closeModal(); });
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
      closeModal();
    } else {
      errorBox.textContent = result.message;
      errorBox.hidden = false;
    }
  });

  googleBtn.addEventListener('click', async () => {
    if(!window.DoloPawsAuth) return;
    const result = await window.DoloPawsAuth.signInGoogle();
    if(result.ok){
      closeModal();
    } else {
      errorBox.textContent = result.message;
      errorBox.hidden = false;
    }
  });

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
