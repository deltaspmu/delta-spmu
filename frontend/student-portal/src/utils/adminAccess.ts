export interface AdminIdentity {
  name: string;
  roles?: readonly string[];
}

/**
 * Admin access is role-based. The built-in Administrator user is retained as
 * a stable fallback because its email address is mutable account metadata.
 */
export function hasAdminAccess(user: AdminIdentity): boolean {
  return user.name === 'Administrator' || user.roles?.includes('System Manager') === true;
}
