import { useState, useCallback, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';

function getStorageKey(email: string): string {
  return `deltaspmu_wishlist_${email}`;
}

function loadWishlist(email: string): string[] {
  try {
    const raw = localStorage.getItem(getStorageKey(email));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveWishlist(email: string, items: string[]): void {
  try {
    localStorage.setItem(getStorageKey(email), JSON.stringify(items));
  } catch {
    // Silently ignore storage errors
  }
}

interface UseWishlistReturn {
  wishlist: string[];
  addToWishlist: (courseId: string) => void;
  removeFromWishlist: (courseId: string) => void;
  toggleWishlist: (courseId: string) => void;
  isInWishlist: (courseId: string) => boolean;
  clearWishlist: () => void;
}

export function useWishlist(): UseWishlistReturn {
  const { user } = useAuth();
  const userEmail = user?.email ?? '';

  const [wishlist, setWishlist] = useState<string[]>([]);

  // Load wishlist on mount and when user changes
  useEffect(() => {
    if (userEmail) {
      setWishlist(loadWishlist(userEmail));
    } else {
      setWishlist([]);
    }
  }, [userEmail]);

  const addToWishlist = useCallback(
    (courseId: string) => {
      if (!userEmail) return;
      setWishlist((prev) => {
        if (prev.includes(courseId)) return prev;
        const next = [...prev, courseId];
        saveWishlist(userEmail, next);
        return next;
      });
    },
    [userEmail]
  );

  const removeFromWishlist = useCallback(
    (courseId: string) => {
      if (!userEmail) return;
      setWishlist((prev) => {
        const next = prev.filter((id) => id !== courseId);
        saveWishlist(userEmail, next);
        return next;
      });
    },
    [userEmail]
  );

  const toggleWishlist = useCallback(
    (courseId: string) => {
      if (!userEmail) return;
      setWishlist((prev) => {
        const next = prev.includes(courseId)
          ? prev.filter((id) => id !== courseId)
          : [...prev, courseId];
        saveWishlist(userEmail, next);
        return next;
      });
    },
    [userEmail]
  );

  const isInWishlist = useCallback(
    (courseId: string): boolean => {
      return wishlist.includes(courseId);
    },
    [wishlist]
  );

  const clearWishlist = useCallback(() => {
    if (!userEmail) return;
    setWishlist([]);
    saveWishlist(userEmail, []);
  }, [userEmail]);

  return {
    wishlist,
    addToWishlist,
    removeFromWishlist,
    toggleWishlist,
    isInWishlist,
    clearWishlist,
  };
}

export default useWishlist;
