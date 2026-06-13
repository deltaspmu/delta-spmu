import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getUsers, getUserDetail, banUser, unbanUser, deleteUser } from '@/api/client';
import type { User } from '@/types';
import {
  Search,
  Loader2,
  X,
  AlertTriangle,
  Shield,
  ShieldOff,
  Trash2,
  Eye,
  UserX,
  UserCheck,
} from 'lucide-react';
import { format } from 'date-fns';

type FilterStatus = 'all' | 'active' | 'banned';

function StatusBadge({ enabled }: { enabled: number }) {
  return enabled ? (
    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">Active</span>
  ) : (
    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">Banned</span>
  );
}

function RoleBadges({ roles }: { roles: string[] }) {
  const display = roles.filter((r) => !['All', 'Guest'].includes(r)).slice(0, 3);
  return (
    <div className="flex flex-wrap gap-1">
      {display.map((role) => (
        <span key={role} className="px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">{role}</span>
      ))}
      {roles.length > display.length + 2 && (
        <span className="text-xs text-gray-400">+{roles.length - display.length - 2}</span>
      )}
    </div>
  );
}

export default function UserList() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterStatus>('all');
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);
  const [banTarget, setBanTarget] = useState<{ user: User; action: 'ban' | 'unban' } | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-users'],
    queryFn: () =>
      getUsers({
        fields: JSON.stringify(['name', 'email', 'full_name', 'mobile_no', 'phone', 'enabled', 'roles', 'last_active', 'user_image', 'creation']),
        limit_page_length: 0,
        order_by: 'creation desc',
      }),
  });

  // Load user detail for slide-over
  const { data: userDetail, isLoading: detailLoading } = useQuery({
    queryKey: ['user-detail', selectedUser?.name],
    queryFn: () => getUserDetail(selectedUser!.name),
    enabled: !!selectedUser,
  });

  const banMutation = useMutation({
    mutationFn: ({ user, action }: { user: string; action: 'ban' | 'unban' }) =>
      action === 'ban' ? banUser(user) : unbanUser(user),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      setBanTarget(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (name: string) => deleteUser(name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      setDeleteTarget(null);
    },
  });

  const users: User[] = Array.isArray(data) ? data : data?.data || [];

  const filtered = users.filter((u) => {
    if (u.name === 'Administrator' || u.name === 'Guest') return false;
    const matchesSearch =
      !search ||
      u.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      u.email?.toLowerCase().includes(search.toLowerCase()) ||
      (u.mobile_no || u.phone || '').toLowerCase().includes(search.toLowerCase());
    const matchesFilter =
      filter === 'all' ||
      (filter === 'active' && u.enabled === 1) ||
      (filter === 'banned' && u.enabled === 0);
    return matchesSearch && matchesFilter;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="font-heading text-2xl font-bold text-dark">Users</h1>
        <p className="text-sm text-gray-500 mt-1">{users.length} registered users</p>
      </div>

      {/* Toolbar */}
      <div className="admin-card flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name, email, or phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm"
          />
        </div>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value as FilterStatus)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
        >
          <option value="all">All Users</option>
          <option value="active">Active</option>
          <option value="banned">Banned</option>
        </select>
      </div>

      {/* Users Table */}
      {isLoading ? (
        <div className="flex items-center justify-center h-40">
          <Loader2 className="w-6 h-6 animate-spin text-primary-dark" />
        </div>
      ) : (
        <div className="admin-card p-0 overflow-x-auto">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Phone</th>
                <th>Roles</th>
                <th>Status</th>
                <th>Last Login</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center text-gray-400 py-8">No users found</td>
                </tr>
              ) : (
                filtered.map((user) => (
                  <tr key={user.name}>
                    <td>
                      <div className="flex items-center gap-2">
                        {user.user_image ? (
                          <img src={user.user_image} alt="" className="w-8 h-8 rounded-full object-cover" />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-dark text-xs font-semibold">
                            {user.full_name?.charAt(0) || '?'}
                          </div>
                        )}
                        <span className="font-medium text-sm">{user.full_name || user.name}</span>
                      </div>
                    </td>
                    <td className="text-sm text-gray-500">{user.email}</td>
                    <td className="text-sm text-gray-500">{user.mobile_no || user.phone || '—'}</td>
                    <td><RoleBadges roles={user.roles || []} /></td>
                    <td><StatusBadge enabled={user.enabled} /></td>
                    <td className="text-sm text-gray-500">
                      {user.last_active ? format(new Date(user.last_active), 'MMM d, yyyy') : 'Never'}
                    </td>
                    <td>
                      <div className="flex gap-1">
                        <button
                          onClick={() => setSelectedUser(user)}
                          className="p-1 text-gray-500 hover:text-dark"
                          title="View details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {user.enabled === 1 ? (
                          <button
                            onClick={() => setBanTarget({ user, action: 'ban' })}
                            className="p-1 text-gray-500 hover:text-amber-600"
                            title="Ban user"
                          >
                            <ShieldOff className="w-4 h-4" />
                          </button>
                        ) : (
                          <button
                            onClick={() => setBanTarget({ user, action: 'unban' })}
                            className="p-1 text-gray-500 hover:text-green-600"
                            title="Unban user"
                          >
                            <Shield className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={() => setDeleteTarget(user)}
                          className="p-1 text-red-400 hover:text-red-600"
                          title="Delete user"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* User Detail Slide-over */}
      {selectedUser && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={() => setSelectedUser(null)}>
          <div className="bg-white w-full max-w-md h-full overflow-y-auto shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="font-heading font-semibold text-dark">User Details</h3>
              <button onClick={() => setSelectedUser(null)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-4 space-y-6">
              {detailLoading ? (
                <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary-dark" /></div>
              ) : (
                <>
                  {/* Profile */}
                  <div className="flex items-center gap-4">
                    {(userDetail?.user_image || selectedUser.user_image) ? (
                      <img src={userDetail?.user_image || selectedUser.user_image} alt="" className="w-16 h-16 rounded-full object-cover" />
                    ) : (
                      <div className="w-16 h-16 rounded-full bg-primary flex items-center justify-center text-dark text-xl font-bold">
                        {(userDetail?.full_name || selectedUser.full_name || '?').charAt(0)}
                      </div>
                    )}
                    <div>
                      <h4 className="font-medium text-dark">{userDetail?.full_name || selectedUser.full_name}</h4>
                      <p className="text-sm text-gray-500">{userDetail?.email || selectedUser.email}</p>
                      <StatusBadge enabled={userDetail?.enabled ?? selectedUser.enabled} />
                    </div>
                  </div>

                  {/* Info grid */}
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="col-span-2">
                      <p className="text-gray-400 text-xs">Phone</p>
                      <p className="text-dark">{userDetail?.mobile_no || userDetail?.phone || selectedUser.mobile_no || selectedUser.phone || '—'}</p>
                    </div>
                    <div>
                      <p className="text-gray-400 text-xs">Joined</p>
                      <p className="text-dark">{selectedUser.creation ? format(new Date(selectedUser.creation), 'MMM d, yyyy') : '-'}</p>
                    </div>
                    <div>
                      <p className="text-gray-400 text-xs">Last Active</p>
                      <p className="text-dark">{selectedUser.last_active ? format(new Date(selectedUser.last_active), 'MMM d, yyyy') : 'Never'}</p>
                    </div>
                  </div>

                  {/* Roles */}
                  <div>
                    <h5 className="text-xs font-semibold text-gray-400 uppercase mb-2">Roles</h5>
                    <div className="flex flex-wrap gap-1">
                      {(userDetail?.roles || selectedUser.roles || []).filter((r: string) => r !== 'All' && r !== 'Guest').map((role: string) => (
                        <span key={role} className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs">{role}</span>
                      ))}
                    </div>
                  </div>

                  {/* Bio */}
                  {userDetail?.bio && (
                    <div>
                      <h5 className="text-xs font-semibold text-gray-400 uppercase mb-2">Bio</h5>
                      <p className="text-sm text-gray-600">{userDetail.bio}</p>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Ban/Unban Confirmation */}
      {banTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full mx-4 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${banTarget.action === 'ban' ? 'bg-amber-100' : 'bg-green-100'}`}>
                {banTarget.action === 'ban' ? <UserX className="w-5 h-5 text-amber-600" /> : <UserCheck className="w-5 h-5 text-green-600" />}
              </div>
              <h3 className="font-heading font-semibold text-dark">{banTarget.action === 'ban' ? 'Ban User' : 'Unban User'}</h3>
              <button onClick={() => setBanTarget(null)} className="ml-auto text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <p className="text-sm text-gray-600 mb-6">
              {banTarget.action === 'ban'
                ? <>Are you sure you want to ban <strong>{banTarget.user.full_name || banTarget.user.email}</strong>? They will lose access to the platform.</>
                : <>Are you sure you want to unban <strong>{banTarget.user.full_name || banTarget.user.email}</strong>? They will regain access to the platform.</>}
            </p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setBanTarget(null)} className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
              <button
                onClick={() => banMutation.mutate({ user: banTarget.user.name, action: banTarget.action })}
                disabled={banMutation.isPending}
                className={`px-4 py-2 text-sm text-white rounded-lg disabled:opacity-50 ${banTarget.action === 'ban' ? 'bg-amber-600 hover:bg-amber-700' : 'bg-green-600 hover:bg-green-700'}`}
              >
                {banMutation.isPending ? 'Processing...' : banTarget.action === 'ban' ? 'Ban' : 'Unban'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full mx-4 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <h3 className="font-heading font-semibold text-dark">Delete User</h3>
              <button onClick={() => setDeleteTarget(null)} className="ml-auto text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <p className="text-sm text-gray-600 mb-6">
              Are you sure you want to delete <strong>{deleteTarget.full_name || deleteTarget.email}</strong>? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setDeleteTarget(null)} className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
              <button
                onClick={() => deleteMutation.mutate(deleteTarget.name)}
                disabled={deleteMutation.isPending}
                className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
