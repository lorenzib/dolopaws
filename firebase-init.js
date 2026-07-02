// ============================================================
// FIREBASE CONFIG — replace this whole object with the one from
// Firebase Console → Project settings → General → Your apps → Web app
// It will look like the shape below, just with real values instead
// of the placeholder strings.
// ============================================================
const firebaseConfig = {
  apiKey: "AIzaSyDnEJKnoDltKwpl4QdhA-qLH3a4ugLd68M",
  authDomain: "dolopaws.firebaseapp.com",
  projectId: "dolopaws",
  storageBucket: "dolopaws.firebasestorage.app",
  messagingSenderId: "331415525455",
  appId: "1:331415525455:web:4a714eea0e95dc9a4ff23a",
  measurementId: "G-LDBKZZDJ2G"
};

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import {
  getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword,
  signOut as fbSignOut, onAuthStateChanged, GoogleAuthProvider, signInWithPopup,
  sendPasswordResetEmail, deleteUser, reauthenticateWithCredential,
  EmailAuthProvider, reauthenticateWithPopup
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import {
  getFirestore, doc, getDoc, setDoc, deleteDoc
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();

let currentUser = null;
const changeListeners = [];

onAuthStateChanged(auth, (user) => {
  currentUser = user;
  changeListeners.forEach(fn => fn(user));
});

async function getFavorites() {
  if (!currentUser) return {};
  try {
    const snap = await getDoc(doc(db, "users", currentUser.uid));
    return snap.exists() ? (snap.data().favorites || {}) : {};
  } catch (e) {
    console.error("Failed to load favorites:", e);
    return {};
  }
}

async function setFavorites(favoritesObj) {
  if (!currentUser) return false;
  try {
    await setDoc(doc(db, "users", currentUser.uid), { favorites: favoritesObj }, { merge: true });
    return true;
  } catch (e) {
    console.error("Failed to save favorites:", e);
    return false;
  }
}

async function getDogProfile() {
  if (!currentUser) return null;
  try {
    const snap = await getDoc(doc(db, "users", currentUser.uid));
    return snap.exists() ? (snap.data().dog || null) : null;
  } catch (e) {
    console.error("Failed to load dog profile:", e);
    return null;
  }
}

async function setDogProfile(dogObj) {
  if (!currentUser) return false;
  try {
    await setDoc(doc(db, "users", currentUser.uid), { dog: dogObj }, { merge: true });
    return true;
  } catch (e) {
    console.error("Failed to save dog profile:", e);
    return false;
  }
}

function friendlyError(code) {
  const map = {
    "auth/email-already-in-use": "That email already has an account — try logging in instead.",
    "auth/invalid-email": "That email address doesn't look right.",
    "auth/weak-password": "Password should be at least 6 characters.",
    "auth/user-not-found": "No account found with that email.",
    "auth/wrong-password": "Incorrect password.",
    "auth/invalid-credential": "Incorrect email or password.",
    "auth/popup-closed-by-user": "Google sign-in was closed before finishing.",
    "auth/requires-recent-login": "For security, please confirm your identity again before this action.",
  };
  return map[code] || "Something went wrong — please try again.";
}

async function deleteAccount(password) {
  if (!currentUser) return { ok: false, message: "Not logged in." };
  const providerId = currentUser.providerData[0] && currentUser.providerData[0].providerId;
  try {
    if (providerId === "google.com") {
      await reauthenticateWithPopup(currentUser, googleProvider);
    } else {
      if (!password) return { ok: false, message: "Enter your password to confirm." };
      const credential = EmailAuthProvider.credential(currentUser.email, password);
      await reauthenticateWithCredential(currentUser, credential);
    }
    await deleteDoc(doc(db, "users", currentUser.uid));
    await deleteUser(currentUser);
    return { ok: true };
  } catch (e) {
    return { ok: false, message: friendlyError(e.code) };
  }
}

window.DoloPawsAuth = {
  get currentUser() { return currentUser; },
  onChange(fn) { changeListeners.push(fn); if (currentUser !== null || auth.currentUser !== undefined) fn(currentUser); },
  getFavorites,
  setFavorites,
  getDogProfile,
  setDogProfile,
  deleteAccount,
  async signUp(email, password) {
    try {
      await createUserWithEmailAndPassword(auth, email, password);
      return { ok: true };
    } catch (e) {
      return { ok: false, message: friendlyError(e.code) };
    }
  },
  async signIn(email, password) {
    try {
      await signInWithEmailAndPassword(auth, email, password);
      return { ok: true };
    } catch (e) {
      return { ok: false, message: friendlyError(e.code) };
    }
  },
  async signInGoogle() {
    try {
      await signInWithPopup(auth, googleProvider);
      return { ok: true };
    } catch (e) {
      return { ok: false, message: friendlyError(e.code) };
    }
  },
  async logOut() {
    await fbSignOut(auth);
  },
  async resetPassword(email) {
    try {
      await sendPasswordResetEmail(auth, email);
      return { ok: true };
    } catch (e) {
      return { ok: false, message: friendlyError(e.code) };
    }
  },
};

window.dispatchEvent(new CustomEvent('dolopaws-auth-ready'));
