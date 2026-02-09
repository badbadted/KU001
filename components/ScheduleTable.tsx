import React from 'react';
import { DAYS, TIME_SLOTS } from '../constants';
import { ScheduleData, DayOfWeek, TimeSlot, LocksMap } from '../types';
import { Edit2, Trash2, Lock } from 'lucide-react';
import { getLockForSlot } from '../services/firebaseService';

interface ScheduleTableProps {
  schedule: ScheduleData;
  locks: LocksMap;
  currentUid: string;
  onCellClick: (day: DayOfWeek, time: TimeSlot) => void;
  onDelete: (day: DayOfWeek, time: TimeSlot) => void;
}

export const ScheduleTable: React.FC<ScheduleTableProps> = ({ schedule, locks, currentUid, onCellClick, onDelete }) => {

  const getCellData = (day: DayOfWeek, time: TimeSlot) => {
    return schedule[day]?.[time];
  };

  const stringToColor = (str: string) => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hue = hash % 360;
    return `hsla(${hue}, 70%, 90%, 1)`;
  };

  const stringToBorder = (str: string) => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hue = hash % 360;
    return `hsla(${hue}, 60%, 40%, 0.3)`;
  };

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 shadow-sm bg-white">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[800px] border-collapse">
          <thead>
            <tr className="bg-kinder-secondary text-white">
              <th className="p-4 text-left font-bold border-b border-r border-white/20 w-32 sticky left-0 bg-kinder-secondary z-10">
                時段 / 星期
              </th>
              {DAYS.map((day) => (
                <th key={day} className="p-4 text-center font-bold text-lg border-b border-white/20 w-1/5 min-w-[140px]">
                  {day}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {TIME_SLOTS.map((time, index) => (
              <tr key={time} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                <td className="p-4 font-bold text-gray-600 border-r border-gray-200 bg-gray-50 sticky left-0 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                  {time}
                </td>
                {DAYS.map((day) => {
                  const data = getCellData(day, time);
                  const isOccupied = !!data;
                  const lock = getLockForSlot(locks, day, time);
                  const isLockedByOther = lock !== null && lock.lockedBy !== currentUid;

                  return (
                    <td
                      key={`${day}-${time}`}
                      className={`p-2 border border-gray-100 align-top h-32 transition-colors group relative ${
                        isLockedByOther
                          ? 'cursor-not-allowed'
                          : 'hover:bg-gray-100 cursor-pointer'
                      }`}
                      onClick={() => {
                        if (!isLockedByOther) onCellClick(day, time);
                      }}
                    >
                      {/* Lock overlay */}
                      {isLockedByOther && (
                        <div className="absolute inset-0 bg-gray-200/60 z-10 flex items-center justify-center rounded">
                          <div className="flex flex-col items-center gap-1 text-gray-500">
                            <Lock size={16} />
                            <span className="text-xs font-medium">{lock.displayName}</span>
                            <span className="text-xs">編輯中...</span>
                          </div>
                        </div>
                      )}

                      {isOccupied ? (
                        <div
                          className="h-full w-full rounded-lg p-3 flex flex-col gap-1 shadow-sm transition-all hover:shadow-md relative overflow-hidden group-hover:-translate-y-1 duration-200"
                          style={{
                            backgroundColor: stringToColor(data.className),
                            border: `1px solid ${stringToBorder(data.className)}`
                          }}
                        >
                          {/* Actions overlay */}
                          {!isLockedByOther && (
                            <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1 bg-white/50 backdrop-blur-sm rounded-md p-1">
                              <button
                                onClick={(e) => { e.stopPropagation(); onDelete(day, time); }}
                                className="p-1 hover:bg-red-100 text-red-500 rounded"
                                title="刪除"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          )}

                          <div className="font-bold text-gray-800 text-base leading-tight">
                            {data.className}
                          </div>
                          {data.activity && (
                            <div className="text-sm text-gray-600 italic bg-white/40 p-1 rounded mt-auto">
                              {data.activity}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className={`h-full w-full rounded-lg border-2 border-dashed flex items-center justify-center transition-colors ${
                          isLockedByOther
                            ? 'border-gray-200 text-gray-300'
                            : 'border-gray-200 text-gray-300 group-hover:border-kinder-secondary group-hover:text-kinder-secondary'
                        }`}>
                          <div className="flex flex-col items-center">
                            <Edit2 size={16} />
                            <span className="text-xs mt-1 font-medium">預約</span>
                          </div>
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
