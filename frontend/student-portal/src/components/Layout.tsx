import { useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Menu,
  X,
  ChevronDown,
  User,
  LogOut,
  BookOpen,
  Award,
  Heart,
  Receipt,
  Globe,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import NotificationDropdown from './NotificationDropdown';
import Avatar from './Avatar';

// ---------------------------------------------------------------------------
// Language Switcher (inline — no separate file exists yet)
// ---------------------------------------------------------------------------
function LanguageSwitcher() {
  const { i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  const current = i18n.language?.startsWith('am') ? 'am' : 'en';

  function switchTo(lng: string) {
    i18n.changeLanguage(lng);
    setOpen(false);
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((p) => !p)}
        className="flex items-center gap-1 rounded-lg p-2 text-dark-light transition-colors hover:bg-primary-light/50 hover:text-dark"
        aria-label="Switch language"
      >
        <Globe className="h-4.5 w-4.5" />
        <span className="text-xs font-medium uppercase">{current}</span>
      </button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 w-32 overflow-hidden rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
          <button
            onClick={() => switchTo('en')}
            className={`flex w-full items-center px-3 py-2 text-sm transition-colors hover:bg-alabaster ${
              current === 'en' ? 'font-semibold text-dark' : 'text-dark-light'
            }`}
          >
            English
          </button>
          <button
            onClick={() => switchTo('am')}
            className={`flex w-full items-center px-3 py-2 text-sm transition-colors hover:bg-alabaster ${
              current === 'am' ? 'font-semibold text-dark' : 'text-dark-light'
            }`}
          >
            Amharic
          </button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------
interface LayoutProps {
  children: React.ReactNode;
  showFooter?: boolean;
}

// ---------------------------------------------------------------------------
// Nav links config
// ---------------------------------------------------------------------------
interface NavItem {
  label: string;
  to: string;
  authOnly?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Courses', to: '/courses' },
  { label: 'My Courses', to: '/my-courses', authOnly: true },
  { label: 'Dashboard', to: '/dashboard', authOnly: true },
];

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------
export default function Layout({ children, showFooter = true }: LayoutProps) {
  const { user, isAuthenticated, logout } = useAuth();
  const { t } = useTranslation();
  const location = useLocation();

  const [mobileOpen, setMobileOpen] = useState(false);
  const [avatarOpen, setAvatarOpen] = useState(false);
  const avatarRef = useRef<HTMLDivElement>(null);

  // Close avatar dropdown on outside click
  useEffect(() => {
    if (!avatarOpen) return;
    function handleClick(e: MouseEvent) {
      if (avatarRef.current && !avatarRef.current.contains(e.target as Node)) {
        setAvatarOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [avatarOpen]);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileOpen(false);
    setAvatarOpen(false);
  }, [location.pathname]);

  // Lock body scroll when mobile menu is open
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileOpen]);

  const visibleNav = NAV_ITEMS.filter((n) => !n.authOnly || isAuthenticated);

  function isActive(path: string) {
    return location.pathname === path || location.pathname.startsWith(path + '/');
  }

  // -------------------------------------------------------------------------
  // Header
  // -------------------------------------------------------------------------
  const header = (
    <header className="sticky top-0 z-50 border-b border-gray-200 bg-white">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Logo */}
        <Link
          to="/courses"
          className="flex items-center gap-2 text-lg font-bold tracking-tight text-dark"
        >
          <BookOpen className="h-6 w-6 text-primary-dark" />
          <span className="font-heading">Delta SPMU</span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-1 md:flex">
          {visibleNav.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                isActive(item.to)
                  ? 'bg-primary-light/60 text-dark'
                  : 'text-dark-light hover:bg-primary-light/30 hover:text-dark'
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        {/* Right section */}
        <div className="flex items-center gap-1">
          <LanguageSwitcher />

          {isAuthenticated && <NotificationDropdown />}

          {/* User avatar dropdown — desktop */}
          {isAuthenticated && user ? (
            <div ref={avatarRef} className="relative hidden md:block">
              <button
                onClick={() => setAvatarOpen((p) => !p)}
                className="flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-primary-light/50"
              >
                {user.user_image ? (
                  <Avatar
                    src={user.user_image}
                    name={user.full_name}
                    size={28}
                    className="h-7 w-7 rounded-full object-cover"
                  />
                ) : (
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-semibold text-dark">
                    {(user.first_name || user.full_name || 'U')[0].toUpperCase()}
                  </span>
                )}
                <ChevronDown className="h-3.5 w-3.5 text-dark-light" />
              </button>

              {avatarOpen && (
                <div className="absolute right-0 top-full z-50 mt-2 w-52 overflow-hidden rounded-xl border border-gray-200 bg-white py-1 shadow-lg">
                  <div className="border-b border-gray-100 px-4 py-2.5">
                    <p className="truncate text-sm font-semibold text-dark">
                      {user.full_name}
                    </p>
                    <p className="truncate text-xs text-dark-light">{user.email}</p>
                  </div>

                  <Link
                    to="/profile"
                    onClick={() => setAvatarOpen(false)}
                    className="flex items-center gap-2.5 px-4 py-2 text-sm text-dark-light transition-colors hover:bg-alabaster hover:text-dark"
                  >
                    <User className="h-4 w-4" /> Profile
                  </Link>
                  <Link
                    to="/certificates"
                    onClick={() => setAvatarOpen(false)}
                    className="flex items-center gap-2.5 px-4 py-2 text-sm text-dark-light transition-colors hover:bg-alabaster hover:text-dark"
                  >
                    <Award className="h-4 w-4" /> Certificates
                  </Link>
                  <Link
                    to="/transactions"
                    onClick={() => setAvatarOpen(false)}
                    className="flex items-center gap-2.5 px-4 py-2 text-sm text-dark-light transition-colors hover:bg-alabaster hover:text-dark"
                  >
                    <Receipt className="h-4 w-4" /> Transactions
                  </Link>
                  <Link
                    to="/wishlist"
                    onClick={() => setAvatarOpen(false)}
                    className="flex items-center gap-2.5 px-4 py-2 text-sm text-dark-light transition-colors hover:bg-alabaster hover:text-dark"
                  >
                    <Heart className="h-4 w-4" /> Wishlist
                  </Link>

                  <div className="my-1 border-t border-gray-100" />

                  <button
                    onClick={() => {
                      setAvatarOpen(false);
                      logout();
                    }}
                    className="flex w-full items-center gap-2.5 px-4 py-2 text-sm text-error transition-colors hover:bg-error/5"
                  >
                    <LogOut className="h-4 w-4" /> Log Out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="hidden items-center gap-2 md:flex">
              <Link
                to="/login"
                className="rounded-lg px-4 py-2 text-sm font-medium text-dark-light transition-colors hover:bg-primary-light/30 hover:text-dark"
              >
                Login
              </Link>
              <Link
                to="/register"
                className="rounded-lg bg-dark px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-dark-light"
              >
                Register
              </Link>
            </div>
          )}

          {/* Mobile hamburger */}
          <button
            onClick={() => setMobileOpen(true)}
            className="rounded-lg p-2 text-dark-light transition-colors hover:bg-primary-light/50 hover:text-dark md:hidden"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>
        </div>
      </div>
    </header>
  );

  // -------------------------------------------------------------------------
  // Mobile drawer
  // -------------------------------------------------------------------------
  const mobileDrawer = (
    <>
      {/* Overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Drawer */}
      <div
        className={`fixed right-0 top-0 z-50 h-full w-72 transform bg-white shadow-xl transition-transform duration-300 md:hidden ${
          mobileOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Close */}
        <div className="flex items-center justify-between border-b border-gray-100 px-4 py-4">
          <span className="font-heading text-sm font-bold text-dark">Menu</span>
          <button
            onClick={() => setMobileOpen(false)}
            className="rounded-lg p-1.5 text-dark-light hover:bg-primary-light/50 hover:text-dark"
            aria-label="Close menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex h-[calc(100%-57px)] flex-col justify-between overflow-y-auto">
          <div className="px-3 py-4">
            {/* User info */}
            {isAuthenticated && user && (
              <div className="mb-4 flex items-center gap-3 rounded-lg bg-alabaster px-3 py-3">
                {user.user_image ? (
                  <Avatar
                    src={user.user_image}
                    name={user.full_name}
                    size={36}
                    className="h-9 w-9 rounded-full object-cover"
                  />
                ) : (
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-sm font-semibold text-dark">
                    {(user.first_name || user.full_name || 'U')[0].toUpperCase()}
                  </span>
                )}
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-dark">
                    {user.full_name}
                  </p>
                  <p className="truncate text-xs text-dark-light">{user.email}</p>
                </div>
              </div>
            )}

            {/* Nav links */}
            <nav className="space-y-1">
              {visibleNav.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`block rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                    isActive(item.to)
                      ? 'bg-primary-light/60 text-dark'
                      : 'text-dark-light hover:bg-primary-light/30 hover:text-dark'
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </nav>

            {/* Authenticated extra links */}
            {isAuthenticated && (
              <div className="mt-4 space-y-1 border-t border-gray-100 pt-4">
                <Link
                  to="/profile"
                  className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm text-dark-light transition-colors hover:bg-primary-light/30 hover:text-dark"
                >
                  <User className="h-4 w-4" /> Profile
                </Link>
                <Link
                  to="/certificates"
                  className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm text-dark-light transition-colors hover:bg-primary-light/30 hover:text-dark"
                >
                  <Award className="h-4 w-4" /> Certificates
                </Link>
                <Link
                  to="/transactions"
                  className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm text-dark-light transition-colors hover:bg-primary-light/30 hover:text-dark"
                >
                  <Receipt className="h-4 w-4" /> Transactions
                </Link>
                <Link
                  to="/wishlist"
                  className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm text-dark-light transition-colors hover:bg-primary-light/30 hover:text-dark"
                >
                  <Heart className="h-4 w-4" /> Wishlist
                </Link>
              </div>
            )}
          </div>

          {/* Bottom action */}
          <div className="border-t border-gray-100 px-3 py-4">
            {isAuthenticated ? (
              <button
                onClick={() => {
                  setMobileOpen(false);
                  logout();
                }}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-error/10 px-4 py-2.5 text-sm font-medium text-error transition-colors hover:bg-error/20"
              >
                <LogOut className="h-4 w-4" /> Log Out
              </button>
            ) : (
              <div className="space-y-2">
                <Link
                  to="/login"
                  className="block w-full rounded-lg border border-gray-200 px-4 py-2.5 text-center text-sm font-medium text-dark transition-colors hover:bg-alabaster"
                >
                  Login
                </Link>
                <Link
                  to="/register"
                  className="block w-full rounded-lg bg-dark px-4 py-2.5 text-center text-sm font-medium text-white transition-colors hover:bg-dark-light"
                >
                  Register
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );

  // -------------------------------------------------------------------------
  // Footer
  // -------------------------------------------------------------------------
  const footer = (
    <footer className="bg-dark text-white">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-8 lg:grid-cols-3">
          {/* Brand */}
          <div>
            <Link to="/courses" className="flex items-center gap-2">
              <BookOpen className="h-6 w-6 text-primary" />
              <span className="font-heading text-lg font-bold">Delta SPMU Academy</span>
            </Link>
            <p className="mt-2 text-sm font-medium text-primary-light">
              Master the Art of Semi-Permanent Makeup
            </p>
            <p className="mt-3 max-w-sm text-sm leading-relaxed text-white/60">
              Professional training in microblading, lip blush, eyeliner, and more.
              Learn from industry experts and earn recognized certifications.
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="mb-4 text-sm font-semibold uppercase tracking-wider text-white/80">
              Quick Links
            </h4>
            <ul className="space-y-2.5">
              {[
                { label: 'Courses', to: '/courses' },
                { label: 'About', to: '/about' },
                { label: 'Contact', to: '/contact' },
                { label: 'Help Center', to: '/help' },
              ].map((link) => (
                <li key={link.to}>
                  <Link
                    to={link.to}
                    className="text-sm text-white/60 transition-colors hover:text-primary-light"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 className="mb-4 text-sm font-semibold uppercase tracking-wider text-white/80">
              Legal
            </h4>
            <ul className="space-y-2.5">
              {[
                { label: 'Terms of Service', to: '/terms' },
                { label: 'Privacy Policy', to: '/privacy' },
                { label: 'Refund Policy', to: '/refund' },
                { label: 'Cookie Policy', to: '/cookies' },
              ].map((link) => (
                <li key={link.to}>
                  <Link
                    to={link.to}
                    className="text-sm text-white/60 transition-colors hover:text-primary-light"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom row */}
        <div className="mt-10 border-t border-white/10 pt-6 text-center">
          <p className="text-xs text-white/40">
            &copy; 2026 Delta SPMU Academy. All rights reserved.
          </p>
          <p className="mt-1 text-xs text-white/30">
            Powered by Philocom
          </p>
        </div>
      </div>
    </footer>
  );

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  return (
    <div className="flex min-h-screen flex-col">
      {header}
      {mobileDrawer}
      <main className="flex-1">{children}</main>
      {showFooter && footer}
    </div>
  );
}
