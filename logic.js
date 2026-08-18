/*
 * Die Rechenlogik der Webversion, ohne Firebase und ohne Browser.
 *
 * Getrennt, damit sie sich mit `node --test web/logic.test.mjs` prüfen lässt.
 * Dieselben Regeln stehen in Kotlin unter domain/. Die Kotlin-Fassung ist die
 * mit den ausführlicheren Tests und gilt im Zweifel; die Fälle hier sind
 * absichtlich dieselben, damit ein Auseinanderlaufen auffällt.
 */
export const ID_LENGTH = 22;
const ALPHABET = /^[A-Za-z0-9]+$/;

/**
 * Zieht eine Gruppen- oder Einladungskennung aus dem heraus, was jemand
 * eingefügt hat – Link oder blanker Code, beides kommt vor.
 */
export function parseId(input) {
  if (!input) return null;
  let candidate = String(input).trim();
  try {
    const url = new URL(candidate);
    candidate = url.searchParams.get("id") || url.pathname.split("/").filter(Boolean).pop() || "";
  } catch {
    candidate = candidate.split("/").filter(Boolean).pop() || "";
    candidate = candidate.split("?")[0];
  }
  return candidate.length === ID_LENGTH && ALPHABET.test(candidate) ? candidate : null;
}

/** Ein Datum, wie der Schreiber es genannt hätte: seine Ortszeit, als 2026-08-18. */
export function today(date = new Date()) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function cutoffDate(days, now = new Date()) {
  if (!days) return null;
  const start = new Date(now);
  start.setDate(start.getDate() - (days - 1));
  return today(start);
}

/**
 * Die Bestenliste. Jedes Mitglied bekommt eine Zeile, auch ohne einen einzigen
 * Eintrag – eine fehlende Zeile liest sich wie eine fehlende Person.
 */
export function buildLeaderboard(members, entries, days, sort) {
  const cutoff = cutoffDate(days);
  const inRange = entries.filter((e) => !cutoff || e.performedOn >= cutoff);
  const rows = members.map((member) => {
    const own = inRange.filter((e) => e.uid === member.uid);
    const all = entries.filter((e) => e.uid === member.uid);
    const latest = all.slice().sort((a, b) => a.performedOn.localeCompare(b.performedOn)).pop();
    return {
      uid: member.uid,
      displayName: member.displayName,
      totalReps: own.reduce((sum, e) => sum + e.totalReps, 0),
      bestSet: own.reduce((best, e) => Math.max(best, e.bestSet), 0),
      days: new Set(own.map((e) => e.performedOn)).size,
      level: latest ? latest.level : 0,
      sharing: member.sharing,
    };
  });
  const by = {
    reps: (a, b) => b.totalReps - a.totalReps || b.bestSet - a.bestSet,
    best: (a, b) => b.bestSet - a.bestSet || b.totalReps - a.totalReps,
    days: (a, b) => b.days - a.days || b.totalReps - a.totalReps,
  }[sort];
  rows.sort((a, b) => by(a, b) || a.displayName.localeCompare(b.displayName));
  return rows;
}

/** Zwei Personen nebeneinander. Keine Platzierung – bei zweien wäre das albern. */
export function buildComparison(ownUid, ownName, otherUid, otherName, entries, days) {
  const cutoff = cutoffDate(days);
  const inRange = entries.filter((e) => !cutoff || e.performedOn >= cutoff);
  const side = (uid, name) => {
    const own = inRange.filter((e) => e.uid === uid);
    const all = entries.filter((e) => e.uid === uid);
    const latest = all.slice().sort((a, b) => a.performedOn.localeCompare(b.performedOn)).pop();
    return {
      uid,
      displayName: name,
      totalReps: own.reduce((sum, e) => sum + e.totalReps, 0),
      bestSet: own.reduce((best, e) => Math.max(best, e.bestSet), 0),
      days: new Set(own.map((e) => e.performedOn)).size,
      level: latest ? latest.level : 0,
      lastTrainedOn: latest ? latest.performedOn : null,
    };
  };
  return { own: side(ownUid, ownName), other: side(otherUid, otherName) };
}
