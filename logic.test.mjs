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
