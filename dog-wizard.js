(function () {
  'use strict';

  var OTHER_VALUE = '__other__';
  var DRAFT_KEY_PREFIX = 'dolopaws-dog-draft';

  var STEPS = [
    { id: 'basics', label: 'Basics' },
    { id: 'breed',  label: 'Breed & Size' },
    { id: 'health', label: 'Health' },
    { id: 'review', label: 'Review' },
  ];

  // ---- State ----
  var stepIndex = 0;
  var isEditing = false;
  var isDirty   = false;
  var phase     = 'form'; // 'draft-prompt' | 'form' | 'close-confirm'
  var data      = makeEmptyData();

  // ---- DOM ----
  var overlay   = document.getElementById('dogWizard');
  var titleEl   = document.getElementById('dwTitle');
  var subtitleEl= document.getElementById('dwSubtitle');
  var stepperEl = document.getElementById('dwStepper');
  var bodyEl    = document.getElementById('dwBody');
  var footerEl  = document.getElementById('dwFooter');
  var backBtn   = document.getElementById('dwBackBtn');
  var nextBtn   = document.getElementById('dwNextBtn');
  var closeBtn  = document.getElementById('dwCloseBtn');
  var toastEl   = document.getElementById('dwToast');

  // ---- Helpers ----
  function makeEmptyData() {
    return {
      name: '', ageGroup: '', dogSex: '',
      breed: '', breedOther: '', fitness: '', heatSensitivity: '',
      spayed: '', conditions: '', allergies: '', medications: '',
    };
  }

  function esc(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // ---- Draft persistence ----
  function getDraftKey() {
    var uid = window.DoloPawsAuth &&
              window.DoloPawsAuth.currentUser &&
              window.DoloPawsAuth.currentUser.uid;
    return uid ? DRAFT_KEY_PREFIX + '-' + uid : DRAFT_KEY_PREFIX;
  }

  function saveDraft() {
    try {
      localStorage.setItem(getDraftKey(), JSON.stringify({
        data: data, step: stepIndex, ts: Date.now()
      }));
    } catch (e) {}
  }

  function loadDraft() {
    try {
      var raw = localStorage.getItem(getDraftKey());
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      if (!parsed || typeof parsed.data !== 'object') return null;
      // Expire after 7 days
      if (Date.now() - (parsed.ts || 0) > 7 * 86400 * 1000) {
        clearDraft();
        return null;
      }
      return parsed;
    } catch (e) {
      return null;
    }
  }

  function clearDraft() {
    try { localStorage.removeItem(getDraftKey()); } catch (e) {}
  }

  // ---- Focus management ----
  var preFocusEl = null;

  function getFocusable() {
    return Array.from(overlay.querySelectorAll(
      'a[href],button:not([disabled]),input:not([disabled]),' +
      'select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])'
    )).filter(function (el) { return !el.closest('[hidden]') && el.offsetParent !== null; });
  }

  function onKeyDown(e) {
    if (e.key === 'Escape') {
      e.preventDefault();
      requestClose();
      return;
    }
    if (e.key !== 'Tab') return;
    var focusable = getFocusable();
    if (!focusable.length) return;
    var first = focusable[0];
    var last  = focusable[focusable.length - 1];
    if (e.shiftKey) {
      if (document.activeElement === first) { last.focus(); e.preventDefault(); }
    } else {
      if (document.activeElement === last)  { first.focus(); e.preventDefault(); }
    }
  }

  // ---- Render ----
  function render() {
    renderStepper();
    renderBody();
    renderFooter();
  }

  function renderStepper() {
    if (phase !== 'form') {
      stepperEl.hidden = true;
      return;
    }
    stepperEl.hidden = false;
    stepperEl.innerHTML = STEPS.map(function (s, i) {
      var cls = i < stepIndex ? 'done' : (i === stepIndex ? 'active' : '');
      var dot = i < stepIndex ? '&#10003;' : (i + 1);
      var ariaCurrent = i === stepIndex ? 'step' : 'false';
      var connector = i < STEPS.length - 1
        ? '<div class="dw-connector" aria-hidden="true"></div>'
        : '';
      return '<div class="dw-step ' + cls + '" role="listitem" aria-current="' + ariaCurrent + '">' +
               '<div class="dw-step-dot" aria-hidden="true">' + dot + '</div>' +
               '<span class="dw-step-label">' + esc(s.label) + '</span>' +
             '</div>' + connector;
    }).join('');
  }

  function renderFooter() {
    if (phase !== 'form') {
      footerEl.hidden = true;
      return;
    }
    footerEl.hidden = false;
    backBtn.style.visibility = stepIndex === 0 ? 'hidden' : 'visible';
    var isLast = stepIndex === STEPS.length - 1;
    if (isLast) {
      nextBtn.textContent = isEditing ? 'Save changes' : 'Save dog';
    } else {
      nextBtn.textContent = 'Next \u2192';
    }
    nextBtn.disabled = false;
  }

  function renderBody() {
    bodyEl.innerHTML = '';
    if (phase === 'draft-prompt') {
      renderDraftPrompt();
    } else if (phase === 'close-confirm') {
      renderCloseConfirm();
    } else {
      renderFormStep();
    }
    bodyEl.scrollTop = 0;
  }

  // ---- Draft prompt view ----
  function renderDraftPrompt() {
    var draft = loadDraft();
    var dogName = draft && draft.data && draft.data.name
      ? ' for ' + esc(draft.data.name)
      : '';
    titleEl.textContent = 'Resume your draft?';
    subtitleEl.textContent = '';
    bodyEl.innerHTML =
      '<div class="dw-info-panel">' +
        '<div class="dw-info-icon" aria-hidden="true">&#128221;</div>' +
        '<p class="dw-info-text">You have an unfinished profile' + dogName + '. ' +
          'Pick up where you left off or start fresh.</p>' +
        '<div class="dw-info-actions">' +
          '<button class="dw-btn-primary" id="dwResumeDraftBtn">Resume draft</button>' +
          '<button class="dw-btn-ghost" id="dwStartOverBtn">Start over</button>' +
        '</div>' +
      '</div>';
    document.getElementById('dwResumeDraftBtn').addEventListener('click', resumeDraft);
    document.getElementById('dwStartOverBtn').addEventListener('click', startFresh);
  }

  function resumeDraft() {
    var draft = loadDraft();
    if (draft) {
      data      = Object.assign(makeEmptyData(), draft.data);
      stepIndex = Math.min(draft.step || 0, STEPS.length - 1);
    }
    setFormTitle();
    phase    = 'form';
    isDirty  = false;
    render();
    focusFirstIn(bodyEl);
  }

  function startFresh() {
    clearDraft();
    data      = makeEmptyData();
    stepIndex = 0;
    setFormTitle();
    phase    = 'form';
    isDirty  = false;
    render();
    focusFirstIn(bodyEl);
  }

  // ---- Close-confirm view ----
  function renderCloseConfirm() {
    titleEl.textContent = 'Save your progress?';
    subtitleEl.textContent = '';
    bodyEl.innerHTML =
      '<div class="dw-info-panel">' +
        '<div class="dw-info-icon" aria-hidden="true">&#128190;</div>' +
        '<p class="dw-info-text">You haven\'t finished adding your dog. ' +
          'Save a draft to continue later, or discard your changes.</p>' +
        '<div class="dw-info-actions">' +
          '<button class="dw-btn-primary" id="dwSaveDraftBtn">Save draft</button>' +
          '<button class="dw-btn-ghost" id="dwDiscardCloseBtn">Discard &amp; close</button>' +
        '</div>' +
        '<button class="dw-keep-link" id="dwKeepEditingBtn">&#8592; Keep editing</button>' +
      '</div>';
    document.getElementById('dwSaveDraftBtn').addEventListener('click', function () {
      saveDraft();
      doClose();
    });
    document.getElementById('dwDiscardCloseBtn').addEventListener('click', function () {
      clearDraft();
      doClose();
    });
    document.getElementById('dwKeepEditingBtn').addEventListener('click', function () {
      setFormTitle();
      phase = 'form';
      render();
      focusFirstIn(bodyEl);
    });
  }

  // ---- Form steps ----
  function renderFormStep() {
    var step = STEPS[stepIndex];
    if (step.id === 'basics')  renderBasicsStep();
    else if (step.id === 'breed')  renderBreedStep();
    else if (step.id === 'health') renderHealthStep();
    else if (step.id === 'review') renderReviewStep();
  }

  function renderBasicsStep() {
    bodyEl.innerHTML =
      '<div class="dw-field-group">' +
        '<label class="dw-label" for="dwName">' +
          'Dog name <span class="dw-required" aria-label="required">*</span>' +
        '</label>' +
        '<input type="text" class="dw-input" id="dwName" placeholder="e.g. Eddie"' +
               ' value="' + esc(data.name) + '" maxlength="40" autocomplete="off"' +
               ' aria-required="true" aria-describedby="dwNameErr">' +
        '<span class="dw-field-error" id="dwNameErr" role="alert" hidden>' +
          'Please enter your dog\'s name (2\u201340 characters).' +
        '</span>' +
      '</div>' +
      '<div class="dw-field-group">' +
        '<span class="dw-label" id="dwAgeLabel">' +
          'Age group <span class="dw-required" aria-label="required">*</span>' +
        '</span>' +
        '<div class="dw-option-group" role="group" aria-labelledby="dwAgeLabel">' +
          optBtn('ageGroup', 'puppy',  'Puppy \u2014 under 1 year') +
          optBtn('ageGroup', 'adult',  'Adult') +
          optBtn('ageGroup', 'senior', 'Senior') +
        '</div>' +
        '<span class="dw-field-error" id="dwAgeErr" role="alert" hidden>' +
          'Please select an age group.' +
        '</span>' +
      '</div>' +
      '<div class="dw-field-group">' +
        '<span class="dw-label" id="dwSexLabel">' +
          'Sex <span class="dw-optional">(optional)</span>' +
        '</span>' +
        '<div class="dw-option-group" role="group" aria-labelledby="dwSexLabel">' +
          optBtn('dogSex', 'male',    'Male') +
          optBtn('dogSex', 'female',  'Female') +
          optBtn('dogSex', 'unknown', 'Unknown') +
        '</div>' +
      '</div>';

    var nameInput = document.getElementById('dwName');
    nameInput.addEventListener('input', function () {
      data.name = nameInput.value;
      isDirty   = true;
      document.getElementById('dwNameErr').hidden = true;
    });
    wireOptionGroup(bodyEl);
    setTimeout(function () { nameInput.focus(); }, 50);
  }

  function renderBreedStep() {
    var breeds = (typeof DOG_BREEDS !== 'undefined') ? DOG_BREEDS : [];
    var opts = '<option value="">Select a breed\u2026</option>' +
      breeds.map(function (b) {
        return '<option value="' + esc(b) + '"' + (data.breed === b ? ' selected' : '') + '>' + esc(b) + '</option>';
      }).join('') +
      '<option value="' + OTHER_VALUE + '"' + (data.breed === OTHER_VALUE ? ' selected' : '') + '>Other (not listed)</option>';

    bodyEl.innerHTML =
      '<div class="dw-field-group">' +
        '<label class="dw-label" for="dwBreed">' +
          'Breed <span class="dw-required" aria-label="required">*</span>' +
        '</label>' +
        '<select class="dw-select" id="dwBreed" aria-required="true" aria-describedby="dwBreedErr">' +
          opts +
        '</select>' +
        '<input type="text" class="dw-input" id="dwBreedOther"' +
               ' placeholder="Tell us the breed" value="' + esc(data.breedOther) + '"' +
               ' style="margin-top:8px;' + (data.breed === OTHER_VALUE ? '' : 'display:none;') + '"' +
               ' aria-label="Other breed name">' +
        '<span class="dw-field-error" id="dwBreedErr" role="alert" hidden>' +
          'Please select a breed.' +
        '</span>' +
      '</div>' +
      '<div class="dw-field-group">' +
        '<span class="dw-label" id="dwFitnessLabel">' +
          'Activity level <span class="dw-required" aria-label="required">*</span>' +
        '</span>' +
        '<div class="dw-option-group" role="group" aria-labelledby="dwFitnessLabel">' +
          optBtn('fitness', 'low',      'Low \u2014 puppy, senior, or just starting out') +
          optBtn('fitness', 'moderate', 'Moderate \u2014 everyday walker') +
          optBtn('fitness', 'high',     'High \u2014 mountain-ready') +
        '</div>' +
        '<span class="dw-field-error" id="dwFitnessErr" role="alert" hidden>' +
          'Please select an activity level.' +
        '</span>' +
      '</div>' +
      '<div class="dw-field-group">' +
        '<span class="dw-label" id="dwHeatLabel">' +
          'Heat sensitivity <span class="dw-required" aria-label="required">*</span>' +
        '</span>' +
        '<div class="dw-option-group" role="group" aria-labelledby="dwHeatLabel">' +
          optBtn('heatSensitivity', 'high', 'Needs mostly shaded routes') +
          optBtn('heatSensitivity', 'some', 'Some open meadow is fine') +
          optBtn('heatSensitivity', 'any',  'Doesn\'t matter') +
        '</div>' +
        '<span class="dw-field-error" id="dwHeatErr" role="alert" hidden>' +
          'Please select a heat sensitivity level.' +
        '</span>' +
      '</div>';

    var breedSelect = document.getElementById('dwBreed');
    var breedOther  = document.getElementById('dwBreedOther');

    breedSelect.addEventListener('change', function () {
      data.breed = breedSelect.value;
      isDirty    = true;
      breedOther.style.display = breedSelect.value === OTHER_VALUE ? '' : 'none';
      document.getElementById('dwBreedErr').hidden = true;
    });
    breedOther.addEventListener('input', function () {
      data.breedOther = breedOther.value;
      isDirty = true;
    });
    wireOptionGroup(bodyEl);
    setTimeout(function () { breedSelect.focus(); }, 50);
  }

  function renderHealthStep() {
    bodyEl.innerHTML =
      '<p class="dw-step-hint">All fields in this step are optional. Fill in what you know.</p>' +
      '<div class="dw-field-group">' +
        '<span class="dw-label" id="dwSpayedLabel">' +
          'Spayed / Neutered <span class="dw-optional">(optional)</span>' +
        '</span>' +
        '<div class="dw-option-group" role="group" aria-labelledby="dwSpayedLabel">' +
          optBtn('spayed', 'yes',     'Yes') +
          optBtn('spayed', 'no',      'No') +
          optBtn('spayed', 'unknown', 'Prefer not to say') +
        '</div>' +
      '</div>' +
      '<div class="dw-field-group">' +
        '<label class="dw-label" for="dwConditions">' +
          'Known conditions <span class="dw-optional">(optional)</span>' +
        '</label>' +
        '<textarea class="dw-textarea" id="dwConditions" rows="2" maxlength="300"' +
                  ' placeholder="e.g. hip dysplasia, epilepsy">' + esc(data.conditions) + '</textarea>' +
      '</div>' +
      '<div class="dw-field-group">' +
        '<label class="dw-label" for="dwAllergies">' +
          'Allergies <span class="dw-optional">(optional)</span>' +
        '</label>' +
        '<input type="text" class="dw-input" id="dwAllergies"' +
               ' placeholder="e.g. grass pollen" value="' + esc(data.allergies) + '" maxlength="200">' +
      '</div>' +
      '<div class="dw-field-group">' +
        '<label class="dw-label" for="dwMeds">' +
          'Current medications <span class="dw-optional">(optional)</span>' +
        '</label>' +
        '<input type="text" class="dw-input" id="dwMeds"' +
               ' placeholder="e.g. Apoquel" value="' + esc(data.medications) + '" maxlength="200">' +
      '</div>';

    wireOptionGroup(bodyEl);
    [
      { id: 'dwConditions', key: 'conditions' },
      { id: 'dwAllergies',  key: 'allergies'  },
      { id: 'dwMeds',       key: 'medications'},
    ].forEach(function (f) {
      var el = document.getElementById(f.id);
      el.addEventListener('input', function () { data[f.key] = el.value; isDirty = true; });
    });
  }

  function renderReviewStep() {
    var breedDisplay = data.breed === OTHER_VALUE ? data.breedOther : data.breed;
    var ageMap     = { puppy: 'Puppy', adult: 'Adult', senior: 'Senior' };
    var fitMap     = { low: 'Low', moderate: 'Moderate', high: 'High' };
    var heatMap    = { high: 'Needs shade', some: 'Some open OK', any: "Doesn't matter" };
    var sexMap     = { male: 'Male', female: 'Female', unknown: 'Unknown' };
    var spayedMap  = { yes: 'Yes', no: 'No', unknown: 'Prefer not to say' };

    function row(label, value) {
      return value
        ? '<div class="dw-review-row"><span class="dw-review-key">' + label + '</span>' +
          '<span class="dw-review-val">' + esc(value) + '</span></div>'
        : '';
    }

    var healthSection = (data.spayed || data.conditions || data.allergies || data.medications)
      ? '<div class="dw-review-section">' +
          '<div class="dw-review-title">Health</div>' +
          '<div class="dw-review-rows">' +
            row('Spayed/Neutered', spayedMap[data.spayed] || '') +
            row('Conditions', data.conditions) +
            row('Allergies',  data.allergies) +
            row('Medications', data.medications) +
          '</div>' +
        '</div>'
      : '';

    bodyEl.innerHTML =
      '<p class="dw-step-hint">Review your dog\'s profile before saving.</p>' +
      '<div class="dw-review-card">' +
        '<div class="dw-review-section">' +
          '<div class="dw-review-title">Basics</div>' +
          '<div class="dw-review-rows">' +
            row('Name',      data.name) +
            row('Age group', ageMap[data.ageGroup] || data.ageGroup) +
            row('Sex',       sexMap[data.dogSex] || '') +
          '</div>' +
        '</div>' +
        '<div class="dw-review-section">' +
          '<div class="dw-review-title">Breed &amp; Size</div>' +
          '<div class="dw-review-rows">' +
            row('Breed',           breedDisplay) +
            row('Activity level',  fitMap[data.fitness] || data.fitness) +
            row('Heat sensitivity', heatMap[data.heatSensitivity] || data.heatSensitivity) +
          '</div>' +
        '</div>' +
        healthSection +
      '</div>';
  }

  // ---- Shared helpers ----
  function optBtn(key, value, label) {
    var sel = data[key] === value ? ' selected' : '';
    return '<button type="button" class="dw-option' + sel + '" data-key="' + key + '" data-value="' + value + '">' +
             label +
           '</button>';
  }

  function wireOptionGroup(container) {
    var errMap = {
      ageGroup:        'dwAgeErr',
      fitness:         'dwFitnessErr',
      heatSensitivity: 'dwHeatErr',
    };
    container.querySelectorAll('.dw-option').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var key = btn.dataset.key;
        data[key] = btn.dataset.value;
        isDirty   = true;
        btn.closest('.dw-option-group').querySelectorAll('.dw-option')
           .forEach(function (b) { b.classList.remove('selected'); });
        btn.classList.add('selected');
        if (errMap[key]) {
          var errEl = document.getElementById(errMap[key]);
          if (errEl) errEl.hidden = true;
        }
      });
    });
  }

  function focusFirstIn(container) {
    setTimeout(function () {
      var focusable = getFocusable();
      if (focusable.length) focusable[0].focus();
    }, 50);
  }

  // ---- Validation ----
  function validateCurrentStep() {
    var step = STEPS[stepIndex];
    if (step.id === 'basics') {
      var nameOk = data.name.trim().length >= 2;
      var ageOk  = !!data.ageGroup;
      if (!nameOk) document.getElementById('dwNameErr').hidden = false;
      if (!ageOk)  document.getElementById('dwAgeErr').hidden  = false;
      if (!nameOk) { document.getElementById('dwName').focus(); }
      else if (!ageOk) {
        var firstOpt = bodyEl.querySelector('[data-key="ageGroup"]');
        if (firstOpt) firstOpt.focus();
      }
      return nameOk && ageOk;
    }
    if (step.id === 'breed') {
      var breedOk   = !!(data.breed && (data.breed !== OTHER_VALUE || data.breedOther.trim()));
      var fitnessOk = !!data.fitness;
      var heatOk    = !!data.heatSensitivity;
      if (!breedOk)   document.getElementById('dwBreedErr').hidden   = false;
      if (!fitnessOk) document.getElementById('dwFitnessErr').hidden = false;
      if (!heatOk)    document.getElementById('dwHeatErr').hidden    = false;
      if (!breedOk) { document.getElementById('dwBreed').focus(); }
      return breedOk && fitnessOk && heatOk;
    }
    return true;
  }

  // ---- Navigation ----
  nextBtn.addEventListener('click', function () {
    if (!validateCurrentStep()) return;
    if (stepIndex === STEPS.length - 1) {
      finishWizard();
    } else {
      stepIndex++;
      render();
      focusFirstIn(bodyEl);
    }
  });

  backBtn.addEventListener('click', function () {
    if (stepIndex > 0) {
      stepIndex--;
      render();
      focusFirstIn(bodyEl);
    }
  });

  // ---- Close ----
  function requestClose() {
    if (phase === 'close-confirm' || phase === 'draft-prompt') {
      doClose();
      return;
    }
    if (isDirty) {
      phase = 'close-confirm';
      render();
      focusFirstIn(bodyEl);
    } else {
      doClose();
    }
  }

  function doClose() {
    overlay.hidden = true;
    document.body.style.overflow = '';
    document.removeEventListener('keydown', onKeyDown);
    phase = 'form';
    if (preFocusEl) { preFocusEl.focus(); preFocusEl = null; }
  }

  closeBtn.addEventListener('click', requestClose);

  overlay.addEventListener('click', function (e) {
    if (e.target === overlay) requestClose();
  });

  // ---- Submit ----
  function finishWizard() {
    var profile = {
      name:            data.name.trim(),
      breed:           data.breed === OTHER_VALUE ? data.breedOther.trim() : data.breed,
      heatSensitivity: data.heatSensitivity,
      ageGroup:        data.ageGroup,
      fitness:         data.fitness,
    };
    if (data.dogSex)     profile.sex        = data.dogSex;
    if (data.spayed)     profile.spayed     = data.spayed;
    if (data.conditions) profile.conditions = data.conditions;
    if (data.allergies)  profile.allergies  = data.allergies;
    if (data.medications)profile.medications= data.medications;

    clearDraft();
    window.dispatchEvent(new CustomEvent('dolopaws-dog-profile-saved', { detail: { profile: profile } }));
    doClose();
    showToast(profile.name + ' was saved successfully.');
  }

  // ---- Toast ----
  var toastTimer = null;
  function showToast(message) {
    if (!toastEl) return;
    if (toastTimer) clearTimeout(toastTimer);
    toastEl.textContent = message;
    toastEl.hidden = false;
    toastEl.className = 'dw-toast dw-toast--in';
    toastTimer = setTimeout(function () {
      toastEl.hidden = true;
      toastEl.className = 'dw-toast';
    }, 3500);
  }

  // ---- Title helper ----
  function setFormTitle() {
    titleEl.textContent   = isEditing ? 'Edit dog' : 'Add a dog';
    subtitleEl.textContent = isEditing
      ? 'Update your dog\'s profile.'
      : 'Tell us about your dog to personalize trail recommendations.';
  }

  // ---- Open ----
  function openWizard(existingDog) {
    preFocusEl = document.activeElement;
    isEditing  = !!(existingDog && existingDog.name);

    if (isEditing) {
      var known = (typeof DOG_BREEDS !== 'undefined') && DOG_BREEDS.includes(existingDog.breed);
      data = Object.assign(makeEmptyData(), {
        name:            existingDog.name            || '',
        breed:           known ? existingDog.breed : (existingDog.breed ? OTHER_VALUE : ''),
        breedOther:      known ? '' : (existingDog.breed || ''),
        heatSensitivity: existingDog.heatSensitivity || '',
        ageGroup:        existingDog.ageGroup        || '',
        fitness:         existingDog.fitness         || '',
        dogSex:          existingDog.sex             || '',
        spayed:          existingDog.spayed          || '',
        conditions:      existingDog.conditions      || '',
        allergies:       existingDog.allergies       || '',
        medications:     existingDog.medications     || '',
      });
      stepIndex = 0;
      isDirty   = false;
      phase     = 'form';
    } else {
      var draft = loadDraft();
      data      = makeEmptyData();
      stepIndex = 0;
      isDirty   = false;
      phase     = draft ? 'draft-prompt' : 'form';
    }

    setFormTitle();
    render();
    overlay.hidden = false;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onKeyDown);

    setTimeout(function () {
      var focusable = getFocusable();
      if (focusable.length) focusable[0].focus();
    }, 50);
  }

  // ---- Public API ----
  window.DoloPawsWizard = { open: openWizard };
})();
