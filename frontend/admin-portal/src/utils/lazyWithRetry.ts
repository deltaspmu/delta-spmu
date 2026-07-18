import { lazy, type ComponentType } from 'react';

const RECOVERY_KEY_PREFIX = 'deltaspmu_chunk_recovery:';

export function isChunkLoadError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|Unable to preload CSS/i.test(
    message,
  );
}

function recoveryKey(chunkName: string): string {
  return `${RECOVERY_KEY_PREFIX}${chunkName}`;
}

export function clearChunkRecoveryMarkers(): void {
  try {
    for (let index = sessionStorage.length - 1; index >= 0; index -= 1) {
      const key = sessionStorage.key(index);
      if (key?.startsWith(RECOVERY_KEY_PREFIX)) {
        sessionStorage.removeItem(key);
      }
    }
  } catch {
    // Storage can be unavailable in privacy-restricted browser contexts.
  }
}

export function lazyWithRetry(
  importer: () => Promise<{ default: ComponentType }>,
  chunkName: string,
) {
  return lazy(async () => {
    const key = recoveryKey(chunkName);

    try {
      const module = await importer();
      try {
        sessionStorage.removeItem(key);
      } catch {
        // A successful import should not fail because storage is unavailable.
      }
      return module;
    } catch (error) {
      if (isChunkLoadError(error)) {
        try {
          if (!sessionStorage.getItem(key)) {
            sessionStorage.setItem(key, '1');
            window.location.reload();

            // Keep this lazy import pending while the browser navigates away.
            return await new Promise<never>(() => undefined);
          }
        } catch {
          // If storage is blocked, fall through to the normal error boundary.
        }
      }

      throw error;
    }
  });
}
