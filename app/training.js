/*
 * Trainieren im Browser.
 *
 * Der Ablauf folgt der App bis in Details: fuenf Sekunden Vorbereitung, dann
 * die Saetze, Pausen dazwischen, und exakt dieselbe Zaehllogik wie in
 * WorkoutViewModel.kt - eine Entprellung gegen Doppeltipper, ein Satz, der
 * sich am Ziel selbst beendet, und Korrekturtasten, die diese Entprellung
 * bewusst umgehen, weil ein Tippen auf "+1" kein Versehen ist.
 *
 * Gezaehlt wird durch Tippen. Das ist in der App die Voreinstellung, weil die
 * Nase auf dem Glas auf jedem Geraet funktioniert; einen Naeherungssensor gibt
 * es im Browser ohnehin nicht.
 */
import { levelReps } from "../levels.js";
import { ask } from "./dialogs.js";
import { t } from "../strings.js";

const $ = (id) => document.getElementById(id);

const PREPARE_SECONDS = 5;

/**
 * Kuerzester Abstand zwischen zwei automatisch gezaehlten Wiederholungen.
 * Derselbe Wert wie MIN_REP_INTERVAL_MILLIS in WorkoutViewModel.kt - ein
 * Doppeltipper auf denselben Liegestuetz soll nicht zweimal zaehlen.
 */
const MIN_REP_INTERVAL_MS = 400;

/** Um so viele Sekunden verlaengert "+30 s" die Pause - derselbe Wert wie addRestSeconds(30) in der App. */
const REST_EXTEND_SECONDS = 30;

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
    let lastRepAt = 0;
    let wakeLock = null;

    const screen = $("workout");
    const els = {
      level: $("wLevel"),
      pills: $("wPills"),
      set: $("wSet"),
      count: $("wCount"),
      of: $("wOf"),
      hint: $("wHint"),
      note: $("wNote"),
      adjust: $("wAdjust"),
      minus: $("wMinus"),
      plus: $("wPlus"),
      restAdjust: $("wRestAdjust"),
      addRest: $("wAddRest"),
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
      els.level.textContent = t("workoutLevel", level);
      drawPills();
      els.adjust.classList.toggle("hidden", phase !== SET);
      els.restAdjust.classList.toggle("hidden", phase !== REST);

      if (phase === PREPARE) {
        els.set.textContent = t("workoutPrepareSet");
        els.count.textContent = String(secondsLeft);
        els.of.textContent = t("workoutPrepareUnit");
        els.hint.textContent = "";
        els.note.textContent = t("workoutPrepareNote", planned[0]);
        els.next.textContent = t("workoutStartNow");
        els.stop.classList.add("hidden");
        screen.classList.remove("hot");
        return;
      }

      if (phase === REST) {
        const done = actual.reduce((sum, n) => sum + n, 0);
        els.set.textContent = t("workoutRestSet", actual.length, planned.length);
        els.count.textContent = String(secondsLeft);
        els.of.textContent = t("workoutRestUnit");
        els.hint.textContent = "";
        els.note.textContent = t("workoutNextSet", planned[setIndex], done);
        els.next.textContent = t("workoutSkipRest");
        els.stop.classList.remove("hidden");
        screen.classList.remove("hot");
        return;
      }

      // SET: dieselbe Formulierung wie "Ziel: %d" in der App.
      const remaining = planned.slice(setIndex + 1);
      els.set.textContent = t("workoutSetOf", setIndex + 1, planned.length);
      els.count.textContent = String(count);
      els.of.textContent = t("workoutTargetOf", planned[setIndex]);
      els.hint.textContent = t("workoutTapHint");
      els.note.textContent = remaining.length
        ? t("workoutThenAlso", remaining.join(" · "))
        : t("workoutLastSet");
      els.next.textContent = t("workoutFinishSet");
      els.stop.classList.add("hidden");
      // Ab dem Ziel färbt sich der Bildschirm. Man sieht es aus dem Augenwinkel,
      // ohne die Zahl lesen zu müssen.
      screen.classList.toggle("hot", count >= planned[setIndex]);
    };

    const releaseWakeLock = () => {
      wakeLock?.release().catch(() => {});
      wakeLock = null;
    };

    /**
     * Haelt den Bildschirm wach, solange trainiert wird - genau das, was
     * `keepScreenOn` in der App per Fensterflag erledigt. Der Browser gibt die
     * Sperre von sich aus frei, sobald der Tab in den Hintergrund geht; beim
     * Zurueckkommen waehrend eines laufenden Satzes wird sie erneut angefragt.
     */
    const acquireWakeLock = async () => {
      if (!("wakeLock" in navigator)) return;
      try {
        wakeLock = await navigator.wakeLock.request("screen");
      } catch {
        // Ohne Sperre laeuft das Training trotzdem - nur schaltet sich der
        // Bildschirm irgendwann von selbst ab.
      }
    };
    const onVisible = () => {
      if (document.visibilityState === "visible" && screen.classList.contains("open")) {
        acquireWakeLock();
      }
    };
    document.addEventListener("visibilitychange", onVisible);

    const finish = (keepProgress) => {
      stopTicker();
      releaseWakeLock();
      document.removeEventListener("visibilitychange", onVisible);
      screen.classList.remove("open", "hot");
      els.tap.removeEventListener("click", tap);
      els.minus.removeEventListener("click", onMinus);
      els.plus.removeEventListener("click", onPlus);
      els.addRest.removeEventListener("click", onAddRest);
      els.next.removeEventListener("click", onNext);
      els.stop.removeEventListener("click", onStop);
      els.abort.removeEventListener("click", onAbort);

      if (!keepProgress || !actual.some((n) => n > 0)) {
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

    /**
     * Beendet den laufenden Satz beim aktuellen Stand - ob am Ziel oder davor.
     * Sowohl das automatische Erreichen des Ziels als auch der Knopf "Satz
     * beenden" laufen hierueber, genau wie finishSet() in der App beides
     * bedient.
     */
    const finishCurrentSet = () => {
      actual.push(count);
      setIndex += 1;
      if (setIndex >= planned.length) {
        finish(true);
        return;
      }
      beginRest();
    };

    /**
     * Zaehlt eine Wiederholung.
     *
     * `forced` uebergeht die Entprellung: Der Tipp auf "+1" ist eine bewusste
     * Korrektur, kein automatisches Signal, das sich verdoppeln koennte - exakt
     * die Unterscheidung, die addRep() gegenueber onTap() in der App trifft.
     * Ein Satz endet sich selbst am Ziel; darueber hinaus zaehlt nichts mehr,
     * weil hier phase bereits auf REST steht.
     */
    const countRep = (forced) => {
      if (phase !== SET) return;
      const now = Date.now();
      if (!forced && now - lastRepAt < MIN_REP_INTERVAL_MS) return;
      lastRepAt = now;
      count += 1;
      draw();
      if (navigator.vibrate) navigator.vibrate(40);
      if (count >= planned[setIndex]) finishCurrentSet();
    };

    const tap = () => countRep(false);
    const onPlus = () => countRep(true);
    /** Keine Entprellung noetig, keine Zielpruefung - ein Herunterzaehlen kann
     *  von sich aus nie automatisch einen Satz beenden. */
    const onMinus = () => {
      if (phase !== SET) return;
      count = Math.max(0, count - 1);
      draw();
    };

    const onNext = () => {
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
      finishCurrentSet();
    };

    /** Pause ueberspringen und sofort aufhoeren - nur zwischen den Saetzen. */
    const onStop = () => finish(true);

    /**
     * Verlaengert die laufende Pause - derselbe "+30 s"-Knopf wie in
     * RestingContent in der App. `secondsLeft` steuert den laufenden Timer
     * direkt, ein Neustart des Countdowns ist nicht noetig.
     */
    const onAddRest = () => {
      if (phase !== REST) return;
      secondsLeft += REST_EXTEND_SECONDS;
      draw();
    };

    const onAbort = async () => {
      const hasProgress = actual.some((n) => n > 0) || count > 0;
      if (!hasProgress) {
        finish(false);
        return;
      }
      const keep = await ask(
        t("workoutAbortTitle"),
        t("workoutAbortBody"),
        t("workoutAbortSave"),
        t("workoutAbortDiscard"),
      );
      finish(keep);
    };

    els.tap.addEventListener("click", tap);
    els.minus.addEventListener("click", onMinus);
    els.plus.addEventListener("click", onPlus);
    els.addRest.addEventListener("click", onAddRest);
    els.next.addEventListener("click", onNext);
    els.stop.addEventListener("click", onStop);
    els.abort.addEventListener("click", onAbort);

    screen.classList.add("open");
    acquireWakeLock();
    countdown(PREPARE_SECONDS, beginSet);
  });
}
