import React, { Suspense, lazy, useState, useEffect, type ReactNode } from 'react';
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  NavLink,
  useLocation,
  useNavigate,
} from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './context/AuthContext';
import LanguageSwitcher from './components/LanguageSwitcher';
import {
  LayoutDashboard,
  BookOpen,
  FolderTree,
  Video,
  Users,
  UserCheck,
  HelpCircle,
  Award,
  Star,
  CreditCard,
  BarChart3,
  Mail,
  Settings,
  ChevronLeft,
  ChevronRight,
  Search,
  Bell,
  LogOut,
  Menu,
  ShieldAlert,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Query client
// ---------------------------------------------------------------------------
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

// ---------------------------------------------------------------------------
// Lazy-loaded pages
// ---------------------------------------------------------------------------
const Login = lazy(() => import('./pages/Login'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const CourseList = lazy(() => import('./pages/CourseList'));
const CourseForm = lazy(() => import('./pages/CourseForm'));
const CourseEdit = lazy(() => import('./pages/CourseEdit'));
const Categories = lazy(() => import('./pages/Categories'));
const Videos = lazy(() => import('./pages/Videos'));
const UserList = lazy(() => import('./pages/UserList'));
const Enrollments = lazy(() => import('./pages/Enrollments'));
const Quizzes = lazy(() => import('./pages/Quizzes'));
const Certificates = lazy(() => import('./pages/Certificates'));
const Reviews = lazy(() => import('./pages/Reviews'));
const Payments = lazy(() => import('./pages/Payments'));
const Analytics = lazy(() => import('./pages/Analytics'));
const EmailList = lazy(() => import('./pages/EmailList'));
const EmailCompose = lazy(() => import('./pages/EmailCompose'));
const EmailDetail = lazy(() => import('./pages/EmailDetail'));
const EmailAddresses = lazy(() => import('./pages/EmailAddresses'));
const SettingsPage = lazy(() => import('./pages/Settings'));

// ---------------------------------------------------------------------------
// Sidebar nav items
// ---------------------------------------------------------------------------
interface NavItem {
  label: string;
  path: string;
  icon: React.ElementType;
}

const navItems: NavItem[] = [
  { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
  { label: 'Courses', path: '/courses', icon: BookOpen },
  { label: 'Categories', path: '/categories', icon: FolderTree },
  { label: 'Videos', path: '/videos', icon: Video },
  { label: 'Users', path: '/users', icon: Users },
  { label: 'Enrollments', path: '/enrollments', icon: UserCheck },
  { label: 'Quizzes', path: '/quizzes', icon: HelpCircle },
  { label: 'Certificates', path: '/certificates', icon: Award },
  { label: 'Reviews', path: '/reviews', icon: Star },
  { label: 'Payments', path: '/payments', icon: CreditCard },
  { label: 'Analytics', path: '/analytics', icon: BarChart3 },
  { label: 'Email', path: '/email', icon: Mail },
  { label: 'Settings', path: '/settings', icon: Settings },
];

// ---------------------------------------------------------------------------
// Loading fallback
// ---------------------------------------------------------------------------
function LoadingFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-alabaster">
      <div className="flex flex-col items-center gap-3">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        <span className="text-sm text-dark-light">Loading...</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Scroll to top on route change
// ---------------------------------------------------------------------------
function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

// ---------------------------------------------------------------------------
// Error boundary
// ---------------------------------------------------------------------------
interface ErrorBoundaryProps {
  children: ReactNode;
}
interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-alabaster px-4 text-center">
          <h1 className="mb-4 text-3xl font-bold text-dark">Something went wrong</h1>
          <p className="mb-6 max-w-md text-dark-light">
            {this.state.error?.message || 'An unexpected error occurred.'}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="rounded-lg bg-primary px-6 py-2.5 font-medium text-dark transition-colors hover:bg-primary-dark"
          >
            Reload page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// ---------------------------------------------------------------------------
// Access Denied screen
// ---------------------------------------------------------------------------
function AccessDenied() {
  const { logout } = useAuth();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-alabaster px-4 text-center">
      <ShieldAlert className="mb-6 h-16 w-16 text-error" />
      <h1 className="mb-4 text-3xl font-bold text-dark">Access Denied</h1>
      <p className="mb-8 max-w-md text-dark-light">
        Your account does not have administrator privileges. Only users with the System Manager role
        can access the admin portal.
      </p>
      <button
        onClick={() => logout()}
        className="rounded-lg bg-dark px-6 py-2.5 font-medium text-alabaster transition-colors hover:bg-dark-light"
      >
        Sign out
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Route guards
// ---------------------------------------------------------------------------
function ProtectedRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated, isAdmin, isLoading, accessDenied } = useAuth();
  const location = useLocation();

  if (isLoading) return <LoadingFallback />;
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  if (accessDenied || !isAdmin) {
    return <AccessDenied />;
  }
  return <>{children}</>;
}

function PublicRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated, isAdmin, isLoading } = useAuth();

  if (isLoading) return <LoadingFallback />;
  if (isAuthenticated && isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }
  return <>{children}</>;
}

// ---------------------------------------------------------------------------
// Sidebar
// ---------------------------------------------------------------------------
function Sidebar({
  collapsed,
  onToggle,
}: {
  collapsed: boolean;
  onToggle: () => void;
}) {
  return (
    <aside
      className={`sidebar fixed left-0 top-0 z-30 flex h-screen flex-col bg-sidebar-bg ${
        collapsed ? 'sidebar-collapsed' : 'sidebar-expanded'
      }`}
    >
      {/* Logo area */}
      <div className="flex h-16 items-center justify-between px-4">
        {!collapsed && (
          <span className="text-lg font-bold text-sidebar-text-active tracking-wide">
            Delta SPMU
          </span>
        )}
        <button
          onClick={onToggle}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-sidebar-text hover:bg-sidebar-hover hover:text-alabaster transition-colors"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>
      </div>

      {/* Nav items */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <ul className="flex flex-col gap-1">
          {navItems.map((item) => (
            <li key={item.path}>
              <NavLink
                to={item.path}
                className={({ isActive }) =>
                  `sidebar-nav-item ${isActive ? 'active' : ''}`
                }
                title={collapsed ? item.label : undefined}
              >
                <item.icon size={20} className="shrink-0" />
                {!collapsed && <span className="text-sm font-medium">{item.label}</span>}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      {/* Footer */}
      <div className="border-t border-sidebar-hover px-3 py-3">
        <LogoutButton collapsed={collapsed} />
      </div>
    </aside>
  );
}

function LogoutButton({ collapsed }: { collapsed: boolean }) {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <button
      onClick={handleLogout}
      className="sidebar-nav-item w-full hover:text-error"
      title={collapsed ? 'Sign out' : undefined}
    >
      <LogOut size={20} className="shrink-0" />
      {!collapsed && <span className="text-sm font-medium">Sign out</span>}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Top bar
// ---------------------------------------------------------------------------
function TopBar({ onMenuClick }: { onMenuClick: () => void }) {
  const { user } = useAuth();

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-gray-200 bg-white px-6">
      <div className="flex items-center gap-4">
        <button
          onClick={onMenuClick}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-dark-light hover:bg-gray-100 lg:hidden"
          aria-label="Toggle menu"
        >
          <Menu size={20} />
        </button>
        {/* Search */}
        <div className="relative hidden sm:block">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search..."
            className="h-9 w-64 rounded-lg border border-gray-200 bg-gray-50 pl-9 pr-4 text-sm text-dark placeholder:text-gray-400 focus:border-primary-dark focus:bg-white focus:outline-none"
          />
        </div>
      </div>

      <div className="flex items-center gap-3">
        {/* Notifications */}
        <button
          className="relative flex h-9 w-9 items-center justify-center rounded-lg text-dark-light hover:bg-gray-100"
          aria-label="Notifications"
        >
          <Bell size={18} />
          <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-error" />
        </button>

        {/* Language switcher */}
        <LanguageSwitcher />

        {/* User avatar */}
        <div className="flex items-center gap-2">
          {user?.user_image ? (
            <img
              src={user.user_image}
              alt={user.full_name}
              className="h-8 w-8 rounded-full object-cover"
            />
          ) : (
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-semibold text-dark">
              {user?.full_name?.charAt(0) || 'A'}
            </div>
          )}
          <span className="hidden text-sm font-medium text-dark md:block">
            {user?.full_name || 'Admin'}
          </span>
        </div>
      </div>
    </header>
  );
}

// ---------------------------------------------------------------------------
// Admin Layout
// ---------------------------------------------------------------------------
function AdminLayout({ children }: { children: ReactNode }) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Close mobile menu on route change
  const location = useLocation();
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-alabaster">
      {/* Mobile overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/50 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar - desktop */}
      <div className="hidden lg:block">
        <Sidebar
          collapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
        />
      </div>

      {/* Sidebar - mobile */}
      <div
        className={`fixed inset-y-0 left-0 z-30 transform transition-transform duration-200 lg:hidden ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <Sidebar collapsed={false} onToggle={() => setMobileMenuOpen(false)} />
      </div>

      {/* Main content */}
      <div
        className={`transition-[margin] duration-200 ${
          sidebarCollapsed ? 'lg:ml-[64px]' : 'lg:ml-[256px]'
        }`}
      >
        <TopBar onMenuClick={() => setMobileMenuOpen(!mobileMenuOpen)} />
        <main className="p-6">{children}</main>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------
export default function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <AuthProvider>
            <ScrollToTop />
            <Suspense fallback={<LoadingFallback />}>
              <Routes>
                {/* Public route */}
                <Route
                  path="/login"
                  element={
                    <PublicRoute>
                      <Login />
                    </PublicRoute>
                  }
                />

                {/* Protected admin routes */}
                <Route
                  path="/dashboard"
                  element={
                    <ProtectedRoute>
                      <AdminLayout>
                        <Dashboard />
                      </AdminLayout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/courses"
                  element={
                    <ProtectedRoute>
                      <AdminLayout>
                        <CourseList />
                      </AdminLayout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/courses/new"
                  element={
                    <ProtectedRoute>
                      <AdminLayout>
                        <CourseForm />
                      </AdminLayout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/courses/:id"
                  element={
                    <ProtectedRoute>
                      <AdminLayout>
                        <CourseEdit />
                      </AdminLayout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/categories"
                  element={
                    <ProtectedRoute>
                      <AdminLayout>
                        <Categories />
                      </AdminLayout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/videos"
                  element={
                    <ProtectedRoute>
                      <AdminLayout>
                        <Videos />
                      </AdminLayout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/users"
                  element={
                    <ProtectedRoute>
                      <AdminLayout>
                        <UserList />
                      </AdminLayout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/enrollments"
                  element={
                    <ProtectedRoute>
                      <AdminLayout>
                        <Enrollments />
                      </AdminLayout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/quizzes"
                  element={
                    <ProtectedRoute>
                      <AdminLayout>
                        <Quizzes />
                      </AdminLayout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/certificates"
                  element={
                    <ProtectedRoute>
                      <AdminLayout>
                        <Certificates />
                      </AdminLayout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/reviews"
                  element={
                    <ProtectedRoute>
                      <AdminLayout>
                        <Reviews />
                      </AdminLayout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/payments"
                  element={
                    <ProtectedRoute>
                      <AdminLayout>
                        <Payments />
                      </AdminLayout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/analytics"
                  element={
                    <ProtectedRoute>
                      <AdminLayout>
                        <Analytics />
                      </AdminLayout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/email"
                  element={
                    <ProtectedRoute>
                      <AdminLayout>
                        <EmailList />
                      </AdminLayout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/email/compose"
                  element={
                    <ProtectedRoute>
                      <AdminLayout>
                        <EmailCompose />
                      </AdminLayout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/email/:id"
                  element={
                    <ProtectedRoute>
                      <AdminLayout>
                        <EmailDetail />
                      </AdminLayout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/email/addresses"
                  element={
                    <ProtectedRoute>
                      <AdminLayout>
                        <EmailAddresses />
                      </AdminLayout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/settings"
                  element={
                    <ProtectedRoute>
                      <AdminLayout>
                        <SettingsPage />
                      </AdminLayout>
                    </ProtectedRoute>
                  }
                />

                {/* Root & catch-all */}
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
                <Route path="*" element={<Navigate to="/dashboard" replace />} />
              </Routes>
            </Suspense>
          </AuthProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
