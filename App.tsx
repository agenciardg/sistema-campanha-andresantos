
import React, { Suspense, lazy, memo } from 'react';
import { HashRouter, Routes, Route, Outlet, Navigate } from 'react-router-dom';
import { ThemeProvider } from './contexts/ThemeContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ConfigProvider } from './contexts/ConfigContext';
import { ModernSidebar } from './components/ui/modern-side-bar';
import Header from './components/Header';
import AuthGuard from './components/AuthGuard';

// Permission guard for individual routes inside DashboardLayout
const PermissionGuard = memo(({ permission, children }: { permission: string; children: React.ReactNode }) => {
  const { user } = useAuth();
  const role = (user as any)?.app_metadata?.role;
  if (role === 'superadmin') return <>{children}</>;
  const permissions: string[] = (user as any)?.app_metadata?.permissions || [];
  if (!permissions.includes(permission)) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
});

// Lazy load das páginas para melhor performance
const Login = lazy(() => import('./pages/Login'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Teams = lazy(() => import('./pages/Teams'));
const TeamDetails = lazy(() => import('./pages/TeamDetails'));
const Coordinators = lazy(() => import('./pages/Coordinators'));
const Organizations = lazy(() => import('./pages/Organizations'));
const Registrations = lazy(() => import('./pages/Registrations'));
const Leaders = lazy(() => import('./pages/Leaders'));
const LeaderDetails = lazy(() => import('./pages/LeaderDetails'));
const CoordinatorDetails = lazy(() => import('./pages/CoordinatorDetails'));
const PublicRegistration = lazy(() => import('./pages/PublicRegistration'));
const Maps = lazy(() => import('./pages/Maps'));
const Settings = lazy(() => import('./pages/Settings'));
const SuperAdmin = lazy(() => import('./pages/SuperAdmin'));
const Tasks = lazy(() => import('./pages/Tasks'));

// Loading spinner component
const PageLoader = memo(() => (
  <div className="flex items-center justify-center h-full w-full">
    <div className="flex flex-col items-center gap-3">
      <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      <span className="text-sm text-gray-500">Carregando...</span>
    </div>
  </div>
));

// Layout memoizado para evitar re-renders
const DashboardLayout = memo(() => {
  return (
    <AuthGuard>
      <div className="flex h-screen w-full bg-white dark:bg-[#0a0e13] font-display text-gray-900 dark:text-white antialiased overflow-hidden">
        <ModernSidebar />
        <div className="flex-1 flex flex-col h-full overflow-hidden relative">
          <Header />
          <main className="flex-1 overflow-y-auto bg-gray-50 dark:bg-[#0a0e13] p-6 lg:p-10 scroll-smooth">
            <Suspense fallback={<PageLoader />}>
              <Outlet />
            </Suspense>
          </main>
        </div>
      </div>
    </AuthGuard>
  );
});

const App: React.FC = () => {
  return (
    <ThemeProvider>
      <AuthProvider>
        <ConfigProvider>
        <HashRouter>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              {/* Rota de Login - pública */}
              <Route path="/login" element={<Login />} />

              {/* Rota pública de cadastro */}
              <Route path="/c/:codigo" element={<PublicRegistration />} />

              {/* Rotas protegidas */}
              <Route path="/" element={<DashboardLayout />}>
                <Route index element={<Navigate to="/dashboard" replace />} />
                <Route path="dashboard" element={<PermissionGuard permission="dashboard"><Dashboard /></PermissionGuard>} />
                <Route path="teams" element={<PermissionGuard permission="teams"><Teams /></PermissionGuard>} />
                <Route path="teams/:teamId" element={<PermissionGuard permission="teams"><TeamDetails /></PermissionGuard>} />
                <Route path="coordinators" element={<PermissionGuard permission="coordinators"><Coordinators /></PermissionGuard>} />
                <Route path="coordinators/:coordinatorId" element={<PermissionGuard permission="coordinators"><CoordinatorDetails /></PermissionGuard>} />
                <Route path="organizations" element={<PermissionGuard permission="organizations"><Organizations /></PermissionGuard>} />
                <Route path="registrations" element={<PermissionGuard permission="registrations"><Registrations /></PermissionGuard>} />
                <Route path="leaders" element={<PermissionGuard permission="leaders"><Leaders /></PermissionGuard>} />
                <Route path="leaders/:leaderId" element={<PermissionGuard permission="leaders"><LeaderDetails /></PermissionGuard>} />
                <Route path="tasks" element={<PermissionGuard permission="tasks"><Tasks /></PermissionGuard>} />
                <Route path="maps" element={<PermissionGuard permission="maps"><Maps /></PermissionGuard>} />
                <Route path="settings" element={<Settings />} />
                <Route path="superadmin" element={<SuperAdmin />} />
              </Route>
            </Routes>
          </Suspense>
        </HashRouter>
        </ConfigProvider>
      </AuthProvider>
    </ThemeProvider>
  );
};

export default App;
