/*
 * Die Webversion.
 *
 * Vier Reiter wie in der App: Training, Freunde, Gruppen, Verlauf. Innerhalb
 * von Freunde und Gruppen kann man in eine Gruppe oder einen Vergleich
 * hineingehen - dieselbe Vorstellung wie die zwei zusaetzlichen Bildschirme
 * (GroupDetailScreen, FriendDetailScreen), die die App auf den Stapel legt.
 *
 * Kein Bauschritt, keine Abhaengigkeiten ausser dem Firebase-SDK direkt von
 * Google. Die Datei laesst sich lesen wie sie ausgeliefert wird.
 */
import {
  firebase, isConfigured, onAuthStateChanged, signInWithPopup, GoogleAuthProvider,
  signOut, doc, getDoc, setDoc, deleteDoc, collection, getDocs, query, where,
  onSnapshot, parseId, buildLeaderboard, buildComparison, ID_LENGTH, today, waitForAuth,
} from "../shared.js";
import { ask, say, askForText } from "./dialogs.js";
import { LEVEL_COUNT, levelReps, levelTotal, goalProgress, suggestLevel } from "../levels.js";
import { statistics, totalReps, bestSet } from "../stats.js";
import { runWorkout } from "./training.js";
import {
  loadGuestProfile, saveGuestProfile, loadGuestSessions, saveGuestSessions,
  hasGuestData, clearGuestData,
} from "./local.js";
import { t, getLanguage, wireLanguagePicker } from "../strings.js";

const $ = (id) => document.getElementById(id);
const show = (el, visible) => el.classList.toggle("hidden", !visible);
const escape = (text) => String(text ?? "").replace(/[&<>"']/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/** Formatiert Sekunden als m:ss - dieselbe Darstellung wie formatDuration() in der App. */
function formatDuration(seconds) {
  const minutes = Math.floor(seconds / 60);
  const remaining = seconds % 60;
  return `${minutes}:${String(remaining).padStart(2, "0")}`;
}

/**
 * Uebersetzt jedes Element mit data-i18n neu - beim Laden und jedesmal, wenn
 * sich die Sprache aendert. Text, der von main.js selbst gesetzt wird (Level,
 * Zahlen, Dialoge), zieht seine Uebersetzung direkt aus t() und braucht diesen
 * Umweg nicht.
 */
function applyTranslations() {
  document.documentElement.lang = getLanguage() === "en" ? "en" : "de";
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const text = t(el.dataset.i18n);
    el.textContent = text;
    if (el.dataset.i18nAttr) el.setAttribute(el.dataset.i18nAttr, text);
  });
}

wireLanguagePicker($("langBtn"));

window.addEventListener("liegestuetzen:language", () => {
  applyTranslations();
  if (me || guestMode) {
    renderTraining();
    renderQuickStats();
    renderFullHistory();
  }
  render();
});
applyTranslations();

const params = new URLSearchParams(location.search);
let fb = null;
let me = null;
let displayName = "";
let range = 7;
let sort = "reps";
/**
 * Ohne Konto weiterkommen, genau wie die App es standardmaessig tut: Level
 * waehlen, trainieren, Satzpause einstellen - nur eben ohne dass ein einziges
 * Byte den Browser verlaesst. Freunde und Gruppen bleiben dabei gesperrt, denn
 * die brauchen zwangslaeufig ein Konto.
 */
let guestMode = false;
/** Das eigene Programm und der eigene Verlauf, so wie sie in der Cloud liegen (oder lokal, als Gast). */
let profile = { level: 1, goalReps: 100, restSeconds: 90, updatedAt: 0 };
let sessions = [];

/**
 * Wo man gerade ist. `detail` legt sich ueber einen Reiter, so wie die App
 * GroupDetailScreen und FriendDetailScreen ueber den Reiter Gruppen bzw.
 * Freunde legt - der Reiter darunter bleibt derselbe, nur sichtbar ist er
 * nicht.
 */
const state = {
  tab: "training",
  detail: null, // null | { type: "group", id } | { type: "friend", pairId }
};

const TAB_TITLE_KEYS = {
  training: "tabTraining",
  friends: "tabFriends",
  groups: "tabGroups",
  history: "tabHistory",
};

if (params.get("code") || params.get("join") || params.get("invite")) {
  // Sonst steht da nur "Anmelden", und warum, weiss niemand.
  const note = document.createElement("p");
  note.className = "hint";
  note.textContent = t("signInInviteHint");
  $("signIn").prepend(note);
}

if (!isConfigured) {
  show($("authLoading"), false);
  show($("unconfigured"), true);
} else {
  fb = firebase();
  // Erst pruefen, ob die Anmeldung ueberhaupt einen Reload uebersteht, dann
  // auf den ersten echten Zustand warten - sonst blitzt "Anmelden" auf, bevor
  // die gespeicherte Sitzung ueberhaupt eine Chance hatte zu antworten.
  waitForAuth().then(() => {
    onAuthStateChanged(fb.auth, (user) => {
      me = user;
      if (user) guestMode = false;
      show($("authLoading"), false);
      show($("signInScreen"), !user && !guestMode);
      show($("shell"), Boolean(user) || guestMode);
      if (user) start();
    });
  });
}

$("google").addEventListener("click", () => signInWithGoogle());

/**
 * Weiter ohne Konto - dieselbe Voreinstellung wie beim ersten Start der App.
 * Kein einziger Firebase-Aufruf hier: Wer nur trainiert, soll nie am Netzwerk
 * haengen.
 */
$("guestBtn").addEventListener("click", () => {
  guestMode = true;
  show($("signInScreen"), false);
  show($("shell"), true);
  start();
});

async function signInWithGoogle() {
  try {
    await signInWithPopup(fb.auth, new GoogleAuthProvider());
  } catch (error) {
    const box = $("signInError");
    box.textContent = t("signInFailed", error.code || error.message);
    show(box, true);
  }
}

/* --------------------------------------------------------------- Navigation */

function setTab(tab) {
  state.tab = tab;
  state.detail = null;
  render();
}

function openDetail(detail) {
  state.detail = detail;
  render();
}

function closeDetail() {
  state.detail = null;
  render();
}

document.querySelectorAll(".navitem").forEach((button) =>
  button.addEventListener("click", () => setTab(button.dataset.tab)));

$("backBtn").addEventListener("click", closeDetail);
$("toHistory").addEventListener("click", () => setTab("history"));

/**
 * Zeigt genau ein Panel, setzt Titel und Zurueck-Pfeil, und laedt bei Bedarf
 * das Detail nach. Reiter bleiben unter der Leiste verborgen, waehrend ein
 * Detail offen ist - dieselbe Logik wie die App, die die Reiterleiste beim
 * Aufruf von GroupDetailScreen/FriendDetailScreen gar nicht erst zeichnet.
 */
function render() {
  document.querySelectorAll(".navitem").forEach((button) =>
    button.setAttribute("aria-pressed", String(button.dataset.tab === state.tab)));

  const showingDetail = state.detail !== null;
  show($("backBtn"), showingDetail);
  $("accountBtn").classList.toggle("hidden", showingDetail);
  document.querySelector(".bottomnav").classList.toggle("hidden", showingDetail);

  ["training", "friends", "groups", "history"].forEach((tab) => {
    show($(`tab-${tab}`), !showingDetail && state.tab === tab);
  });
  show($("tab-detail"), showingDetail);

  if (!showingDetail) {
    $("topTitle").textContent = t(TAB_TITLE_KEYS[state.tab]);
    return;
  }
  $("topTitle").textContent = "…";
  if (state.detail.type === "group") drawGroupDetail(state.detail.id);
  else drawFriendDetail(state.detail.pairId);
}

/* ---------------------------------------------------------------- Daten */

const profileRef = () => doc(fb.db, "profiles", me.uid);
const membershipsRef = () => collection(fb.db, "users", me.uid, "memberships");

async function readMyProfile() {
  const snapshot = await getDoc(profileRef());
  return snapshot.exists() ? snapshot.data().displayName || "" : "";
}

const privateProfileRef = () => doc(fb.db, "users", me.uid, "private", "profile");
const sessionsRef = () => collection(fb.db, "users", me.uid, "sessions");

function toProfile(data) {
  return {
    level: data.level || 1,
    goalReps: data.goalReps || 100,
    levelStartedAt: data.levelStartedAt || 0,
    hasChosenLevel: data.hasChosenLevel || false,
    lastTestResult: data.lastTestResult || 0,
    restSeconds: data.restSeconds || 90,
    restSecondsUpdatedAt: data.restSecondsUpdatedAt || 0,
    updatedAt: data.updatedAt || 0,
  };
}

const EMPTY_PROFILE = toProfile({});

async function readOwnTraining() {
  const [profileDoc, sessionDocs] = await Promise.all([
    getDoc(privateProfileRef()),
    getDocs(sessionsRef()),
  ]);
  profile = profileDoc.exists() ? toProfile(profileDoc.data()) : { ...EMPTY_PROFILE };
  sessions = sessionDocs.docs.map((d) => ({
    id: d.id,
    timestampMillis: d.data().timestamp || 0,
    level: d.data().level || 1,
    plannedReps: d.data().plannedReps || [],
    actualReps: d.data().actualReps || [],
    durationSeconds: d.data().durationSeconds || 0,
  }));
}

/** Dasselbe wie readOwnTraining(), nur aus diesem Browser statt aus der Cloud. */
function readOwnTrainingGuest() {
  profile = loadGuestProfile();
  sessions = loadGuestSessions();
}

/**
 * Schreibt das Programm zurueck.
 *
 * Nur die Felder, die diese Seite ueberhaupt aendern kann. Was eine Seite
 * nicht bearbeitet, darf sie auch nicht schreiben - sonst hätte ein
 * Levelwechsel hier zum Beispiel das Ergebnis eines Maximaltests aus der App
 * mit geloescht.
 *
 * `updatedAt` entscheidet, welches Geraet gewonnen hat, wenn zwei dasselbe
 * geaendert haben - die App merkt sich das genauso.
 */
async function writeProfile() {
  if (guestMode) {
    profile.updatedAt = Date.now();
    profile.hasChosenLevel = true;
    saveGuestProfile(profile);
    return;
  }
  profile.updatedAt = Date.now();
  await setDoc(privateProfileRef(), {
    level: profile.level,
    levelStartedAt: profile.levelStartedAt || 0,
    goalReps: profile.goalReps,
    hasChosenLevel: true,
    updatedAt: profile.updatedAt,
  }, { merge: true });
}

/**
 * Die Satzpause, getrennt von writeProfile() geschrieben.
 *
 * Eigener Zeitstempel `restSecondsUpdatedAt`, genau wie
 * `restSecondsUpdatedAtMillis` in AppSettings.kt - ohne ihn liesse sich
 * zwischen zwei Geraeten nicht entscheiden, welche Einstellung neuer ist.
 */
async function writeRestSeconds(seconds) {
  profile.restSeconds = seconds;
  profile.restSecondsUpdatedAt = Date.now();
  if (guestMode) {
    saveGuestProfile(profile);
    return;
  }
  await setDoc(privateProfileRef(), {
    restSeconds: profile.restSeconds,
    restSecondsUpdatedAt: profile.restSecondsUpdatedAt,
  }, { merge: true });
}

/**
 * Legt eine fertige Einheit ab - im eigenen Bereich und in allem, was geteilt
 * wird. Dieselben drei Orte wie in der App, aus demselben Grund: Eine Regel
 * soll nie herausfinden muessen, ob zwei Leute etwas gemeinsam haben.
 */
async function storeSession(workout) {
  if (guestMode) {
    // `sessions` traegt den Eintrag schon - der Aufrufer haengt ihn vor dem
    // Aufruf an, damit die Zahlen sofort auf dem Bildschirm stehen.
    saveGuestSessions(sessions);
    return;
  }
  await setDoc(doc(sessionsRef(), workout.id), {
    timestamp: workout.timestampMillis,
    level: workout.level,
    plannedReps: workout.plannedReps,
    actualReps: workout.actualReps,
    durationSeconds: workout.durationSeconds,
  });

  const entry = {
    uid: me.uid,
    performedOn: today(new Date(workout.timestampMillis)),
    totalReps: totalReps(workout),
    bestSet: bestSet(workout),
    level: workout.level,
  };

  const groups = await readGroups();
  await Promise.all(groups.filter((g) => g.sharing !== false).map((g) =>
    setDoc(doc(fb.db, "groups", g.id, "entries", `${me.uid}_${workout.id}`), entry)));

  const friendships = await readFriendships();
  await Promise.all(friendships
    .filter((f) => f.status === "accepted" && !f.pausedBy.includes(me.uid))
    .map((f) =>
      setDoc(doc(fb.db, "friendships", f.pairId, "entries", `${me.uid}_${workout.id}`), entry)));
}

/**
 * Nimmt mit, was als Gast entstanden ist - einmalig, direkt nach der ersten
 * Anmeldung. Programm: ein leeres Kontoprofil uebernimmt das Gast-Programm,
 * ein echtes gewinnt und behaelt seins - dieselbe Regel wie ProfileMerge.kt
 * fuer zwei Geraete. Verlauf: die Vereinigung, nichts wird verworfen.
 */
async function mergeGuestDataIntoCloud() {
  if (!hasGuestData()) return;
  const guestProfile = loadGuestProfile();
  const guestSessions = loadGuestSessions();

  const cloudDoc = await getDoc(privateProfileRef());
  const cloudHasProgramme = cloudDoc.exists() && cloudDoc.data().hasChosenLevel;
  if (!cloudHasProgramme && guestProfile.hasChosenLevel) {
    await setDoc(privateProfileRef(), {
      level: guestProfile.level,
      levelStartedAt: guestProfile.levelStartedAt || 0,
      goalReps: guestProfile.goalReps,
      hasChosenLevel: true,
      updatedAt: Date.now(),
    }, { merge: true });
  }

  const cloudRestUpdatedAt = cloudDoc.exists() ? (cloudDoc.data().restSecondsUpdatedAt || 0) : 0;
  if ((guestProfile.restSecondsUpdatedAt || 0) > cloudRestUpdatedAt) {
    await setDoc(privateProfileRef(), {
      restSeconds: guestProfile.restSeconds,
      restSecondsUpdatedAt: guestProfile.restSecondsUpdatedAt || Date.now(),
    }, { merge: true });
  }

  if (guestSessions.length) {
    const existing = await getDocs(sessionsRef());
    const known = new Set(existing.docs.map((d) => d.id));
    const newOnes = guestSessions.filter((s) => !known.has(s.id));
    await Promise.all(newOnes.map((workout) => setDoc(doc(sessionsRef(), workout.id), {
      timestamp: workout.timestampMillis,
      level: workout.level,
      plannedReps: workout.plannedReps,
      actualReps: workout.actualReps,
      durationSeconds: workout.durationSeconds,
    })));
  }

  clearGuestData();
}

/**
 * Loescht eine Einheit ueberall wieder - lokal reicht nicht, sonst kaeme sie
 * beim naechsten Abgleich mit der App zurueck und die Bestenliste behielte
 * einen Eintrag, den man selbst weggeworfen hat.
 */
async function deleteSession(id) {
  sessions = sessions.filter((s) => s.id !== id);
  if (guestMode) {
    saveGuestSessions(sessions);
    return;
  }
  await deleteDoc(doc(sessionsRef(), id));
  const [groups, friendships] = await Promise.all([readGroups(), readFriendships()]);
  await Promise.all([
    ...groups.map((g) => deleteDoc(doc(fb.db, "groups", g.id, "entries", `${me.uid}_${id}`))),
    ...friendships.map((f) =>
      deleteDoc(doc(fb.db, "friendships", f.pairId, "entries", `${me.uid}_${id}`))),
  ].map((p) => p.catch(() => {}))); // ein fehlender Eintrag ist kein Fehler
}

async function readGroups() {
  const snapshot = await getDocs(membershipsRef());
  return snapshot.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (a.joinedAt || 0) - (b.joinedAt || 0));
}

async function readGroup(groupId) {
  const [group, members, entries] = await Promise.all([
    getDoc(doc(fb.db, "groups", groupId)),
    getDocs(collection(fb.db, "groups", groupId, "members")),
    getDocs(collection(fb.db, "groups", groupId, "entries")),
  ]);
  return {
    id: groupId,
    name: group.exists() ? group.data().name : "",
    ownerUid: group.exists() ? group.data().ownerUid : "",
    members: members.docs.map((d) => ({ uid: d.id, ...d.data() })),
    entries: entries.docs.map((d) => d.data()),
  };
}

async function readFriendships() {
  const snapshot = await getDocs(
    query(collection(fb.db, "friendships"), where("uids", "array-contains", me.uid)),
  );
  return snapshot.docs.map((d) => {
    const data = d.data();
    const other = (data.uids || []).find((uid) => uid !== me.uid) || "";
    return {
      pairId: d.id,
      otherUid: other,
      otherName: (data.names || {})[other] || "",
      status: data.status,
      requestedBy: data.requestedBy,
      pausedBy: data.pausedBy || [],
    };
  });
}

/* --------------------------------------------------------------- Ansicht */

async function start() {
  show($("friendsGate"), guestMode);
  show($("friendsPanel"), !guestMode);
  show($("groupsGate"), guestMode);
  show($("groupsPanel"), !guestMode);

  if (guestMode) {
    readOwnTrainingGuest();
    renderTraining();
    renderQuickStats();
    renderFullHistory();
    render();
    return;
  }

  displayName = await readMyProfile();
  // Falls dieser Browser schon als Gast trainiert hat, kommt das jetzt mit ins
  // Konto - unabhaengig davon, ob die Anmeldung gerade eben aus dem
  // Gastmodus heraus geschah oder erst nach einem Neustart der Seite.
  await mergeGuestDataIntoCloud().catch(() => {});

  await readOwnTraining().catch(() => {});
  renderTraining();
  renderQuickStats();
  renderFullHistory();
  render();

  // Live statt einmalig gelesen: Ein Levelwechsel oder eine neue Einheit auf
  // dem Handy soll hier ankommen, ohne dass man die Seite neu laedt - genau
  // die Traegheit, an der der Abgleich vorher krankte.
  watchOwnTraining();
  watchGroups();
  watchFriends();

  await handleDeepLinks();
}

$("friendsGateSignIn").addEventListener("click", () => leaveGuestModeForSignIn());
$("groupsGateSignIn").addEventListener("click", () => leaveGuestModeForSignIn());

/** Bringt zum Anmeldebildschirm zurueck, ohne das bisherige Gast-Training zu verlieren. */
function leaveGuestModeForSignIn() {
  show($("shell"), false);
  show($("signInScreen"), true);
}

/** Haelt Level, Ziel und Verlauf synchron mit dem, was gerade in der Cloud steht. */
function watchOwnTraining() {
  onSnapshot(privateProfileRef(), (snapshot) => {
    profile = snapshot.exists() ? toProfile(snapshot.data()) : { ...EMPTY_PROFILE };
    renderTraining();
    renderQuickStats();
  }, () => {});

  onSnapshot(sessionsRef(), (snapshot) => {
    sessions = snapshot.docs.map((d) => ({
      id: d.id,
      timestampMillis: d.data().timestamp || 0,
      level: d.data().level || 1,
      plannedReps: d.data().plannedReps || [],
      actualReps: d.data().actualReps || [],
      durationSeconds: d.data().durationSeconds || 0,
    }));
    renderQuickStats();
    renderFullHistory();
  }, () => {});
}

function watchGroups() {
  onSnapshot(membershipsRef(), (snapshot) => {
    const groups = snapshot.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (a.joinedAt || 0) - (b.joinedAt || 0));
    drawGroupsList(groups);
  }, (error) => {
    $("groups").innerHTML =
      `<p class="muted error">Gruppen nicht lesbar: ${escape(error.code || error.message)}</p>`;
  });
}

function watchFriends() {
  const q = query(collection(fb.db, "friendships"), where("uids", "array-contains", me.uid));
  onSnapshot(q, (snapshot) => {
    const all = snapshot.docs.map((d) => {
      const data = d.data();
      const other = (data.uids || []).find((uid) => uid !== me.uid) || "";
      return {
        pairId: d.id,
        otherUid: other,
        otherName: (data.names || {})[other] || "",
        status: data.status,
        requestedBy: data.requestedBy,
        pausedBy: data.pausedBy || [],
      };
    });
    drawFriendsList(all);
  }, (error) => {
    $("friends").innerHTML =
      `<p class="muted error">Freunde nicht lesbar: ${escape(error.code || error.message)}</p>`;
  });
}

/** Zeichnet die Gruppenliste aus bereits gelesenen Daten - kein eigener Zugriff. */
function drawGroupsList(groups) {
  const box = $("groups");
  if (!groups.length) {
    box.innerHTML = `<p class="muted">${t("groupsEmpty")}</p>`;
    return;
  }
  box.innerHTML = groups.map((g) => `
    <div class="listrow" style="cursor:default">
      <div class="grow">
        <div class="name">${escape(g.name || t("groupsUnnamed"))}</div>
        ${g.sharing === false ? `<div class="muted">${t("groupsSharingPaused")}</div>` : ""}
      </div>
      <button class="chip" data-group="${escape(g.id)}">${t("groupsView")}</button>
    </div>`).join("");
  box.querySelectorAll("[data-group]").forEach((button) =>
    button.addEventListener("click", () => openDetail({ type: "group", id: button.dataset.group })));
}

/** Zeichnet die Freundesliste aus bereits gelesenen Daten - kein eigener Zugriff. */
function drawFriendsList(all) {
  const box = $("friends");
  const accepted = all.filter((f) => f.status === "accepted");
  const incoming = all.filter((f) => f.status === "pending" && f.requestedBy !== me.uid);

  const parts = [];
  if (incoming.length) {
    parts.push(`<p class="muted">${t("friendsIncomingHint")}</p>`);
    parts.push(incoming.map((f) => `
      <div class="listrow" style="cursor:default"><div class="grow">${escape(f.otherName || t("friendsUnnamed"))}</div>
      <span class="muted">${t("friendsWaiting")}</span></div>`).join(""));
  }
  if (!accepted.length) {
    parts.push(`<p class="muted">${t("friendsEmpty")}</p>`);
  } else {
    parts.push(accepted.map((f) => `
      <div class="listrow" style="cursor:default">
        <div class="grow"><div class="name">${escape(f.otherName || t("friendsUnnamed"))}</div></div>
        <button class="chip" data-friend="${escape(f.pairId)}">${t("friendsCompare")}</button>
      </div>`).join(""));
  }
  box.innerHTML = parts.join("");
  box.querySelectorAll("[data-friend]").forEach((button) =>
    button.addEventListener("click", () =>
      openDetail({ type: "friend", pairId: button.dataset.friend })));
}

function renderTraining() {
  const reps = levelReps(profile.level);
  $("levelTitle").textContent = t("levelOf", profile.level, LEVEL_COUNT);
  $("setPills").innerHTML = reps.map((n) => `<span>${n}</span>`).join("");
  $("levelSummary").textContent = t(
    "levelSummary",
    levelTotal(profile.level),
    reps.length,
    profile.restSeconds || 90,
  );
  $("levelDown").disabled = profile.level <= 1;
  $("levelUp").disabled = profile.level >= LEVEL_COUNT;

  // Ein Vorschlag aus dem Maximaltest, solange man ihm nicht gefolgt ist.
  const suggested = profile.lastTestResult ? suggestLevel(profile.lastTestResult) : 0;
  const hint = $("levelHint");
  if (suggested && suggested !== profile.level) {
    hint.textContent = t("levelHint", profile.lastTestResult, suggested);
    hint.classList.remove("hidden");
  } else {
    hint.classList.add("hidden");
  }
}

/** Was gerade geschafft wurde, in Zahlen — sonst verschwindet es kommentarlos. */
async function showSummary(workout) {
  const done = totalReps(workout);
  const target = workout.plannedReps.reduce((sum, n) => sum + n, 0);
  const complete = workout.actualReps.every((n, i) => n >= workout.plannedReps[i]) &&
    workout.actualReps.length === levelReps(workout.level).length;
  await say(
    t(complete ? "workoutDoneTitle" : "workoutEndedTitle"),
    t("workoutSummary", done, workout.actualReps.length, workout.actualReps.join(" · "), target, bestSet(workout)),
  );
}

/** Die vier Zahlen auf dem Trainings-Reiter, wie in HomeScreen der App. */
function renderQuickStats() {
  const s = statistics(sessions);
  const tiles = [
    [s.totalReps, t("statReps")],
    [s.workoutCount, t("statWorkouts")],
    [s.currentStreakDays, t("statStreak")],
  ];
  $("quickTiles").innerHTML = tiles
    .map(([n, label]) => `<div><div class="n">${n}</div><div class="l">${label}</div></div>`)
    .join("");

  const progress = goalProgress(s.bestSet, profile.goalReps);
  $("goalLine").textContent = t("goalLine", s.bestSet, profile.goalReps, Math.round(progress * 100));
  $("goalBar").style.width = `${progress * 100}%`;

  $("testLine").textContent = profile.lastTestResult
    ? t("testLineDone", profile.lastTestResult)
    : t("testLineNone");
}

/** Der volle Verlauf mit allen Zahlen, wie HistoryScreen in der App. */
function renderFullHistory() {
  const s = statistics(sessions);
  const tiles = [
    [s.totalReps, t("statReps")],
    [s.bestSet, t("statBestSet")],
    [s.currentStreakDays, t("statStreak")],
    [s.workoutCount, t("statWorkouts")],
    [s.bestSession, t("statBestSession")],
    [s.repsLast7Days, t("statLast7")],
  ];
  $("fullTiles").innerHTML = tiles
    .map(([n, label]) => `<div><div class="n">${n}</div><div class="l">${label}</div></div>`)
    .join("");

  const sorted = [...sessions].sort((a, b) => b.timestampMillis - a.timestampMillis);
  const dateLocale = getLanguage() === "en" ? "en-US" : "de-DE";
  $("fullHistory").innerHTML = sorted.length
    ? sorted.map((entry) => `
        <div class="listrow" style="cursor:default">
          <div class="grow">
            <div class="name">${t("historyReps", totalReps(entry), entry.level)}</div>
            <div class="muted">${escape(entry.actualReps.join(" · "))}</div>
          </div>
          <div class="muted">${new Date(entry.timestampMillis).toLocaleDateString(dateLocale)}</div>
          <button class="chip" data-delete="${escape(entry.id)}">${t("deleteBtn")}</button>
        </div>`).join("")
    : `<p class="muted">${t("historyEmpty")}</p>`;

  $("fullHistory").querySelectorAll("[data-delete]").forEach((button) =>
    button.addEventListener("click", async () => {
      const yes = await ask(t("deleteTitle"), t("deleteBody"), t("deleteBtn"), t("cancel"));
      if (!yes) return;
      try {
        await deleteSession(button.dataset.delete);
        renderFullHistory();
        renderQuickStats();
      } catch (error) {
        await say(t("deleteFailedTitle"), error.code || error.message);
      }
    }));
}

// Das Ziel laesst sich hier genauso setzen wie in der App - sonst waere es das
// einzige, wofuer man zum Telefon greifen muesste.
$("goalLine").addEventListener("click", async () => {
  const entered = await askForText(t("goalPrompt"), t("goalPromptLabel"), t("goalPromptSave"));
  const wanted = Number(entered);
  if (!Number.isFinite(wanted)) return;
  profile.goalReps = Math.min(Math.max(Math.round(wanted), 20), 300);
  renderQuickStats();
  try {
    await writeProfile();
  } catch (error) {
    await say(t("saveFailedTitle"), error.code || error.message);
  }
});
$("goalLine").style.cursor = "pointer";

/**
 * Alle 40 Level zum Nachsehen.
 *
 * Das Level ist die eine Zahl, um die sich die ganze App dreht, und ohne die
 * Leiter daneben sagt sie nichts: Man will sehen, was vor einem liegt und was
 * man hinter sich hat.
 */
$("allLevels").addEventListener("click", () => {
  const rows = Array.from({ length: LEVEL_COUNT }, (unused, index) => {
    const number = index + 1;
    const reps = levelReps(number);
    const current = number === profile.level;
    return `
      <div class="listrow ${current ? "current" : ""}" data-level="${number}">
        <div class="grow">
          <div class="name">${t("workoutLevel", number)}${current ? t("yourLevelSuffix") : ""}</div>
          <div class="muted">${reps.join(" · ")}</div>
        </div>
        <div class="muted">${levelTotal(number)}</div>
      </div>`;
  }).join("");

  const dialog = document.createElement("dialog");
  dialog.innerHTML = `
    <h2>${t("allLevelsTitle")}</h2>
    <p class="muted">${t("allLevelsHint")}</p>
    <div style="max-height:60vh;overflow:auto">${rows}</div>
    <div class="actions"><button class="ghost">${t("allLevelsClose")}</button></div>`;
  document.body.append(dialog);

  dialog.querySelector("button").addEventListener("click", () => dialog.close());
  dialog.addEventListener("close", () => dialog.remove());
  dialog.querySelectorAll("[data-level]").forEach((row) =>
    row.addEventListener("click", async () => {
      dialog.close();
      await setLevel(Number(row.dataset.level));
    }));

  dialog.showModal();
  dialog.querySelector(".current")?.scrollIntoView({ block: "center" });
});

$("levelUp").addEventListener("click", () => changeLevel(1));
$("levelDown").addEventListener("click", () => changeLevel(-1));

const changeLevel = (step) => setLevel(profile.level + step);

async function setLevel(wanted) {
  const level = Math.min(Math.max(wanted, 1), LEVEL_COUNT);
  if (level === profile.level) return;
  profile.level = level;
  profile.levelStartedAt = Date.now();
  profile.hasChosenLevel = true;
  renderTraining();
  try {
    await writeProfile();
  } catch (error) {
    await say(t("saveFailedTitle"), error.code || error.message);
  }
}

$("startWorkout").addEventListener("click", async () => {
  const workout = await runWorkout(profile.level, profile.restSeconds || 90);
  if (!workout) return;
  sessions = [...sessions, workout];
  renderQuickStats();
  renderFullHistory();
  await showSummary(workout);
  try {
    await storeSession(workout);
  } catch (error) {
    await say(t("workoutUploadFailedTitle"), t("workoutUploadFailed", error.code || error.message));
  }
});

const RANGES = () => [[7, t("range7")], [30, t("range30")], [0, t("rangeAll")]];
const SORTS = () => [["reps", t("sortReps")], ["best", t("sortBest")], ["days", t("sortDays")]];

function chips(entries, current, attribute) {
  return entries.map(([value, label]) =>
    `<button class="chip" data-${attribute}="${value}" aria-pressed="${value === current}">${label}</button>`,
  ).join("");
}

async function drawGroupDetail(groupId) {
  const panel = $("tab-detail");
  panel.innerHTML = `<div class="card"><p class="muted">${t("loading")}</p></div>`;
  let group;
  try {
    group = await readGroup(groupId);
  } catch (error) {
    panel.innerHTML = `<div class="card"><p class="muted error">${t("noAccess", escape(error.code || error.message))}</p></div>`;
    return;
  }
  $("topTitle").textContent = group.name || t("groupsUnnamed");

  const draw = () => {
    const rows = buildLeaderboard(group.members, group.entries, range, sort);
    const total = rows.reduce((sum, r) => sum + r.totalReps, 0);
    const average = rows.length ? Math.floor(total / rows.length) : 0;
    panel.innerHTML = `
      <div class="card stack">
        <p class="muted">${t("rangeLabel")}</p>
        <div class="chips">${chips(RANGES(), range, "range")}</div>
        <p class="muted">${t("sortLabel")}</p>
        <div class="chips">${chips(SORTS(), sort, "sort")}</div>
        <table>
          <thead><tr><th>${t("groupColName")}</th><th>${t("groupColReps")}</th><th>${t("groupColBest")}</th><th>${t("groupColDays")}</th></tr></thead>
          <tbody>${rows.map((r, index) => `
            <tr class="${r.uid === me.uid ? "self" : ""}">
              <td>${index + 1}. ${escape(r.displayName || t("friendsUnnamed"))}
                ${!r.sharing ? `<span class="sub">${t("groupsSharingPaused")}</span>`
                  : r.level ? `<span class="sub">${t("workoutLevel", r.level)}</span>` : ""}</td>
              <td>${r.totalReps}</td><td>${r.bestSet}</td><td>${r.days}</td>
            </tr>`).join("")}
          </tbody>
        </table>
        <p class="muted">${t("groupTotal", total, average)}</p>
        <p class="muted">${t("groupIdLabel")} <span class="code">${escape(group.id)}</span></p>
        <p class="muted">${t("groupManageHint")}</p>
      </div>`;
    panel.querySelectorAll("[data-range]").forEach((chip) =>
      chip.addEventListener("click", () => { range = Number(chip.dataset.range); draw(); }));
    panel.querySelectorAll("[data-sort]").forEach((chip) =>
      chip.addEventListener("click", () => { sort = chip.dataset.sort; draw(); }));
  };
  draw();
}

async function drawFriendDetail(pairId) {
  const panel = $("tab-detail");
  panel.innerHTML = `<div class="card"><p class="muted">${t("loading")}</p></div>`;
  const friendships = await readFriendships();
  const friendship = friendships.find((f) => f.pairId === pairId);
  if (!friendship) {
    panel.innerHTML = `<div class="card"><p class="muted">${t("friendGone")}</p></div>`;
    $("topTitle").textContent = t("friendGoneTitle");
    return;
  }
  $("topTitle").textContent = friendship.otherName || t("friendsUnnamed");

  let entries;
  try {
    const snapshot = await getDocs(collection(fb.db, "friendships", pairId, "entries"));
    entries = snapshot.docs.map((d) => d.data());
  } catch (error) {
    panel.innerHTML = `<div class="card"><p class="muted error">${t("noAccess", escape(error.code || error.message))}</p></div>`;
    return;
  }

  const draw = () => {
    const c = buildComparison(
      me.uid, displayName || t("anonymousName"), friendship.otherUid,
      friendship.otherName || t("friendsUnnamed"), entries, range,
    );
    const line = (label, a, b) => `
      <div class="value ${a > b ? "ahead" : ""}">${a}</div>
      <div class="label">${label}</div>
      <div class="value ${b > a ? "ahead" : ""}">${b}</div>`;
    panel.innerHTML = `
      <div class="card stack">
        <p class="muted">${t("rangeLabel")}</p>
        <div class="chips">${chips(RANGES(), range, "range")}</div>
        <div class="compare">
          <div class="head">${escape(c.own.displayName)}</div><div></div>
          <div class="head">${escape(c.other.displayName)}</div>
          ${line(t("compareRepsLabel"), c.own.totalReps, c.other.totalReps)}
          ${line(t("compareBestLabel"), c.own.bestSet, c.other.bestSet)}
          ${line(t("compareDaysLabel"), c.own.days, c.other.days)}
          ${line(t("compareLevelLabel"), c.own.level, c.other.level)}
          <div class="label">${escape(c.own.lastTrainedOn || t("compareNeverTrained"))}</div>
          <div class="label">${t("compareLastTrained")}</div>
          <div class="label">${escape(c.other.lastTrainedOn || t("compareNeverTrained"))}</div>
        </div>
        ${friendship.pausedBy.includes(friendship.otherUid)
          ? `<p class="muted">${t("comparePausedHint")}</p>` : ""}
        <p class="muted">${t("friendManageHint")}</p>
      </div>`;
    panel.querySelectorAll("[data-range]").forEach((chip) =>
      chip.addEventListener("click", () => { range = Number(chip.dataset.range); draw(); }));
  };
  draw();
}

/* -------------------------------------------------------------- Konto */

/**
 * Das Konto: Anzeigename und Abmelden.
 *
 * Kein Loeschen hier - das ist ein mehrschrittiger Vorgang (Profil weg, dann
 * das Konto selbst) und bleibt bewusst der App vorbehalten, wo er schon
 * getestet ist. Doppelt gebaut waere er nur doppelt so leicht auseinander zu
 * laufen.
 */
$("accountBtn").addEventListener("click", () => {
  if (guestMode) {
    openSettingsDialog({ guest: true });
    return;
  }
  openSettingsDialog({ guest: false });
});

/** 30 bis 240 Sekunden in Schritten von 30 - dieselbe Spanne wie RestCard in der App. */
function clampRestSeconds(seconds) {
  const rounded = Math.round(seconds / 30) * 30;
  return Math.min(Math.max(rounded, 30), 240);
}

/** Wo der Griff auf der Spur sitzt, als Prozentsatz zwischen 30 und 240 Sekunden. */
function restFillPercent(seconds) {
  return ((seconds - 30) / (240 - 30)) * 100;
}

/** 30, 60, 90 ... 240 - dieselben acht Raststellen wie Slider(steps = 6) in RestCard. */
const REST_STOPS = [30, 60, 90, 120, 150, 180, 210, 240];

/** Baut Satzpause-Anzeige und -Regler, wie RestCard in der App: eine grosse m:ss-Zahl ueber dem Schieberegler mit sichtbaren Raststellen. */
function restSliderMarkup(presetSeconds) {
  const seconds = presetSeconds ?? (profile.restSeconds || 90);
  return `
    <p class="muted" style="margin-top:12px">${t("settingsRestTitle")}</p>
    <p class="restValue" id="restValue">${formatDuration(seconds)}</p>
    <div class="restSliderWrap">
      <input type="range" id="restSlider" min="30" max="240" step="30" value="${seconds}"
        style="--fill:${restFillPercent(seconds)}%">
      <div class="restTicks" aria-hidden="true">${REST_STOPS.map(() => "<span></span>").join("")}</div>
    </div>`;
}

/** Live-Anzeige beim Ziehen; gespeichert wird erst beim Klick auf "Speichern". */
function wireRestSlider(dialog) {
  const slider = dialog.querySelector("#restSlider");
  const value = dialog.querySelector("#restValue");
  slider.addEventListener("input", () => {
    const seconds = clampRestSeconds(Number(slider.value));
    value.textContent = formatDuration(seconds);
    slider.style.setProperty("--fill", `${restFillPercent(seconds)}%`);
  });
  return () => clampRestSeconds(Number(slider.value));
}

/**
 * Die Einstellungen: Satzpause und Sprache immer, Anzeigename und Abmelden
 * nur mit Konto. Kein Konto-Loeschen hier - das ist ein mehrschrittiger
 * Vorgang (Profil weg, dann das Konto selbst) und bleibt bewusst der App
 * vorbehalten, wo er schon getestet ist.
 */
function openSettingsDialog({ guest, presetRest }) {
  const dialog = document.createElement("dialog");
  dialog.innerHTML = `
    <h2>${t("settingsTitle")}</h2>
    <p class="muted">${guest ? t("settingsGuestHint") : t("settingsAccountEmail", escape(me.email))}</p>
    ${guest ? "" : `<input type="text" id="nameField" placeholder="${t("settingsNamePlaceholder")}" autocomplete="off" value="${escape(displayName)}">`}
    ${restSliderMarkup(presetRest)}
    <div class="row" style="margin-top:12px">
      <button type="button" class="chip" id="langFieldBtn">Sprache</button>
    </div>
    <div class="actions">
      <button class="ghost" id="closeBtn">${t("settingsClose")}</button>
      ${guest ? "" : `<button class="ghost" id="signOutBtn">${t("settingsSignOut")}</button>`}
      <button id="saveBtn">${t("settingsSave")}</button>
    </div>
    ${guest ? `
      <p class="muted" style="margin-top:16px">${t("settingsGuestConnect")}</p>
      <button class="wide" id="signInBtn">${t("settingsSignInBtn")}</button>` : ""}`;
  document.body.append(dialog);
  dialog.addEventListener("close", () => dialog.remove());

  const readRest = wireRestSlider(dialog);
  const unwireLanguagePicker = wireLanguagePicker(dialog.querySelector("#langFieldBtn"));
  dialog.addEventListener("close", () => unwireLanguagePicker());

  // Die Sprache kann sich aendern, waehrend der Dialog offen ist - dann wird
  // er mit der noch nicht gespeicherten Satzpause neu aufgebaut, statt mit
  // veralteten Beschriftungen stehen zu bleiben.
  const onLanguageChange = () => {
    const rest = readRest();
    dialog.close();
    openSettingsDialog({ guest, presetRest: rest });
  };
  window.addEventListener("liegestuetzen:language", onLanguageChange);
  dialog.addEventListener("close", () => window.removeEventListener("liegestuetzen:language", onLanguageChange));

  dialog.querySelector("#closeBtn").addEventListener("click", () => dialog.close());
  dialog.querySelector("#saveBtn").addEventListener("click", async () => {
    const rest = readRest();
    dialog.close();
    if (!guest) {
      const name = dialog.querySelector("#nameField").value.trim().slice(0, 40);
      if (name && name !== displayName) await saveDisplayName(name);
    }
    if (rest !== (profile.restSeconds || 90)) {
      await writeRestSeconds(rest);
      renderTraining();
    }
  });
  if (guest) {
    dialog.querySelector("#signInBtn").addEventListener("click", () => {
      dialog.close();
      leaveGuestModeForSignIn();
    });
  } else {
    dialog.querySelector("#signOutBtn").addEventListener("click", async () => {
      dialog.close();
      const yes = await ask(t("signOutTitle"), t("signOutBody"), t("signOutConfirm"), t("cancel"));
      if (yes) await signOut(fb.auth);
    });
  }

  dialog.showModal();
}

/**
 * Speichert den Anzeigenamen und zieht ihn nach.
 *
 * Der Name liegt in jeder Gruppe und jeder Freundschaft noch einmal, damit
 * Mitgliederlisten ohne Nachladen auskommen - der Preis dafuer ist, ihn dort
 * ueberall zu aktualisieren.
 */
async function saveDisplayName(name) {
  await setDoc(profileRef(), { displayName: name, updatedAt: Date.now() }, { merge: true });
  displayName = name;
  const groups = await readGroups();
  await Promise.all(groups.map((g) =>
    setDoc(doc(fb.db, "groups", g.id, "members", me.uid), { displayName: name }, { merge: true })));
  const friendships = await readFriendships();
  await Promise.all(friendships.map((f) =>
    setDoc(doc(fb.db, "friendships", f.pairId), { names: { [me.uid]: name } }, { merge: true })));
}

/* -------------------------------------------------------- Gruppen und Freunde */

$("newGroup").addEventListener("click", async () => {
  const entered = await askForText(t("newGroupTitle"), t("newGroupLabel"), t("createBtn"));
  if (!entered) return;
  const name = entered.slice(0, 40);
  const id = randomId();
  const now = Date.now();
  try {
    await setDoc(doc(fb.db, "groups", id), { name, ownerUid: me.uid, createdAt: now });
    await joinExisting(id, name, now);
    setTab("groups");
    openDetail({ type: "group", id });
  } catch (error) {
    await say(t("createFailedTitle"), error.code || error.message);
  }
});

$("joinGroup").addEventListener("click", () => promptJoin());
$("redeem").addEventListener("click", () => promptRedeem());
$("inviteFriend").addEventListener("click", () => createFriendInvite());

/**
 * Erstellt eine Einladung und bietet sie zum Teilen an - dasselbe Ziel wie der
 * Knopf "Freund einladen" in der App, nur dass der Browser kein Teilen-Menue
 * hat: Der Link landet in der Zwischenablage.
 */
async function createFriendInvite() {
  const now = Date.now();
  const inviteId = randomId();
  try {
    await setDoc(doc(fb.db, "invites", inviteId), {
      fromUid: me.uid,
      fromDisplayName: displayName || t("anonymousName"),
      createdAt: now,
      expiresAt: now + 7 * 86400000,
    });
    const link = `${location.origin}${location.pathname.replace(/app\/?$/, "f/")}?id=${inviteId}`;
    await navigator.clipboard.writeText(link).catch(() => {});
    await say(t("inviteCreatedTitle"), t("inviteCreated", link));
  } catch (error) {
    await say(t("createFailedTitle"), error.code || error.message);
  }
}

async function promptJoin(prefill) {
  const input = prefill || await askForText(t("joinGroupTitle"), t("joinGroupLabel"), t("nextBtn"));
  const id = parseId(input);
  if (!id) {
    if (input) await say(t("invalidTitle"), t("invalidCode"));
    return;
  }
  try {
    const snapshot = await getDoc(doc(fb.db, "groups", id));
    if (!snapshot.exists()) {
      await say(t("notFoundTitle"), t("groupNotFound"));
      return;
    }
    const name = snapshot.data().name || t("groupsUnnamed");
    const memberDoc = await getDoc(doc(fb.db, "groups", id, "members", me.uid));
    if (memberDoc.exists()) {
      setTab("groups");
      openDetail({ type: "group", id });
      return;
    }
    const yes = await ask(t("joinGroupTitle"), t("joinGroupQuestion", name), t("joinBtn"), t("cancel"));
    if (!yes) return;
    await joinExisting(id, name, Date.now());
    await backfill(id);
    setTab("groups");
    openDetail({ type: "group", id });
  } catch (error) {
    await say(t("joinFailedTitle"), error.code || error.message);
  }
}

/**
 * Reicht die letzten 30 Tage nach, wenn man einer Gruppe beitritt.
 *
 * Ohne das stuende ein Neuzugang bei null neben Leuten, deren Wochen schon auf
 * der Tafel stehen - dieselbe Ueberlegung wie in der App.
 */
async function backfill(groupId) {
  const cutoff = Date.now() - 30 * 86400000;
  const recent = sessions.filter((s) => s.timestampMillis >= cutoff);
  await Promise.all(recent.map((workout) =>
    setDoc(doc(fb.db, "groups", groupId, "entries", `${me.uid}_${workout.id}`), {
      uid: me.uid,
      performedOn: today(new Date(workout.timestampMillis)),
      totalReps: totalReps(workout),
      bestSet: bestSet(workout),
      level: workout.level,
    })));
}

async function joinExisting(groupId, groupName, now) {
  await setDoc(doc(fb.db, "groups", groupId, "members", me.uid), {
    uid: me.uid, displayName: displayName || t("anonymousName"), joinedAt: now, sharing: true,
  }, { merge: true });
  await setDoc(doc(fb.db, "users", me.uid, "memberships", groupId), {
    name: groupName, joinedAt: now, sharing: true,
  }, { merge: true });
}

async function promptRedeem(prefill) {
  const input = prefill || await askForText(t("redeemTitle"), t("redeemLabel"), t("nextBtn"));
  const inviteId = parseId(input);
  if (!inviteId) {
    if (input) await say(t("invalidTitle"), t("invalidInviteCode"));
    return;
  }
  try {
    const snapshot = await getDoc(doc(fb.db, "invites", inviteId));
    if (!snapshot.exists()) {
      await say(t("notFoundTitle"), t("inviteNotFound"));
      return;
    }
    const invite = snapshot.data();
    if (invite.fromUid === me.uid) {
      await say(t("inviteOwnTitle"), t("inviteOwn"));
      return;
    }
    if (invite.acceptedBy || invite.expiresAt < Date.now()) {
      await say(t("inviteExpiredTitle"), t("inviteExpired"));
      return;
    }
    const from = invite.fromDisplayName || t("someoneName");
    const yes = await ask(t("inviteFrom", from), t("inviteFromQuestion", from), t("connectBtn"), t("cancel"));
    if (!yes) return;
    const uids = [me.uid, invite.fromUid].sort();
    const pairId = uids.join("_");
    await setDoc(doc(fb.db, "friendships", pairId), {
      uids,
      status: "accepted",
      requestedBy: invite.fromUid,
      viaInvite: inviteId,
      createdAt: Date.now(),
      pausedBy: [],
      names: { [me.uid]: displayName || t("anonymousName"), [invite.fromUid]: from },
    });
    await setDoc(doc(fb.db, "invites", inviteId), { acceptedBy: me.uid }, { merge: true });
    setTab("friends");
    openDetail({ type: "friend", pairId });
  } catch (error) {
    await say(t("redeemFailedTitle"), error.code || error.message);
  }
}

/**
 * Wer über einen Einladungslink hereinkommt, soll nichts abtippen müssen.
 *
 * `code` ist der Weg für alle, die nur einen Code haben und nicht wissen
 * können, wofür er ist – Gruppen-IDs und Freundschaftscodes sehen gleich aus.
 * Die Seite probiert es einfach aus. `join` und `invite` bleiben für Links, die
 * es schon wissen.
 */
async function handleDeepLinks() {
  const code = parseId(params.get("code"));
  const join = parseId(params.get("join"));
  const invite = parseId(params.get("invite"));
  if (code) await resolveCode(code);
  if (join) await promptJoin(join);
  if (invite) await promptRedeem(invite);
  if (code || join || invite) history.replaceState(null, "", location.pathname);
}

/**
 * Findet heraus, wofür ein Code steht, und macht dann das Richtige damit.
 *
 * Erst als Gruppe, dann als Einladung. Beide sind 22 Zeichen aus demselben
 * Vorrat; es gibt keinen anderen Weg als nachzusehen.
 */
async function resolveCode(code) {
  try {
    const group = await getDoc(doc(fb.db, "groups", code));
    if (group.exists()) {
      await promptJoin(code);
      return;
    }
    const invite = await getDoc(doc(fb.db, "invites", code));
    if (invite.exists()) {
      await promptRedeem(code);
      return;
    }
    await say(t("codeNothingFound"), t("codeNotFound"));
  } catch (error) {
    await say(t("codeCheckFailedTitle"), t("codeCheckFailed", error.code || error.message));
  }
}

/**
 * Dieselbe Erzeugung wie in der App: 22 Zeichen aus 62, aus dem
 * kryptografischen Zufall des Browsers. Die ID ist das Passwort der Gruppe.
 *
 * Zufallsbytes werden verworfen statt per Rest umgebogen: 256 teilt sich nicht
 * durch 62, und ein Rest bevorzugt die ersten acht Zeichen des Alphabets. Bei
 * 22 Stellen faellt das praktisch nicht ins Gewicht - aber eine Schiefe, die
 * man mit drei Zeilen vermeiden kann, gehoert nicht in einen Schluessel.
 */
function randomId() {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const limit = 256 - (256 % alphabet.length);
  const out = [];
  while (out.length < ID_LENGTH) {
    for (const byte of crypto.getRandomValues(new Uint8Array(ID_LENGTH))) {
      if (byte < limit && out.length < ID_LENGTH) out.push(alphabet[byte % alphabet.length]);
    }
  }
  return out.join("");
}
