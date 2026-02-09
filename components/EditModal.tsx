import React, { useState, useEffect } from 'react';
import { ScheduleEntry, DayOfWeek, TimeSlot } from '../types';
import { X } from 'lucide-react';

interface EditModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (day: DayOfWeek, time: TimeSlot, data: ScheduleEntry | null) => void;
  day: DayOfWeek;
  time: TimeSlot;
  currentData?: ScheduleEntry;
}

export const EditModal: React.FC<EditModalProps> = ({ isOpen, onClose, onSave, day, time, currentData }) => {
  const [className, setClassName] = useState('');
  const [activity, setActivity] = useState('');

  useEffect(() => {
    if (isOpen) {
      setClassName(currentData?.className || '');
      setActivity(currentData?.activity || '');
    }
  }, [isOpen, currentData]);

  if (!isOpen) return null;

  const handleSave = () => {
    if (!className.trim()) {
      onSave(day, time, null); // Delete if empty
    } else {
      onSave(day, time, { className, activity });
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md transform transition-all scale-100">
        <div className="flex justify-between items-center p-6 border-b border-gray-100">
          <div>
            <h3 className="text-xl font-bold text-gray-800">編輯時段</h3>
            <p className="text-sm text-gray-500 mt-1">{day} • {time}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X size={24} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">班級名稱</label>
            <input
              type="text"
              value={className}
              onChange={(e) => setClassName(e.target.value)}
              placeholder="例如: 大班-太陽班"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-kinder-primary focus:border-transparent outline-none transition-all"
              autoFocus
            />
          </div>

          <div>
            <div className="flex justify-between items-center mb-1">
                <label className="block text-sm font-medium text-gray-700">活動內容</label>
            </div>
            <textarea
              value={activity}
              onChange={(e) => setActivity(e.target.value)}
              placeholder="例如: 大肢體循環"
              rows={3}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-kinder-primary focus:border-transparent outline-none transition-all resize-none"
            />
          </div>
        </div>

        <div className="p-6 border-t border-gray-100 flex justify-end gap-3 bg-gray-50 rounded-b-2xl">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-600 font-medium hover:bg-gray-200 rounded-lg transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleSave}
            className="px-6 py-2 bg-kinder-primary text-white font-bold rounded-lg hover:bg-orange-600 shadow-md hover:shadow-lg transition-all transform active:scale-95"
          >
            儲存
          </button>
        </div>
      </div>
    </div>
  );
};