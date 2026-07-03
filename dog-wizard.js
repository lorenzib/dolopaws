(function(){
  const OTHER_VALUE = '__other__';

  const STEPS = [
    { key:'name', question:"What's your dog's name?", type:'text', placeholder:'e.g. Eddie' },
    { key:'breed', question:"What breed are they?", type:'breed' },
    { key:'heatSensitivity', question:'How sensitive is your dog to heat?', type:'options', options:[
      { value:'high', label:'Needs mostly shaded routes' },
      { value:'some', label:'Some open meadow is fine' },
      { value:'any',  label:"Doesn't matter" },
    ]},
    { key:'ageGroup', question:"What's their age group?", type:'options', options:[
      { value:'puppy',  label:'Puppy — under 1 year' },
      { value:'adult',  label:'Adult' },
      { value:'senior', label:'Senior' },
    ]},
    { key:'fitness', question:'How would you describe their fitness level?', type:'options', options:[
      { value:'low',      label:'Low — puppy, senior, or just starting out' },
      { value:'moderate', label:'Moderate — everyday walker' },
      { value:'high',     label:'High — mountain-ready' },
    ]},
  ];

  let stepIndex = 0;
  let data = { name:'', breed:'', breedOther:'', heatSensitivity:'', ageGroup:'', fitness:'' };

  const overlay = document.getElementById('dogWizard');
  const progressEl = document.getElementById('wizardProgress');
  const stepLabel = document.getElementById('wizardStepLabel');
  const questionEl = document.getElementById('wizardQuestion');
  const bodyEl = document.getElementById('wizardStepBody');
  const backBtn = document.getElementById('wizardBackBtn');
  const continueBtn = document.getElementById('wizardContinueBtn');
  const closeBtn = document.getElementById('wizardCloseBtn');
  const openBtn = document.getElementById('openWizardBtn');

  function renderProgress(){
    progressEl.innerHTML = STEPS.map((_, i) =>
      `<div class="seg ${i <= stepIndex ? 'done' : ''}"></div>`
    ).join('');
  }

  function currentValueIsSet(){
    const step = STEPS[stepIndex];
    if(step.type === 'text') return data[step.key].trim().length > 0;
    if(step.type === 'breed') return data.breed && (data.breed !== OTHER_VALUE || data.breedOther.trim().length > 0);
    if(step.type === 'options') return !!data[step.key];
    return true;
  }

  function renderStep(){
    const step = STEPS[stepIndex];
    renderProgress();
    stepLabel.textContent = `Step ${stepIndex + 1} of ${STEPS.length}`;
    questionEl.textContent = step.question;

    if(step.type === 'text'){
      bodyEl.innerHTML = `<input type="text" class="wizard-input" id="wizardTextInput" placeholder="${step.placeholder}" value="${data[step.key]}">`;
      const input = document.getElementById('wizardTextInput');
      input.addEventListener('input', () => { data[step.key] = input.value; updateContinueState(); });
      setTimeout(() => input.focus(), 50);
    }

    if(step.type === 'breed'){
      const list = (typeof DOG_BREEDS !== 'undefined') ? DOG_BREEDS : [];
      const options = `<option value="">Select a breed…</option>` +
        list.map(b => `<option value="${b}" ${data.breed===b?'selected':''}>${b}</option>`).join('') +
        `<option value="${OTHER_VALUE}" ${data.breed===OTHER_VALUE?'selected':''}>Other (not listed)</option>`;
      bodyEl.innerHTML = `
        <select class="wizard-select" id="wizardBreedSelect">${options}</select>
        <input type="text" class="wizard-input" id="wizardBreedOther" placeholder="Tell us the breed" value="${data.breedOther}" ${data.breed===OTHER_VALUE?'':'style="display:none;"'}>
      `;
      const select = document.getElementById('wizardBreedSelect');
      const other = document.getElementById('wizardBreedOther');
      select.addEventListener('change', () => {
        data.breed = select.value;
        other.style.display = select.value === OTHER_VALUE ? 'block' : 'none';
        updateContinueState();
      });
      other.addEventListener('input', () => { data.breedOther = other.value; updateContinueState(); });
    }

    if(step.type === 'options'){
      bodyEl.innerHTML = `<div class="wizard-options">${step.options.map(o => `
        <button type="button" class="wizard-option ${data[step.key]===o.value ? 'selected' : ''}" data-value="${o.value}">${o.label}</button>
      `).join('')}</div>`;
      bodyEl.querySelectorAll('.wizard-option').forEach(btn=>{
        btn.addEventListener('click', () => {
          data[step.key] = btn.dataset.value;
          bodyEl.querySelectorAll('.wizard-option').forEach(b=>b.classList.remove('selected'));
          btn.classList.add('selected');
          updateContinueState();
        });
      });
    }

    backBtn.style.visibility = stepIndex === 0 ? 'hidden' : 'visible';
    continueBtn.textContent = stepIndex === STEPS.length - 1 ? 'See my matches' : 'Continue';
    updateContinueState();
  }

  function updateContinueState(){
    continueBtn.disabled = !currentValueIsSet();
  }

  async function finishWizard(){
    const profile = {
      name: data.name.trim(),
      breed: data.breed === OTHER_VALUE ? data.breedOther.trim() : data.breed,
      heatSensitivity: data.heatSensitivity,
      ageGroup: data.ageGroup,
      fitness: data.fitness,
    };

    const user = window.DoloPawsAuth && window.DoloPawsAuth.currentUser;
    if(user){
      await window.DoloPawsAuth.setDogProfile(profile);
    } else {
      try{ localStorage.setItem('dolopaws-dog-profile', JSON.stringify(profile)); }catch(e){}
    }

    window.dispatchEvent(new CustomEvent('dolopaws-dog-profile-saved', { detail:{ profile } }));
    closeWizard();
  }

  continueBtn.addEventListener('click', () => {
    if(!currentValueIsSet()) return;
    if(stepIndex === STEPS.length - 1){
      finishWizard();
    } else {
      stepIndex++;
      renderStep();
    }
  });

  backBtn.addEventListener('click', () => {
    if(stepIndex > 0){
      stepIndex--;
      renderStep();
    }
  });

  function openWizard(){
    stepIndex = 0;
    data = { name:'', breed:'', breedOther:'', heatSensitivity:'', ageGroup:'', fitness:'' };
    renderStep();
    overlay.hidden = false;
    document.body.style.overflow = 'hidden';
  }
  function closeWizard(){
    overlay.hidden = true;
    document.body.style.overflow = '';
  }

  closeBtn.addEventListener('click', closeWizard);
  if(openBtn) openBtn.addEventListener('click', openWizard);

  window.DoloPawsWizard = { open: openWizard };
})();
