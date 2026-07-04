const path = require('path');

const modulePath = path.join(__dirname, 'auth-ui.js');

function loadAuthUi(options = {}){
  const { includeAccountBtn = true } = options;
  document.body.innerHTML = `
    ${includeAccountBtn ? '<button id="accountBtn">Log in</button>' : ''}
    <div id="authModal" hidden>
      <button id="authClose" type="button">Close</button>
      <h2 id="authTitle">Log in</h2>
      <p id="authHint"></p>
      <div id="authError" hidden></div>
      <form id="authForm">
        <input id="authEmail" type="email" />
        <input id="authPassword" type="password" />
        <button id="forgotPasswordBtn" type="button">Forgot</button>
        <button id="authSubmit" type="submit">Log in</button>
      </form>
      <button id="googleBtn" type="button">Google</button>
      <span id="authToggleText"></span>
      <button id="authToggleBtn" type="button">Toggle</button>
    </div>
  `;

  window.DoloPawsAuth = {
    currentUser: null,
    signIn: jest.fn().mockResolvedValue({ ok: true }),
    signUp: jest.fn().mockResolvedValue({ ok: true }),
    signInGoogle: jest.fn().mockResolvedValue({ ok: true }),
    resetPassword: jest.fn().mockResolvedValue({ ok: true }),
    onChange: jest.fn(),
  };

  delete window.DoloPawsAuthUI;
  jest.resetModules();
  require(modulePath);
}

describe('auth ui contextual prompts', () => {
  test('openLogin applies contextual hint and returns it on auth success', async () => {
    loadAuthUi();
    const successEvents = [];
    window.addEventListener('dolopaws-auth-success', (event) => {
      successEvents.push(event.detail);
    });

    window.DoloPawsAuthUI.openLogin({
      hint: 'Sign in to save your guest shortlist and unlock the full ranked trail list.',
    });

    expect(document.getElementById('authHint').textContent).toBe(
      'Sign in to save your guest shortlist and unlock the full ranked trail list.'
    );

    document.getElementById('authEmail').value = 'guest@example.com';
    document.getElementById('authPassword').value = 'password123';
    document.getElementById('authForm').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

    await Promise.resolve();

    expect(window.DoloPawsAuth.signIn).toHaveBeenCalledWith('guest@example.com', 'password123');
    expect(successEvents).toEqual([
      {
        context: {
          hint: 'Sign in to save your guest shortlist and unlock the full ranked trail list.',
        },
      },
    ]);
  });

  test('clicking logged-out Log in button opens auth modal with email/password and Google options', () => {
    loadAuthUi();

    document.getElementById('accountBtn').click();

    expect(document.getElementById('authModal').hidden).toBe(false);
    expect(document.getElementById('authEmail')).not.toBeNull();
    expect(document.getElementById('authPassword')).not.toBeNull();
    expect(document.getElementById('googleBtn')).not.toBeNull();
  });

  test('close button hides the auth modal', () => {
    loadAuthUi();

    window.DoloPawsAuthUI.openLogin();
    expect(document.getElementById('authModal').hidden).toBe(false);

    document.getElementById('authClose').click();
    expect(document.getElementById('authModal').hidden).toBe(true);
    expect(document.getElementById('authModal').style.display).toBe('none');
  });

  test('backdrop click hides the auth modal', () => {
    loadAuthUi();

    window.DoloPawsAuthUI.openLogin();
    const modal = document.getElementById('authModal');
    expect(modal.hidden).toBe(false);

    modal.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(modal.hidden).toBe(true);
    expect(modal.style.display).toBe('none');
  });

  test('click inside modal content does not hide the auth modal', () => {
    loadAuthUi();

    window.DoloPawsAuthUI.openLogin();
    const modal = document.getElementById('authModal');
    expect(modal.hidden).toBe(false);

    document.getElementById('authTitle').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(modal.hidden).toBe(false);
  });

  test('Escape key hides the auth modal', () => {
    loadAuthUi();

    window.DoloPawsAuthUI.openLogin();
    const modal = document.getElementById('authModal');
    expect(modal.hidden).toBe(false);

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(modal.hidden).toBe(true);
    expect(modal.style.display).toBe('none');
  });

  test('openLogin still works when account button is not present', () => {
    loadAuthUi({ includeAccountBtn: false });

    expect(() => window.DoloPawsAuthUI.openLogin()).not.toThrow();
    expect(document.getElementById('authModal').hidden).toBe(false);
  });
});
