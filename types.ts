export type DayOfWeek = '星期一' | '星期二' | '星期三' | '星期四' | '星期五';

export type TimeSlot = '8:40-9:40' | '9:40-10:40' | '10:40-11:40';

export interface ScheduleEntry {
  className: string;
  activity: string;
  updatedBy?: string;
  updatedAt?: number | object;
}

// Nested structure: schedule[day][timeSlot] = ScheduleEntry
export type ScheduleData = {
  [day in DayOfWeek]?: {
    [time in TimeSlot]?: ScheduleEntry;
  };
};

export interface UserProfile {
  displayName: string;
  role: 'teacher' | 'admin';
  lastLogin: number | object;
}

export interface AppUser {
  uid: string;
  displayName: string;
}

export interface LockData {
  lockedBy: string;
  displayName: string;
  lockedAt: number;
}

export interface PresenceData {
  online: boolean;
  displayName: string;
  lastSeen: number | object;
}

export type LocksMap = Record<string, LockData>;
export type PresenceMap = Record<string, PresenceData>;