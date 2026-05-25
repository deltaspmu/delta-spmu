import { useQuery } from '@tanstack/react-query';
import { getCoursePrice } from '@/api/client';
import type { PaymentInfo } from '@/types';

const FALLBACK_PRICE: PaymentInfo = {
  original_price: 5000,
  discount_percent: 0,
  discount_amount: 0,
  final_price: 5000,
  currency: 'ETB',
  bundle_available: true,
  bundle_price: 5000,
};

interface UseCoursePriceReturn {
  priceInfo: PaymentInfo;
  isLoading: boolean;
  error: Error | null;
}

export function useCoursePrice(
  courseId: string,
  currency: string = 'ETB'
): UseCoursePriceReturn {
  const { data, isLoading, error } = useQuery<PaymentInfo>({
    queryKey: ['coursePrice', courseId, currency],
    queryFn: async () => {
      try {
        const price = (await getCoursePrice(courseId, currency)) as PaymentInfo;
        if (price && typeof price.final_price === 'number') {
          return price;
        }
        return FALLBACK_PRICE;
      } catch {
        return FALLBACK_PRICE;
      }
    },
    enabled: !!courseId,
    staleTime: 10 * 60 * 1000, // 10 minutes
  });

  return {
    priceInfo: data ?? FALLBACK_PRICE,
    isLoading,
    error: error as Error | null,
  };
}

export default useCoursePrice;
