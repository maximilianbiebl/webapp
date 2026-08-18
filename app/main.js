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
  parseId, buildLeaderboard, buildComparison, ID_LENGTH, today, waitForAuth,
} from "../shared.js";
import { ask, say, askForText } from "./dialogs.js";
import { LEVEL_COUNT, levelReps, levelTotal, goalProgress, suggestLevel } from "../levels.js";
import { statistics, totalReps, bestSet } from "../stats.js";
import { runWorkout } from "./training.js";

const $ = (id) => document.getElementById(id);
const show = (el, visible) => el.classList.toggle("hidden", !visible);
const escape = (text) => String(text ?? "").replace(/[&<>"']/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const params = new URLSearchParams(location.search);
let fb = null;
let me = null;
let displayName = "";
let range = 7;
let sort = "reps";
/** Das eigene Programm und der eigene Verlauf, so wie sie in der Cloud liegen. */
let profile = { level: 1, goalReps: 100, updatedAt: 0 };
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

const TAB_TITLES = {
  training: "Training",
  friends: "Freunde",
  groups: "Gruppen",
  history: "Verlauf",
};

if (params.get("code") || params.get("join") || params.get("invite")) {
  // Sonst steht da nur "Anmelden", und warum, weiss niemand.
  const note = document.createElement("p");
  note.className = "hint";
  note.textContent =
    "Du hast eine Einladung dabei. Melde dich an, dann wird sie gleich eingelöst.";
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
      show($("authLoading"), false);
      show($("signInScreen"), !user);
      show($("shell"), Boolean(user));
      if (user) start();
    });
  });
}

$("google").addEventListener("click", async () => {
  try {
    await signInWithPopup(fb.auth, new GoogleAuthProvider());
  } catch (error) {
    const box = $("signInError");
    box.textContent = `Anmeldung fehlgeschlagen: ${error.code || error.message}`;
    show(box, true);
  }
});

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
    $("topTitle").textContent = TAB_TITLES[state.tab];
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

async function readOwnTraining() {
  const [profileDoc, sessionDocs] = await Promise.all([
    getDoc(privateProfileRef()),
    getDocs(sessionsRef()),
  ]);
  profile = profileDoc.exists()
    ? {
        level: profileDoc.data().level || 1,
        goalReps: profileDoc.data().goalReps || 100,
        levelStartedAt: profileDoc.data().levelStartedAt || 0,
        hasChosenLevel: profileDoc.data().hasChosenLevel || false,
        lastTestResult: profileDoc.data().lastTestResult || 0,
        updatedAt: profileDoc.data().updatedAt || 0,
      }
    : {
        level: 1, goalReps: 100, levelStartedAt: 0,
        hasChosenLevel: false, lastTestResult: 0, updatedAt: 0,
      };
  sessions = sessionDocs.docs.map((d) => ({
    id: d.id,
    timestampMillis: d.data().timestamp || 0,
    level: d.data().level || 1,
    plannedReps: d.data().plannedReps || [],
    actualReps: d.data().actualReps || [],
    durationSeconds: d.data().durationSeconds || 0,
  }));
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
 * Legt eine fertige Einheit ab - im eigenen Bereich und in allem, was geteilt
 * wird. Dieselben drei Orte wie in der App, aus demselben Grund: Eine Regel
 * soll nie herausfinden muessen, ob zwei Leute etwas gemeinsam haben.
 */
async function storeSession(workout) {
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
 * Loescht eine Einheit ueberall wieder - lokal reicht nicht, sonst kaeme sie
 * beim naechsten Abgleich mit der App zurueck und die Bestenliste behielte
 * einen Eintrag, den man selbst weggeworfen hat.
 */
async function deleteSession(id) {
  await deleteDoc(doc(sessionsRef(), id));
  sessions = sessions.filter((s) => s.id !== id);
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
  displayName = await readMyProfile();

  await readOwnTraining().catch(() => {});
  renderTraining();
  renderQuickStats();
  renderFullHistory();

  render();
  await Promise.all([renderGroupsList(), renderFriendsList()]);
  await handleDeepLinks();
}

async function renderGroupsList() {
  const box = $("groups");
  try {
    const groups = await readGroups();
    if (!groups.length) {
      box.innerHTML = `<p class="muted">Noch in keiner Gruppe.</p>`;
      return;
    }
    box.innerHTML = groups.map((g) => `
      <div class="listrow" data-group="${escape(g.id)}">
        <div class="grow">
          <div class="name">${escape(g.name || "Gruppe ohne Namen")}</div>
          ${g.sharing === false ? '<div class="muted">Teilen pausiert</div>' : ""}
        </div>
        <span class="muted">ansehen →</span>
      </div>`).join("");
    box.querySelectorAll("[data-group]").forEach((row) =>
      row.addEventListener("click", () => openDetail({ type: "group", id: row.dataset.group })));
  } catch (error) {
    box.innerHTML = `<p class="muted error">Gruppen nicht lesbar: ${escape(error.code || error.message)}</p>`;
  }
}

async function renderFriendsList() {
  const box = $("friends");
  try {
    const all = await readFriendships();
    const accepted = all.filter((f) => f.status === "accepted");
    const incoming = all.filter((f) => f.status === "pending" && f.requestedBy !== me.uid);

    const parts = [];
    if (incoming.length) {
      parts.push(`<p class="muted">Offene Anfragen an dich – annehmen geht in der App:</p>`);
      parts.push(incoming.map((f) => `
        <div class="listrow"><div class="grow">${escape(f.otherName || "Ohne Namen")}</div>
        <span class="muted">wartet</span></div>`).join(""));
    }
    if (!accepted.length) {
      parts.push(`<p class="muted">Noch keine Freunde.</p>`);
    } else {
      parts.push(accepted.map((f) => `
        <div class="listrow" data-friend="${escape(f.pairId)}">
          <div class="grow"><div class="name">${escape(f.otherName || "Ohne Namen")}</div></div>
          <span class="muted">vergleichen →</span>
        </div>`).join(""));
    }
    box.innerHTML = parts.join("");
    box.querySelectorAll("[data-friend]").forEach((row) =>
      row.addEventListener("click", () =>
        openDetail({ type: "friend", pairId: row.dataset.friend })));
  } catch (error) {
    box.innerHTML = `<p class="muted error">Freunde nicht lesbar: ${escape(error.code || error.message)}</p>`;
  }
}

function renderTraining() {
  const reps = levelReps(profile.level);
  $("levelTitle").textContent = `Level ${profile.level} von ${LEVEL_COUNT}`;
  $("setPills").innerHTML = reps.map((n) => `<span>${n}</span>`).join("");
  $("levelSummary").textContent =
    `${levelTotal(profile.level)} Wiederholungen in ${reps.length} Sätzen, ` +
    `90 Sekunden Pause dazwischen.`;
  $("levelDown").disabled = profile.level <= 1;
  $("levelUp").disabled = profile.level >= LEVEL_COUNT;

  // Ein Vorschlag aus dem Maximaltest, solange man ihm nicht gefolgt ist.
  const suggested = profile.lastTestResult ? suggestLevel(profile.lastTestResult) : 0;
  const hint = $("levelHint");
  if (suggested && suggested !== profile.level) {
    hint.textContent =
      `Dein Test von ${profile.lastTestResult} am Stück spricht für Level ${suggested}.`;
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
    complete ? "Training geschafft" : "Training beendet",
    `${done} Wiederholungen in ${workout.actualReps.length} Sätzen ` +
    `(${workout.actualReps.join(" · ")}), geplant waren ${target}. ` +
    `Bester Satz: ${bestSet(workout)}.`,
  );
}

/** Die vier Zahlen auf dem Trainings-Reiter, wie in HomeScreen der App. */
function renderQuickStats() {
  const s = statistics(sessions);
  const tiles = [
    [s.totalReps, "Wiederholungen"],
    [s.workoutCount, "Einheiten"],
    [s.currentStreakDays, "Tage in Folge"],
  ];
  $("quickTiles").innerHTML = tiles
    .map(([n, label]) => `<div><div class="n">${n}</div><div class="l">${label}</div></div>`)
    .join("");

  const progress = goalProgress(s.bestSet, profile.goalReps);
  $("goalLine").textContent =
    `Ziel: ${s.bestSet} von ${profile.goalReps} am Stück (${Math.round(progress * 100)} %) — ändern`;
  $("goalBar").style.width = `${progress * 100}%`;

  $("testLine").textContent = profile.lastTestResult
    ? `Letzter Maximaltest: ${profile.lastTestResult} am Stück`
    : "Noch kein Maximaltest gemacht — der geht in der App.";
}

/** Der volle Verlauf mit allen Zahlen, wie HistoryScreen in der App. */
function renderFullHistory() {
  const s = statistics(sessions);
  const tiles = [
    [s.totalReps, "Wiederholungen"],
    [s.bestSet, "Bester Satz"],
    [s.currentStreakDays, "Tage in Folge"],
    [s.workoutCount, "Einheiten"],
    [s.bestSession, "Beste Einheit"],
    [s.repsLast7Days, "Letzte 7 Tage"],
  ];
  $("fullTiles").innerHTML = tiles
    .map(([n, label]) => `<div><div class="n">${n}</div><div class="l">${label}</div></div>`)
    .join("");

  const sorted = [...sessions].sort((a, b) => b.timestampMillis - a.timestampMillis);
  $("fullHistory").innerHTML = sorted.length
    ? sorted.map((entry) => `
        <div class="listrow" style="cursor:default">
          <div class="grow">
            <div class="name">${totalReps(entry)} Wiederholungen · Level ${entry.level}</div>
            <div class="muted">${escape(entry.actualReps.join(" · "))}</div>
          </div>
          <div class="muted">${new Date(entry.timestampMillis).toLocaleDateString("de-DE")}</div>
          <button class="chip" data-delete="${escape(entry.id)}">Löschen</button>
        </div>`).join("")
    : `<p class="muted">Noch kein Training aufgezeichnet.</p>`;

  $("fullHistory").querySelectorAll("[data-delete]").forEach((button) =>
    button.addEventListener("click", async () => {
      const yes = await ask(
        "Einheit löschen",
        "Sie verschwindet auch aus jeder Gruppe und jedem Vergleich, in dem sie stand.",
        "Löschen",
      );
      if (!yes) return;
      try {
        await deleteSession(button.dataset.delete);
        renderFullHistory();
        renderQuickStats();
      } catch (error) {
        await say("Nicht gelöscht", error.code || error.message);
      }
    }));
}

// Das Ziel laesst sich hier genauso setzen wie in der App - sonst waere es das
// einzige, wofuer man zum Telefon greifen muesste.
$("goalLine").addEventListener("click", async () => {
  const entered = await askForText("Dein Ziel", "Liegestütze am Stück", "Speichern");
  const wanted = Number(entered);
  if (!Number.isFinite(wanted)) return;
  profile.goalReps = Math.min(Math.max(Math.round(wanted), 20), 300);
  renderQuickStats();
  try {
    await writeProfile();
  } catch (error) {
    await say("Nicht gespeichert", error.code || error.message);
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
          <div class="name">Level ${number}${current ? " · dein Level" : ""}</div>
          <div class="muted">${reps.join(" · ")}</div>
        </div>
        <div class="muted">${levelTotal(number)}</div>
      </div>`;
  }).join("");

  const dialog = document.createElement("dialog");
  dialog.innerHTML = `
    <h2>Alle Level</h2>
    <p class="muted">Tippe auf ein Level, um dorthin zu wechseln.</p>
    <div style="max-height:60vh;overflow:auto">${rows}</div>
    <div class="actions"><button class="ghost">Schließen</button></div>`;
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
    await say("Nicht gespeichert", error.code || error.message);
  }
}

$("startWorkout").addEventListener("click", async () => {
  const workout = await runWorkout(profile.level);
  if (!workout) return;
  sessions = [...sessions, workout];
  renderQuickStats();
  renderFullHistory();
  await showSummary(workout);
  try {
    await storeSession(workout);
  } catch (error) {
    await say(
      "Nicht überall gespeichert",
      `Dein Training ist gezählt, konnte aber nicht vollständig hochgeladen werden: ` +
      `${error.code || error.message}`,
    );
  }
});

const RANGES = [[7, "7 Tage"], [30, "30 Tage"], [0, "Gesamt"]];
const SORTS = [["reps", "Wdh."], ["best", "Bester"], ["days", "Tage"]];

function chips(entries, current, attribute) {
  return entries.map(([value, label]) =>
    `<button class="chip" data-${attribute}="${value}" aria-pressed="${value === current}">${label}</button>`,
  ).join("");
}

async function drawGroupDetail(groupId) {
  const panel = $("tab-detail");
  panel.innerHTML = `<div class="card"><p class="muted">Wird geladen …</p></div>`;
  let group;
  try {
    group = await readGroup(groupId);
  } catch (error) {
    panel.innerHTML = `<div class="card"><p class="muted error">Kein Zugriff: ${escape(error.code || error.message)}</p></div>`;
    return;
  }
  $("topTitle").textContent = group.name || "Gruppe ohne Namen";

  const draw = () => {
    const rows = buildLeaderboard(group.members, group.entries, range, sort);
    const total = rows.reduce((sum, r) => sum + r.totalReps, 0);
    const average = rows.length ? Math.floor(total / rows.length) : 0;
    panel.innerHTML = `
      <div class="card stack">
        <p class="muted">Zeitraum</p>
        <div class="chips">${chips(RANGES, range, "range")}</div>
        <p class="muted">Sortierung</p>
        <div class="chips">${chips(SORTS, sort, "sort")}</div>
        <table>
          <thead><tr><th>Name</th><th>Wdh.</th><th>Bester</th><th>Tage</th></tr></thead>
          <tbody>${rows.map((r, index) => `
            <tr class="${r.uid === me.uid ? "self" : ""}">
              <td>${index + 1}. ${escape(r.displayName || "Ohne Namen")}
                ${!r.sharing ? '<span class="sub">Teilen pausiert</span>'
                  : r.level ? `<span class="sub">Level ${r.level}</span>` : ""}</td>
              <td>${r.totalReps}</td><td>${r.bestSet}</td><td>${r.days}</td>
            </tr>`).join("")}
          </tbody>
        </table>
        <p class="muted">Gruppe gesamt ${total} · Durchschnitt ${average}</p>
        <p class="muted">Gruppen-ID: <span class="code">${escape(group.id)}</span></p>
        <p class="muted">Verwalten, umbenennen und verlassen geht in der App.</p>
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
  panel.innerHTML = `<div class="card"><p class="muted">Wird geladen …</p></div>`;
  const friendships = await readFriendships();
  const friendship = friendships.find((f) => f.pairId === pairId);
  if (!friendship) {
    panel.innerHTML = `<div class="card"><p class="muted">Diese Freundschaft besteht nicht mehr.</p></div>`;
    $("topTitle").textContent = "Nicht mehr verbunden";
    return;
  }
  $("topTitle").textContent = friendship.otherName || "Ohne Namen";

  let entries;
  try {
    const snapshot = await getDocs(collection(fb.db, "friendships", pairId, "entries"));
    entries = snapshot.docs.map((d) => d.data());
  } catch (error) {
    panel.innerHTML = `<div class="card"><p class="muted error">Kein Zugriff: ${escape(error.code || error.message)}</p></div>`;
    return;
  }

  const draw = () => {
    const c = buildComparison(
      me.uid, displayName || "Ich", friendship.otherUid,
      friendship.otherName || "Ohne Namen", entries, range,
    );
    const line = (label, a, b) => `
      <div class="value ${a > b ? "ahead" : ""}">${a}</div>
      <div class="label">${label}</div>
      <div class="value ${b > a ? "ahead" : ""}">${b}</div>`;
    panel.innerHTML = `
      <div class="card stack">
        <p class="muted">Zeitraum</p>
        <div class="chips">${chips(RANGES, range, "range")}</div>
        <div class="compare">
          <div class="head">${escape(c.own.displayName)}</div><div></div>
          <div class="head">${escape(c.other.displayName)}</div>
          ${line("Wiederholungen", c.own.totalReps, c.other.totalReps)}
          ${line("Bester Satz", c.own.bestSet, c.other.bestSet)}
          ${line("Trainingstage", c.own.days, c.other.days)}
          ${line("Level", c.own.level, c.other.level)}
          <div class="label">${escape(c.own.lastTrainedOn || "noch nie")}</div>
          <div class="label">zuletzt trainiert</div>
          <div class="label">${escape(c.other.lastTrainedOn || "noch nie")}</div>
        </div>
        ${friendship.pausedBy.includes(friendship.otherUid)
          ? '<p class="muted">Diese Person teilt ihre Zahlen mit dir gerade nicht.</p>' : ""}
        <p class="muted">Entfernen, blockieren und Teilen pausieren geht in der App.</p>
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
  const dialog = document.createElement("dialog");
  dialog.innerHTML = `
    <h2>Konto</h2>
    <p class="muted">${escape(me.email || "Anonymes Konto")}</p>
    <input type="text" id="nameField" placeholder="Anzeigename" autocomplete="off" value="${escape(displayName)}">
    <div class="actions">
      <button class="ghost" id="signOutBtn">Abmelden</button>
      <button id="saveNameBtn">Speichern</button>
    </div>`;
  document.body.append(dialog);
  dialog.addEventListener("close", () => dialog.remove());

  dialog.querySelector("#saveNameBtn").addEventListener("click", async () => {
    const name = dialog.querySelector("#nameField").value.trim().slice(0, 40);
    dialog.close();
    if (!name || name === displayName) return;
    await saveDisplayName(name);
  });
  dialog.querySelector("#signOutBtn").addEventListener("click", async () => {
    dialog.close();
    const yes = await ask(
      "Abmelden",
      "Du meldest dich von diesem Browser ab. Dein Training auf deinem Telefon bleibt " +
      "erhalten. Mit demselben Google-Konto kommst du jederzeit zurück.",
      "Abmelden",
    );
    if (yes) await signOut(fb.auth);
  });

  dialog.showModal();
});

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
  const entered = await askForText("Neue Gruppe", "Name der Gruppe", "Anlegen");
  if (!entered) return;
  const name = entered.slice(0, 40);
  const id = randomId();
  const now = Date.now();
  try {
    await setDoc(doc(fb.db, "groups", id), { name, ownerUid: me.uid, createdAt: now });
    await joinExisting(id, name, now);
    await renderGroupsList();
    setTab("groups");
    openDetail({ type: "group", id });
  } catch (error) {
    await say("Anlegen fehlgeschlagen", error.code || error.message);
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
      fromDisplayName: displayName || "Anonym",
      createdAt: now,
      expiresAt: now + 7 * 86400000,
    });
    const link = `${location.origin}${location.pathname.replace(/app\/?$/, "f/")}?id=${inviteId}`;
    await navigator.clipboard.writeText(link).catch(() => {});
    await say(
      "Einladung erstellt",
      `Der Link ist in der Zwischenablage und sieben Tage gültig: ${link}`,
    );
  } catch (error) {
    await say("Anlegen fehlgeschlagen", error.code || error.message);
  }
}

async function promptJoin(prefill) {
  const input = prefill || await askForText("Gruppe beitreten", "Gruppen-ID oder Link", "Weiter");
  const id = parseId(input);
  if (!id) {
    if (input) await say("Ungültig", "Das sieht nicht nach einer Gruppen-ID aus.");
    return;
  }
  try {
    const snapshot = await getDoc(doc(fb.db, "groups", id));
    if (!snapshot.exists()) {
      await say("Nicht gefunden", "Zu diesem Code gibt es keine Gruppe.");
      return;
    }
    const name = snapshot.data().name || "Gruppe ohne Namen";
    const memberDoc = await getDoc(doc(fb.db, "groups", id, "members", me.uid));
    if (memberDoc.exists()) {
      setTab("groups");
      openDetail({ type: "group", id });
      return;
    }
    const yes = await ask(
      "Gruppe beitreten",
      `„${name}" beitreten? Deine Trainingszahlen erscheinen dann in der Bestenliste dieser Gruppe.`,
      "Beitreten",
    );
    if (!yes) return;
    await joinExisting(id, name, Date.now());
    await backfill(id);
    await renderGroupsList();
    setTab("groups");
    openDetail({ type: "group", id });
  } catch (error) {
    await say("Beitreten fehlgeschlagen", error.code || error.message);
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
    uid: me.uid, displayName: displayName || "Anonym", joinedAt: now, sharing: true,
  }, { merge: true });
  await setDoc(doc(fb.db, "users", me.uid, "memberships", groupId), {
    name: groupName, joinedAt: now, sharing: true,
  }, { merge: true });
}

async function promptRedeem(prefill) {
  const input = prefill || await askForText("Einladung einlösen", "Code oder Link", "Weiter");
  const inviteId = parseId(input);
  if (!inviteId) {
    if (input) await say("Ungültig", "Das sieht nicht nach einem Einladungscode aus.");
    return;
  }
  try {
    const snapshot = await getDoc(doc(fb.db, "invites", inviteId));
    if (!snapshot.exists()) {
      await say("Nicht gefunden", "Zu diesem Code gibt es keine Einladung.");
      return;
    }
    const invite = snapshot.data();
    if (invite.fromUid === me.uid) {
      await say("Deine eigene Einladung", "Diesen Code hast du selbst ausgestellt.");
      return;
    }
    if (invite.acceptedBy || invite.expiresAt < Date.now()) {
      await say(
        "Nicht mehr gültig",
        "Diese Einladung ist abgelaufen oder wurde schon eingelöst. Lass dir eine neue schicken.",
      );
      return;
    }
    const from = invite.fromDisplayName || "Jemand";
    const yes = await ask(
      `Einladung von ${from}`,
      `Mit ${from} verbinden? Ihr seht dann gegenseitig eure Trainingszahlen.`,
      "Verbinden",
    );
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
      names: { [me.uid]: displayName || "Anonym", [invite.fromUid]: from },
    });
    await setDoc(doc(fb.db, "invites", inviteId), { acceptedBy: me.uid }, { merge: true });
    await renderFriendsList();
    setTab("friends");
    openDetail({ type: "friend", pairId });
  } catch (error) {
    await say("Einlösen fehlgeschlagen", error.code || error.message);
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
    await say(
      "Nichts gefunden",
      "Zu diesem Code gibt es weder eine Gruppe noch eine Einladung. " +
      "Vielleicht ein Tippfehler, oder die Einladung wurde zurückgezogen.",
    );
  } catch (error) {
    await say("Das ging schief", `Der Code ließ sich nicht prüfen: ${error.code || error.message}`);
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
