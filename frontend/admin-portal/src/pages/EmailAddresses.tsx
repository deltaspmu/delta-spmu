import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getEmailAddresses, addEmailAddress, deleteEmailAddress } from '@/api/emailClient';
import type { EmailAddress } from '@/api/emailClient';
import { Plus, Trash2, Mail, CheckCircle } from 'lucide-react';

export default function EmailAddresses() {
  const queryClient = useQueryClient();
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');

  const { data: addresses = [], isLoading } = useQuery({
    queryKey: ['email-addresses'],
    queryFn: getEmailAddresses,
  });

  const addMut = useMutation({
    mutationFn: () => addEmailAddress(email.trim(), displayName.trim() || undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-addresses'] });
      setEmail('');
      setDisplayName('');
    },
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteEmailAddress(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['email-addresses'] }),
  });

  const [deleteTarget, setDeleteTarget] = useState<EmailAddress | null>(null);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Email Addresses</h1>
        <p className="mt-1 text-sm text-gray-500">Manage verified sender addresses.</p>
      </div>

      {/* Add Form */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-gray-900">Add New Address</h2>
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1">
            <label className="mb-1 block text-xs text-gray-500">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="sender@deltaspmu.com"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
            />
          </div>
          <div className="flex-1">
            <label className="mb-1 block text-xs text-gray-500">Display Name</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Delta SPMU Academy"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
            />
          </div>
          <button
            onClick={() => addMut.mutate()}
            disabled={!email.trim() || addMut.isPending}
            className="inline-flex items-center gap-2 rounded-lg bg-dark px-4 py-2 text-sm font-medium text-white hover:bg-dark/90 disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            {addMut.isPending ? 'Adding...' : 'Add'}
          </button>
        </div>
        {addMut.isError && <p className="mt-2 text-sm text-red-500">Failed to add address.</p>}
      </div>

      {/* List */}
      {isLoading ? (
        <div className="py-8 text-center text-gray-500">Loading...</div>
      ) : addresses.length === 0 ? (
        <div className="py-8 text-center text-gray-500">
          <Mail className="mx-auto h-8 w-8 text-gray-300" />
          <p className="mt-2 text-sm">No email addresses configured.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Email</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Status</th>
                <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {addresses.map((addr: EmailAddress) => (
                <tr key={addr.id} className="hover:bg-gray-50">
                  <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900">{addr.email}</td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-600">{addr.name || '-'}</td>
                  <td className="whitespace-nowrap px-6 py-4">
                    {addr.verified ? (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-green-600">
                        <CheckCircle className="h-3.5 w-3.5" /> Verified
                      </span>
                    ) : (
                      <span className="text-xs font-medium text-yellow-600">Pending</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-right">
                    <button
                      onClick={() => setDeleteTarget(addr)}
                      className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-500"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Delete Confirmation */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setDeleteTarget(null)}>
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-gray-900">Remove Address</h2>
            <p className="mt-2 text-sm text-gray-600">
              Remove <span className="font-medium">{deleteTarget.email}</span>?
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setDeleteTarget(null)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">Cancel</button>
              <button
                onClick={() => { deleteMut.mutate(deleteTarget.id); setDeleteTarget(null); }}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
