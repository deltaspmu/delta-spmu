import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getNotifications, markNotificationRead } from '@/api/client';
import { useAuth } from '@/context/AuthContext';
import type { Notification } from '@/types';

interface UseNotificationsReturn {
  notifications: Notification[];
  unreadCount: number;
  isLoading: boolean;
  markAsRead: (notificationId: string) => void;
}

export function useNotifications(): UseNotificationsReturn {
  const { user, isAuthenticated } = useAuth();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery<Notification[]>({
    queryKey: ['notifications', user?.email],
    queryFn: async () => {
      const result = await getNotifications(20, 0);
      // Handle both array responses and paginated responses
      if (Array.isArray(result)) {
        return result as Notification[];
      }
      const paginated = result as { data?: Notification[] };
      return paginated?.data ?? [];
    },
    enabled: isAuthenticated,
    refetchInterval: 60000, // 1 minute polling
  });

  const notifications = data ?? [];

  const unreadCount = notifications.filter(
    (n: Notification) => n.read === false
  ).length;

  const { mutate: markAsRead } = useMutation({
    mutationFn: (notificationId: string) => markNotificationRead(notificationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications', user?.email] });
    },
  });

  return {
    notifications,
    unreadCount,
    isLoading,
    markAsRead,
  };
}

export default useNotifications;
