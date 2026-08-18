/*
 * Trainieren im Browser.
 *
 * Der Ablauf folgt der App: eine kurze Vorbereitung, dann fünf Sätze mit festen
 * Zielen und Pausen dazwischen. Kein "so viele wie du kannst" — man soll vorher
 * wissen, was ein Training kostet.
 *
 * Gezählt wird durch Tippen. Das ist in der App die Voreinstellung, weil die
 * Nase auf dem Glas auf jedem Gerät funktioniert; einen Näherungssensor gibt es
 * im Browser ohnehin nicht.
 *
 * Auf dem Bildschirm steht immer, wo man gerade ist: welcher Satz von wie
 * vielen, was noch kommt, was schon geschafft ist. Wer unten liegt, sieht das
 * Display schräg und will nicht rechnen müssen.
 */
import { levelReps } from "../levels.js";

const $ = (id) => document.getElementById(id);

const PREPARE_SECONDS = 5;

/** Die Phasen, in denen ein Training sein kann. */
const PREPARE = "prepare";
const SET = "set";
const REST = "rest";

/**
 * Führt ein Training durch.
 *
 * Löst mit der fertigen Einheit auf, oder mit null, wenn nichts zustande kam.
 * Vorzeitig beenden ist kein Abbruch: Was geschafft wurde, zählt.
 */
export function runWorkout(level, restSeconds = 90) {
  return new Promise((resolve) => {
    const planned = levelReps(level);
    const actual = [];
    const startedAt = Date.now();

    let phase = PREPARE;
    let setIndex = 0;
    let count = 0;
    let secondsLeft = PREPARE_SECONDS;
    let ticker = null;

    const screen = $("workout");
    const els = {
      level: $("wLevel"),
      pills: $("wPills"),
      set: $("wSet"),
      count: $("wCount"),
      of: $("wOf"),
      note: $("wNote"),
      next: $("wNext"),
      stop: $("wStop"),
      abort: $("wAbort"),
      tap: $("wTap"),
    };

    const stopTicker = () => {
      if (ticker) clearInterval(ticker);
      ticker = null;
    };

    const countdown = (seconds, onDone) => {
      stopTicker();
      secondsLeft = seconds;
      draw();
      ticker = setInterval(() => {
        secondsLeft -= 1;
        if (secondsLeft <= 0) {
          stopTicker();
          onDone();
        }
        draw();
      }, 1000);
    };

    const drawPills = () => {
      els.pills.innerHTML = planned.map((reps, index) => {
        const done = index < actual.length;
        const active = index === setIndex && phase !== PREPARE;
        const label = done ? actual[index] : reps;
        const classes = [done ? "done" : "", active ? "active" : ""].join(" ").trim();
        return `<span class="${classes}">${label}</span>`;
      }).join("");
    };

    const draw = () => {
      els.level.textContent = `Level ${level}`;
      drawPills();

      if (phase === PREPARE) {
        els.set.textContent = "Gleich geht es los";
        els.count.textContent = String(secondsLeft);
        els.of.textContent = "Sekunden";
        els.note.textContent = `Erster Satz: ${planned[0]} Wiederholungen`;
        els.next.textContent = "Jetzt starten";
        els.stop.classList.add("hidden");
        screen.classList.remove("hot");
        return;
      }

      if (phase === REST) {
        const done = actual.reduce((sum, n) => sum + n, 0);
        els.set.textContent = `Pause · ${actual.length} von ${planned.length} Sätzen geschafft`;
        els.count.textContent = String(secondsLeft);
        els.of.textContent = "Sekunden Pause";
        els.note.textContent =
          `Nächster Satz: ${planned[setIndex]} Wiederholungen · bisher ${done} gesamt`;
        els.next.textContent = "Pause überspringen";
        els.stop.classList.remove("hidden");
        screen.classList.remove("hot");
        return;
      }

      const remaining = planned.slice(setIndex + 1);
      els.set.textContent = `Satz ${setIndex + 1} von ${planned.length}`;
      els.count.textContent = String(count);
      els.of.textContent = `von ${planned[setIndex]}`;
      els.note.textContent = remaining.length
        ? `Danach noch: ${remaining.join(" · ")}`
        : "Letzter Satz";
      els.next.textContent = setIndex === planned.length - 1 ? "Fertig" : "Satz fertig";
      els.stop.classList.add("hidden");
      // Ab dem Ziel färbt sich der Bildschirm. Man sieht es aus dem Augenwinkel,
      // ohne die Zahl lesen zu müssen.
      screen.classList.toggle("hot", count >= planned[setIndex]);
    };

    const finish = () => {
      stopTicker();
      screen.classList.remove("open", "hot");
      els.tap.removeEventListener("click", tap);
      els.next.removeEventListener("click", advance);
      els.stop.removeEventListener("click", stopHere);
      els.abort.removeEventListener("click", abort);

      if (!actual.some((n) => n > 0)) {
        resolve(null);
        return;
      }
      resolve({
        id: `${startedAt}-${Math.random().toString(36).slice(2, 8)}`,
        timestampMillis: startedAt,
        level,
        // Nur die wirklich angetretenen Sätze zählen als geplant, sonst sähe ein
        // vorzeitig beendetes Training aus wie ein gescheitertes.
        plannedReps: planned.slice(0, actual.length),
        actualReps: actual,
        durationSeconds: Math.round((Date.now() - startedAt) / 1000),
      });
    };

    const beginSet = () => {
      phase = SET;
      count = 0;
      draw();
    };

    const beginRest = () => {
      phase = REST;
      draw();
      countdown(restSeconds, beginSet);
    };

    const advance = () => {
      if (phase === PREPARE) {
        stopTicker();
        beginSet();
        return;
      }
      if (phase === REST) {
        stopTicker();
        beginSet();
        return;
      }
      actual.push(count);
      setIndex += 1;
      if (setIndex >= planned.length) {
        finish();
        return;
      }
      beginRest();
    };

    /** Vorzeitig beenden. Nur zwischen den Sätzen — mitten im Satz wäre es ein
     *  Fehltipper, und der Knopf säße genau dort, wo gezählt wird. */
    const stopHere = () => finish();

    const abort = () => {
      actual.length = 0;
      finish();
    };

    const tap = () => {
      if (phase !== SET) return;
      count += 1;
      draw();
      if (navigator.vibrate) navigator.vibrate(40);
    };

    els.tap.addEventListener("click", tap);
    els.next.addEventListener("click", advance);
    els.stop.addEventListener("click", stopHere);
    els.abort.addEventListener("click", abort);

    screen.classList.add("open");
    countdown(PREPARE_SECONDS, beginSet);
  });
}
