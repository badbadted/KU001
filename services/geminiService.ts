import { GoogleGenAI, Type } from "@google/genai";
import { ScheduleMap, ScheduleEntry } from "../types";
import { DAYS, TIME_SLOTS } from "../constants";

const apiKey = process.env.API_KEY || '';

const ai = new GoogleGenAI({ apiKey });

export const generateScheduleSuggestions = async (currentSchedule: ScheduleMap): Promise<ScheduleMap> => {
  if (!apiKey) {
    throw new Error("API Key is missing");
  }

  // Construct a prompt that understands the current state
  const currentJson = JSON.stringify(currentSchedule);

  const prompt = `
    You are an expert kindergarten physical education coordinator for "臺南市立新市幼兒園".
    
    We have a schedule for the "Outdoor Physical Fitness Area" (戶外體能場).
    The schedule grid has days: ${DAYS.join(', ')} and time slots: ${TIME_SLOTS.join(', ')}.

    Current Schedule State (JSON): ${currentJson}

    Task:
    1. Identify empty slots in the schedule.
    2. Fill ONLY the empty slots with realistic kindergarten class names (e.g., "大班-向日葵", "中班-小星星", "小班-綿羊") and fun, safe outdoor physical activities (e.g., "滑梯探險", "障礙賽跑", "球類遊戲").
    3. Do NOT overwrite existing slots that already have data.
    4. Ensure variety in activities.
    
    Return a flat array of objects representing the NEW entries for the empty slots.
  `;

  // Define response schema
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          newEntries: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                day: { type: Type.STRING, enum: DAYS },
                timeSlot: { type: Type.STRING, enum: TIME_SLOTS },
                className: { type: Type.STRING },
                activity: { type: Type.STRING },
              },
              required: ['day', 'timeSlot', 'className', 'activity']
            }
          }
        }
      }
    }
  });

  const generatedData = JSON.parse(response.text || '{"newEntries": []}');
  
  // Merge new entries into a copy of the current schedule
  const newSchedule: ScheduleMap = { ...currentSchedule };

  if (generatedData.newEntries && Array.isArray(generatedData.newEntries)) {
    generatedData.newEntries.forEach((item: any) => {
        const key = `${item.day}::${item.timeSlot}`;
        // Double check we aren't overwriting just in case
        if (!newSchedule[key]) {
            newSchedule[key] = {
                className: item.className,
                activity: item.activity,
                isAiSuggested: true
            };
        }
    });
  }

  return newSchedule;
};

export const suggestActivityForSlot = async (day: string, time: string, className: string): Promise<string> => {
     if (!apiKey) return "自由探索";

     const prompt = `
        Suggest one fun, safe, specific outdoor physical activity for a kindergarten class named "${className}" 
        on ${day} at ${time}. 
        Keep it under 10 words. In Traditional Chinese.
     `;

     const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
        config: {
            responseMimeType: "text/plain",
        }
     });

     return response.text?.trim() || "戶外遊戲";
}
