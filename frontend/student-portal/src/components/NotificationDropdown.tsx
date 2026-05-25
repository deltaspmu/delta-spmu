import { useState, useEffect, useRef } from 'react';
import { Bell } from 'lucide-react';
import { useNotifications } from '@/hooks/useNotifications';

function timeAgo(dateString: string): string {
  const now = new Date();
  const date = new Date(dateString);
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString();
}

export default function NotificationDropdown() {
  const { notifications, unreadCount, markAsRead } = useNotifications();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    if (!open) return;

    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const recent = notifications.slice(0, 5);

  return (
    <div ref={containerRef} className="relative">
      {/* Bell button */}
      <button
        onClick={() => setOpen((prev) => !prev)}
        className="relative rounded-lg p-2 text-dark-light transition-colors hover:bg-primary-light/50 hover:text-dark"
        aria-label="Notifications"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-error px-1 text-[10px] font-bold leading-none text-white">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-80 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg">
          <div className="border-b border-gray-100 px-4 py-3">
            <h3 className="text-sm font-semibold text-dark">Notifications</h3>
          </div>

          {recent.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-dark-light">
              No notifications yet
            </div>
          ) : (
            <ul className="max-h-80 divide-y divide-gray-50 overflow-y-auto">
              {recent.map((n) => (
                <li key={n.name}>
                  <button
                    onClick={() => {
                      if (!n.read) markAsRead(n.name);
                    }}
                    className="flex w-full gap-3 px-4 py-3 text-left transition-colors hover:bg-alabaster"
                  >
                    {/* Unread dot */}
                    <span className="mt-1.5 flex-shrink-0">
                      {!n.read ? (
                        <span className="block h-2 w-2 rounded-full bg-info" />
                      ) : (
                        <span className="block h-2 w-2" />
                      )}
                    </span>

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-dark">
                        {n.subject}
                      </p>
                      <p className="mt-0.5 line-clamp-2 text-xs text-dark-light">
                        {n.message}
                      </p>
                      <p className="mt-1 text-[11px] text-dark-light/60">
                        {timeAgo(n.creation)}
                      </p>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="border-t border-gray-100">
            <button
              onClick={() => setOpen(false)}
              className="w-full px-4 py-2.5 text-center text-xs font-medium text-info transition-colors hover:bg-alabaster"
            >
              View All
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
