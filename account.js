(function(){
  const subline = document.getElementById('accountSubline');
  const loggedOutState = document.getElementById('loggedOutState');
  const loggedInState = document.getElementById('loggedInState');
  const userEmail = document.getElementById('userEmail');
  const userProvider = document.getElementById('userProvider');
  const passwordSection = document.getElementById('passwordSection');
  const sendResetBtn = document.getElementById('sendResetBtn');
  const resetStatus = document.getElementById('resetStatus');
  const savedTrailsList = document.getElementById('savedTrailsList');
  const logOutBtn = document.getElementById('logOutBtn');
  const accountDogCard = document.getElementById('accountDogCard');
  let currentDog = null;

  const showDeleteBtn = document.getElementById('showDeleteBtn');
  const deleteConfirmBox = document.getElementById('deleteConfirmBox');
  const deletePasswordField = document.getElementById('deletePasswordField');
  const deletePassword = document.getElementById('deletePassword');
  const deleteGoogleNote = document.getElementById('deleteGoogleNote');
  const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
  const cancelDeleteBtn = document.getElementById('cancelDeleteBtn');
  const deleteStatus = document.getElementById('deleteStatus');

  function providerLabel(user){
    const pid = user.providerData[0] && user.providerData[0].providerId;
    if(pid === 'google.com') return 'Google';
    if(pid === 'password') return 'Email & password';
    return 'Unknown';
  }

  function initial(name){ return (name || '?').trim().charAt(0).toUpperCase(); }
  function fitnessLabel(f){
    if(f === 'low') return 'Low fitness';
    if(f === 'high') return 'High fitness';
    return 'Moderate fitness';
  }

  function renderDogCard(){
    if(!currentDog || !currentDog.name){
      accountDogCard.innerHTML = `<div class="add-dog-row" id="addDogRow">+ Add your dog</div>`;
    } else {
      accountDogCard.innerHTML = `
        <div class="account-dog-row">
          <div class="left">
            <div class="avatar" style="width:34px;height:34px;border-radius:50%;background:var(--pine);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:13px;">${initial(currentDog.name)}</div>
            <div>
              <div class="name" style="font-family:'Fraunces',serif;font-weight:600;font-size:15px;">${currentDog.name}</div>
              <div class="meta" style="font-size:12px;color:var(--pine-soft);">${currentDog.breed || 'Breed not set'} · ${fitnessLabel(currentDog.fitness)}</div>
            </div>
          </div>
          <a href="#" id="editDogLink" style="font-size:12px;font-weight:700;color:var(--alpenglow);text-decoration:none;">Edit →</a>
        </div>
      `;
    }

    const addRowEl = document.getElementById('addDogRow');
    if(addRowEl){
      addRowEl.addEventListener('click', () => {
        if(window.DoloPawsWizard) window.DoloPawsWizard.open();
      });
    }
    const editLink = document.getElementById('editDogLink');
    if(editLink){
      editLink.addEventListener('click', (e) => {
        e.preventDefault();
        if(window.DoloPawsWizard) window.DoloPawsWizard.open(currentDog);
      });
    }
  }

  window.addEventListener('dolopaws-dog-profile-saved', async (e) => {
    if(!window.DoloPawsAuth || !window.DoloPawsAuth.currentUser) return;
    currentDog = e.detail.profile;
    await window.DoloPawsAuth.setDogProfile(currentDog);
    renderDogCard();
  });

  function renderSavedTrails(favorites){
    const ids = Object.keys(favorites || {});
    if(ids.length === 0){
      savedTrailsList.innerHTML = `<p style="color:var(--pine-soft);font-size:14px;">You haven't saved any trails yet. <a href="index.html#finder" style="color:var(--alpenglow);font-weight:700;">Browse trails</a></p>`;
      return;
    }
    const items = ids.map(id => {
      const trail = (typeof trails !== 'undefined') ? trails.find(t => t.id === id) : null;
      if(!trail){
        return `<li style="padding:10px 0;border-bottom:1px solid var(--paper-line);">${id}</li>`;
      }
      return `<li style="padding:12px 0;border-bottom:1px solid var(--paper-line);">
        <a href="index.html#finder" style="color:var(--pine);font-weight:700;text-decoration:none;font-size:14.5px;">${trail.name}</a>
        <div style="color:var(--pine-soft);font-size:12.5px;margin-top:2px;">${trail.area} · ${trail.distance} km</div>
      </li>`;
    }).join('');
    savedTrailsList.innerHTML = `<ul style="list-style:none;padding:0;margin:0;">${items}</ul>`;
  }

  function waitForAuth(cb){
    if(window.DoloPawsAuth){ cb(); return; }
    window.addEventListener('dolopaws-auth-ready', cb, { once: true });
  }

  waitForAuth(() => {
    window.DoloPawsAuth.onChange(async (user) => {
      if(!user){
        subline.textContent = "You're not logged in.";
        loggedOutState.hidden = false;
        loggedInState.hidden = true;
        return;
      }

      subline.textContent = `Signed in as ${user.email || 'your Google account'}.`;
      loggedOutState.hidden = true;
      loggedInState.hidden = false;

      userEmail.textContent = user.email || '(no email on file)';
      userProvider.textContent = providerLabel(user);

      if(providerLabel(user) === 'Google'){
        passwordSection.style.display = 'none';
        deletePasswordField.hidden = true;
        deleteGoogleNote.hidden = false;
      } else {
        passwordSection.style.display = '';
        deletePasswordField.hidden = false;
        deleteGoogleNote.hidden = true;
      }

      currentDog = await window.DoloPawsAuth.getDogProfile();
      renderDogCard();

      savedTrailsList.innerHTML = `<p style="color:var(--pine-soft);font-size:14px;">Loading your saved trails…</p>`;
      const favorites = await window.DoloPawsAuth.getFavorites();
      renderSavedTrails(favorites);
    });
  });

  sendResetBtn.addEventListener('click', async () => {
    const user = window.DoloPawsAuth && window.DoloPawsAuth.currentUser;
    if(!user || !user.email) return;
    sendResetBtn.disabled = true;
    sendResetBtn.textContent = 'Sending…';
    const result = await window.DoloPawsAuth.resetPassword(user.email);
    sendResetBtn.disabled = false;
    sendResetBtn.textContent = 'Send password reset link';
    resetStatus.hidden = false;
    if(result.ok){
      resetStatus.style.color = '#2C5C34';
      resetStatus.textContent = `Reset link sent to ${user.email} — check your inbox.`;
    } else {
      resetStatus.style.color = '#9C3A25';
      resetStatus.textContent = result.message;
    }
  });

  logOutBtn.addEventListener('click', async () => {
    if(!window.DoloPawsAuth) return;
    await window.DoloPawsAuth.logOut();
    window.location.href = 'index.html';
  });

  showDeleteBtn.addEventListener('click', () => {
    deleteConfirmBox.hidden = false;
    showDeleteBtn.hidden = true;
  });

  cancelDeleteBtn.addEventListener('click', () => {
    deleteConfirmBox.hidden = true;
    showDeleteBtn.hidden = false;
    deletePassword.value = '';
    deleteStatus.hidden = true;
  });

  confirmDeleteBtn.addEventListener('click', async () => {
    if(!window.DoloPawsAuth) return;
    confirmDeleteBtn.disabled = true;
    confirmDeleteBtn.textContent = 'Deleting…';
    const result = await window.DoloPawsAuth.deleteAccount(deletePassword.value);
    confirmDeleteBtn.disabled = false;
    confirmDeleteBtn.textContent = 'Permanently delete account';
    if(result.ok){
      window.location.href = 'index.html';
    } else {
      deleteStatus.hidden = false;
      deleteStatus.style.color = '#9C3A25';
      deleteStatus.textContent = result.message;
    }
  });
})();
