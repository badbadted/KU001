import React, { useState } from 'react';
import { Calendar } from 'lucide-react';
import { APP_TITLE } from '../constants';

interface LoginScreenProps {
  onLogin: (displayName: string) => void;
  loading: boolean;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin, loading }) => {
  const [name, setName] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (trimmed) {
      onLogin(trimmed);
    }
  };

  return (
    <div className="min-h-screen bg-[#F0F7F4] flex items-center justify-center font-sans px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-8">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="bg-kinder-primary p-3 rounded-2xl text-white shadow-md mb-4">
            <Calendar size={36} />
          </div>
          <h1 className="text-xl font-bold text-gray-800">{APP_TITLE}</h1>
          <p className="text-sm text-gray-500 mt-1">戶外體能場預約系統</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              請輸入您的名稱
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例如：王老師"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-kinder-primary focus:border-transparent outline-none transition-all text-lg"
              autoFocus
              disabled={loading}
            />
          </div>

          <button
            type="submit"
            disabled={!name.trim() || loading}
            className="w-full py-3 bg-kinder-primary text-white font-bold rounded-lg hover:bg-orange-600 shadow-md hover:shadow-lg transition-all transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none text-lg"
          >
            {loading ? '登入中...' : '進入系統'}
          </button>
        </form>
      </div>
    </div>
  );
};
