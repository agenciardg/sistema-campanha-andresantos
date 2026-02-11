
import React from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { Sun, Moon } from 'lucide-react';

interface HeaderProps {
    onMenuClick?: () => void;
}

const Header: React.FC<HeaderProps> = () => {
  const { theme, toggleTheme } = useTheme();
  const { user } = useAuth();

  const userName = user?.user_metadata?.nome || user?.email?.split('@')[0] || 'Usuário';
  const userInitials = userName.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase();
  const userType = user?.user_metadata?.tipo || 'admin';

  return (
    <header className="h-14 flex items-center justify-end px-6 border-b border-gray-200 bg-white/90 dark:border-white/5 dark:bg-[#0f1419]/90 backdrop-blur-xl flex-shrink-0">
      <div className="flex items-center gap-3">
        <button
          onClick={toggleTheme}
          className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-white dark:hover:bg-white/5 transition-colors rounded-lg"
          title={theme === 'dark' ? 'Modo Claro' : 'Modo Escuro'}
        >
          {theme === 'dark' ? (
            <Sun className="h-5 w-5" />
          ) : (
            <Moon className="h-5 w-5" />
          )}
        </button>
        <div className="h-6 w-[1px] bg-gray-200 dark:bg-white/10 mx-1"></div>
        <div className="flex items-center gap-3 cursor-pointer pl-1 py-1 px-2 rounded-xl hover:bg-gray-100 dark:hover:bg-white/[0.03] transition-colors">
            <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-[#1e3a5f] to-[#1e5a8d] border border-blue-200 dark:border-white/10 flex items-center justify-center text-white text-xs font-medium">
              {userInitials}
            </div>
            <div className="text-right hidden sm:block">
                <p className="text-sm font-medium text-gray-900 dark:text-white leading-none">
                  {userName}
                </p>
                <p className="text-[10px] text-gray-600 dark:text-gray-500 mt-0.5">
                  {userType === 'admin' ? 'Administrador' : 'Usuário'}
                </p>
            </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
