const path = require('path');

const modulePath = path.join(__dirname, 'guest-session.js');

function loadGuestSession(){
  jest.resetModules();
  delete window.DoloPawsGuestSession;
  return require(modulePath);
}

describe('guest session helpers', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    window.dataLayer = [];
  });

  test('tracks the first guest action only once per session', () => {
    const session = loadGuestSession();
    const events = [];
    window.addEventListener('dolopaws-analytics', (event) => {
      events.push(event.detail);
    });

    expect(session.trackFirstGuestAction('try_trails_clicked', { source: 'heroTryBtn' })).toBe(true);
    expect(session.trackFirstGuestAction('trail_saved', { trailId: 't1' })).toBe(false);

    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({
      eventName: 'guest_first_meaningful_action',
      detail: {
        action: 'try_trails_clicked',
        source: 'heroTryBtn',
      },
    });
    expect(window.dataLayer).toContainEqual({
      event: 'guest_first_meaningful_action',
      action: 'try_trails_clicked',
      source: 'heroTryBtn',
    });
  });

  test('remembers and consumes pending auth action context', () => {
    const session = loadGuestSession();
    const action = { type: 'unlock-results', returnTo: 'results' };

    session.rememberPendingAuthAction(action);

    expect(session.consumePendingAuthAction()).toEqual(action);
    expect(session.consumePendingAuthAction()).toBeNull();
  });

  test('persists guest trail context for later restore', () => {
    const session = loadGuestSession();

    session.rememberGuestTrailContext({ trailId: 'alta-badia' });

    expect(session.loadGuestTrailContext()).toEqual({ trailId: 'alta-badia' });
  });
});
