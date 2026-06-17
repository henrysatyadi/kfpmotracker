# PMO Tracker

A web-based project tracker for KF PMO: pipeline/pitching, awarded projects, payment
milestones, stage gates, contacts, and reporting. Multiple teammates can sign in at
once and see each other's changes live.

## Architecture

- `index.html` — the entire app UI and business logic (single page app, no build step).
- `firebase-config.js` — your Firebase project's public web config. **You must fill this in.**
- `firebase-init.js` — auth (login/register/sign-out), and the real-time data layer that
  replaces local-only storage: the whole dataset lives in one Firestore document
  (`pmoData/shared`) and is pushed to every signed-in browser instantly via `onSnapshot`.
- `firestore.rules` — security rules: only signed-in users can read/write tracker data;
  only admins can change another user's role.

Each browser also keeps a `localStorage` copy as an offline cache, but Firestore is the
source of truth once you're signed in.

## One-time setup

1. **Create a Firebase project** at https://console.firebase.google.com (free Spark plan
   is enough for a small team).
2. **Enable Authentication** → Sign-in method → enable **Email/Password**.
3. **Create a Firestore database** → start in production mode, pick a region.
4. **Deploy the security rules**: Firestore → Rules tab → paste the contents of
   `firestore.rules` → Publish.
5. **Register a Web app**: Project settings → General → "Your apps" → Add app → Web.
   Copy the `firebaseConfig` object it gives you into `firebase-config.js`, replacing the
   placeholder values.
6. **Host it.** This is a static site (HTML/CSS/JS, no server/build step needed), so any
   static host works:
   - `firebase deploy` with Firebase Hosting (simplest, same project as your DB), or
   - Netlify / Vercel / GitHub Pages / your own web server — just upload `index.html`,
     `firebase-config.js`, and `firebase-init.js` together.

## Using it

- First visit shows a login screen. Click **Create an account**, enter your name/email/
  password and pick a role (Project Manager, Director, or Admin), then sign in.
- Anyone signed in can view and edit the shared tracker — edits sync to every other open
  browser within a second or two.
- Admins get a **Team & roles** panel under Settings to promote/demote teammates or
  deactivate an account.
- "Reset to sample data" under Settings → Data wipes the shared dataset for **everyone** —
  use with care.

## Notes / limitations

- Roles (PM/Director/Admin) gate the admin user-management panel; the underlying case data
  itself is shared/editable by all signed-in users, matching how the original single-file
  version was designed to be shared across a small team.
- There's no granular per-field conflict resolution — the last save wins, same trade-off as
  the original "export/import JSON" workflow, just automatic and live instead of manual.
