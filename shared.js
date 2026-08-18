/*
 * Was alle Seiten brauchen: die Verbindung zu Firebase, und die Weitergabe der
 * Rechenlogik aus logic.js.
 *
 * Das Firebase-SDK kommt direkt von Google, ohne Bauschritt und ohne
 * Paketverwaltung. Die Seite laesst sich damit lesen, wie sie ausgeliefert wird.
 */
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import {
  getAuth, onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut,
  setPersistence, browserLocalPersistence,
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import {
  getFirestore, doc, getDoc, setDoc, deleteDoc, collection, getDocs, query, where,
  onSnapshot,
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { firebaseConfig, isConfigured } from "./firebase-config.js";

export {
  ID_LENGTH, parseId, today, cutoffDate, buildLeaderboard, buildComparison,
} from "./logic.js";

let app = null;
let authReady = null;

/**
 * Verbindet mit Firebase.
 *
 * `browserLocalPersistence` wird ausdruecklich gesetzt statt sich auf die
 * Standardwahl des SDK zu verlassen. Ohne funktionierendes IndexedDB - blockiert
 * durch strengen Tracking-Schutz, eine Erweiterung oder privates Surfen -
 * faellt Firebase sonst still auf reinen Arbeitsspeicher zurueck: Die Anmeldung
 * wirkt, ueberlebt aber keinen einzigen Seitenwechsel, weil diese Seite ohne
 * Bauschritt keine einzelne Seite ist, sondern bei jedem Link neu laedt. Genau
 * das sah aus wie "nach der Startseite wieder der Anmeldebildschirm".
 *
 * `authReady` haelt fest, ob das gelungen ist, damit `waitForAuth()` weiss,
 * wann der erste Zustand wirklich feststeht statt nur "noch nicht null".
 */
export function firebase() {
  if (!isConfigured) return null;
  if (!app) {
    app = initializeApp(firebaseConfig);
    const auth = getAuth(app);
    authReady = setPersistence(auth, browserLocalPersistence).catch(() => {
      // Auch wenn das Setzen scheitert, soll die Seite nutzbar bleiben - nur
      // eben ohne die Garantie, dass eine Anmeldung einen Reload uebersteht.
    });
  }
  return {
    auth: getAuth(app),
    db: getFirestore(app),
  };
}

/** Wartet, bis die Persistenz eingerichtet ist, bevor der erste Zustand zaehlt. */
export function waitForAuth() {
  return authReady ?? Promise.resolve();
}

export {
  isConfigured, onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut,
  doc, getDoc, setDoc, deleteDoc, collection, getDocs, query, where, onSnapshot,
};
