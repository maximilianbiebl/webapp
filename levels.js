/*
 * Die Leiter der 40 Level.
 *
 * ERZEUGT aus domain/Levels.kt - nicht von Hand ändern. Die Tabelle ist der
 * Trainingsinhalt der App; zwei Fassungen, die auseinanderlaufen, wären zwei
 * verschiedene Apps. `logic.test.mjs` liest die Kotlin-Datei und vergleicht,
 * solange sie erreichbar ist.
 *
 * Innerhalb eines Levels fallen die Sätze streng: Der erste ist der größte,
 * jeder folgende kleiner. So wirkt Ermüdung wirklich, und keine Zahl wiederholt
 * sich innerhalb eines Levels.
 */
export const LEVELS = [
  [5, 4, 3, 2, 1],
  [6, 5, 4, 3, 2],
  [7, 6, 5, 4, 3],
  [8, 7, 6, 5, 4],
  [10, 8, 7, 6, 5],
  [11, 9, 8, 7, 6],
  [12, 10, 9, 7, 6],
  [13, 11, 9, 8, 6],
  [14, 12, 10, 8, 7],
  [15, 13, 11, 9, 8],
  [16, 14, 12, 10, 8],
  [18, 15, 13, 11, 9],
  [19, 16, 14, 11, 10],
  [20, 17, 14, 12, 10],
  [21, 18, 15, 13, 10],
  [22, 19, 16, 13, 11],
  [23, 20, 17, 14, 12],
  [25, 21, 18, 15, 12],
  [26, 22, 19, 16, 13],
  [27, 23, 19, 16, 14],
  [28, 24, 20, 17, 14],
  [29, 25, 21, 17, 14],
  [30, 26, 22, 18, 15],
  [31, 26, 22, 19, 16],
  [33, 28, 24, 20, 16],
  [34, 29, 24, 20, 17],
  [35, 30, 25, 21, 18],
  [36, 31, 26, 22, 18],
  [37, 31, 27, 22, 18],
  [38, 32, 27, 23, 19],
  [40, 34, 29, 24, 20],
  [41, 35, 30, 25, 20],
  [42, 36, 30, 25, 21],
  [43, 37, 31, 26, 22],
  [44, 37, 32, 26, 22],
  [45, 38, 32, 27, 22],
  [46, 39, 33, 28, 23],
  [48, 41, 35, 29, 24],
  [49, 42, 35, 29, 24],
  [50, 42, 36, 30, 25]
];

export const LEVEL_COUNT = LEVELS.length;

export function levelReps(number) {
  const index = Math.min(Math.max(number, 1), LEVEL_COUNT) - 1;
  return LEVELS[index];
}

export function levelTotal(number) {
  return levelReps(number).reduce((sum, n) => sum + n, 0);
}

/**
 * Schlägt aus einem Maximaltest ein Startlevel vor.
 *
 * Ein Training muss fünfmal hintereinander gehen, also zielt der erste Satz auf
 * etwa drei Viertel einer einzelnen Höchstleistung.
 */
export function suggestLevel(testMaxReps) {
  if (testMaxReps <= 0) return 1;
  const ceiling = Math.max(Math.trunc(testMaxReps * 0.75), 1);
  for (let number = LEVEL_COUNT; number >= 1; number -= 1) {
    if (Math.max(...levelReps(number)) <= ceiling) return number;
  }
  return 1;
}

/** Fortschritt zum Ziel als Anteil zwischen 0 und 1, gemessen am besten Satz. */
export function goalProgress(bestSingleSet, goalReps) {
  if (goalReps <= 0) return 0;
  return Math.min(Math.max(bestSingleSet / goalReps, 0), 1);
}
