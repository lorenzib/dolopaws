/**
 * Tests for dog-wizard.js
 *
 * Covers:
 *   1. Step validation gating (required fields)
 *   2. Draft save / resume / clear behaviour
 *   3. Successful submit flow (event, draft clear, toast, close)
 */

'use strict';

const fs   = require('fs');
const path = require('path');

// Minimal HTML that mirrors what account.html renders for the wizard.
const WIZARD_HTML = `
  <div id="dogWizard" class="dw-overlay" hidden
       role="dialog" aria-modal="true"
       aria-labelledby="dwTitle" aria-describedby="dwSubtitle">
    <div class="dw-modal">
      <div class="dw-header">
        <div class="dw-header-text">
          <h2 id="dwTitle" class="dw-title">Add a dog</h2>
          <p id="dwSubtitle" class="dw-subtitle">Tell us about your dog.</p>
        </div>
        <button class="dw-close" id="dwCloseBtn" aria-label="Close dialog">&times;</button>
      </div>
      <nav class="dw-stepper" id="dwStepper" role="list"></nav>
      <div class="dw-body" id="dwBody" tabindex="-1"></div>
      <div class="dw-footer" id="dwFooter">
        <button class="dw-btn-ghost" id="dwBackBtn">Back</button>
        <button class="dw-btn-primary" id="dwNextBtn">Next</button>
      </div>
    </div>
  </div>
  <div id="dwToast" class="dw-toast" hidden></div>
`;

const WIZARD_SRC = fs.readFileSync(path.join(__dirname, 'dog-wizard.js'), 'utf8');

// jsdom does not implement offsetParent; make all elements "visible" for focus queries.
Object.defineProperty(HTMLElement.prototype, 'offsetParent', {
  get() { return this.parentElement; },
  configurable: true,
});

function setupWizard() {
  document.body.innerHTML = WIZARD_HTML;
  // eslint-disable-next-line no-new-func
  new Function(WIZARD_SRC)();
  return window.DoloPawsWizard;
}

// Helper: click the Next button
function clickNext() {
  document.getElementById('dwNextBtn').click();
}

// Helper: fill basics step with valid data
function fillBasicsValid() {
  const nameInput = document.getElementById('dwName');
  if (!nameInput) throw new Error('dwName not found — are we on the Basics step?');
  // Simulate user typing
  nameInput.value = 'Buddy';
  nameInput.dispatchEvent(new Event('input'));

  // Select "Adult" age group
  const adultBtn = document.querySelector('[data-key="ageGroup"][data-value="adult"]');
  adultBtn.click();
}

// Helper: fill breed step with valid data
// Uses "Other (not listed)" + breedOther since DOG_BREEDS is not loaded in test env.
function fillBreedValid() {
  const breedSelect = document.getElementById('dwBreed');
  breedSelect.value = '__other__';
  breedSelect.dispatchEvent(new Event('change'));

  const breedOther = document.getElementById('dwBreedOther');
  breedOther.value = 'Labrador Mix';
  breedOther.dispatchEvent(new Event('input'));

  document.querySelector('[data-key="fitness"][data-value="moderate"]').click();
  document.querySelector('[data-key="heatSensitivity"][data-value="some"]').click();
}

// ============================================================
// 1. Step validation gating
// ============================================================

describe('Step validation gating', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  test('Next on Basics step is blocked when name is empty', () => {
    const wizard = setupWizard();
    wizard.open();

    // Should be on Basics step (step 0)
    expect(document.getElementById('dwName')).not.toBeNull();

    // Click Next without filling in name
    clickNext();

    // Error message should be visible
    const nameErr = document.getElementById('dwNameErr');
    expect(nameErr.hidden).toBe(false);

    // Still on step 0 (Name field still present)
    expect(document.getElementById('dwName')).not.toBeNull();
  });

  test('Next on Basics step is blocked when name is too short (< 2 chars)', () => {
    const wizard = setupWizard();
    wizard.open();

    const nameInput = document.getElementById('dwName');
    nameInput.value = 'A';
    nameInput.dispatchEvent(new Event('input'));

    clickNext();

    expect(document.getElementById('dwNameErr').hidden).toBe(false);
    expect(document.getElementById('dwName')).not.toBeNull();
  });

  test('Next on Basics step is blocked when age group not selected', () => {
    const wizard = setupWizard();
    wizard.open();

    // Enter a valid name but skip age
    const nameInput = document.getElementById('dwName');
    nameInput.value = 'Buddy';
    nameInput.dispatchEvent(new Event('input'));

    clickNext();

    expect(document.getElementById('dwAgeErr').hidden).toBe(false);
    // Still on Basics (name input still there)
    expect(document.getElementById('dwName')).not.toBeNull();
  });

  test('Next on Basics step advances when name and age are valid', () => {
    const wizard = setupWizard();
    wizard.open();

    fillBasicsValid();
    clickNext();

    // Should now be on Breed step
    expect(document.getElementById('dwBreed')).not.toBeNull();
    expect(document.getElementById('dwName')).toBeNull();
  });

  test('Next on Breed step is blocked when breed not selected', () => {
    const wizard = setupWizard();
    wizard.open();

    fillBasicsValid();
    clickNext(); // → Breed step

    // Do not select breed; click Next
    document.querySelector('[data-key="fitness"][data-value="moderate"]').click();
    document.querySelector('[data-key="heatSensitivity"][data-value="some"]').click();
    clickNext();

    expect(document.getElementById('dwBreedErr').hidden).toBe(false);
    expect(document.getElementById('dwBreed')).not.toBeNull();
  });

  test('Next on Breed step is blocked when fitness not selected', () => {
    const wizard = setupWizard();
    wizard.open();

    fillBasicsValid();
    clickNext();

    // Select a valid breed (Other + name)
    const breedSelect = document.getElementById('dwBreed');
    breedSelect.value = '__other__';
    breedSelect.dispatchEvent(new Event('change'));
    const breedOther = document.getElementById('dwBreedOther');
    breedOther.value = 'Poodle';
    breedOther.dispatchEvent(new Event('input'));
    // Skip fitness, select heat
    document.querySelector('[data-key="heatSensitivity"][data-value="some"]').click();
    clickNext();

    expect(document.getElementById('dwFitnessErr').hidden).toBe(false);
  });

  test('Next on Breed step advances with valid breed, fitness, heat', () => {
    const wizard = setupWizard();
    wizard.open();

    fillBasicsValid();
    clickNext();
    fillBreedValid();
    clickNext();

    // Should now be on Health step
    expect(document.getElementById('dwConditions')).not.toBeNull();
  });

  test('Health step has no required fields — Next always advances', () => {
    const wizard = setupWizard();
    wizard.open();

    fillBasicsValid();
    clickNext();
    fillBreedValid();
    clickNext(); // → Health
    clickNext(); // → Review (no validation barrier)

    // Should be on Review step
    expect(document.querySelector('.dw-review-card')).not.toBeNull();
  });
});

// ============================================================
// 2. Draft save / resume / clear
// ============================================================

describe('Draft behaviour', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  test('Closing with dirty data (isDirty=true) shows close-confirm view', () => {
    const wizard = setupWizard();
    wizard.open();

    // Type a name to make data dirty
    const nameInput = document.getElementById('dwName');
    nameInput.value = 'Rex';
    nameInput.dispatchEvent(new Event('input'));

    // Click close button
    document.getElementById('dwCloseBtn').click();

    // Should see the save-draft confirmation UI
    expect(document.getElementById('dwSaveDraftBtn')).not.toBeNull();
    // Overlay should still be open
    expect(document.getElementById('dogWizard').hidden).toBe(false);
  });

  test('Save draft button persists data to localStorage and closes modal', () => {
    const wizard = setupWizard();
    wizard.open();

    const nameInput = document.getElementById('dwName');
    nameInput.value = 'Rex';
    nameInput.dispatchEvent(new Event('input'));

    // Trigger close-confirm
    document.getElementById('dwCloseBtn').click();

    // Click "Save draft"
    document.getElementById('dwSaveDraftBtn').click();

    // Modal should be closed
    expect(document.getElementById('dogWizard').hidden).toBe(true);

    // Draft should be in localStorage
    const keys = Object.keys(localStorage);
    expect(keys.some(k => k.startsWith('dolopaws-dog-draft'))).toBe(true);

    const raw    = localStorage.getItem(keys.find(k => k.startsWith('dolopaws-dog-draft')));
    const parsed = JSON.parse(raw);
    expect(parsed.data.name).toBe('Rex');
  });

  test('Discard & close removes draft and closes modal', () => {
    const wizard = setupWizard();
    wizard.open();

    const nameInput = document.getElementById('dwName');
    nameInput.value = 'Rex';
    nameInput.dispatchEvent(new Event('input'));

    document.getElementById('dwCloseBtn').click();

    // Pre-save a draft so we can verify it gets cleared
    const key = 'dolopaws-dog-draft';
    localStorage.setItem(key, JSON.stringify({ data: { name: 'Rex' }, step: 0, ts: Date.now() }));

    document.getElementById('dwDiscardCloseBtn').click();

    expect(document.getElementById('dogWizard').hidden).toBe(true);
    expect(localStorage.getItem(key)).toBeNull();
  });

  test('Opening when draft exists shows draft-prompt view', () => {
    const key = 'dolopaws-dog-draft';
    localStorage.setItem(key, JSON.stringify({
      data: { name: 'Fido', ageGroup: 'adult', breed: '', breedOther: '',
              fitness: '', heatSensitivity: '', dogSex: '', spayed: '',
              conditions: '', allergies: '', medications: '' },
      step: 1,
      ts: Date.now(),
    }));

    const wizard = setupWizard();
    wizard.open();

    // Title should indicate draft prompt
    expect(document.getElementById('dwTitle').textContent).toBe('Resume your draft?');
    expect(document.getElementById('dwResumeDraftBtn')).not.toBeNull();
    expect(document.getElementById('dwStartOverBtn')).not.toBeNull();
  });

  test('Resume draft restores saved data and step', () => {
    const key = 'dolopaws-dog-draft';
    localStorage.setItem(key, JSON.stringify({
      data: { name: 'Fido', ageGroup: 'adult', breed: 'Beagle',
              breedOther: '', fitness: 'moderate', heatSensitivity: 'some',
              dogSex: '', spayed: '', conditions: '', allergies: '', medications: '' },
      step: 2,
      ts: Date.now(),
    }));

    const wizard = setupWizard();
    wizard.open();

    // Click "Resume draft"
    document.getElementById('dwResumeDraftBtn').click();

    // Should be on Health step (step index 2)
    expect(document.getElementById('dwConditions')).not.toBeNull();
  });

  test('Start over clears draft and starts from step 1', () => {
    const key = 'dolopaws-dog-draft';
    localStorage.setItem(key, JSON.stringify({
      data: { name: 'Fido', ageGroup: 'adult', breed: '', breedOther: '',
              fitness: '', heatSensitivity: '', dogSex: '', spayed: '',
              conditions: '', allergies: '', medications: '' },
      step: 1,
      ts: Date.now(),
    }));

    const wizard = setupWizard();
    wizard.open();

    document.getElementById('dwStartOverBtn').click();

    // Draft should be cleared
    expect(localStorage.getItem(key)).toBeNull();

    // Should be back at the first step (Basics)
    expect(document.getElementById('dwName')).not.toBeNull();
    expect(document.getElementById('dwName').value).toBe('');
  });

  test('Stale draft (> 7 days) is ignored', () => {
    const key = 'dolopaws-dog-draft';
    const eightDaysAgo = Date.now() - 8 * 86400 * 1000;
    localStorage.setItem(key, JSON.stringify({
      data: { name: 'OldDog', ageGroup: 'adult', breed: '', breedOther: '',
              fitness: '', heatSensitivity: '', dogSex: '', spayed: '',
              conditions: '', allergies: '', medications: '' },
      step: 0,
      ts: eightDaysAgo,
    }));

    const wizard = setupWizard();
    wizard.open();

    // Should go directly to form (step 1), not draft-prompt
    expect(document.getElementById('dwName')).not.toBeNull();
    expect(document.getElementById('dwResumeDraftBtn')).toBeNull();
  });

  test('Closing without dirty data closes immediately (no confirm prompt)', () => {
    const wizard = setupWizard();
    wizard.open();

    // Do not type anything — isDirty stays false
    document.getElementById('dwCloseBtn').click();

    expect(document.getElementById('dogWizard').hidden).toBe(true);
    expect(document.getElementById('dwSaveDraftBtn')).toBeNull();
  });
});

// ============================================================
// 3. Successful submit flow
// ============================================================

describe('Successful submit flow', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  test('Save dog dispatches dolopaws-dog-profile-saved event with correct profile', () => {
    const wizard = setupWizard();
    wizard.open();

    let receivedProfile = null;
    window.addEventListener('dolopaws-dog-profile-saved', (e) => {
      receivedProfile = e.detail.profile;
    }, { once: true });

    fillBasicsValid();
    clickNext(); // → Breed
    fillBreedValid();
    clickNext(); // → Health
    clickNext(); // → Review

    // Click "Save dog"
    clickNext();

    expect(receivedProfile).not.toBeNull();
    expect(receivedProfile.name).toBe('Buddy');
    expect(receivedProfile.ageGroup).toBe('adult');
    expect(receivedProfile.fitness).toBe('moderate');
    expect(receivedProfile.heatSensitivity).toBe('some');
    // breed resolved from breedOther since DOG_BREEDS is not loaded in tests
    expect(receivedProfile.breed).toBe('Labrador Mix');
  });

  test('Save dog closes the modal', () => {
    const wizard = setupWizard();
    wizard.open();

    fillBasicsValid();
    clickNext();
    fillBreedValid();
    clickNext();
    clickNext(); // Health → Review
    clickNext(); // Save

    expect(document.getElementById('dogWizard').hidden).toBe(true);
  });

  test('Save dog clears any saved draft', () => {
    // Pre-save a draft
    const key = 'dolopaws-dog-draft';
    localStorage.setItem(key, JSON.stringify({
      data: { name: 'Buddy', ageGroup: 'adult', breed: '', breedOther: '',
              fitness: '', heatSensitivity: '', dogSex: '', spayed: '',
              conditions: '', allergies: '', medications: '' },
      step: 0,
      ts: Date.now(),
    }));

    const wizard = setupWizard();
    // Start over to bypass draft-prompt
    wizard.open();
    document.getElementById('dwStartOverBtn').click();

    fillBasicsValid();
    clickNext();
    fillBreedValid();
    clickNext();
    clickNext(); // Health → Review
    clickNext(); // Save

    // Draft should be gone
    expect(localStorage.getItem(key)).toBeNull();
  });

  test('Save dog shows a toast notification', () => {
    const wizard = setupWizard();
    wizard.open();

    fillBasicsValid();
    clickNext();
    fillBreedValid();
    clickNext();
    clickNext();
    clickNext();

    const toast = document.getElementById('dwToast');
    expect(toast.hidden).toBe(false);
    expect(toast.textContent).toContain('Buddy');
  });

  test('Editing existing dog populates form fields', () => {
    const wizard = setupWizard();
    const existingDog = {
      name: 'Max', ageGroup: 'senior', breed: 'Beagle',
      fitness: 'low', heatSensitivity: 'high',
    };
    wizard.open(existingDog);

    const nameInput = document.getElementById('dwName');
    expect(nameInput.value).toBe('Max');

    // Senior should be selected
    const seniorBtn = document.querySelector('[data-key="ageGroup"][data-value="senior"]');
    expect(seniorBtn.classList.contains('selected')).toBe(true);
  });

  test('Editing does not show draft-prompt even when draft exists', () => {
    const key = 'dolopaws-dog-draft';
    localStorage.setItem(key, JSON.stringify({
      data: { name: 'Fido', ageGroup: 'adult', breed: '', breedOther: '',
              fitness: '', heatSensitivity: '', dogSex: '', spayed: '',
              conditions: '', allergies: '', medications: '' },
      step: 0,
      ts: Date.now(),
    }));

    const wizard = setupWizard();
    wizard.open({ name: 'Max', ageGroup: 'adult', breed: '',
                  fitness: 'high', heatSensitivity: 'any' });

    // Should go straight to form, not draft-prompt
    expect(document.getElementById('dwName').value).toBe('Max');
    expect(document.getElementById('dwResumeDraftBtn')).toBeNull();
  });
});
