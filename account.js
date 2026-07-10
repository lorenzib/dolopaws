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
  const dogDob = document.getElementById('dogDob');
  const dogAgeBand = document.getElementById('dogAgeBand');
  const dogWeightBand = document.getElementById('dogWeightBand');
  const dogCondBox = document.getElementById('dogCondBox');
  const dogCondSummary = document.getElementById('dogCondSummary');
  const dogHealthNotes = document.getElementById('dogHealthNotes');
  const saveDogBtn = document.getElementById('saveDogBtn');
  const dogStatus = document.getElementById('dogStatus');

  // ---------- Dog photo — synced to the account ----------
  // The photo is downscaled in the browser to a small thumbnail and saved
  // into the user's own Firestore document (users/{uid} → dog.photo), so it
  // follows the account to any device they log in from. localStorage is
  // only a fast local cache, keyed by uid so two accounts sharing one
  // browser never see each other's dog. A Firestore document caps at 1 MB;
  // the ~300 px JPEG thumbnail (~20–40 KB) stays far below that.
  const LEGACY_PHOTO_KEY = 'dolopaws-dog-photo';   // pre-sync, device-only key
  const PHOTO_INPUT_MAX_BYTES = 8 * 1024 * 1024;   // cap BEFORE downscaling
  const PHOTO_MAX_PX = 300;
  const dogPhotoInput = document.getElementById('dogPhotoInput');
  const dogPhotoImg = document.getElementById('dogPhotoImg');
  const dogPhotoFallback = document.getElementById('dogPhotoFallback');
  const dogPhotoRemoveBtn = document.getElementById('dogPhotoRemoveBtn');
  const dogPhotoStatus = document.getElementById('dogPhotoStatus');

  function photoCacheKey(){
    const u = window.DoloPawsAuth && window.DoloPawsAuth.currentUser;
    return u ? 'dolopaws-dog-photo-' + u.uid : null;
  }

  function showDogPhoto(dataUrl){
    if(!dogPhotoImg) return;
    dogPhotoImg.src = dataUrl;
    dogPhotoImg.hidden = false;
    if(dogPhotoFallback) dogPhotoFallback.style.display = 'none';
    if(dogPhotoRemoveBtn) dogPhotoRemoveBtn.hidden = false;
  }
  function clearDogPhoto(){
    if(!dogPhotoImg) return;
    dogPhotoImg.src = '';
    dogPhotoImg.hidden = true;
    if(dogPhotoFallback) dogPhotoFallback.style.display = '';
    if(dogPhotoRemoveBtn) dogPhotoRemoveBtn.hidden = true;
    if(dogPhotoInput) dogPhotoInput.value = '';
  }
  function photoStatus(text, ok){
    if(!dogPhotoStatus) return;
    dogPhotoStatus.hidden = false;
    dogPhotoStatus.style.color = ok ? '#2C5C34' : '#9C3A25';
    dogPhotoStatus.textContent = text;
  }
  function tKey(key, fallback){
    if(!window.t) return fallback;
    const s = window.t(key);
    return s === key ? fallback : s;
  }

  // Shrink to a thumbnail in the browser: the profile circle only shows
  // ~150 px, and small thumbnails are what make account sync possible.
  function downscalePhoto(file){
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        try {
          const scale = Math.min(1, PHOTO_MAX_PX / Math.max(img.width, img.height));
          const w = Math.max(1, Math.round(img.width * scale));
          const h = Math.max(1, Math.round(img.height * scale));
          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          canvas.getContext('2d').drawImage(img, 0, 0, w, h);
          URL.revokeObjectURL(url);
          resolve(canvas.toDataURL('image/jpeg', 0.85));
        } catch (e) { URL.revokeObjectURL(url); reject(e); }
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('decode failed')); };
      img.src = url;
    });
  }

  if(dogPhotoInput){
    dogPhotoInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if(!file) return;

      if(!file.type.startsWith('image/')){
        photoStatus(tKey('account.photo.typeError', 'Please select an image file.'), false);
        dogPhotoInput.value = '';
        return;
      }
      if(file.size > PHOTO_INPUT_MAX_BYTES){
        photoStatus(tKey('account.photo.sizeError', 'Photo must be smaller than 8 MB.'), false);
        dogPhotoInput.value = '';
        return;
      }
      if(dogPhotoStatus) dogPhotoStatus.hidden = true;

      downscalePhoto(file).then((dataUrl) => {
        showDogPhoto(dataUrl);
        const key = photoCacheKey();
        try { if(key) localStorage.setItem(key, dataUrl); } catch (err) { /* cache only */ }

        if(window.DoloPawsAuth && window.DoloPawsAuth.currentUser){
          window.DoloPawsAuth.setDogProfile({ photo: dataUrl }).then((ok) => {
            photoStatus(ok
              ? tKey('account.photo.synced', 'Photo saved to your account — it will show on any device you log in from.')
              : tKey('account.photo.localOnly', "Photo saved on this device — couldn't reach your account just now."), ok);
          });
        }
      }).catch(() => {
        photoStatus(tKey('account.photo.typeError', 'Please select an image file.'), false);
        dogPhotoInput.value = '';
      });
    });
  }
  if(dogPhotoRemoveBtn){
    dogPhotoRemoveBtn.addEventListener('click', () => {
      const key = photoCacheKey();
      try {
        if(key) localStorage.removeItem(key);
        localStorage.removeItem(LEGACY_PHOTO_KEY);
      } catch(e){}
      clearDogPhoto();
      if(dogPhotoStatus) dogPhotoStatus.hidden = true;
      if(window.DoloPawsAuth && window.DoloPawsAuth.currentUser){
        window.DoloPawsAuth.setDogProfile({ photo: null });
      }
    });
  }

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

  // ---------- Breed dropdown: full FCI nomenclature, grouped ----------
  const OTHER_VALUE = '__other__';
  function populateBreedOptions(){
    const groups = (typeof FCI_BREED_GROUPS !== 'undefined') ? FCI_BREED_GROUPS : [];
    const esc = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;');
    let html = `<option value="">Select a breed…</option>`;
    groups.forEach(g => {
      html += `<optgroup label="${esc(g.label)}">`
        + g.breeds.map(b => `<option value="${esc(b)}">${esc(b)}</option>`).join('')
        + `</optgroup>`;
    });
    html += `<optgroup label="Something else"><option value="${OTHER_VALUE}">Other (type it in)</option></optgroup>`;
    dogBreed.innerHTML = html;
  }
  populateBreedOptions();

  dogBreed.addEventListener('change', () => {
    dogBreedOtherField.hidden = dogBreed.value !== OTHER_VALUE;
  });

  // ---------- Date of birth / age band ----------
  if (dogDob) dogDob.max = new Date().toISOString().slice(0, 10);

  // ---------- Health conditions dropdown ----------
  function condInputs(){
    return Array.from(document.querySelectorAll('input[name="dogCond"]'));
  }
  function selectedConditions(){
    return condInputs().filter(i => i.checked).map(i => i.value);
  }
  function updateCondSummary(){
    const n = selectedConditions().length;
    dogCondSummary.textContent = n === 0
      ? 'None selected — tap to choose'
      : (n === 1 ? '1 condition selected' : `${n} conditions selected`);
  }
  condInputs().forEach(i => i.addEventListener('change', updateCondSummary));

  // ---------- Derivations kept in sync with script.js / SCORING.md ----------
  const AGE_BAND_MID = { 'u1':0.5, '1-2':1.5, '3-4':3.5, '5-6':5.5, '7-8':7.5, '9-10':9.5, '11-12':11.5, '13plus':14 };
  const WEIGHT_BAND_MID = { 'u5':4, '5-10':7.5, '10-15':12.5, '15-20':17.5, '20-30':25, '30-40':35, '40-55':47.5, '55plus':60 };

  function ageYearsFrom(dobStr, band){
    if(dobStr){
      const d = new Date(dobStr);
      if(!isNaN(d)) return Math.max(0, Math.round(((Date.now() - d.getTime()) / 31557600000) * 10) / 10);
    }
    if(band && AGE_BAND_MID[band] != null) return AGE_BAND_MID[band];
    return null;
  }
  function ageBandFromYears(y){
    if(y == null) return '';
    if(y < 1) return 'u1';
    if(y < 3) return '1-2';
    if(y < 5) return '3-4';
    if(y < 7) return '5-6';
    if(y < 9) return '7-8';
    if(y < 11) return '9-10';
    if(y < 13) return '11-12';
    return '13plus';
  }
  function weightBandFromKg(kg){
    if(kg == null) return '';
    if(kg < 5) return 'u5';
    if(kg < 10) return '5-10';
    if(kg < 15) return '10-15';
    if(kg < 20) return '15-20';
    if(kg < 30) return '20-30';
    if(kg < 40) return '30-40';
    if(kg < 55) return '40-55';
    return '55plus';
  }

  // ---------- Save ----------
  saveDogBtn.addEventListener('click', async () => {
    if(!window.DoloPawsAuth) return;
    const finalBreed = dogBreed.value === OTHER_VALUE
      ? dogBreedOther.value.trim()
      : dogBreed.value;
    const conditions = selectedConditions();
    const ageYears = ageYearsFrom(dogDob.value, dogAgeBand.value);
    const weightKg = WEIGHT_BAND_MID[dogWeightBand.value] != null
      ? WEIGHT_BAND_MID[dogWeightBand.value] : null;

    saveDogBtn.disabled = true;
    saveDogBtn.textContent = 'Saving…';
    const ok = await window.DoloPawsAuth.setDogProfile({
      name: dogName.value.trim(),
      breed: finalBreed,
      fitness: dogFitness.value,
      dob: dogDob.value || null,
      ageBand: dogAgeBand.value || null,
      weightBand: dogWeightBand.value || null,
      conditions: conditions,
      healthNotes: dogHealthNotes.value.trim(),
      // Legacy mirrors so any cached older script keeps working.
      age: ageYears,
      weight: weightKg,
      jointIssues: conditions.includes('joints'),
      heatIssues: conditions.includes('heat'),
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

      // Photo: the account copy always wins. A photo saved on this device
      // before sync existed (old device-only key) gets migrated up to the
      // account once, then the old key is removed.
      const pKey = 'dolopaws-dog-photo-' + user.uid;
      if(profile && profile.photo){
        showDogPhoto(profile.photo);
        try { localStorage.setItem(pKey, profile.photo); } catch(e){}
      } else {
        let local = null;
        try { local = localStorage.getItem(pKey) || localStorage.getItem(LEGACY_PHOTO_KEY); } catch(e){}
        if(local){
          showDogPhoto(local);
          window.DoloPawsAuth.setDogProfile({ photo: local }).then((ok) => {
            if(ok){
              try {
                localStorage.setItem(pKey, local);
                localStorage.removeItem(LEGACY_PHOTO_KEY);
              } catch(e){}
            }
          });
        } else {
          clearDogPhoto();
        }
      }

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

        // Age: prefer stored DOB, then stored band, then migrate the old
        // plain-number age into the nearest band.
        dogDob.value = profile.dob || '';
        dogAgeBand.value = profile.ageBand
          || (profile.dob ? '' : ageBandFromYears(typeof profile.age === 'number' ? profile.age : null));

        // Weight: stored band, else migrate old plain-number kg.
        dogWeightBand.value = profile.weightBand
          || weightBandFromKg(typeof profile.weight === 'number' ? profile.weight : null);

        // Conditions: stored list, else migrate the two old booleans.
        const conds = Array.isArray(profile.conditions)
          ? profile.conditions
          : [profile.jointIssues && 'joints', profile.heatIssues && 'heat'].filter(Boolean);
        condInputs().forEach(i => { i.checked = conds.includes(i.value); });
        updateCondSummary();

        // Notes: keep old free-text detail fields visible after migration.
        let notes = profile.healthNotes || '';
        if(!Array.isArray(profile.conditions)){
          const legacyBits = [profile.jointDetail, profile.heatDetail].filter(Boolean).join('. ');
          if(legacyBits && !notes.includes(legacyBits)) notes = notes ? `${notes}. ${legacyBits}` : legacyBits;
        }
        dogHealthNotes.value = notes;
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
