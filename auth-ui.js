(function(){
  let mode = 'login'; // 'login' | 'signup'
  const DEFAULT_HINT = 'Save trails to your account so they follow you across devices.';
  let pendingContext = null;

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

  function applyPromptContext(context){
    pendingContext = context || null;
    hint.textContent = pendingContext && pendingContext.hint
      ? pendingContext.hint
      : DEFAULT_HINT;
  }

  function openModal(context){
    if(window.DoloPawsAuth && window.DoloPawsAuth.currentUser){
      window.location.href = 'account.html';
      return;
    }
    applyPromptContext(context);
    errorBox.hidden = true;
    form.reset();
    modal.hidden = false;
  }
  function closeModal(){ modal.hidden = true; }

  function setMode(newMode){
    mode = newMode;
    errorBox.hidden = true;
    if(mode === 'login'){
      title.textContent = 'Log in';
      submitBtn.textContent = 'Log in';
      toggleText.textContent = "Don't have an account?";
      toggleBtn.textContent = 'Sign up';
      passwordInput.autocomplete = 'current-password';
    } else {
      title.textContent = 'Create your account';
      submitBtn.textContent = 'Sign up';
      toggleText.textContent = 'Already have an account?';
      toggleBtn.textContent = 'Log in';
      passwordInput.autocomplete = 'new-password';
    }
  }

  accountBtn.addEventListener('click', openModal);
  closeBtn.addEventListener('click', closeModal);
  modal.addEventListener('click', (e) => { if(e.target === modal) closeModal(); });
  toggleBtn.addEventListener('click', () => setMode(mode === 'login' ? 'signup' : 'login'));

  forgotBtn.addEventListener('click', async () => {
    if(!window.DoloPawsAuth) return;
    const email = emailInput.value.trim();
    if(!email){
      errorBox.textContent = 'Enter your email above first, then click "Forgot password?"';
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
    setMode(mode); // resets button label
    if(result.ok){
      closeModal();
      window.dispatchEvent(new CustomEvent('dolopaws-auth-success', { detail: { context: pendingContext } }));
      pendingContext = null;
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
      window.dispatchEvent(new CustomEvent('dolopaws-auth-success', { detail: { context: pendingContext } }));
      pendingContext = null;
    } else {
      errorBox.textContent = result.message;
      errorBox.hidden = false;
    }
  });

  function waitForAuth(cb){
    if(window.DoloPawsAuth){ cb(); return; }
    window.addEventListener('dolopaws-auth-ready', cb, { once: true });
  }

  waitForAuth(() => {
    window.DoloPawsAuth.onChange((user) => {
      if(user){
        accountBtn.textContent = 'My account';
      } else {
        accountBtn.textContent = 'Log in';
      }
      // let script.js know so it can reload favorites from the right source
      window.dispatchEvent(new CustomEvent('dolopaws-auth-changed', { detail: { user } }));
    });
  });

  window.DoloPawsAuthUI = {
    openSignup(context){
      setMode('signup');
      openModal(context);
    },
    openLogin(context){
      setMode('login');
      openModal(context);
    },
  };
})();
