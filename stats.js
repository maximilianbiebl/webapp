/*
 * Die persönlichen Zahlen: was aus dem eigenen Verlauf folgt.
 *
 * Dieselben Regeln wie in domain/Statistics.kt. Ein Trainingstag ist ein Tag,
 * an dem trainiert wurde - nicht eine Einheit. Zwei Sätze an einem Abend sind
 * ein Tag, und die Serie zählt Tage, keine Einheiten.
 */

/** Tage seit der Epoche in der Zeitzone des Geräts. */
export function dayIndex(millis) {
  const date = new Date(millis);
  date.setHours(0, 0, 0, 0);
  return Math.floor(date.getTime() / 86400000);
}

export function totalReps(session) {
  return session.actualReps.reduce((sum, n) => sum + n, 0);
}

export function bestSet(session) {
  return session.actualReps.reduce((best, n) => Math.max(best, n), 0);
}

export function statistics(sessions, nowMillis = Date.now()) {
  if (!sessions.length) {
    return {
      totalReps: 0, workoutCount: 0, bestSet: 0, bestSession: 0,
      currentStreakDays: 0, averagePerWorkout: 0, repsLast7Days: 0,
    };
  }
  const total = sessions.reduce((sum, s) => sum + totalReps(s), 0);
  const weekAgo = nowMillis - 7 * 86400000;
  return {
    totalReps: total,
    workoutCount: sessions.length,
    bestSet: sessions.reduce((best, s) => Math.max(best, bestSet(s)), 0),
    bestSession: sessions.reduce((best, s) => Math.max(best, totalReps(s)), 0),
    currentStreakDays: currentStreak(sessions, nowMillis),
    averagePerWorkout: Math.trunc(total / sessions.length),
    repsLast7Days: sessions
      .filter((s) => s.timestampMillis >= weekAgo)
      .reduce((sum, s) => sum + totalReps(s), 0),
  };
}

/**
 * Aufeinanderfolgende Tage mit mindestens einer Einheit, endend heute oder
 * gestern. Gestern zählt noch, damit die Serie nicht mitten am Tag reißt.
 */
export function currentStreak(sessions, nowMillis = Date.now()) {
  const days = [...new Set(sessions.map((s) => dayIndex(s.timestampMillis)))]
    .sort((a, b) => b - a);
  if (!days.length) return 0;

  const today = dayIndex(nowMillis);
  if (days[0] !== today && days[0] !== today - 1) return 0;

  let expected = days[0];
  let streak = 0;
  for (const day of days) {
    if (day === expected) {
      streak += 1;
      expected -= 1;
    } else if (day < expected) {
      break;
    }
  }
  return streak;
}

/** Verschiedene Kalendertage, an denen auf diesem Level trainiert wurde. */
export function daysTrainedAtLevel(sessions, level, sinceMillis) {
  const days = sessions
    .filter((s) => s.level === level && s.timestampMillis >= sinceMillis)
    .map((s) => dayIndex(s.timestampMillis));
  return new Set(days).size;
}
