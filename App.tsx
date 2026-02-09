import React, { useState, useEffect, useCallback } from 'react';
import { ScheduleEntry, ScheduleData, DayOfWeek, TimeSlot, AppUser, LocksMap, PresenceMap } from './types';
import { APP_TITLE, APP_SUBTITLE } from './constants';
import { ScheduleTable } from './components/ScheduleTable';
import { EditModal } from './components/EditModal';
import { LoginScreen } from './components/LoginScreen';
import { Calendar, LogOut, Users } from 'lucide-react';
import {
  saveCellSchedule,
  deleteCellSchedule,
  onScheduleChange,
  migrateIfNeeded,
  loginAsTeacher,
  onAuthChange,
  acquireLock,
  releaseLock,
  onLocksChange,
  setupPresence,
  cleanupPresence,
  onPresenceChange,
  getCurrentUser,
} from './services/firebaseService';

const App: React.FC = () => {
  const [user, setUser] = useState<AppUser | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);
  const [schedule, setSchedule] = useState<ScheduleData>({});
  const [locks, setLocks] = useState<LocksMap>({});
  const [presence, setPresence] = useState<PresenceMap>({});
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<{ day: DayOfWeek; time: TimeSlot } | null>(null);

  // Listen for auth state
  useEffect(() => {
    const unsubscribe = onAuthChange((appUser) => {
      setUser(appUser);
      setAuthChecked(true);
    });
    return unsubscribe;
  }, []);

  // Subscribe to data once logged in
  useEffect(() => {
    if (!user) return;

    migrateIfNeeded();
    setupPresence(user.displayName);

    const unsubs = [
      onScheduleChange((data) => setSchedule(data)),
      onLocksChange((data) => setLocks(data)),
      onPresenceChange((data) => setPresence(data)),
    ];

    return () => {
      unsubs.forEach((fn) => fn());
    };
  }, [user]);

  const handleLogin = async (displayName: string) => {
    setLoginLoading(true);
    try {
      const appUser = await loginAsTeacher(displayName);
      setUser(appUser);
    } catch (err) {
      console.error('Login failed:', err);
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = async () => {
    await cleanupPresence();
    localStorage.removeItem('teacherName');
    setUser(null);
  };

  // Lock-aware cell click
  const handleCellClick = useCallback(async (day: DayOfWeek, time: TimeSlot) => {
    const success = await acquireLock(day, time);
    if (!success) {
      return; // Lock indicator on cell already shows who's editing
    }
    setSelectedSlot({ day, time });
    setModalOpen(true);
  }, []);

  // Release lock on modal close
  const handleModalClose = useCallback(() => {
    if (selectedSlot) {
      releaseLock(selectedSlot.day, selectedSlot.time);
    }
    setModalOpen(false);
    setSelectedSlot(null);
  }, [selectedSlot]);

  const handleSaveCell = useCallback((day: DayOfWeek, time: TimeSlot, data: ScheduleEntry | null) => {
    if (data) {
      saveCellSchedule(day, time, data);
    } else {
      deleteCellSchedule(day, time);
    }
    releaseLock(day, time);
  }, []);

  const handleDelete = useCallback((day: DayOfWeek, time: TimeSlot) => {
    if (window.confirm('確定要刪除這個時段的預約嗎？')) {
      deleteCellSchedule(day, time);
    }
  }, []);

  // Online users (exclude self, only online)
  const currentUser = getCurrentUser();
  const onlineUsers = Object.entries(presence)
    .filter(([uid, p]) => p.online && uid !== currentUser?.uid)
    .map(([, p]) => p.displayName);

  // Loading state
  if (!authChecked) {
    return (
      <div className="min-h-screen bg-[#F0F7F4] flex items-center justify-center font-sans">
        <div className="text-gray-400 text-lg">載入中...</div>
      </div>
    );
  }

  // Not logged in
  if (!user) {
    return <LoginScreen onLogin={handleLogin} loading={loginLoading} />;
  }

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

          <div className="flex items-center gap-4">
            {/* Online users */}
            {onlineUsers.length > 0 && (
              <div className="hidden sm:flex items-center gap-2 text-sm text-gray-500">
                <Users size={14} />
                <span>
                  {onlineUsers.map((name, i) => (
                    <span key={i} className="inline-flex items-center gap-1">
                      {i > 0 && '、'}
                      <span className="inline-block w-2 h-2 bg-green-400 rounded-full"></span>
                      {name}
                    </span>
                  ))}
                </span>
              </div>
            )}

            {/* Current user + logout */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600 font-medium hidden sm:flex items-center gap-1">
                <span className="inline-block w-2 h-2 bg-green-400 rounded-full"></span>
                {user.displayName}
              </span>
              <button
                onClick={handleLogout}
                className="flex items-center gap-1 px-3 py-2 text-sm text-gray-500 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                title="登出"
              >
                <LogOut size={16} />
                <span className="hidden sm:inline">登出</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <ScheduleTable
          schedule={schedule}
          locks={locks}
          currentUid={user.uid}
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
          onClose={handleModalClose}
          onSave={handleSaveCell}
          day={selectedSlot.day}
          time={selectedSlot.time}
          currentData={schedule[selectedSlot.day]?.[selectedSlot.time]}
        />
      )}
    </div>
  );
};

export default App;
