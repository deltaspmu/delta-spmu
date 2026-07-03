import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getTelegramStats, sendTelegramBroadcast } from '@/api/client';
import { Send, Loader2, Users, AlertTriangle, CheckCircle2 } from 'lucide-react';

const inputCls =
  'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-500';

const MAX_LEN = 4096;

export default function TelegramBroadcast() {
  const queryClient = useQueryClient();
  const [message, setMessage] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [lastResult, setLastResult] = useState<{ recipients: number } | null>(null);

  const { data: stats, isLoading } = useQuery({
    queryKey: ['telegram-stats'],
    queryFn: getTelegramStats,
  });

  const sendMut = useMutation({
    mutationFn: () => sendTelegramBroadcast(message.trim()),
    onSuccess: (res) => {
      setLastResult({ recipients: res.recipients });
      setMessage('');
      setConfirming(false);
      queryClient.invalidateQueries({ queryKey: ['telegram-stats'] });
    },
    onError: () => setConfirming(false),
  });

  const canSend =
    !!message.trim() && message.length <= MAX_LEN && !sendMut.isPending && !!stats?.linked_count;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!stats?.enabled) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">Telegram Broadcast</h1>
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 shrink-0 text-amber-500" />
            <div>
              <p className="text-sm font-medium text-gray-900">
                Telegram integration is not enabled yet.
              </p>
              <p className="mt-1 text-sm text-gray-500">
                Create the bot with @BotFather, then set the telegram_* keys in
                site_config and run the setup functions (see
                lms/lms/telegram_bot.py for the activation steps).
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Telegram Broadcast</h1>

      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="space-y-4">
          <div className="flex items-center gap-2 rounded-lg bg-gray-50 px-4 py-3 text-sm text-gray-700">
            <Users className="h-4 w-4 text-primary" />
            <span>
              <strong>{stats.linked_count}</strong> linked student
              {stats.linked_count === 1 ? '' : 's'} will receive this message.
            </span>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Announcement</label>
            <textarea
              className={inputCls}
              rows={8}
              maxLength={MAX_LEN}
              value={message}
              onChange={(e) => {
                setMessage(e.target.value);
                setConfirming(false);
                setLastResult(null);
              }}
              placeholder="e.g. The new Lip Blush certificate course is now open for enrollment!"
            />
            <p className="mt-1 text-right text-xs text-gray-400">
              {message.length}/{MAX_LEN}
            </p>
          </div>

          <div className="flex items-center gap-3 pt-1">
            {confirming ? (
              <>
                <button
                  onClick={() => sendMut.mutate()}
                  disabled={!canSend}
                  className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                >
                  {sendMut.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                  {sendMut.isPending
                    ? 'Sending...'
                    : `Yes, send to ${stats.linked_count} student${stats.linked_count === 1 ? '' : 's'}`}
                </button>
                <button
                  onClick={() => setConfirming(false)}
                  disabled={sendMut.isPending}
                  className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-gray-600 hover:bg-gray-50"
                >
                  Cancel
                </button>
              </>
            ) : (
              <button
                onClick={() => setConfirming(true)}
                disabled={!canSend}
                className="inline-flex items-center gap-2 rounded-lg bg-dark px-5 py-2.5 text-sm font-medium text-white hover:bg-dark/90 disabled:opacity-50"
              >
                <Send className="h-4 w-4" />
                Send broadcast
              </button>
            )}
          </div>

          {lastResult && (
            <div className="flex items-center gap-2 text-sm text-green-600">
              <CheckCircle2 className="h-4 w-4" />
              Queued for {lastResult.recipients} student
              {lastResult.recipients === 1 ? '' : 's'}. Delivery happens in the
              background over the next minute or two.
            </div>
          )}
          {sendMut.isError && (
            <p className="text-sm text-red-500">
              Failed to queue the broadcast. Please try again.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
