import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getLMSSettings, updateLMSSettings, changeAdminPassword } from '@/api/client';
import type { LMSSettings } from '@/types';
import { Settings as SettingsIcon, Globe, CreditCard, Link2, User, Save, Loader2 } from 'lucide-react';

interface SectionProps {
  title: string;
  icon: typeof Globe;
  children: React.ReactNode;
  onSave: () => void;
  saving: boolean;
}

function Section({ title, icon: Icon, children, onSave, saving }: SectionProps) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="flex items-center gap-3 border-b border-gray-100 px-6 py-4">
        <Icon className="h-5 w-5 text-dark" />
        <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
      </div>
      <div className="space-y-4 px-6 py-5">{children}</div>
      <div className="flex justify-end border-t border-gray-100 px-6 py-3">
        <button
          onClick={onSave}
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-lg bg-dark px-4 py-2 text-sm font-medium text-white hover:bg-dark/90 disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {saving ? 'Saving...' : 'Save'}
        </button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-gray-700">{label}</label>
      {children}
    </div>
  );
}

const inputCls =
  'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-500';

export default function Settings() {
  const queryClient = useQueryClient();

  const { data: settings, isLoading } = useQuery<LMSSettings>({
    queryKey: ['lms-settings'],
    queryFn: getLMSSettings,
  });

  const [general, setGeneral] = useState({ site_name: '', description: '', logo: '' });
  const [courseDefaults, setCourseDefaults] = useState({ default_currency: 'ETB', access_duration_days: 30, bundle_price: 0 });
  const [payment, setPayment] = useState({ methods: [] as string[], cbe_account: '' });
  const [integrations, setIntegrations] = useState({ vimeo: false, telebirr: false, chapa: false });
  const [account, setAccount] = useState({ admin_email: '', new_password: '', confirm_password: '' });

  useEffect(() => {
    if (!settings) return;
    setGeneral({
      site_name: settings.site_name || '',
      description: settings.description || '',
      logo: settings.logo || '',
    });
    setCourseDefaults({
      default_currency: settings.default_currency || 'ETB',
      access_duration_days: settings.access_duration_days || 30,
      bundle_price: 0,
    });
    setPayment({
      methods: settings.payment_methods ?? [],
      cbe_account: '',
    });
  }, [settings]);

  const saveMut = useMutation({
    mutationFn: (data: Record<string, unknown>) => updateLMSSettings(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['lms-settings'] }),
  });

  const [savingSection, setSavingSection] = useState('');
  const [accountMessage, setAccountMessage] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);

  const saveSection = (section: string, data: Record<string, unknown>) => {
    setSavingSection(section);
    saveMut.mutate(data, { onSettled: () => setSavingSection('') });
  };

  const saveAccount = async () => {
    setSavingSection('account');
    setAccountMessage(null);
    try {
      // Save email via the settings mutation
      await new Promise<void>((resolve, reject) => {
        saveMut.mutate(
          { admin_email: account.admin_email },
          { onSuccess: () => resolve(), onError: (e) => reject(e) },
        );
      });

      // If a password was provided, change it via the dedicated endpoint
      if (account.new_password || account.confirm_password) {
        await changeAdminPassword(account.new_password, account.confirm_password);
        setAccount((a) => ({ ...a, new_password: '', confirm_password: '' }));
        setAccountMessage({ kind: 'success', text: 'Email and password updated.' });
      } else {
        setAccountMessage({ kind: 'success', text: 'Email updated.' });
      }
    } catch (err) {
      const apiMsg =
        (err as { response?: { data?: { message?: string } } }).response?.data?.message ||
        'Could not save account changes.';
      setAccountMessage({ kind: 'error', text: apiMsg });
    } finally {
      setSavingSection('');
    }
  };

  if (isLoading) {
    return <div className="py-20 text-center text-gray-500">Loading settings...</div>;
  }

  const PAYMENT_OPTIONS = ['telebirr', 'Chapa', 'CBE Bank Transfer', 'EthSwitch'];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="mt-1 text-sm text-gray-500">Configure platform settings. Changes are saved per section.</p>
      </div>

      {/* General */}
      <Section
        title="General"
        icon={SettingsIcon}
        onSave={() => saveSection('general', { site_name: general.site_name, description: general.description, logo: general.logo || null })}
        saving={savingSection === 'general'}
      >
        <Field label="Site Name">
          <input className={inputCls} value={general.site_name} onChange={(e) => setGeneral({ ...general, site_name: e.target.value })} />
        </Field>
        <Field label="Description">
          <textarea className={inputCls} rows={3} value={general.description} onChange={(e) => setGeneral({ ...general, description: e.target.value })} />
        </Field>
        <Field label="Logo URL">
          <input className={inputCls} value={general.logo} onChange={(e) => setGeneral({ ...general, logo: e.target.value })} placeholder="https://..." />
        </Field>
      </Section>

      {/* Course Defaults */}
      <Section
        title="Course Defaults"
        icon={Globe}
        onSave={() => saveSection('courseDefaults', { default_currency: courseDefaults.default_currency, access_duration_days: courseDefaults.access_duration_days })}
        saving={savingSection === 'courseDefaults'}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Default Currency">
            <input className={inputCls} value={courseDefaults.default_currency} onChange={(e) => setCourseDefaults({ ...courseDefaults, default_currency: e.target.value })} />
          </Field>
          <Field label="Access Duration (days)">
            <input className={inputCls} type="number" min={1} value={courseDefaults.access_duration_days} onChange={(e) => setCourseDefaults({ ...courseDefaults, access_duration_days: Number(e.target.value) })} />
          </Field>
        </div>
      </Section>

      {/* Payment */}
      <Section
        title="Payment"
        icon={CreditCard}
        onSave={() => saveSection('payment', { payment_methods: payment.methods })}
        saving={savingSection === 'payment'}
      >
        <Field label="Active Payment Methods">
          <div className="space-y-2">
            {PAYMENT_OPTIONS.map((method) => (
              <label key={method} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={payment.methods.includes(method)}
                  onChange={(e) => {
                    setPayment({
                      ...payment,
                      methods: e.target.checked
                        ? [...payment.methods, method]
                        : payment.methods.filter((m) => m !== method),
                    });
                  }}
                  className="h-4 w-4 rounded border-gray-300 text-dark focus:ring-dark"
                />
                {method}
              </label>
            ))}
          </div>
        </Field>
        <Field label="CBE Account Number">
          <input className={inputCls} value={payment.cbe_account} onChange={(e) => setPayment({ ...payment, cbe_account: e.target.value })} placeholder="1000XXXXXXXXXX" />
        </Field>
      </Section>

      {/* Integrations */}
      <Section
        title="Integrations"
        icon={Link2}
        onSave={() => saveSection('integrations', integrations)}
        saving={savingSection === 'integrations'}
      >
        <div className="space-y-3">
          {([['vimeo', 'Vimeo Video Hosting'], ['telebirr', 'telebirr Payment'], ['chapa', 'Chapa Payment']] as const).map(([key, label]) => (
            <div key={key} className="flex items-center justify-between rounded-lg border border-gray-100 px-4 py-3">
              <span className="text-sm font-medium text-gray-700">{label}</span>
              <button
                type="button"
                onClick={() => setIntegrations({ ...integrations, [key]: !integrations[key] })}
                className={`relative h-6 w-11 rounded-full transition-colors ${integrations[key] ? 'bg-dark' : 'bg-gray-300'}`}
              >
                <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${integrations[key] ? 'left-[22px]' : 'left-0.5'}`} />
              </button>
            </div>
          ))}
        </div>
      </Section>

      {/* Account */}
      <Section
        title="Account"
        icon={User}
        onSave={saveAccount}
        saving={savingSection === 'account'}
      >
        {accountMessage && (
          <div
            className={`rounded-lg border px-3 py-2 text-sm ${
              accountMessage.kind === 'success'
                ? 'border-green-200 bg-green-50 text-green-700'
                : 'border-red-200 bg-red-50 text-red-700'
            }`}
          >
            {accountMessage.text}
          </div>
        )}
        <Field label="Admin Email">
          <input className={inputCls} type="email" value={account.admin_email} onChange={(e) => setAccount({ ...account, admin_email: e.target.value })} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="New Password">
            <input className={inputCls} type="password" value={account.new_password} onChange={(e) => setAccount({ ...account, new_password: e.target.value })} placeholder="At least 10 characters" />
          </Field>
          <Field label="Confirm Password">
            <input className={inputCls} type="password" value={account.confirm_password} onChange={(e) => setAccount({ ...account, confirm_password: e.target.value })} />
          </Field>
        </div>
      </Section>
    </div>
  );
}
