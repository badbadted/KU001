import React, { useState, useEffect, useRef } from 'react';
import { ScheduleEntry, ScheduleMap, DayOfWeek, TimeSlot } from './types';
import { APP_TITLE, APP_SUBTITLE } from './constants';
import { ScheduleTable } from './components/ScheduleTable';
import { EditModal } from './components/EditModal';
import { Calendar } from 'lucide-react';
import { saveSchedule, onScheduleChange } from './services/firebaseService';

const App: React.FC = () => {
  const [schedule, setSchedule] = useState<ScheduleMap>({});
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<{ day: DayOfWeek; time: TimeSlot } | null>(null);
  const isRemoteUpdate = useRef(false);

  // Subscribe to Firebase Realtime Database
  useEffect(() => {
    const unsubscribe = onScheduleChange((data) => {
      isRemoteUpdate.current = true;
      setSchedule(data);
    });
    return unsubscribe;
  }, []);

  const handleCellClick = (day: DayOfWeek, time: TimeSlot) => {
    setSelectedSlot({ day, time });
    setModalOpen(true);
  };

  const handleSaveCell = (day: DayOfWeek, time: TimeSlot, data: ScheduleEntry | null) => {
    setSchedule((prev) => {
      const newSchedule = { ...prev };
      const key = `${day}::${time}`;
      if (data) {
        const { className, activity } = data;
        newSchedule[key] = { className, activity };
      } else {
        delete newSchedule[key];
      }
      saveSchedule(newSchedule);
      return newSchedule;
    });
  };

  const handleDelete = (day: DayOfWeek, time: TimeSlot) => {
     if(window.confirm('確定要刪除這個時段的預約嗎？')) {
        handleSaveCell(day, time, null);
     }
  };

  return (
    <div className="min-h-screen bg-[#F0F7F4] flex flex-col font-sans">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-kinder-bg sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="bg-kinder-primary p-2 rounded-xl text-white shadow-md">
                <Calendar size={28} />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-800 tracking-tight">{APP_TITLE}</h1>
              <p className="text-sm text-gray-500 font-medium">{APP_SUBTITLE}</p>
            </div>
          </div>
          {/* Right side actions removed */}
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <ScheduleTable 
          schedule={schedule}
          onCellClick={handleCellClick}
          onDelete={handleDelete}
        />
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 py-6 mt-auto">
        <div className="max-w-7xl mx-auto px-4 text-center text-gray-400 text-sm">
          &copy; {new Date().getFullYear()} {APP_TITLE} | 體能活動預約系統
        </div>
      </footer>

      {/* Edit Modal */}
      {selectedSlot && (
        <EditModal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          onSave={handleSaveCell}
          day={selectedSlot.day}
          time={selectedSlot.time}
          currentData={schedule[`${selectedSlot.day}::${selectedSlot.time}`]}
        />
      )}
    </div>
  );
};

export default App;