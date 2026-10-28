/**
 * workout-logger.js — Workout Logger State Management & LocalStorage Engine
 *
 * Core data structure:
 * localStorage['fitdata_workout_logs'] = Array<WorkoutSession>
 *
 * WorkoutSession:
 * {
 *   id: string,
 *   title: string,
 *   date: string (ISO),
 *   durationMinutes: number,
 *   notes: string,
 *   exercises: [
 *     {
 *       exerciseId: string,
 *       exerciseName: string,
 *       bodyPart: string,
 *       equipment: string,
 *       target: string,
 *       sets: [
 *         { setNum: number, weight: number, reps: number, rpe: number|null, completed: boolean }
 *       ]
 *     }
 *   ],
 *   totalVolume: number,
 *   totalSets: number
 * }
 */

'use strict';

const STORAGE_KEY = 'fitdata_workout_logs';
const ACTIVE_SESSION_KEY = 'fitdata_active_workout_session';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function generateId() {
  return 'log_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
}

/** Epley formula: 1RM = Weight * (1 + Reps / 30) */
export function estimate1RM(weight, reps) {
  if (!weight || weight <= 0 || !reps || reps <= 0) return 0;
  if (reps === 1) return weight;
  return Math.round(weight * (1 + reps / 30) * 10) / 10;
}

export function calculateSessionVolume(exercises) {
  let volume = 0;
  let totalSets = 0;
  (exercises || []).forEach(ex => {
    (ex.sets || []).forEach(s => {
      totalSets++;
      const w = parseFloat(s.weight) || 0;
      const r = parseInt(s.reps, 10) || 0;
      volume += w * r;
    });
  });
  return { volume: Math.round(volume * 10) / 10, totalSets };
}

// ---------------------------------------------------------------------------
// Storage CRUD
// ---------------------------------------------------------------------------

export function getWorkoutLogs() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    console.error('Failed to parse workout logs from localStorage:', err);
    return [];
  }
}

export function saveWorkoutLog(session) {
  const logs = getWorkoutLogs();
  const { volume, totalSets } = calculateSessionVolume(session.exercises);

  const newSession = {
    id: session.id || generateId(),
    title: session.title?.trim() || `Workout on ${new Date().toLocaleDateString()}`,
    date: session.date || new Date().toISOString(),
    durationMinutes: parseInt(session.durationMinutes, 10) || 0,
    notes: session.notes?.trim() || '',
    exercises: session.exercises || [],
    totalVolume: volume,
    totalSets: totalSets,
    createdAt: session.createdAt || Date.now(),
  };

  const existingIdx = logs.findIndex(l => l.id === newSession.id);
  if (existingIdx >= 0) {
    logs[existingIdx] = newSession;
  } else {
    logs.unshift(newSession); // newest first
  }

  localStorage.setItem(STORAGE_KEY, JSON.stringify(logs));
  window.dispatchEvent(new CustomEvent('workout-logs-changed', { detail: { session: newSession } }));
  return newSession;
}

export function deleteWorkoutLog(logId) {
  let logs = getWorkoutLogs();
  logs = logs.filter(l => l.id !== logId);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(logs));
  window.dispatchEvent(new CustomEvent('workout-logs-changed', { detail: { deletedId: logId } }));
}

export function clearAllWorkoutLogs() {
  localStorage.removeItem(STORAGE_KEY);
  window.dispatchEvent(new CustomEvent('workout-logs-changed', { detail: { cleared: true } }));
}

// ---------------------------------------------------------------------------
// Exercise-specific history & Personal Records (PR)
// ---------------------------------------------------------------------------

export function getExerciseLogs(exerciseId) {
  const logs = getWorkoutLogs();
  const result = [];

  logs.forEach(session => {
    (session.exercises || []).forEach(ex => {
      if (ex.exerciseId === exerciseId || ex.exerciseName?.toLowerCase() === exerciseId?.toLowerCase()) {
        (ex.sets || []).forEach(s => {
          result.push({
            sessionId: session.id,
            sessionTitle: session.title,
            date: session.date,
            setNum: s.setNum,
            weight: parseFloat(s.weight) || 0,
            reps: parseInt(s.reps, 10) || 0,
            rpe: s.rpe ? parseFloat(s.rpe) : null,
            volume: (parseFloat(s.weight) || 0) * (parseInt(s.reps, 10) || 0),
            est1RM: estimate1RM(parseFloat(s.weight) || 0, parseInt(s.reps, 10) || 0),
          });
        });
      }
    });
  });

  return result;
}

export function getExercisePR(exerciseId) {
  const sets = getExerciseLogs(exerciseId);
  if (sets.length === 0) return null;

  let maxWeightSet = sets[0];
  let max1RMSet = sets[0];

  sets.forEach(s => {
    if (s.weight > maxWeightSet.weight) maxWeightSet = s;
    if (s.est1RM > max1RMSet.est1RM) max1RMSet = s;
  });

  return {
    maxWeight: maxWeightSet.weight,
    maxWeightReps: maxWeightSet.reps,
    maxWeightDate: maxWeightSet.date,
    bestEst1RM: max1RMSet.est1RM,
    totalSetsLogged: sets.length,
    lastLoggedDate: sets[0]?.date,
  };
}

export function getAllPRs() {
  const logs = getWorkoutLogs();
  const map = new Map();

  logs.forEach(session => {
    (session.exercises || []).forEach(ex => {
      const key = ex.exerciseId || ex.exerciseName;
      if (!key) return;

      if (!map.has(key)) {
        map.set(key, {
          exerciseId: ex.exerciseId || '',
          exerciseName: ex.exerciseName || key,
          bodyPart: ex.bodyPart || '',
          target: ex.target || '',
          equipment: ex.equipment || '',
          maxWeight: 0,
          maxWeightReps: 0,
          maxWeightDate: null,
          bestEst1RM: 0,
          best1RMDate: null,
          totalSets: 0,
          totalVolume: 0,
          sessionDates: new Set(),
        });
      }

      const pr = map.get(key);
      if (!pr.target && ex.target) pr.target = ex.target;
      if (!pr.bodyPart && ex.bodyPart) pr.bodyPart = ex.bodyPart;
      if (!pr.equipment && ex.equipment) pr.equipment = ex.equipment;
      if (session.date) pr.sessionDates.add(session.date.split('T')[0]);

      (ex.sets || []).forEach(s => {
        pr.totalSets++;
        const w = parseFloat(s.weight) || 0;
        const r = parseInt(s.reps, 10) || 0;
        const vol = w * r;
        pr.totalVolume += vol;
        const e1rm = estimate1RM(w, r);

        if (w > pr.maxWeight || (w === pr.maxWeight && r > pr.maxWeightReps)) {
          pr.maxWeight = w;
          pr.maxWeightReps = r;
          pr.maxWeightDate = session.date;
        }

        if (e1rm > pr.bestEst1RM) {
          pr.bestEst1RM = e1rm;
          pr.best1RMDate = session.date;
        }
      });
    });
  });

  return Array.from(map.values())
    .map(p => ({
      ...p,
      totalSessions: p.sessionDates.size,
      sessionDates: undefined,
    }))
    .filter(p => p.bestEst1RM > 0 || p.maxWeight > 0)
    .sort((a, b) => b.bestEst1RM - a.bestEst1RM);
}

// ---------------------------------------------------------------------------
// Custom Workout Routines (Builder)
// ---------------------------------------------------------------------------

const ROUTINES_KEY = 'fitdata_custom_routines';

export function getCustomRoutines() {
  try {
    const raw = localStorage.getItem(ROUTINES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    console.error('Failed to load custom routines:', err);
    return [];
  }
}

export function saveCustomRoutine(routine) {
  const routines = getCustomRoutines();
  if (!routine.id) {
    routine.id = 'rtn_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
    routine.createdAt = new Date().toISOString();
    routines.unshift(routine);
  } else {
    const idx = routines.findIndex(r => r.id === routine.id);
    if (idx !== -1) {
      routine.updatedAt = new Date().toISOString();
      routines[idx] = routine;
    } else {
      routines.unshift(routine);
    }
  }
  localStorage.setItem(ROUTINES_KEY, JSON.stringify(routines));
  window.dispatchEvent(new CustomEvent('custom-routines-changed', { detail: { routine } }));
  return routine;
}

export function deleteCustomRoutine(routineId) {
  const routines = getCustomRoutines().filter(r => r.id !== routineId);
  localStorage.setItem(ROUTINES_KEY, JSON.stringify(routines));
  window.dispatchEvent(new CustomEvent('custom-routines-changed', { detail: { deletedId: routineId } }));
}

export function loadRoutineIntoSession(routineId) {
  const routines = getCustomRoutines();
  const routine = routines.find(r => r.id === routineId);
  if (!routine) return null;

  const now = new Date();
  const session = {
    title: routine.title || 'Custom Workout',
    date: now.toISOString(),
    notes: routine.notes || '',
    exercises: (routine.exercises || []).map(ex => ({
      exerciseId: ex.exerciseId || '',
      exerciseName: ex.exerciseName || '',
      bodyPart: ex.bodyPart || '',
      equipment: ex.equipment || '',
      target: ex.target || '',
      sets: Array.from({ length: ex.targetSets || 3 }, (_, i) => ({
        setNum: i + 1,
        weight: ex.defaultWeight || '',
        reps: ex.targetReps || 10,
        rpe: null,
        completed: false,
      })),
    })),
  };

  saveActiveSession(session);
  return session;
}

/** Quick log a single set directly from the exercise page */
export function quickLogSet(exerciseData, weight, reps, rpe = null) {
  const todayDate = new Date();
  const todayStr = todayDate.toISOString().split('T')[0];
  const logs = getWorkoutLogs();

  // Find or create today's quick log session
  let todaySession = logs.find(l => l.date && l.date.startsWith(todayStr));

  const setItem = {
    setNum: 1,
    weight: parseFloat(weight) || 0,
    reps: parseInt(reps, 10) || 0,
    rpe: rpe ? parseFloat(rpe) : null,
    completed: true,
  };

  if (!todaySession) {
    todaySession = {
      id: generateId(),
      title: `Workout on ${todayDate.toLocaleDateString()}`,
      date: todayDate.toISOString(),
      durationMinutes: 30,
      notes: 'Quick logged',
      exercises: [
        {
          exerciseId: exerciseData.id,
          exerciseName: exerciseData.name,
          bodyPart: exerciseData.body_part || exerciseData.bodyPart || '',
          equipment: exerciseData.equipment || '',
          target: exerciseData.target || '',
          sets: [setItem],
        }
      ],
    };
    saveWorkoutLog(todaySession);
  } else {
    // Add set to existing exercise in today's session or create exercise entry
    let exEntry = todaySession.exercises.find(e => e.exerciseId === exerciseData.id || e.exerciseName === exerciseData.name);
    if (!exEntry) {
      exEntry = {
        exerciseId: exerciseData.id,
        exerciseName: exerciseData.name,
        bodyPart: exerciseData.body_part || exerciseData.bodyPart || '',
        equipment: exerciseData.equipment || '',
        target: exerciseData.target || '',
        sets: [setItem],
      };
      todaySession.exercises.push(exEntry);
    } else {
      setItem.setNum = (exEntry.sets.length || 0) + 1;
      exEntry.sets.push(setItem);
    }
    saveWorkoutLog(todaySession);
  }

  return todaySession;
}

// ---------------------------------------------------------------------------
// Active Session In-Progress Tracker (Draft in localStorage)
// ---------------------------------------------------------------------------

export function getActiveSession() {
  try {
    const raw = localStorage.getItem(ACTIVE_SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveActiveSession(session) {
  if (!session) {
    localStorage.removeItem(ACTIVE_SESSION_KEY);
  } else {
    localStorage.setItem(ACTIVE_SESSION_KEY, JSON.stringify(session));
  }
}

// ---------------------------------------------------------------------------
// Stats calculation
// ---------------------------------------------------------------------------

export function getWorkoutStats() {
  const logs = getWorkoutLogs();
  let totalVolume = 0;
  let totalSets = 0;
  let totalMinutes = 0;

  const now = new Date();
  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  let workoutsThisWeek = 0;

  logs.forEach(l => {
    totalVolume += l.totalVolume || 0;
    totalSets += l.totalSets || 0;
    totalMinutes += l.durationMinutes || 0;

    const logDate = new Date(l.date);
    if (logDate >= oneWeekAgo) {
      workoutsThisWeek++;
    }
  });

  return {
    totalWorkouts: logs.length,
    totalVolume: Math.round(totalVolume),
    totalSets,
    totalMinutes,
    workoutsThisWeek,
  };
}

// ---------------------------------------------------------------------------
// Import / Export
// ---------------------------------------------------------------------------

export function exportLogsJSON() {
  const logs = getWorkoutLogs();
  const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(logs, null, 2));
  const a = document.createElement('a');
  a.setAttribute('href', dataStr);
  a.setAttribute('download', `fitdata_workout_logs_${new Date().toISOString().split('T')[0]}.json`);
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

export function exportLogsCSV() {
  const logs = getWorkoutLogs();
  const rows = [
    ['Session Date', 'Session Title', 'Duration (min)', 'Exercise Name', 'Target Muscle', 'Equipment', 'Set #', 'Weight (kg)', 'Reps', 'RPE', 'Volume (kg)', 'Estimated 1RM (kg)', 'Notes']
  ];

  logs.forEach(session => {
    const dateStr = session.date ? new Date(session.date).toLocaleDateString() : '';
    const title = `"${(session.title || '').replace(/"/g, '""')}"`;
    const notes = `"${(session.notes || '').replace(/"/g, '""')}"`;
    const dur = session.durationMinutes || 0;

    (session.exercises || []).forEach(ex => {
      const exName = `"${(ex.exerciseName || '').replace(/"/g, '""')}"`;
      const target = `"${(ex.target || '').replace(/"/g, '""')}"`;
      const equip = `"${(ex.equipment || '').replace(/"/g, '""')}"`;

      (ex.sets || []).forEach(s => {
        const w = parseFloat(s.weight) || 0;
        const r = parseInt(s.reps, 10) || 0;
        const rpe = s.rpe ?? '';
        const vol = w * r;
        const est1RM = estimate1RM(w, r);

        rows.push([dateStr, title, dur, exName, target, equip, s.setNum, w, r, rpe, vol, est1RM, notes]);
      });
    });
  });

  const csvContent = 'data:text/csv;charset=utf-8,' + rows.map(e => e.join(',')).join('\n');
  const a = document.createElement('a');
  a.setAttribute('href', encodeURI(csvContent));
  a.setAttribute('download', `fitdata_workout_logs_${new Date().toISOString().split('T')[0]}.csv`);
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

export function importLogsJSON(jsonString) {
  try {
    const parsed = JSON.parse(jsonString);
    if (!Array.isArray(parsed)) throw new Error('Imported data must be an array of sessions.');

    const current = getWorkoutLogs();
    const map = new Map();
    current.forEach(item => map.set(item.id, item));
    parsed.forEach(item => {
      if (item && item.id) map.set(item.id, item);
    });

    const merged = Array.from(map.values()).sort((a, b) => new Date(b.date) - new Date(a.date));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
    window.dispatchEvent(new CustomEvent('workout-logs-changed', { detail: { importedCount: parsed.length } }));
    return { success: true, count: parsed.length };
  } catch (err) {
    return { success: false, error: err.message };
  }
}
