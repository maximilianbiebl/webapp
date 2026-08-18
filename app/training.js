/*
 * Trainieren im Browser.
 *
 * Gezählt wird durch Tippen - genau wie in der App, wo das die Standardeinstellung
 * ist, weil die Nase auf dem Glas auf jedem Gerät funktioniert. Einen
 * Näherungssensor gibt es im Browser nicht.
 *
 * Der Ablauf ist derselbe wie in der App: fünf Sätze mit festen Zielen,
 * dazwischen eine Pause, und die Möglichkeit, jederzeit aufzuhören. Kein
 * "so viele wie du kannst" - man soll vorher wissen, was ein Training kostet.
 */
import { levelReps } from "../levels.js";

const $ = (id) => document.getElementById(id);

/**
 * Führt ein Training durch und löst mit der fertigen Einheit auf, oder mit
 * null, wenn abgebrochen wurde.
 */
export function runWorkout(level, restSeconds = 90) {
  return new Promise((resolve) => {
    const planned = levelReps(level);
    const actual = [];
    const startedAt = Date.now();

    let setIndex = 0;
    let count = 0;
    let resting = false;
    let restLeft = 0;
    let ticker = null;

    const screen = $("workout");
    const setLine = $("wSet");
    const countBox = $("wCount");
    const ofBox = $("wOf");
    const nextButton = $("wNext");
    const abortButton = $("wAbort");
    const tapZone = $("wTap");

    const draw = () => {
      if (resting) {
        setLine.textContent = `Pause vor Satz ${setIndex + 1} von ${planned.length}`;
        countBox.textContent = String(restLeft);
        ofBox.textContent = "Sekunden";
        nextButton.textContent = "Pause überspringen";
        screen.classList.remove("hot");
        return;
      }
      setLine.textContent = `Satz ${setIndex + 1} von ${planned.length}`;
      countBox.textContent = String(count);
      ofBox.textContent = `von ${planned[setIndex]}`;
      nextButton.textContent = setIndex === planned.length - 1 ? "Fertig" : "Satz fertig";
      // Ab dem Ziel wird der Bildschirm farbig: Man sieht es aus dem Augenwinkel,
      // ohne die Zahl lesen zu muessen.
      screen.classList.toggle("hot", count >= planned[setIndex]);
    };

    const stopTicker = () => {
      if (ticker) clearInterval(ticker);
      ticker = null;
    };

    const finish = (completed) => {
      stopTicker();
      screen.classList.remove("open", "hot");
      tapZone.removeEventListener("click", tap);
      nextButton.removeEventListener("click", advance);
      abortButton.removeEventListener("click", abort);
      if (!completed || !actual.some((n) => n > 0)) {
        resolve(null);
        return;
      }
      resolve({
        id: `${startedAt}-${Math.random().toString(36).slice(2, 8)}`,
        timestampMillis: startedAt,
        level,
        // Nur die wirklich absolvierten Saetze zaehlen als geplant, sonst saehe
        // ein vorzeitig beendetes Training aus wie ein gescheitertes.
        plannedReps: planned.slice(0, actual.length),
        actualReps: actual,
        durationSeconds: Math.round((Date.now() - startedAt) / 1000),
      });
    };

    const beginRest = () => {
      if (setIndex >= planned.length) {
        finish(true);
        return;
      }
      resting = true;
      restLeft = restSeconds;
      draw();
      ticker = setInterval(() => {
        restLeft -= 1;
        if (restLeft <= 0) {
          stopTicker();
          resting = false;
          count = 0;
        }
        draw();
      }, 1000);
    };

    const advance = () => {
      if (resting) {
        stopTicker();
        resting = false;
        count = 0;
        draw();
        return;
      }
      actual.push(count);
      setIndex += 1;
      count = 0;
      if (setIndex >= planned.length) {
        finish(true);
        return;
      }
      beginRest();
    };

    const tap = () => {
      if (resting) return;
      count += 1;
      draw();
      if (navigator.vibrate) navigator.vibrate(40);
    };

    const abort = () => finish(false);

    tapZone.addEventListener("click", tap);
    nextButton.addEventListener("click", advance);
    abortButton.addEventListener("click", abort);

    screen.classList.add("open");
    draw();
  });
}
