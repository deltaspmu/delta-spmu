import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Clock, X } from 'lucide-react';

interface AccessExpiringBannerProps {
  daysRemaining: number;
  courseId: string;
}

export default function AccessExpiringBanner({ daysRemaining, courseId }: AccessExpiringBannerProps) {
  const { t } = useTranslation();
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  return (
    <div className="flex items-center justify-between gap-3 rounded-xl bg-yellow-50 border border-yellow-200 px-4 py-3 text-sm text-yellow-800">
      <div className="flex items-center gap-2">
        <Clock className="h-4 w-4 shrink-0 text-yellow-600" />
        <span>
          {t('accessExpiring.message', 'Your access expires in {{days}} days', { days: daysRemaining })}
        </span>
        <Link
          to={`/payment/${courseId}`}
          className="ml-1 font-semibold text-yellow-900 underline underline-offset-2 hover:text-yellow-700"
        >
          {t('accessExpiring.renew', 'Renew')}
        </Link>
      </div>
      <button
        onClick={() => setDismissed(true)}
        className="shrink-0 rounded p-0.5 text-yellow-600 transition hover:bg-yellow-200 hover:text-yellow-800"
        aria-label="Dismiss"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
