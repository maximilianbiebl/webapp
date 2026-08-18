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
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import {
  getFirestore, doc, getDoc, setDoc, deleteDoc, collection, getDocs, query, where,
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { firebaseConfig, isConfigured } from "./firebase-config.js";

export {
  ID_LENGTH, parseId, today, cutoffDate, buildLeaderboard, buildComparison,
} from "./logic.js";

let app = null;
export function firebase() {
  if (!isConfigured) return null;
  if (!app) app = initializeApp(firebaseConfig);
  return {
    auth: getAuth(app),
    db: getFirestore(app),
  };
}

export {
  isConfigured, onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut,
  doc, getDoc, setDoc, deleteDoc, collection, getDocs, query, where,
};
