import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { Lock, X } from 'lucide-react';

interface AccessExpiredModalProps {
  isOpen: boolean;
  onClose: () => void;
  courseId: string;
  courseTitle: string;
}

export default function AccessExpiredModal({ isOpen, onClose, courseId, courseTitle }: AccessExpiredModalProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative z-10 mx-4 w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-xl">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-full p-1 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
          <Lock className="h-8 w-8 text-red-500" />
        </div>

        <h2 className="mb-2 text-xl font-bold text-gray-900">
          {t('accessExpired.title', 'Access Expired')}
        </h2>
        <p className="mb-1 text-sm font-medium text-gray-500">{courseTitle}</p>
        <p className="mb-6 text-sm text-gray-600">
          {t('accessExpired.message', 'Your access to this course has expired. Renew to continue learning.')}
        </p>

        <button
          onClick={() => { onClose(); navigate(`/payment/${courseId}`); }}
          className="mb-3 w-full rounded-xl bg-dark px-6 py-3 text-sm font-semibold text-white transition hover:bg-dark/90"
        >
          {t('accessExpired.renew', 'Renew Access')}
        </button>

        <Link
          to="/courses"
          onClick={onClose}
          className="text-sm font-medium text-gray-500 underline-offset-2 hover:text-dark hover:underline"
        >
          {t('accessExpired.browse', 'Browse Courses')}
        </Link>
      </div>
    </div>
  );
}
