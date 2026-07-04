# DoloPaws

## Homepage: split-hero experience

The deployed homepage (`index.html`) renders an auth-based split-hero:

- **Logged out / auth unavailable (default)** → new-customer hero (`#newCustomerHomepage`):
  Compact horizontal strip with a heading, short tagline, and two CTAs (create a dog profile / log in).

- **Logged in** → returning-customer hero (`#returningCustomerHomepage`):
  Welcome-back banner addressed to the user's display name, with quick-action links (saved trails, past hikes, edit profile).

### How auth switching works

`homepage-view.js` runs on page load and again on every `dolopaws-auth-changed` event (dispatched by `auth-ui.js` when Firebase reports an auth state change).

View selection priority:

1. **`?view=new` or `?view=returning` URL param** — dev override only, for testing without a real account.
2. **`DoloPawsAuth.currentUser`** — logged in → returning hero; logged out / unavailable → new-customer hero.

The safe fallback is always the new-customer view (no flash of wrong content, no auth dependency at render time).

### File overview

| File | Role |
|---|---|
| `index.html` | Deployed homepage — contains both hero sections |
| `homepage-view.js` | Auth-based view selection + DOM updates |
| `homepage-view.test.js` | Jest tests for view switching logic |
| `styles.css` | Shared styles including split-hero preview panel |
| `guest-session.js` | Guest analytics + pending auth/restore helpers |
| `auth-ui.js` | Auth modal + dispatches `dolopaws-auth-changed` and contextual success events |
| `firebase-init.js` | Firebase init + exposes `window.DoloPawsAuth` |

### Prior prototype file

`DoloPaws Homepage - Split Hero.html` (repo root) is the original design-tool export that inspired this implementation. It is not linked from the deployed site — the live experience is wired directly into `index.html`.

### Manual test steps

| Scenario | Expected |
|---|---|
| Open site while logged out | New-customer split-hero is shown; account button reads "Log in" |
| Open site while logged in | Returning-customer banner shows with your display name; account button reads "My account" |
| Log out via account page | Page re-renders to new-customer hero on next visit |
| Open `/?view=returning` while logged out | Returning hero shown (dev override) |
| Open `/?view=new` while logged in | New-customer hero shown (dev override) |
| JavaScript disabled or auth load fails | New-customer hero remains visible (safe default) |
