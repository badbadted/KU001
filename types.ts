export type DayOfWeek = '星期一' | '星期二' | '星期三' | '星期四' | '星期五';

export type TimeSlot = '8:40-9:40' | '9:40-10:40' | '10:40-11:40';

export interface ScheduleEntry {
  className: string;
  activity: string;
  isAiSuggested?: boolean;
}

// Map key format: `${DayOfWeek}::${TimeSlot}`
export type ScheduleMap = Record<string, ScheduleEntry>;