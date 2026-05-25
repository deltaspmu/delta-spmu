import { useState, useRef, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/context/AuthContext';
import {
  getUserBio,
  updateUserProfile,
  updateNotificationPreferences,
  deleteUserAccount,
  uploadAvatar,
} from '@/api/client';
import { formatDate, cn } from '@/lib/utils';
import Avatar from '@/components/Avatar';
import {
  Camera,
  Save,
  Lock,
  Bell,
  Trash2,
  AlertTriangle,
  ChevronDown,
  Check,
  Loader2,
  User,
  Mail,
  Calendar,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Section Accordion
// ---------------------------------------------------------------------------

interface SectionProps {
  title: string;
  icon: React.ReactNode;
  defaultOpen?: boolean;
  danger?: boolean;
  children: React.ReactNode;
}

function Section({ title, icon, defaultOpen = false, danger = false, children }: SectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div
      className={cn(
        'bg-white rounded-xl shadow-sm overflow-hidden',
        danger && 'border-2 border-red-200'
      )}
    >
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          'w-full flex items-center justify-between p-5 text-left transition-colors',
          danger ? 'hover:bg-red-50' : 'hover:bg-gray-50'
        )}
      >
        <div className="flex items-center gap-3">
          <span className={cn(danger ? 'text-red-500' : 'text-primary')}>{icon}</span>
          <h3
            className={cn(
              'font-heading font-semibold text-base',
              danger ? 'text-red-700' : 'text-dark'
            )}
          >
            {title}
          </h3>
        </div>
        <ChevronDown
          className={cn(
            'w-5 h-5 text-gray-400 transition-transform duration-200',
            open && 'rotate-180'
          )}
        />
      </button>
      {open && <div className="px-5 pb-5 border-t border-gray-100 pt-5">{children}</div>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Toast helper (inline)
// ---------------------------------------------------------------------------

function useToast() {
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const show = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  const ToastUI = toast ? (
    <div
      className={cn(
        'fixed bottom-6 right-6 z-50 px-5 py-3 rounded-lg shadow-lg text-sm font-medium text-white transition-all',
        toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'
      )}
    >
      {toast.message}
    </div>
  ) : null;

  return { show, ToastUI };
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function Profile() {
  const { t } = useTranslation(['common', 'pages']);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, refreshUser, logout } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { show: showToast, ToastUI } = useToast();

  // ------- Profile form state -------
  const [firstName, setFirstName] = useState(user?.first_name ?? '');
  const [lastName, setLastName] = useState(user?.last_name ?? '');

  // Fetch bio
  const { data: bioData } = useQuery({
    queryKey: ['userBio', user?.email],
    queryFn: () => getUserBio(),
    enabled: !!user,
  });

  const [bio, setBio] = useState('');
  // Sync bio when fetched (effect, not setState during render)
  useEffect(() => {
    const bioStr =
      typeof bioData === 'string'
        ? bioData
        : (bioData as { bio?: string } | undefined)?.bio ?? '';
    if (bioStr) setBio(bioStr);
  }, [bioData]);

  // ------- Avatar upload -------
  const [avatarUploading, setAvatarUploading] = useState(false);

  const handleAvatarChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file || !user) return;
      setAvatarUploading(true);
      try {
        await uploadAvatar(file, user.email);
        await refreshUser();
        showToast(t('pages:profile.avatarUpdated', 'Avatar updated successfully'));
      } catch {
        showToast(t('pages:profile.avatarError', 'Failed to update avatar'), 'error');
      } finally {
        setAvatarUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    },
    [user, refreshUser, showToast, t]
  );

  // ------- Update profile mutation -------
  const updateProfileMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => updateUserProfile(data),
    onSuccess: async () => {
      await refreshUser();
      queryClient.invalidateQueries({ queryKey: ['userBio'] });
      showToast(t('pages:profile.profileUpdated', 'Profile updated successfully'));
    },
    onError: () => {
      showToast(t('pages:profile.profileError', 'Failed to update profile'), 'error');
    },
  });

  const handleSaveProfile = () => {
    updateProfileMutation.mutate({
      first_name: firstName,
      last_name: lastName,
      bio,
    });
  };

  // ------- Change password -------
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');

  const changePasswordMutation = useMutation({
    mutationFn: async () => {
      const { default: api } = await import('@/api/client');
      return api
        .post('/api/method/frappe.core.doctype.user.user.update_password', {
          old_password: currentPassword,
          new_password: newPassword,
        })
        .then((res) => res.data?.message);
    },
    onSuccess: () => {
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPasswordError('');
      showToast(t('pages:profile.passwordUpdated', 'Password changed successfully'));
    },
    onError: () => {
      showToast(t('pages:profile.passwordError', 'Failed to change password'), 'error');
    },
  });

  const handleChangePassword = () => {
    setPasswordError('');
    if (newPassword.length < 8) {
      setPasswordError(t('pages:profile.passwordMinLength', 'Password must be at least 8 characters'));
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError(t('pages:profile.passwordMismatch', 'Passwords do not match'));
      return;
    }
    changePasswordMutation.mutate();
  };

  // ------- Notification preferences -------
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [courseUpdates, setCourseUpdates] = useState(true);
  const [promotionalEmails, setPromotionalEmails] = useState(false);

  const notifMutation = useMutation({
    mutationFn: (prefs: Record<string, unknown>) => updateNotificationPreferences(prefs),
    onSuccess: () => {
      showToast(t('pages:profile.prefsUpdated', 'Preferences saved'));
    },
    onError: () => {
      showToast(t('pages:profile.prefsError', 'Failed to save preferences'), 'error');
    },
  });

  const handleToggleNotification = (key: string, value: boolean, setter: (v: boolean) => void) => {
    setter(value);
    notifMutation.mutate({
      email_notifications: key === 'email_notifications' ? value : emailNotifications,
      course_updates: key === 'course_updates' ? value : courseUpdates,
      promotional_emails: key === 'promotional_emails' ? value : promotionalEmails,
    });
  };

  // ------- Delete account -------
  const [deleteConfirm, setDeleteConfirm] = useState('');

  const deleteAccountMutation = useMutation({
    mutationFn: () => deleteUserAccount(),
    onSuccess: async () => {
      await logout();
      navigate('/login');
    },
    onError: () => {
      showToast(t('pages:profile.deleteError', 'Failed to delete account'), 'error');
    },
  });

  const handleDeleteAccount = () => {
    if (deleteConfirm !== 'DELETE') return;
    deleteAccountMutation.mutate();
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-alabaster">
      {ToastUI}

      {/* Header */}
      <div className="bg-dark text-white py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="font-heading text-3xl sm:text-4xl font-bold">
            {t('pages:profile.title', 'Profile')}
          </h1>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Left Sidebar */}
          <div className="lg:w-72 shrink-0">
            <div className="bg-white rounded-xl shadow-sm p-6 text-center sticky top-8">
              {/* Avatar */}
              <div className="relative mx-auto w-28 h-28 mb-4">
                <Avatar
                  src={user.user_image}
                  name={user.full_name}
                  size={128}
                  alt={user.full_name}
                  className="w-28 h-28 rounded-full object-cover border-4 border-gray-100"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={avatarUploading}
                  className="absolute bottom-0 right-0 w-9 h-9 rounded-full bg-dark text-white flex items-center justify-center hover:bg-primary transition-colors shadow-md"
                  aria-label="Change avatar"
                >
                  {avatarUploading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Camera className="w-4 h-4" />
                  )}
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarChange}
                  className="hidden"
                />
              </div>

              <h2 className="font-heading font-bold text-dark text-lg mb-1">
                {user.full_name}
              </h2>

              <div className="space-y-2 mt-4 text-left">
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <Mail className="w-4 h-4 text-gray-400" />
                  <span className="truncate">{user.email}</span>
                </div>
                {user.creation && (
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <Calendar className="w-4 h-4 text-gray-400" />
                    <span>
                      {t('pages:profile.memberSince', 'Member since')}{' '}
                      {formatDate(user.creation)}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Content */}
          <div className="flex-1 space-y-4">
            {/* Edit Profile */}
            <Section
              title={t('pages:profile.editProfile', 'Edit Profile')}
              icon={<User className="w-5 h-5" />}
              defaultOpen
            >
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {t('pages:profile.firstName', 'First Name')}
                    </label>
                    <input
                      type="text"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {t('pages:profile.lastName', 'Last Name')}
                    </label>
                    <input
                      type="text"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('pages:profile.bio', 'Bio')}
                  </label>
                  <textarea
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    rows={4}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors resize-none"
                    placeholder={t('pages:profile.bioPlaceholder', 'Tell us about yourself...')}
                  />
                </div>
                <div className="flex justify-end">
                  <button
                    onClick={handleSaveProfile}
                    disabled={updateProfileMutation.isPending}
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-dark text-white rounded-lg hover:bg-primary/90 transition-colors text-sm font-medium disabled:opacity-50"
                  >
                    {updateProfileMutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4" />
                    )}
                    {t('common:save', 'Save')}
                  </button>
                </div>
              </div>
            </Section>

            {/* Change Password */}
            <Section
              title={t('pages:profile.changePassword', 'Change Password')}
              icon={<Lock className="w-5 h-5" />}
            >
              <div className="space-y-4 max-w-md">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('pages:profile.currentPassword', 'Current Password')}
                  </label>
                  <input
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('pages:profile.newPassword', 'New Password')}
                  </label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('pages:profile.confirmPassword', 'Confirm New Password')}
                  </label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
                  />
                </div>
                {passwordError && (
                  <p className="text-sm text-red-500">{passwordError}</p>
                )}
                <div className="flex justify-end">
                  <button
                    onClick={handleChangePassword}
                    disabled={
                      changePasswordMutation.isPending ||
                      !currentPassword ||
                      !newPassword ||
                      !confirmPassword
                    }
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-dark text-white rounded-lg hover:bg-primary/90 transition-colors text-sm font-medium disabled:opacity-50"
                  >
                    {changePasswordMutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Lock className="w-4 h-4" />
                    )}
                    {t('pages:profile.updatePassword', 'Update Password')}
                  </button>
                </div>
              </div>
            </Section>

            {/* Notification Preferences */}
            <Section
              title={t('pages:profile.notifications', 'Notification Preferences')}
              icon={<Bell className="w-5 h-5" />}
            >
              <div className="space-y-4">
                {[
                  {
                    key: 'email_notifications',
                    label: t('pages:profile.emailNotifications', 'Email Notifications'),
                    desc: t('pages:profile.emailNotificationsDesc', 'Receive email notifications for important updates'),
                    value: emailNotifications,
                    setter: setEmailNotifications,
                  },
                  {
                    key: 'course_updates',
                    label: t('pages:profile.courseUpdates', 'Course Updates'),
                    desc: t('pages:profile.courseUpdatesDesc', 'Get notified when enrolled courses are updated'),
                    value: courseUpdates,
                    setter: setCourseUpdates,
                  },
                  {
                    key: 'promotional_emails',
                    label: t('pages:profile.promotionalEmails', 'Promotional Emails'),
                    desc: t('pages:profile.promotionalEmailsDesc', 'Receive offers and promotional content'),
                    value: promotionalEmails,
                    setter: setPromotionalEmails,
                  },
                ].map((pref) => (
                  <div
                    key={pref.key}
                    className="flex items-center justify-between py-2"
                  >
                    <div>
                      <p className="text-sm font-medium text-dark">{pref.label}</p>
                      <p className="text-xs text-gray-500">{pref.desc}</p>
                    </div>
                    <button
                      onClick={() =>
                        handleToggleNotification(pref.key, !pref.value, pref.setter)
                      }
                      className={cn(
                        'relative w-11 h-6 rounded-full transition-colors duration-200 shrink-0',
                        pref.value ? 'bg-primary' : 'bg-gray-300'
                      )}
                      role="switch"
                      aria-checked={pref.value}
                    >
                      <span
                        className={cn(
                          'absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-200 flex items-center justify-center',
                          pref.value && 'translate-x-5'
                        )}
                      >
                        {pref.value && <Check className="w-3 h-3 text-primary" />}
                      </span>
                    </button>
                  </div>
                ))}
              </div>
            </Section>

            {/* Delete Account */}
            <Section
              title={t('pages:profile.deleteAccount', 'Delete Account')}
              icon={<Trash2 className="w-5 h-5" />}
              danger
            >
              <div className="space-y-4">
                <div className="flex items-start gap-3 p-4 bg-red-50 rounded-lg">
                  <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-red-700">
                      {t('pages:profile.deleteWarningTitle', 'This action cannot be undone.')}
                    </p>
                    <p className="text-xs text-red-600 mt-1">
                      {t(
                        'pages:profile.deleteWarningDesc',
                        'Once you delete your account, all your data including course progress, certificates, and profile information will be permanently removed.'
                      )}
                    </p>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t(
                      'pages:profile.deleteConfirmLabel',
                      'Type "DELETE" to confirm'
                    )}
                  </label>
                  <input
                    type="text"
                    value={deleteConfirm}
                    onChange={(e) => setDeleteConfirm(e.target.value)}
                    placeholder="DELETE"
                    className="w-full max-w-xs px-4 py-2.5 border border-red-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-300 focus:border-red-400 transition-colors"
                  />
                </div>

                <div className="flex justify-end">
                  <button
                    onClick={handleDeleteAccount}
                    disabled={
                      deleteConfirm !== 'DELETE' || deleteAccountMutation.isPending
                    }
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium disabled:opacity-50"
                  >
                    {deleteAccountMutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                    {t('pages:profile.deleteButton', 'Delete My Account')}
                  </button>
                </div>
              </div>
            </Section>
          </div>
        </div>
      </div>
    </div>
  );
}
