import { initializeApp } from 'firebase/app';
import {
  getDatabase,
  ref,
  set,
  get,
  remove,
  onValue,
  runTransaction,
  onDisconnect,
  serverTimestamp,
  DatabaseReference,
} from 'firebase/database';
import {
  getAuth,
  signInAnonymously,
  onAuthStateChanged,
  User,
} from 'firebase/auth';
import {
  ScheduleEntry,
  ScheduleData,
  DayOfWeek,
  TimeSlot,
  UserProfile,
  AppUser,
  LockData,
  LocksMap,
  PresenceData,
  PresenceMap,
} from '../types';

const firebaseConfig = {
  apiKey: "AIzaSyAH-PdZ_uayg340SmQlR-cPGJtWruTmt2g",
  authDomain: "ku001-c603f.firebaseapp.com",
  databaseURL: "https://ku001-c603f-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "ku001-c603f",
  storageBucket: "ku001-c603f.firebasestorage.app",
  messagingSenderId: "654206792145",
  appId: "1:654206792145:web:86229a4787fee05a1bb0f0",
  measurementId: "G-70K9YHEJ1C"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const auth = getAuth(app);

const scheduleRef: DatabaseReference = ref(db, 'schedule');
const LOCK_TIMEOUT = 2 * 60 * 1000; // 2 minutes

// ──── Auth ────

export async function loginAsTeacher(displayName: string): Promise<AppUser> {
  const credential = await signInAnonymously(auth);
  const uid = credential.user.uid;

  const profile: UserProfile = {
    displayName,
    role: 'teacher',
    lastLogin: serverTimestamp(),
  };
  await set(ref(db, `users/${uid}`), profile);

  localStorage.setItem('teacherName', displayName);
  return { uid, displayName };
}

export function onAuthChange(callback: (user: AppUser | null) => void): () => void {
  return onAuthStateChanged(auth, (firebaseUser: User | null) => {
    if (firebaseUser) {
      const savedName = localStorage.getItem('teacherName');
      if (savedName) {
        callback({ uid: firebaseUser.uid, displayName: savedName });
      } else {
        callback(null);
      }
    } else {
      callback(null);
    }
  });
}

export function getCurrentUser(): AppUser | null {
  const user = auth.currentUser;
  if (!user) return null;
  const name = localStorage.getItem('teacherName');
  if (!name) return null;
  return { uid: user.uid, displayName: name };
}

// ──── Cell-level operations ────

export function saveCellSchedule(
  day: DayOfWeek,
  timeSlot: TimeSlot,
  entry: ScheduleEntry
): Promise<void> {
  const cellRef = ref(db, `schedule/${day}/${timeSlot}`);
  const user = getCurrentUser();
  return set(cellRef, {
    className: entry.className,
    activity: entry.activity,
    updatedBy: user?.displayName || '',
    updatedAt: serverTimestamp(),
  });
}

export function deleteCellSchedule(
  day: DayOfWeek,
  timeSlot: TimeSlot
): Promise<void> {
  const cellRef = ref(db, `schedule/${day}/${timeSlot}`);
  return remove(cellRef);
}

// ──── Real-time listeners ────

export function onScheduleChange(
  callback: (schedule: ScheduleData) => void
): () => void {
  return onValue(scheduleRef, (snapshot) => {
    callback(snapshot.val() || {});
  });
}

// ──── Lock mechanism ────

function slotKey(day: DayOfWeek, time: TimeSlot): string {
  return `${day}__${time}`;
}

export async function acquireLock(day: DayOfWeek, time: TimeSlot): Promise<boolean> {
  const user = getCurrentUser();
  if (!user) return false;

  const key = slotKey(day, time);
  const lockRef = ref(db, `locks/${key}`);

  const result = await runTransaction(lockRef, (current: LockData | null) => {
    // Lock is free or expired
    if (!current || Date.now() - current.lockedAt > LOCK_TIMEOUT) {
      return {
        lockedBy: user.uid,
        displayName: user.displayName,
        lockedAt: Date.now(),
      };
    }
    // Already locked by me
    if (current.lockedBy === user.uid) {
      return { ...current, lockedAt: Date.now() };
    }
    // Locked by someone else — abort
    return undefined;
  });

  if (result.committed) {
    // Auto-release on disconnect
    onDisconnect(lockRef).remove();
  }

  return result.committed;
}

export async function releaseLock(day: DayOfWeek, time: TimeSlot): Promise<void> {
  const user = getCurrentUser();
  if (!user) return;

  const key = slotKey(day, time);
  const lockRef = ref(db, `locks/${key}`);
  const snap = await get(lockRef);
  const data = snap.val() as LockData | null;

  if (data?.lockedBy === user.uid) {
    await remove(lockRef);
  }
}

export function onLocksChange(callback: (locks: LocksMap) => void): () => void {
  return onValue(ref(db, 'locks'), (snapshot) => {
    callback(snapshot.val() || {});
  });
}

export function getLockForSlot(locks: LocksMap, day: DayOfWeek, time: TimeSlot): LockData | null {
  const key = slotKey(day, time);
  const lock = locks[key];
  if (!lock) return null;
  // Check expiry
  if (Date.now() - lock.lockedAt > LOCK_TIMEOUT) return null;
  return lock;
}

// ──── Presence ────

export function setupPresence(displayName: string): void {
  const user = auth.currentUser;
  if (!user) return;

  const presRef = ref(db, `presence/${user.uid}`);

  set(presRef, {
    online: true,
    displayName,
    lastSeen: serverTimestamp(),
  });

  // Auto-cleanup on disconnect
  onDisconnect(presRef).set({
    online: false,
    displayName,
    lastSeen: serverTimestamp(),
  });
}

export function cleanupPresence(): Promise<void> {
  const user = auth.currentUser;
  if (!user) return Promise.resolve();

  const presRef = ref(db, `presence/${user.uid}`);
  return set(presRef, {
    online: false,
    displayName: localStorage.getItem('teacherName') || '',
    lastSeen: serverTimestamp(),
  });
}

export function onPresenceChange(callback: (presence: PresenceMap) => void): () => void {
  return onValue(ref(db, 'presence'), (snapshot) => {
    callback(snapshot.val() || {});
  });
}

// ──── Migration: flat key → nested path ────

export async function migrateIfNeeded(): Promise<void> {
  const snapshot = await get(scheduleRef);
  const data = snapshot.val();
  if (!data) return;

  const keys = Object.keys(data);
  const hasFlatKeys = keys.some((k) => k.includes('::'));
  if (!hasFlatKeys) return;

  console.log('[Migration] Converting flat keys to nested paths...');
  const nested: Record<string, Record<string, ScheduleEntry>> = {};

  for (const [key, value] of Object.entries(data)) {
    if (key.includes('::')) {
      const [day, time] = key.split('::');
      if (!nested[day]) nested[day] = {};
      const entry = value as ScheduleEntry;
      nested[day][time] = {
        className: entry.className,
        activity: entry.activity,
      };
    }
  }

  await set(scheduleRef, nested);
  console.log('[Migration] Done.');
}
