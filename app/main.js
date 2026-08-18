/*
 * Die Webversion.
 *
 * Bewusst lesend, mit zwei Ausnahmen: beitreten und eine Einladung einlösen.
 * Trainieren gehört auf das Gerät, das man beim Trainieren dabeihat; was hier
 * wirklich hilft, ist der große Bildschirm für Bestenliste und Vergleich.
 *
 * Kein Bauschritt, keine Abhängigkeiten außer dem Firebase-SDK direkt von
 * Google. Die Datei lässt sich lesen wie sie ausgeliefert wird.
 */
import {
  firebase, isConfigured, onAuthStateChanged, signInWithPopup, GoogleAuthProvider,
  signOut, doc, getDoc, setDoc, deleteDoc, collection, getDocs, query, where,
  parseId, buildLeaderboard, buildComparison, ID_LENGTH,
} from "../shared.js";

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

if (!isConfigured) {
  show($("unconfigured"), true);
  show($("signIn"), false);
} else {
  fb = firebase();
  onAuthStateChanged(fb.auth, (user) => {
    me = user;
    show($("signIn"), !user);
    show($("app"), Boolean(user));
    show($("signOut"), Boolean(user));
    if (user) start();
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

$("signOut").addEventListener("click", () => signOut(fb.auth));

/* ---------------------------------------------------------------- Daten */

const profileRef = () => doc(fb.db, "profiles", me.uid);
const membershipsRef = () => collection(fb.db, "users", me.uid, "memberships");

async function readMyProfile() {
  const snapshot = await getDoc(profileRef());
  return snapshot.exists() ? snapshot.data().displayName || "" : "";
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
  $("whoami").textContent = displayName || "Ohne Namen";
  $("whoamiSub").textContent = me.email || "Anonymes Konto";
  $("name").value = displayName;

  await Promise.all([renderGroups(), renderFriends()]);
  await handleDeepLinks();
}

async function renderGroups() {
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
      row.addEventListener("click", () => openGroup(row.dataset.group)));
  } catch (error) {
    box.innerHTML = `<p class="muted error">Gruppen nicht lesbar: ${escape(error.code || error.message)}</p>`;
  }
}

async function renderFriends() {
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
      row.addEventListener("click", () => {
        const friendship = accepted.find((f) => f.pairId === row.dataset.friend);
        openFriend(friendship);
      }));
  } catch (error) {
    box.innerHTML = `<p class="muted error">Freunde nicht lesbar: ${escape(error.code || error.message)}</p>`;
  }
}

const RANGES = [[7, "7 Tage"], [30, "30 Tage"], [0, "Gesamt"]];
const SORTS = [["reps", "Wdh."], ["best", "Bester"], ["days", "Tage"]];

function chips(entries, current, attribute) {
  return entries.map(([value, label]) =>
    `<button class="chip" data-${attribute}="${value}" aria-pressed="${value === current}">${label}</button>`,
  ).join("");
}

async function openGroup(groupId) {
  const detail = $("detail");
  detail.innerHTML = `<div class="card"><p class="muted">Wird geladen …</p></div>`;
  detail.scrollIntoView({ behavior: "smooth", block: "start" });
  let group;
  try {
    group = await readGroup(groupId);
  } catch (error) {
    detail.innerHTML = `<div class="card"><p class="muted error">Kein Zugriff: ${escape(error.code || error.message)}</p></div>`;
    return;
  }

  const draw = () => {
    const rows = buildLeaderboard(group.members, group.entries, range, sort);
    const total = rows.reduce((sum, r) => sum + r.totalReps, 0);
    const average = rows.length ? Math.floor(total / rows.length) : 0;
    detail.innerHTML = `
      <div class="card stack">
        <h2>${escape(group.name || "Gruppe ohne Namen")}</h2>
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
    detail.querySelectorAll("[data-range]").forEach((chip) =>
      chip.addEventListener("click", () => { range = Number(chip.dataset.range); draw(); }));
    detail.querySelectorAll("[data-sort]").forEach((chip) =>
      chip.addEventListener("click", () => { sort = chip.dataset.sort; draw(); }));
  };
  draw();
}

async function openFriend(friendship) {
  const detail = $("detail");
  detail.innerHTML = `<div class="card"><p class="muted">Wird geladen …</p></div>`;
  detail.scrollIntoView({ behavior: "smooth", block: "start" });
  let entries;
  try {
    const snapshot = await getDocs(
      collection(fb.db, "friendships", friendship.pairId, "entries"),
    );
    entries = snapshot.docs.map((d) => d.data());
  } catch (error) {
    detail.innerHTML = `<div class="card"><p class="muted error">Kein Zugriff: ${escape(error.code || error.message)}</p></div>`;
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
    detail.innerHTML = `
      <div class="card stack">
        <h2>Direktvergleich</h2>
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
      </div>`;
    detail.querySelectorAll("[data-range]").forEach((chip) =>
      chip.addEventListener("click", () => { range = Number(chip.dataset.range); draw(); }));
  };
  draw();
}

/* ------------------------------------------------------------- Schreiben */

$("saveName").addEventListener("click", async () => {
  const name = $("name").value.trim().slice(0, 40);
  if (!name) return;
  await setDoc(profileRef(), { displayName: name, updatedAt: Date.now() }, { merge: true });
  displayName = name;
  $("whoami").textContent = name;
  // Der Name liegt in jeder Gruppe noch einmal, damit Mitgliederlisten ohne
  // Nachladen auskommen. Also muss er dort mitgezogen werden.
  const groups = await readGroups();
  await Promise.all(groups.map((g) =>
    setDoc(doc(fb.db, "groups", g.id, "members", me.uid), { displayName: name }, { merge: true })));
  const friendships = await readFriendships();
  await Promise.all(friendships.map((f) =>
    setDoc(doc(fb.db, "friendships", f.pairId), { names: { [me.uid]: name } }, { merge: true })));
});

$("newGroup").addEventListener("click", async () => {
  const name = prompt("Wie soll die Gruppe heißen?");
  if (!name || !name.trim()) return;
  const id = randomId();
  const now = Date.now();
  try {
    await setDoc(doc(fb.db, "groups", id), {
      name: name.trim().slice(0, 40), ownerUid: me.uid, createdAt: now,
    });
    await joinExisting(id, name.trim().slice(0, 40), now);
    await renderGroups();
    openGroup(id);
  } catch (error) {
    alert(`Anlegen fehlgeschlagen: ${error.code || error.message}`);
  }
});

$("joinGroup").addEventListener("click", () => promptJoin());
$("redeem").addEventListener("click", () => promptRedeem());

async function promptJoin(prefill) {
  const input = prefill || prompt("Gruppen-ID oder Link");
  const id = parseId(input);
  if (!id) return;
  try {
    const snapshot = await getDoc(doc(fb.db, "groups", id));
    if (!snapshot.exists()) {
      alert("Diese Gruppe gibt es nicht.");
      return;
    }
    const name = snapshot.data().name || "";
    if (!confirm(`„${name}" beitreten?`)) return;
    await joinExisting(id, name, Date.now());
    await renderGroups();
    openGroup(id);
  } catch (error) {
    alert(`Beitreten fehlgeschlagen: ${error.code || error.message}`);
  }
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
  const input = prefill || prompt("Freundschaftscode oder Link");
  const inviteId = parseId(input);
  if (!inviteId) return;
  try {
    const snapshot = await getDoc(doc(fb.db, "invites", inviteId));
    if (!snapshot.exists()) {
      alert("Diese Einladung gibt es nicht.");
      return;
    }
    const invite = snapshot.data();
    if (invite.fromUid === me.uid) {
      alert("Das ist deine eigene Einladung.");
      return;
    }
    if (invite.acceptedBy || invite.expiresAt < Date.now()) {
      alert("Diese Einladung ist abgelaufen oder schon eingelöst.");
      return;
    }
    const from = invite.fromDisplayName || "Jemand";
    if (!confirm(`Mit ${from} verbinden? Ihr seht dann gegenseitig eure Zahlen.`)) return;
    const uids = [me.uid, invite.fromUid].sort();
    await setDoc(doc(fb.db, "friendships", uids.join("_")), {
      uids,
      status: "accepted",
      requestedBy: invite.fromUid,
      viaInvite: inviteId,
      createdAt: Date.now(),
      pausedBy: [],
      names: { [me.uid]: displayName || "Anonym", [invite.fromUid]: from },
    });
    await setDoc(doc(fb.db, "invites", inviteId), { acceptedBy: me.uid }, { merge: true });
    await renderFriends();
  } catch (error) {
    alert(`Einlösen fehlgeschlagen: ${error.code || error.message}`);
  }
}

/** Wer über einen Einladungslink hereinkommt, soll nichts abtippen müssen. */
async function handleDeepLinks() {
  const join = parseId(params.get("join"));
  const invite = parseId(params.get("invite"));
  if (join) await promptJoin(join);
  if (invite) await promptRedeem(invite);
  if (join || invite) history.replaceState(null, "", location.pathname);
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
