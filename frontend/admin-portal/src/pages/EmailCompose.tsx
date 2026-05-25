import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  getEmailAddresses, getEmail, sendEmail, getPresignedUrl,
} from '@/api/emailClient';
import type { EmailAddress } from '@/api/emailClient';
import { Send, Paperclip, Loader2, ArrowLeft, X } from 'lucide-react';

const inputCls =
  'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-500';

export default function EmailCompose() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const replyId = searchParams.get('reply');

  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [attachments, setAttachments] = useState<{ file: File; url?: string; uploading?: boolean }[]>([]);

  const { data: addresses = [] } = useQuery({
    queryKey: ['email-addresses'],
    queryFn: getEmailAddresses,
  });

  // Pre-fill reply
  const { data: replyEmail } = useQuery({
    queryKey: ['email', replyId],
    queryFn: () => getEmail(replyId!),
    enabled: !!replyId,
  });

  useEffect(() => {
    if (replyEmail) {
      setTo(replyEmail.from);
      setSubject(replyEmail.subject.startsWith('Re:') ? replyEmail.subject : `Re: ${replyEmail.subject}`);
      setBody(`\n\n--- Original Message ---\n${replyEmail.body}`);
    }
  }, [replyEmail]);

  useEffect(() => {
    if (addresses.length > 0 && !from) {
      setFrom(addresses[0].email);
    }
  }, [addresses, from]);

  const sendMut = useMutation({
    mutationFn: () =>
      sendEmail({
        from,
        to,
        subject,
        body,
        attachments: attachments
          .filter((a) => a.url)
          .map((a) => ({ filename: a.file.name, url: a.url!, content_type: a.file.type })),
      }),
    onSuccess: () => navigate('/email'),
  });

  const handleAttach = async (files: FileList | null) => {
    if (!files) return;
    for (const file of Array.from(files)) {
      const entry = { file, uploading: true, url: undefined as string | undefined };
      setAttachments((prev) => [...prev, entry]);
      try {
        const { upload_url, file_url } = await getPresignedUrl(file.name, file.type);
        await fetch(upload_url, { method: 'PUT', body: file, headers: { 'Content-Type': file.type } });
        setAttachments((prev) =>
          prev.map((a) => (a.file === file ? { ...a, url: file_url, uploading: false } : a)),
        );
      } catch {
        setAttachments((prev) => prev.filter((a) => a.file !== file));
      }
    }
  };

  const removeAttachment = (file: File) => {
    setAttachments((prev) => prev.filter((a) => a.file !== file));
  };

  const canSend = from && to && subject && !sendMut.isPending;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/email')} className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-2xl font-bold text-gray-900">{replyId ? 'Reply' : 'Compose Email'}</h1>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="space-y-4">
          {/* From */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">From</label>
            <select className={inputCls} value={from} onChange={(e) => setFrom(e.target.value)}>
              {addresses.map((addr: EmailAddress) => (
                <option key={addr.id} value={addr.email}>
                  {addr.name ? `${addr.name} <${addr.email}>` : addr.email}
                </option>
              ))}
            </select>
          </div>

          {/* To */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">To</label>
            <input className={inputCls} type="email" value={to} onChange={(e) => setTo(e.target.value)} placeholder="recipient@example.com" />
          </div>

          {/* Subject */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Subject</label>
            <input className={inputCls} value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Email subject" />
          </div>

          {/* Body */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Body</label>
            <textarea className={inputCls} rows={12} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Write your message..." />
          </div>

          {/* Attachments */}
          {attachments.length > 0 && (
            <div className="space-y-1">
              <p className="text-sm font-medium text-gray-700">Attachments</p>
              {attachments.map((a, i) => (
                <div key={i} className="flex items-center gap-2 rounded border border-gray-100 px-3 py-1.5 text-sm">
                  <Paperclip className="h-3.5 w-3.5 text-gray-400" />
                  <span className="flex-1 truncate text-gray-700">{a.file.name}</span>
                  {a.uploading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-gray-400" />
                  ) : (
                    <button onClick={() => removeAttachment(a.file)} className="text-gray-400 hover:text-red-500">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={() => sendMut.mutate()}
              disabled={!canSend}
              className="inline-flex items-center gap-2 rounded-lg bg-dark px-5 py-2.5 text-sm font-medium text-white hover:bg-dark/90 disabled:opacity-50"
            >
              {sendMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {sendMut.isPending ? 'Sending...' : 'Send'}
            </button>
            <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50">
              <Paperclip className="h-4 w-4" />
              Attach
              <input type="file" multiple className="hidden" onChange={(e) => handleAttach(e.target.files)} />
            </label>
          </div>

          {sendMut.isError && (
            <p className="text-sm text-red-500">Failed to send email. Please try again.</p>
          )}
        </div>
      </div>
    </div>
  );
}
