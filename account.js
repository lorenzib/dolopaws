(function(){
  const subline = document.getElementById('accountSubline');
  const loggedOutState = document.getElementById('loggedOutState');
  const loggedInState = document.getElementById('loggedInState');
  const userEmail = document.getElementById('userEmail');
  const userProvider = document.getElementById('userProvider');
  const passwordSection = document.getElementById('passwordSection');
  const sendResetBtn = document.getElementById('sendResetBtn');
  const resetStatus = document.getElementById('resetStatus');
  const logOutBtn = document.getElementById('logOutBtn');

  const dogName = document.getElementById('dogName');
  const dogBreed = document.getElementById('dogBreed');
  const dogBreedOtherField = document.getElementById('dogBreedOtherField');
  const dogBreedOther = document.getElementById('dogBreedOther');
  const dogFitness = document.getElementById('dogFitness');
  const dogAge = document.getElementById('dogAge');
  const dogWeight = document.getElementById('dogWeight');
  const dogJointIssues = document.getElementById('dogJointIssues');
  const dogJointDetailField = document.getElementById('dogJointDetailField');
  const dogJointDetail = document.getElementById('dogJointDetail');
  const dogHeatIssues = document.getElementById('dogHeatIssues');
  const dogHeatDetailField = document.getElementById('dogHeatDetailField');
  const dogHeatDetail = document.getElementById('dogHeatDetail');
  const dogHealthNotes = document.getElementById('dogHealthNotes');
  const saveDogBtn = document.getElementById('saveDogBtn');
  const dogStatus = document.getElementById('dogStatus');

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

  const OTHER_VALUE = '__other__';
  function populateBreedOptions(){
    const list = (typeof DOG_BREEDS !== 'undefined') ? DOG_BREEDS : [];
    dogBreed.innerHTML =
      `<option value="">Select a breed…</option>` +
      list.map(b => `<option value="${b}">${b}</option>`).join('') +
      `<option value="${OTHER_VALUE}">Other (not listed)</option>`;
  }
  populateBreedOptions();

  dogBreed.addEventListener('change', () => {
    dogBreedOtherField.hidden = dogBreed.value !== OTHER_VALUE;
  });

  dogJointIssues.addEventListener('change', () => {
    dogJointDetailField.hidden = !dogJointIssues.checked;
  });
  dogHeatIssues.addEventListener('change', () => {
    dogHeatDetailField.hidden = !dogHeatIssues.checked;
  });

  saveDogBtn.addEventListener('click', async () => {
    if(!window.DoloPawsAuth) return;
    const finalBreed = dogBreed.value === OTHER_VALUE
      ? dogBreedOther.value.trim()
      : dogBreed.value;
    saveDogBtn.disabled = true;
    saveDogBtn.textContent = 'Saving…';
    const ok = await window.DoloPawsAuth.setDogProfile({
      name: dogName.value.trim(),
      breed: finalBreed,
      fitness: dogFitness.value,
      age: dogAge.value ? Number(dogAge.value) : null,
      weight: dogWeight.value ? Number(dogWeight.value) : null,
      jointIssues: dogJointIssues.checked,
      jointDetail: dogJointIssues.checked ? dogJointDetail.value.trim() : '',
      heatIssues: dogHeatIssues.checked,
      heatDetail: dogHeatIssues.checked ? dogHeatDetail.value.trim() : '',
      healthNotes: dogHealthNotes.value.trim(),
    });
    saveDogBtn.disabled = false;
    saveDogBtn.textContent = 'Save dog profile';
    dogStatus.hidden = false;
    dogStatus.style.color = ok ? '#2C5C34' : '#9C3A25';
    dogStatus.textContent = ok ? 'Saved.' : 'Something went wrong — please try again.';
  });

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

      const profile = await window.DoloPawsAuth.getDogProfile();
      if(profile){
        dogName.value = profile.name || '';
        dogFitness.value = profile.fitness || 'moderate';
        const savedBreed = profile.breed || '';
        const isKnownBreed = (typeof DOG_BREEDS !== 'undefined') && DOG_BREEDS.includes(savedBreed);
        if(savedBreed && !isKnownBreed){
          dogBreed.value = OTHER_VALUE;
          dogBreedOtherField.hidden = false;
          dogBreedOther.value = savedBreed;
        } else {
          dogBreed.value = savedBreed;
          dogBreedOtherField.hidden = true;
        }
        dogAge.value = profile.age != null ? profile.age : '';
        dogWeight.value = profile.weight != null ? profile.weight : '';
        dogJointIssues.checked = !!profile.jointIssues;
        dogJointDetailField.hidden = !profile.jointIssues;
        dogJointDetail.value = profile.jointDetail || '';
        dogHeatIssues.checked = !!profile.heatIssues;
        dogHeatDetailField.hidden = !profile.heatIssues;
        dogHeatDetail.value = profile.heatDetail || '';
        dogHealthNotes.value = profile.healthNotes || '';
      }
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
