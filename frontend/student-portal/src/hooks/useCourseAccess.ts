import { useQuery } from '@tanstack/react-query';
import { getCourseAccess, getEnrollmentStatus } from '@/api/client';
import { useAuth } from '@/context/AuthContext';
import type { CourseAccess } from '@/types';

interface UseCourseAccessReturn {
  hasAccess: boolean;
  accessEnd: string | null;
  daysRemaining: number;
  isExpiringSoon: boolean;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

export function useCourseAccess(courseId: string): UseCourseAccessReturn {
  const { user, isAuthenticated } = useAuth();

  const { data, isLoading, error, refetch } = useQuery<CourseAccess>({
    queryKey: ['courseAccess', courseId, user?.email],
    queryFn: async () => {
      try {
        const access = (await getCourseAccess(courseId)) as CourseAccess;
        if (access && typeof access.has_access === 'boolean') {
          return access;
        }
        throw new Error('No access data returned');
      } catch {
        // Fallback to enrollment status
        const enrollment = (await getEnrollmentStatus(courseId)) as Record<string, unknown>;
        const isEnrolled = !!(enrollment && (enrollment.is_enrolled || enrollment.enrolled));
        return {
          has_access: isEnrolled,
          access_start: null,
          access_end: null,
          days_remaining: isEnrolled ? 365 : 0,
          is_expiring_soon: false,
        } as CourseAccess;
      }
    },
    enabled: isAuthenticated && !!courseId,
  });

  const daysRemaining = data?.days_remaining ?? 0;

  return {
    hasAccess: data?.has_access ?? false,
    accessEnd: data?.access_end ?? null,
    daysRemaining,
    isExpiringSoon: daysRemaining > 0 && daysRemaining < 7,
    isLoading,
    error: error as Error | null,
    refetch,
  };
}

export default useCourseAccess;
