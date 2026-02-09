import { initializeApp } from 'firebase/app';
import { getDatabase, ref, set, onValue, DatabaseReference } from 'firebase/database';
import { ScheduleMap } from '../types';

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

const scheduleRef: DatabaseReference = ref(db, 'schedule');

export function saveSchedule(schedule: ScheduleMap): Promise<void> {
  return set(scheduleRef, schedule);
}

export function onScheduleChange(callback: (schedule: ScheduleMap) => void): () => void {
  const unsubscribe = onValue(scheduleRef, (snapshot) => {
    const data = snapshot.val();
    callback(data || {});
  });
  return unsubscribe;
}
