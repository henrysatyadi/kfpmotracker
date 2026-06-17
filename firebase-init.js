import { firebaseConfig } from './firebase-config.js';
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import {
  getAuth, onAuthStateChanged, signInWithEmailAndPassword,
  createUserWithEmailAndPassword, signOut, updateProfile
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import {
  getFirestore, doc, getDoc, setDoc, updateDoc, onSnapshot,
  collection, getDocs
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const SHARED_DOC = doc(db, 'pmoData', 'shared');
let lastWrittenSaved = null;
let currentProfile = null; // {uid,name,email,role,active}
let unsubData = null;

const TAB_DRAW = { dashboard: 'drawDash', cases: 'drawList', revisit: 'drawRevisit', contacts: 'drawContacts', settings: 'drawSettings', sync: 'drawSync' };

function rerenderCurrentTab() {
  const onSec = document.querySelector('.sec.on');
  const name = onSec ? onSec.id.replace('sec-', '') : 'dashboard';
  const fn = window[TAB_DRAW[name] || 'drawDash'];
  if (typeof fn === 'function') fn();
}

function showLogin(err) {
  document.getElementById('app-root').style.display = 'none';
  document.getElementById('login-screen').style.display = 'flex';
  const e = document.getElementById('login-error');
  e.textContent = err || '';
  e.style.display = err ? 'block' : 'none';
}

async function showApp() {
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('app-root').style.display = '';
  paintUserBadge();
  if (unsubData) unsubData();
  unsubData = onSnapshot(SHARED_DOC, async (snap) => {
    if (!snap.exists()) {
      lastWrittenSaved = window.SEED._saved = new Date().toISOString();
      await setDoc(SHARED_DOC, JSON.parse(JSON.stringify(window.SEED)));
      return;
    }
    const data = snap.data();
    if (data._saved && data._saved === lastWrittenSaved) return; // echo of our own write
    window.D = data;
    window.normalizeData();
    window.updateSavedLbl();
    rerenderCurrentTab();
  });
}

function paintUserBadge() {
  const el = document.getElementById('sb-user-badge');
  if (!el || !currentProfile) return;
  el.innerHTML = `<div style="font-size:12px;font-weight:600">${currentProfile.name || currentProfile.email}</div>
    <div style="font-size:10px;color:var(--text3);text-transform:capitalize">${currentProfile.role}</div>`;
  document.querySelectorAll('.admin-only').forEach(n => n.style.display = currentProfile.role === 'admin' ? '' : 'none');
}

async function loadOrCreateProfile(user, fallbackName, fallbackRole) {
  const ref = doc(db, 'users', user.uid);
  const snap = await getDoc(ref);
  if (snap.exists()) {
    currentProfile = { uid: user.uid, ...snap.data() };
  } else {
    currentProfile = {
      uid: user.uid,
      name: fallbackName || user.email,
      email: user.email,
      role: fallbackRole || 'pm',
      active: true
    };
    await setDoc(ref, { name: currentProfile.name, email: currentProfile.email, role: currentProfile.role, active: true });
  }
  window.pmoCurrentUser = currentProfile;
  if (window.D) window.D.editor = currentProfile.name;
}

onAuthStateChanged(auth, async (user) => {
  if (user) {
    await loadOrCreateProfile(user);
    await showApp();
  } else {
    currentProfile = null;
    window.pmoCurrentUser = null;
    if (unsubData) { unsubData(); unsubData = null; }
    showLogin();
  }
});

window.pmoAuth = {
  async signIn() {
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (e) {
      showLogin(friendlyAuthError(e));
    }
  },
  async register() {
    const name = document.getElementById('reg-name').value.trim();
    const email = document.getElementById('reg-email').value.trim();
    const password = document.getElementById('reg-password').value;
    const role = document.getElementById('reg-role').value;
    if (!name || !email || !password) { showLogin('Fill in all fields to register.'); return; }
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(cred.user, { displayName: name });
      await loadOrCreateProfile(cred.user, name, role);
      await showApp();
    } catch (e) {
      showLogin(friendlyAuthError(e));
    }
  },
  async signOut() {
    await signOut(auth);
  }
};

function friendlyAuthError(e) {
  const map = {
    'auth/invalid-email': 'Invalid email address.',
    'auth/user-not-found': 'No account with that email.',
    'auth/wrong-password': 'Incorrect password.',
    'auth/invalid-credential': 'Incorrect email or password.',
    'auth/email-already-in-use': 'An account with that email already exists.',
    'auth/weak-password': 'Password should be at least 6 characters.'
  };
  return map[e.code] || e.message;
}

// Admin: list all users / change roles (Settings → Users panel).
window.pmoAdmin = {
  async listUsers() {
    const snap = await getDocs(collection(db, 'users'));
    return snap.docs.map(d => ({ uid: d.id, ...d.data() }));
  },
  async setRole(uid, role) {
    await updateDoc(doc(db, 'users', uid), { role });
  },
  async setActive(uid, active) {
    await updateDoc(doc(db, 'users', uid), { active });
  }
};

// Hook used by the app's save() to push the in-memory D object to Firestore in real time.
window.pmoCloudSave = function () {
  if (!currentProfile) return;
  lastWrittenSaved = window.D._saved;
  setDoc(SHARED_DOC, JSON.parse(JSON.stringify(window.D))).catch(console.error);
};
