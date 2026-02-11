"use client";
import React, { useState, useEffect, useCallback, useMemo, memo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useConfig } from '../../contexts/ConfigContext';
import {
  LayoutDashboard,
  UserCheck,
  Users,
  User,
  BadgeCheck,
  Building2,
  Map,
  Settings,
  LogOut,
  Menu,
  X,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
} from 'lucide-react';

interface NavigationItem {
  id: string;
  name: string;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
  badge?: string;
}

interface SidebarProps {
  className?: string;
}

const navigationItems: NavigationItem[] = [
  { id: "dashboard", name: "Dashboard", icon: LayoutDashboard, href: "/dashboard" },
  { id: "registrations", name: "Cadastros", icon: UserCheck, href: "/registrations" },
  { id: "teams", name: "Equipes", icon: Users, href: "/teams" },
  { id: "leaders", name: "Líderes", icon: User, href: "/leaders" },
  { id: "coordinators", name: "Coordenadores", icon: BadgeCheck, href: "/coordinators" },
  { id: "organizations", name: "Organizações", icon: Building2, href: "/organizations" },
  { id: "tasks", name: "Tarefas", icon: ClipboardList, href: "/tasks" },
  { id: "maps", name: "Mapa Eleitoral", icon: Map, href: "/maps" },
  { id: "settings", name: "Configurações", icon: Settings, href: "/settings" },
];

function ModernSidebarComponent({ className = "" }: SidebarProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { user, signOut } = useAuth();
  const { getConfigValue } = useConfig();

  const userRole = (user as any)?.app_metadata?.role as string | undefined;
  const userPermissions = (user as any)?.app_metadata?.permissions as string[] | undefined;
  const isSuperadmin = userRole === 'superadmin';

  const filteredNavItems = useMemo(() => {
    if (isSuperadmin) return navigationItems;
    return navigationItems.filter(item => {
      // Settings is superadmin-only
      if (item.id === 'settings') return false;
      // Filter by permissions for admins
      if (userPermissions && userPermissions.length > 0) {
        return userPermissions.includes(item.id);
      }
      // No permissions set = no access (except dashboard as fallback)
      return item.id === 'dashboard';
    });
  }, [isSuperadmin, userPermissions]);

  const userInfo = useMemo(() => {
    const name = user?.user_metadata?.nome || user?.email?.split('@')[0] || 'Usuário';
    const initials = name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase();
    const roleLabel = isSuperadmin ? 'Superadmin' : 'Administrador';
    return { name, initials, type: roleLabel };
  }, [user, isSuperadmin]);

  useEffect(() => {
    const handleResize = () => {
      const isDesktop = window.innerWidth >= 1024;
      setIsOpen(isDesktop);
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const toggleSidebar = useCallback(() => setIsOpen(prev => !prev), []);
  const toggleCollapse = useCallback(() => setIsCollapsed(prev => !prev), []);

  const handleItemClick = useCallback((href: string) => {
    navigate(href);
    if (window.innerWidth < 1024) {
      setIsOpen(false);
    }
  }, [navigate]);

  const handleLogout = useCallback(async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('Erro ao sair:', error);
    } finally {
      navigate('/login');
    }
  }, [signOut, navigate]);

  const isActive = useCallback((href: string) =>
    location.pathname === href || location.pathname.startsWith(href + '/'),
    [location.pathname]);

  return (
    <>
      {/* Mobile hamburger button */}
      <button
        onClick={toggleSidebar}
        className="fixed top-4 left-4 z-50 p-3 rounded-xl bg-white shadow-lg border border-gray-200 hover:bg-gray-50 dark:bg-[#1a2632] dark:border-white/10 dark:hover:bg-[#233648] lg:hidden transition-all duration-200"
        aria-label="Toggle sidebar"
      >
        {isOpen ?
          <X className="h-5 w-5 text-gray-700 dark:text-gray-300" /> :
          <Menu className="h-5 w-5 text-gray-700 dark:text-gray-300" />
        }
      </button>

      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/20 dark:bg-black/60 backdrop-blur-sm z-30 lg:hidden transition-opacity duration-300"
          onClick={toggleSidebar}
        />
      )}

      {/* Sidebar */}
      <div
        className={`
          fixed top-0 left-0 h-full bg-white dark:bg-gradient-to-b dark:from-[#0f1419] dark:to-[#0a0e14] border-r border-gray-200 dark:border-white/5 z-40 transition-all duration-300 ease-in-out flex flex-col
          ${isOpen ? "translate-x-0" : "-translate-x-full"}
          ${isCollapsed ? "w-20" : "w-72"}
          lg:translate-x-0 lg:static lg:z-auto
          ${className}
        `}
      >
        {/* Header with logo and collapse button */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-white/5">
          {!isCollapsed && (
            <div className="flex items-center gap-3">
              <img
                src="/images/logo_redondo.png"
                alt="Logo"
                className="w-10 h-10 object-contain rounded-full"
              />
              <div className="flex flex-col">
                <span className="font-semibold text-gray-900 dark:text-white text-base tracking-tight">{getConfigValue('branding.app_nome')}</span>
                <span className="text-xs text-gray-500 -mt-0.5">{getConfigValue('branding.app_subtitulo')}</span>
              </div>
            </div>
          )}

          {isCollapsed && (
            <img
              src="/images/logo_redondo.png"
              alt="Logo"
              className="w-10 h-10 object-contain rounded-full mx-auto"
            />
          )}

          {/* Desktop collapse button */}
          <button
            onClick={toggleCollapse}
            className="hidden lg:flex p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-white/5 transition-all duration-200"
            aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {isCollapsed ? (
              <ChevronRight className="h-4 w-4 text-gray-500" />
            ) : (
              <ChevronLeft className="h-4 w-4 text-gray-500" />
            )}
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 overflow-y-auto">
          <ul className="space-y-1">
            {filteredNavItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href);

              return (
                <li key={item.id} className="relative group/item">
                  <button
                    onClick={() => handleItemClick(item.href)}
                    className={`
                      w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all duration-200 group
                      ${active
                        ? "bg-blue-50 text-blue-700 dark:bg-white/[0.08] dark:text-white"
                        : "text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-white/[0.05] dark:hover:text-white"
                      }
                      ${isCollapsed ? "justify-center px-2" : ""}
                    `}
                  >
                    <div className="flex items-center justify-center w-6 h-6 flex-shrink-0">
                      <Icon
                        className={`
                          h-5 w-5
                          ${active
                            ? "text-blue-700 dark:text-white"
                            : "text-gray-500 group-hover:text-gray-700 dark:group-hover:text-gray-300"
                          }
                        `}
                      />
                    </div>

                    {!isCollapsed && (
                      <span className={`text-sm ${active ? "font-medium" : "font-normal"}`}>
                        {item.name}
                      </span>
                    )}
                  </button>

                  {/* Tooltip - sempre visível no hover */}
                  <div className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-3 px-3 py-2 bg-gray-900 dark:bg-[#1a2632] text-white text-sm font-medium rounded-lg opacity-0 scale-95 group-hover/item:opacity-100 group-hover/item:scale-100 transition-all duration-200 whitespace-nowrap z-[100] shadow-xl border border-gray-700 dark:border-white/10">
                    {item.name}
                    <div className="absolute left-0 top-1/2 transform -translate-y-1/2 -translate-x-1 w-2 h-2 bg-gray-900 dark:bg-[#1a2632] rotate-45 border-l border-b border-gray-700 dark:border-white/10" />
                  </div>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Bottom section with profile and logout */}
        <div className="mt-auto border-t border-gray-200 dark:border-white/5">
          {/* Profile Section */}
          <div className={`border-b border-gray-200 dark:border-white/5 ${isCollapsed ? 'py-3 px-2' : 'p-3'}`}>
            {!isCollapsed ? (
              <div className="flex items-center px-3 py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 dark:bg-white/[0.03] dark:hover:bg-white/[0.05] transition-colors duration-200">
                <div className="w-9 h-9 bg-gradient-to-br from-[#1e3a5f] to-[#1e5a8d] rounded-xl flex items-center justify-center border border-blue-200 dark:border-white/10">
                  <span className="text-white font-medium text-sm">{userInfo.initials}</span>
                </div>
                <div className="flex-1 min-w-0 ml-3">
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{userInfo.name}</p>
                  <p className="text-xs text-gray-600 dark:text-gray-500 truncate">
                    {userInfo.type}
                  </p>
                </div>
                <div className="w-2 h-2 bg-emerald-500 rounded-full ml-2" title="Online" />
              </div>
            ) : (
              <div className="flex justify-center group/profile relative">
                <div className="relative">
                  <div className="w-10 h-10 bg-gradient-to-br from-[#1e3a5f] to-[#1e5a8d] rounded-xl flex items-center justify-center border border-blue-200 dark:border-white/10">
                    <span className="text-white font-medium text-sm">{userInfo.initials}</span>
                  </div>
                  <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 rounded-full border-2 border-white dark:border-[#0a0e14]" />
                </div>
                {/* Tooltip */}
                <div className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-3 px-3 py-2 bg-gray-900 dark:bg-[#1a2632] text-white text-sm font-medium rounded-lg opacity-0 scale-95 group-hover/profile:opacity-100 group-hover/profile:scale-100 transition-all duration-200 whitespace-nowrap z-[100] shadow-xl border border-gray-700 dark:border-white/10">
                  <div className="font-medium">{userInfo.name}</div>
                  <div className="text-xs text-gray-400">{userInfo.type}</div>
                  <div className="absolute left-0 top-1/2 transform -translate-y-1/2 -translate-x-1 w-2 h-2 bg-gray-900 dark:bg-[#1a2632] rotate-45 border-l border-b border-gray-700 dark:border-white/10" />
                </div>
              </div>
            )}
          </div>

          {/* Logout Button */}
          <div className="p-3 relative group/logout">
            <button
              onClick={handleLogout}
              className={`
                w-full flex items-center rounded-xl text-left transition-all duration-200 group
                text-gray-600 hover:bg-rose-50 hover:text-rose-600 dark:text-gray-400 dark:hover:bg-rose-500/10 dark:hover:text-rose-400
                ${isCollapsed ? "justify-center p-2.5" : "gap-3 px-3 py-2.5"}
              `}
            >
              <div className="flex items-center justify-center w-6 h-6 flex-shrink-0">
                <LogOut className="h-5 w-5 text-gray-500 group-hover:text-rose-600 dark:group-hover:text-rose-400" />
              </div>

              {!isCollapsed && (
                <span className="text-sm">Sair</span>
              )}
            </button>

            {/* Tooltip - sempre visível no hover */}
            <div className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-3 px-3 py-2 bg-gray-900 dark:bg-[#1a2632] text-white text-sm font-medium rounded-lg opacity-0 scale-95 group-hover/logout:opacity-100 group-hover/logout:scale-100 transition-all duration-200 whitespace-nowrap z-[100] shadow-xl border border-gray-700 dark:border-white/10">
              Sair
              <div className="absolute left-0 top-1/2 transform -translate-y-1/2 -translate-x-1 w-2 h-2 bg-gray-900 dark:bg-[#1a2632] rotate-45 border-l border-b border-gray-700 dark:border-white/10" />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// Export com memo para evitar re-renders desnecessários
export const ModernSidebar = memo(ModernSidebarComponent);
export default ModernSidebar;
