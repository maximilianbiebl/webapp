/*
 * Prüfungen für die Rechenlogik der Webversion.
 *
 * Die Fälle sind dieselben wie in LeaderboardTest.kt und ComparisonTest.kt.
 * Zwei Fassungen derselben Regeln sind nur zu ertragen, wenn beide gegen
 * dieselben Erwartungen laufen.
 *
 * Aufruf: node --test web/logic.test.mjs
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseId, cutoffDate, buildLeaderboard, buildComparison } from "./logic.js";

const member = (uid, sharing = true) => ({ uid, displayName: uid, sharing });
const entry = (uid, performedOn, totalReps, bestSet, level = 1) =>
  ({ uid, performedOn, totalReps, bestSet, level });
const noonOf = (day) => {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(y, m - 1, d, 12, 0, 0, 0);
};

test("Codes werden aus Links wie aus blankem Text gelesen", () => {
  const id = "AbCdEfGhIjKlMnOpQrStUv";
  assert.equal(parseId(id), id);
  assert.equal(parseId(`  ${id}  `), id);
  assert.equal(parseId(`https://liegestutzen.web.app/g/?id=${id}`), id);
  assert.equal(parseId(`https://liegestutzen.web.app/g/${id}`), id);
  assert.equal(parseId("zu-kurz"), null);
  assert.equal(parseId(""), null);
  assert.equal(parseId(null), null);
  assert.equal(parseId(`${id}!`), null);
});

test("Die Woche umfasst heute und die sechs Tage davor", () => {
  const now = noonOf("2026-08-18");
  assert.equal(cutoffDate(7, now), "2026-08-12");
  assert.equal(cutoffDate(30, now), "2026-07-20");
  assert.equal(cutoffDate(0, now), null);
});

test("Jedes Mitglied bekommt eine Zeile, auch ohne einen einzigen Eintrag", () => {
  const rows = buildLeaderboard(
    [member("a"), member("b")],
    [entry("a", "2026-08-18", 50, 20)],
    0, "reps",
  );
  assert.equal(rows.length, 2);
  assert.equal(rows.at(-1).totalReps, 0);
});

test("Wiederholungen addieren sich, der beste Satz ist der hoechste", () => {
  const rows = buildLeaderboard(
    [member("a")],
    [entry("a", "2026-08-17", 50, 20), entry("a", "2026-08-18", 60, 15)],
    0, "reps",
  );
  assert.equal(rows[0].totalReps, 110);
  assert.equal(rows[0].bestSet, 20);
  assert.equal(rows[0].days, 2);
});

test("Zwei Einheiten an einem Tag sind ein Trainingstag", () => {
  const rows = buildLeaderboard(
    [member("a")],
    [entry("a", "2026-08-18", 50, 20), entry("a", "2026-08-18", 40, 18)],
    0, "days",
  );
  assert.equal(rows[0].days, 1);
  assert.equal(rows[0].totalReps, 90);
});

test("Nach bestem Satz sortiert gewinnt jemand anderes als nach Menge", () => {
  const members = [member("viel"), member("hart")];
  const entries = [entry("viel", "2026-08-18", 300, 12), entry("hart", "2026-08-18", 40, 40)];
  assert.equal(buildLeaderboard(members, entries, 0, "reps")[0].uid, "viel");
  assert.equal(buildLeaderboard(members, entries, 0, "best")[0].uid, "hart");
});

test("Das Level stammt vom juengsten Eintrag, unabhaengig vom Zeitraum", () => {
  const rows = buildLeaderboard(
    [member("a"), member("b")],
    [
      entry("a", "2026-06-01", 80, 20, 6),
      entry("a", today(), 90, 22, 11),
      entry("b", "2026-06-02", 40, 10, 3),
    ],
    7, "reps",
  );
  const a = rows.find((r) => r.uid === "a");
  const b = rows.find((r) => r.uid === "b");
  assert.equal(a.level, 11);
  assert.equal(b.totalReps, 0);
  assert.equal(b.level, 3);
});

test("Jede Seite des Vergleichs zaehlt nur ihre eigenen Eintraege", () => {
  const c = buildComparison("ich", "Ich", "du", "Du", [
    entry("ich", today(), 100, 25),
    entry("du", today(), 60, 30),
  ], 0);
  assert.equal(c.own.totalReps, 100);
  assert.equal(c.own.bestSet, 25);
  assert.equal(c.other.totalReps, 60);
  assert.equal(c.other.bestSet, 30);
});

test("Zuletzt trainiert kennt keinen Zeitraum", () => {
  const c = buildComparison("ich", "Ich", "du", "Du", [entry("ich", "2026-01-05", 80, 20)], 7);
  assert.equal(c.own.totalReps, 0);
  assert.equal(c.own.lastTrainedOn, "2026-01-05");
});

test("Wer nie trainiert hat, hat nichts statt irgendetwas Falsches", () => {
  const c = buildComparison("ich", "Ich", "du", "Du", [entry("ich", today(), 50, 20)], 0);
  assert.equal(c.other.totalReps, 0);
  assert.equal(c.other.days, 0);
  assert.equal(c.other.lastTrainedOn, null);
});

function today() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/* ------------------------------------------------------------------ Training */

import { readFileSync, existsSync } from "node:fs";
import { LEVELS, LEVEL_COUNT, levelReps, suggestLevel, goalProgress } from "./levels.js";
import { statistics, currentStreak, daysTrainedAtLevel, dayIndex } from "./stats.js";

const session = (millis, reps, level = 1) => ({
  id: String(millis), timestampMillis: millis, level,
  plannedReps: reps, actualReps: reps, durationSeconds: 60,
});
const daysAgo = (n) => Date.now() - n * 86400000;

test("Die Leiter hat 40 Level, in denen die Saetze streng fallen", () => {
  assert.equal(LEVEL_COUNT, 40);
  for (const reps of LEVELS) {
    assert.equal(reps.length, 5);
    for (let i = 0; i < 4; i += 1) assert.ok(reps[i] > reps[i + 1], reps.join(","));
  }
});

test("Die Leiter stimmt mit der Kotlin-Fassung ueberein", (t) => {
  const path = "../app/src/main/java/de/liegestuetzen/trainer/domain/Levels.kt";
  const here = new URL(path, import.meta.url).pathname;
  if (!existsSync(here)) {
    t.skip("Levels.kt nicht erreichbar - eigenstaendiges Web-Repository");
    return;
  }
  const source = readFileSync(here, "utf8");
  const block = source.slice(
    source.indexOf("val ALL: List<TrainingLevel>"),
    source.indexOf(").mapIndexed"),
  );
  // Nur die Zeilen aus Zahlen: Das aeussere listOf( der Tabelle selbst darf
  // nicht mitgelesen werden.
  const fromKotlin = [...block.matchAll(/listOf\(\s*(\d[\d,\s]*?)\s*\)/g)]
    .map((match) => match[1].split(",").map((n) => Number(n.trim())));
  assert.deepEqual(LEVELS, fromKotlin);
});

test("Hoehere Level sind nie leichter als niedrigere", () => {
  for (let n = 2; n <= LEVEL_COUNT; n += 1) {
    const before = levelReps(n - 1).reduce((a, b) => a + b, 0);
    const now = levelReps(n).reduce((a, b) => a + b, 0);
    assert.ok(now > before, `Level ${n} ist nicht schwerer als ${n - 1}`);
  }
});

test("Das vorgeschlagene Level zielt auf drei Viertel des Maximums", () => {
  assert.equal(suggestLevel(0), 1);
  assert.equal(suggestLevel(-5), 1);
  assert.equal(suggestLevel(4), 1);
  // 20 Wiederholungen -> Obergrenze 15 -> hoechstes Level mit erstem Satz <= 15
  assert.equal(Math.max(...levelReps(suggestLevel(20))), 15);
  assert.ok(suggestLevel(100) <= LEVEL_COUNT);
});

test("Der Zielfortschritt bleibt zwischen null und eins", () => {
  assert.equal(goalProgress(50, 100), 0.5);
  assert.equal(goalProgress(200, 100), 1);
  assert.equal(goalProgress(10, 0), 0);
});

test("Die Statistik summiert, zaehlt und mittelt", () => {
  const s = statistics([
    session(daysAgo(1), [10, 8, 6, 4, 2]),
    session(daysAgo(0), [12, 10, 8, 6, 4]),
  ]);
  assert.equal(s.workoutCount, 2);
  assert.equal(s.totalReps, 30 + 40);
  assert.equal(s.bestSet, 12);
  assert.equal(s.bestSession, 40);
  assert.equal(s.averagePerWorkout, 35);
});

test("Die Serie zaehlt Tage, nicht Einheiten", () => {
  const two = [session(daysAgo(0), [5]), session(daysAgo(0), [5]), session(daysAgo(1), [5])];
  assert.equal(currentStreak(two), 2);
});

test("Gestern haelt die Serie am Leben, vorgestern nicht", () => {
  assert.equal(currentStreak([session(daysAgo(1), [5])]), 1);
  assert.equal(currentStreak([session(daysAgo(2), [5])]), 0);
  assert.equal(currentStreak([]), 0);
});

test("Eine Luecke beendet die Serie", () => {
  const sessions = [session(daysAgo(0), [5]), session(daysAgo(1), [5]), session(daysAgo(3), [5])];
  assert.equal(currentStreak(sessions), 2);
});

test("Trainingstage auf einem Level zaehlen Tage seit dem Wechsel", () => {
  const since = daysAgo(5);
  const sessions = [
    session(daysAgo(4), [5], 3),
    session(daysAgo(4), [5], 3),
    session(daysAgo(2), [5], 3),
    session(daysAgo(1), [5], 4),
    session(daysAgo(9), [5], 3),
  ];
  assert.equal(daysTrainedAtLevel(sessions, 3, since), 2);
});

test("Der Tagesindex ignoriert die Uhrzeit", () => {
  const morning = new Date(2026, 7, 18, 6, 30).getTime();
  const night = new Date(2026, 7, 18, 23, 45).getTime();
  assert.equal(dayIndex(morning), dayIndex(night));
});
