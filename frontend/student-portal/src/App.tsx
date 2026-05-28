import React, { Suspense, lazy, useEffect, type ReactNode } from 'react';
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  Outlet,
  useLocation,
} from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { HelmetProvider } from 'react-helmet-async';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import SiteGate from './components/SiteGate';
import { trackPageView } from './lib/analytics';

// ---------------------------------------------------------------------------
// Query client
// ---------------------------------------------------------------------------
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

// ---------------------------------------------------------------------------
// Lazy-loaded pages
// ---------------------------------------------------------------------------
const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));
const ResetPassword = lazy(() => import('./pages/ResetPassword'));
const Verify = lazy(() => import('./pages/VerifyEmail'));

const Courses = lazy(() => import('./pages/Courses'));
const CourseDetail = lazy(() => import('./pages/CourseDetail'));

const Dashboard = lazy(() => import('./pages/Dashboard'));
const MyCourses = lazy(() => import('./pages/MyCourses'));
const Profile = lazy(() => import('./pages/Profile'));
const Certificates = lazy(() => import('./pages/Certificates'));
const Wishlist = lazy(() => import('./pages/Wishlist'));

const Learn = lazy(() => import('./pages/Learn'));
const QuizPage = lazy(() => import('./pages/Quiz'));

const Payment = lazy(() => import('./pages/Payment'));
const PaymentSuccess = lazy(() => import('./pages/PaymentSuccess'));
const Transactions = lazy(() => import('./pages/Transactions'));

const Terms = lazy(() => import('./pages/Terms'));
const Privacy = lazy(() => import('./pages/Privacy'));
const Refund = lazy(() => import('./pages/Refund'));
const Cookies = lazy(() => import('./pages/Cookies'));
const Help = lazy(() => import('./pages/Help'));
const Contact = lazy(() => import('./pages/Contact'));
const About = lazy(() => import('./pages/About'));

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
    trackPageView(pathname);
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
// Route guards
// ---------------------------------------------------------------------------
function ProtectedRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) return <LoadingFallback />;
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  return <>{children}</>;
}

function PublicRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) return <LoadingFallback />;
  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }
  return <>{children}</>;
}

// ---------------------------------------------------------------------------
// Layout wrapper — renders the shared nav/footer around <Outlet />.
// Used as a parent route for content pages. Auth pages (login/register/etc.)
// and immersive pages (learn/quiz) skip this and render bare.
// ---------------------------------------------------------------------------
function LayoutOutlet() {
  return (
    <Layout>
      <Outlet />
    </Layout>
  );
}

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------
export default function App() {
  return (
    <SiteGate>
      <ErrorBoundary>
        <HelmetProvider>
          <QueryClientProvider client={queryClient}>
            <BrowserRouter>
            <AuthProvider>
              <ScrollToTop />
              <Suspense fallback={<LoadingFallback />}>
                <Routes>
                  {/* Root redirect */}
                  <Route path="/" element={<Navigate to="/courses" replace />} />

                  {/* Public auth routes */}
                  <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
                  <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />
                  <Route path="/forgot-password" element={<PublicRoute><ForgotPassword /></PublicRoute>} />
                  <Route path="/reset-password" element={<PublicRoute><ResetPassword /></PublicRoute>} />
                  <Route path="/verify" element={<PublicRoute><Verify /></PublicRoute>} />

                  {/* Immersive routes (no shared nav/footer) */}
                  <Route path="/learn/:courseId" element={<ProtectedRoute><Learn /></ProtectedRoute>} />
                  <Route path="/learn/:courseId/:lessonId" element={<ProtectedRoute><Learn /></ProtectedRoute>} />
                  <Route path="/quiz/:quizId" element={<ProtectedRoute><QuizPage /></ProtectedRoute>} />

                  {/* Content routes (wrapped in Layout for shared nav/footer) */}
                  <Route element={<LayoutOutlet />}>
                    {/* Public content routes */}
                    <Route path="/courses" element={<Courses />} />
                    <Route path="/course/:courseId" element={<CourseDetail />} />

                    {/* Protected routes */}
                    <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
                    <Route path="/my-courses" element={<ProtectedRoute><MyCourses /></ProtectedRoute>} />
                    <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
                    <Route path="/certificates" element={<ProtectedRoute><Certificates /></ProtectedRoute>} />
                    <Route path="/wishlist" element={<ProtectedRoute><Wishlist /></ProtectedRoute>} />

                    <Route path="/payment/:courseId" element={<ProtectedRoute><Payment /></ProtectedRoute>} />
                    <Route path="/payment/success" element={<ProtectedRoute><PaymentSuccess /></ProtectedRoute>} />
                    <Route path="/transactions" element={<ProtectedRoute><Transactions /></ProtectedRoute>} />

                    {/* Public info pages */}
                    <Route path="/terms" element={<Terms />} />
                    <Route path="/privacy" element={<Privacy />} />
                    <Route path="/refund" element={<Refund />} />
                    <Route path="/cookies" element={<Cookies />} />
                    <Route path="/help" element={<Help />} />
                    <Route path="/contact" element={<Contact />} />
                    <Route path="/about" element={<About />} />
                  </Route>

                  {/* Catch-all */}
                  <Route path="*" element={<Navigate to="/courses" replace />} />
                </Routes>
              </Suspense>
              <Toaster
                position="top-right"
                toastOptions={{
                  duration: 4000,
                  style: {
                    background: '#121212',
                    color: '#FAFAFA',
                    borderRadius: '8px',
                    fontSize: '14px',
                  },
                  success: { iconTheme: { primary: '#22C55E', secondary: '#FAFAFA' } },
                  error: { iconTheme: { primary: '#EF4444', secondary: '#FAFAFA' } },
                }}
              />
            </AuthProvider>
          </BrowserRouter>
        </QueryClientProvider>
      </HelmetProvider>
      </ErrorBoundary>
    </SiteGate>
  );
}
