/*
 * Training ohne Konto.
 *
 * Dieselbe Grundidee wie die App: Solange niemand ein Konto verbindet, verlässt
 * kein Byte das Gerät. Hier heißt "Gerät" eben dieser Browser, und
 * localStorage steht an der Stelle, an der die App eine lokale Datenbank hat.
 */

const PROFILE_KEY = "liegestuetzen.guest.profile";
const SESSIONS_KEY = "liegestuetzen.guest.sessions";

const DEFAULT_PROFILE = {
  level: 1,
  goalReps: 100,
  levelStartedAt: 0,
  hasChosenLevel: false,
  lastTestResult: 0,
  restSeconds: 90,
  restSecondsUpdatedAt: 0,
  updatedAt: 0,
};

export function loadGuestProfile() {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    return raw ? { ...DEFAULT_PROFILE, ...JSON.parse(raw) } : { ...DEFAULT_PROFILE };
  } catch {
    return { ...DEFAULT_PROFILE };
  }
}

export function saveGuestProfile(profile) {
  try {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  } catch {
    // Voller oder gesperrter Speicher - das Training laeuft trotzdem weiter,
    // nur eben ohne dass dieser Stand ueberlebt.
  }
}

export function loadGuestSessions() {
  try {
    const raw = localStorage.getItem(SESSIONS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveGuestSessions(sessions) {
  try {
    localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
  } catch {
    // s.o.
  }
}

/** Ob es etwas gibt, das beim Anmelden verloren ginge, wenn niemand es mitnimmt. */
export function hasGuestData() {
  return loadGuestSessions().length > 0 || loadGuestProfile().hasChosenLevel;
}

/** Nach dem Mitnehmen ins Konto ist der Gastzustand nur noch eine Kopie. */
export function clearGuestData() {
  localStorage.removeItem(PROFILE_KEY);
  localStorage.removeItem(SESSIONS_KEY);
}
