import { MailWarning } from 'lucide-react';

export default function EmailCrmUnavailable() {
  return (
    <div className="flex min-h-[420px] items-center justify-center">
      <div className="max-w-lg rounded-xl border border-amber-200 bg-amber-50 px-8 py-10 text-center shadow-sm">
        <MailWarning className="mx-auto h-10 w-10 text-amber-600" />
        <h1 className="mt-4 text-2xl font-bold text-gray-900">Email CRM unavailable</h1>
        <p className="mt-2 text-sm leading-6 text-gray-600">
          The email inbox and sender-address service is not configured for this environment.
          Transactional course emails are delivered separately and are not affected.
        </p>
      </div>
    </div>
  );
}
