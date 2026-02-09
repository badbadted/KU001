import { DayOfWeek, TimeSlot } from './types';

export const DAYS: DayOfWeek[] = ['星期一', '星期二', '星期三', '星期四', '星期五'];

export const TIME_SLOTS: TimeSlot[] = ['8:40-9:40', '9:40-10:40', '10:40-11:40'];

export const EMPTY_ENTRY = { className: '', activity: '' };

export const APP_TITLE = "臺南市立新市幼兒園";
export const APP_SUBTITLE = "戶外體能場班級使用時段";

// Colors for random assignment based on class name hash could go here, 
// but we'll handle visual logic in components.