import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getEmails, getEmail, updateEmail, deleteEmail } from '@/api/emailClient';
import type { Email } from '@/api/emailClient';
import {
  Mail, Search, Inbox, Send, Archive, Trash2, Eye, MailOpen,
  ArrowUpRight, ArrowDownLeft, PenSquare,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

type Tab = 'all' | 'inbox' | 'sent' | 'archived';

export default function EmailInbox() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('all');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const directionParam = tab === 'inbox' ? 'inbound' : tab === 'sent' ? 'outbound' : undefined;

  const { data: emails = [], isLoading } = useQuery({
    queryKey: ['emails', tab],
    queryFn: () => getEmails({ direction: directionParam, limit: 50 }),
  });

  const { data: selectedEmail, isLoading: detailLoading } = useQuery({
    queryKey: ['email', selectedId],
    queryFn: () => getEmail(selectedId!),
    enabled: !!selectedId,
  });

  const markReadMut = useMutation({
    mutationFn: (id: string) => updateEmail(id, { read: true }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['emails'] }),
  });

  const archiveMut = useMutation({
    mutationFn: (id: string) => updateEmail(id, { archived: true }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['emails'] });
      setSelectedId(null);
    },
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteEmail(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['emails'] });
      setSelectedId(null);
    },
  });

  const handleSelect = (email: Email) => {
    setSelectedId(email.id);
    if (!email.read) markReadMut.mutate(email.id);
  };

  const filteredEmails = emails.filter((e: Email) => {
    if (tab === 'archived') return e.archived;
    if (tab !== 'all' && e.archived) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      e.subject.toLowerCase().includes(q) ||
      e.from.toLowerCase().includes(q) ||
      e.to.toLowerCase().includes(q)
    );
  });

  const tabs: { key: Tab; label: string; icon: typeof Inbox }[] = [
    { key: 'all', label: 'All', icon: Mail },
    { key: 'inbox', label: 'Inbox', icon: Inbox },
    { key: 'sent', label: 'Sent', icon: Send },
    { key: 'archived', label: 'Archived', icon: Archive },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Email</h1>
        <button
          onClick={() => navigate('/email/compose')}
          className="inline-flex items-center gap-2 rounded-lg bg-dark px-4 py-2 text-sm font-medium text-white hover:bg-dark/90"
        >
          <PenSquare className="h-4 w-4" /> Compose
        </button>
      </div>

      {/* Tabs + Search */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex rounded-lg border border-gray-200 bg-white p-0.5">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => { setTab(t.key); setSelectedId(null); }}
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition ${tab === t.key ? 'bg-dark text-white' : 'text-gray-600 hover:text-gray-900'}`}
            >
              <t.icon className="h-3.5 w-3.5" />
              {t.label}
            </button>
          ))}
        </div>
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search emails..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-gray-300 py-2 pl-10 pr-4 text-sm focus:border-gray-500 focus:outline-none"
          />
        </div>
      </div>

      {/* Two-column layout */}
      <div className="grid min-h-[500px] grid-cols-1 gap-4 lg:grid-cols-5">
        {/* Email List */}
        <div className="col-span-1 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm lg:col-span-2">
          {isLoading ? (
            <div className="p-6 text-center text-gray-500">Loading...</div>
          ) : filteredEmails.length === 0 ? (
            <div className="p-6 text-center text-gray-500">No emails found.</div>
          ) : (
            <div className="divide-y divide-gray-100 overflow-y-auto" style={{ maxHeight: 560 }}>
              {filteredEmails.map((email: Email) => (
                <button
                  key={email.id}
                  onClick={() => handleSelect(email)}
                  className={`w-full px-4 py-3 text-left transition hover:bg-gray-50 ${selectedId === email.id ? 'bg-gray-50' : ''} ${!email.read ? 'bg-blue-50/40' : ''}`}
                >
                  <div className="flex items-center gap-2">
                    {email.direction === 'inbound' ? (
                      <ArrowDownLeft className="h-3.5 w-3.5 shrink-0 text-blue-500" />
                    ) : (
                      <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-green-500" />
                    )}
                    <span className={`truncate text-sm ${!email.read ? 'font-semibold text-gray-900' : 'text-gray-700'}`}>
                      {email.direction === 'inbound' ? email.from : email.to}
                    </span>
                    {!email.read && <span className="ml-auto h-2 w-2 shrink-0 rounded-full bg-blue-500" />}
                  </div>
                  <p className={`mt-0.5 truncate text-sm ${!email.read ? 'font-medium text-gray-900' : 'text-gray-600'}`}>{email.subject}</p>
                  <p className="mt-0.5 text-xs text-gray-400">{new Date(email.created_at).toLocaleString()}</p>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Preview */}
        <div className="col-span-1 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm lg:col-span-3">
          {!selectedId ? (
            <div className="flex h-full items-center justify-center p-8 text-gray-400">
              <div className="text-center">
                <Eye className="mx-auto h-8 w-8" />
                <p className="mt-2 text-sm">Select an email to preview</p>
              </div>
            </div>
          ) : detailLoading ? (
            <div className="p-6 text-center text-gray-500">Loading...</div>
          ) : selectedEmail ? (
            <div className="flex h-full flex-col">
              <div className="border-b border-gray-100 px-6 py-4">
                <h2 className="text-lg font-semibold text-gray-900">{selectedEmail.subject}</h2>
                <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-500">
                  <span>From: {selectedEmail.from}</span>
                  <span>To: {selectedEmail.to}</span>
                  <span>{new Date(selectedEmail.created_at).toLocaleString()}</span>
                </div>
                <div className="mt-3 flex gap-2">
                  {!selectedEmail.read && (
                    <button onClick={() => markReadMut.mutate(selectedEmail.id)} className="inline-flex items-center gap-1 rounded border border-gray-200 px-2.5 py-1 text-xs text-gray-600 hover:bg-gray-50">
                      <MailOpen className="h-3.5 w-3.5" /> Mark read
                    </button>
                  )}
                  <button onClick={() => archiveMut.mutate(selectedEmail.id)} className="inline-flex items-center gap-1 rounded border border-gray-200 px-2.5 py-1 text-xs text-gray-600 hover:bg-gray-50">
                    <Archive className="h-3.5 w-3.5" /> Archive
                  </button>
                  <button onClick={() => deleteMut.mutate(selectedEmail.id)} className="inline-flex items-center gap-1 rounded border border-red-200 px-2.5 py-1 text-xs text-red-600 hover:bg-red-50">
                    <Trash2 className="h-3.5 w-3.5" /> Delete
                  </button>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto px-6 py-4">
                <div className="prose prose-sm max-w-none text-gray-700" dangerouslySetInnerHTML={{ __html: selectedEmail.body }} />
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
