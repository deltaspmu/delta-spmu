import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getEnrollments, getCourses, manualEnroll, updateEnrollment } from '@/api/client';
import type { Enrollment } from '@/types';
import {
  AlertTriangle,
  CalendarDays,
  Search,
  Loader2,
  PauseCircle,
  PlayCircle,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import { addYears, format } from 'date-fns';

// Pull a human-readable message out of a Frappe error response so the modal can
// show the real reason (e.g. "No account found for ...") instead of a generic one.
function enrollmentErrorMsg(err: any): string {
  const data = err?.response?.data;
  try {
    if (data?._server_messages) {
      const arr = JSON.parse(data._server_messages);
      const first = typeof arr[0] === 'string' ? JSON.parse(arr[0]) : arr[0];
      if (first?.message) return String(first.message).replace(/<[^>]+>/g, '');
    }
  } catch {
    /* fall through */
  }
  if (data?.exception) {
    const msg = String(data.exception).split(':').slice(1).join(':').trim();
    if (msg) return msg;
  }
  return 'The enrollment could not be updated. Please try again.';
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    Active: 'bg-green-100 text-green-700',
    Completed: 'bg-blue-100 text-blue-700',
    Expired: 'bg-red-100 text-red-700',
    Suspended: 'bg-yellow-100 text-yellow-700',
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${styles[status] || 'bg-gray-100 text-gray-700'}`}>
      {status}
    </span>
  );
}

function ProgressBar({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
        <div className="h-full bg-primary-dark rounded-full transition-all" style={{ width: `${Math.min(value, 100)}%` }} />
      </div>
      <span className="text-xs text-gray-500 w-8 text-right">{value}%</span>
    </div>
  );
}

export default function Enrollments() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [courseFilter, setCourseFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [actionDialog, setActionDialog] = useState<{
    enrollment: Enrollment;
    action: 'suspend' | 'reactivate' | 'revoke';
  } | null>(null);
  const [expiryEnrollment, setExpiryEnrollment] = useState<Enrollment | null>(null);
  const [expiryDate, setExpiryDate] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Form state for manual enrollment
  const [newStudentEmail, setNewStudentEmail] = useState('');
  const [newCourse, setNewCourse] = useState('');

  // Custom endpoint joins LMS Enrollment with LMS Course + Course Access
  // and derives a status field. Real columns on LMS Enrollment in this
  // fork are member/member_name/course/progress (no student_name, no
  // status field), so the server does the enrichment.
  const { data, isLoading } = useQuery({
    queryKey: ['admin-enrollments', search, courseFilter],
    queryFn: () =>
      getEnrollments({
        limit: 200,
        offset: 0,
        search: search || undefined,
        course: courseFilter || undefined,
      }),
  });

  const { data: coursesData } = useQuery({
    queryKey: ['courses-list'],
    queryFn: () => getCourses({ fields: JSON.stringify(['name', 'title']), limit_page_length: 0 }),
  });

  const createMutation = useMutation({
    mutationFn: (data: { student: string; course: string }) =>
      manualEnroll(data.student, data.course),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-enrollments'] });
      setShowCreateModal(false);
      setNewStudentEmail('');
      setNewCourse('');
    },
  });

  const lifecycleMutation = useMutation({
    mutationFn: ({
      enrollment,
      action,
      accessEnd,
    }: {
      enrollment: string;
      action: 'suspend' | 'reactivate' | 'set_expiry' | 'revoke';
      accessEnd?: string;
    }) => updateEnrollment(enrollment, action, accessEnd),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['admin-enrollments'] });
      const messages = {
        suspend: 'Enrollment suspended.',
        reactivate: 'Enrollment reactivated.',
        set_expiry: 'Access expiry updated.',
        revoke: 'Enrollment revoked.',
      };
      setSuccessMessage(messages[variables.action]);
      setActionDialog(null);
      setExpiryEnrollment(null);
      setExpiryDate('');
    },
  });

  const enrollments: Enrollment[] = data?.data || [];
  const courses = Array.isArray(coursesData) ? coursesData : coursesData?.data || [];

  // Server already filters by search + course; status filter happens
  // client-side since it's a derived field.
  const filtered = enrollments.filter((e) => {
    const matchesStatus = !statusFilter || e.status === statusFilter;
    return matchesStatus;
  });

  const openExpiryDialog = (enrollment: Enrollment) => {
    lifecycleMutation.reset();
    setSuccessMessage('');
    setExpiryEnrollment(enrollment);
    const today = format(new Date(), 'yyyy-MM-dd');
    const currentExpiry = enrollment.access_end?.slice(0, 10);
    setExpiryDate(
      currentExpiry && currentExpiry >= today
        ? currentExpiry
        : format(addYears(new Date(), 1), 'yyyy-MM-dd'),
    );
  };

  const openActionDialog = (
    enrollment: Enrollment,
    action: 'suspend' | 'reactivate' | 'revoke',
  ) => {
    lifecycleMutation.reset();
    setSuccessMessage('');
    setActionDialog({ enrollment, action });
  };

  const confirmCopy = actionDialog
    ? {
        suspend: {
          title: 'Suspend enrollment?',
          body: 'The student will immediately lose course access. Their enrollment and learning progress will be kept.',
          button: 'Suspend',
        },
        reactivate: {
          title: 'Reactivate enrollment?',
          body: 'The student will regain access through the current expiry date.',
          button: 'Reactivate',
        },
        revoke: {
          title: 'Revoke enrollment?',
          body: 'This removes the student from the course roster and blocks access. Existing learning progress records are retained.',
          button: 'Revoke',
        },
      }[actionDialog.action]
    : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-bold text-dark">Enrollments</h1>
          <p className="text-sm text-gray-500 mt-1">{enrollments.length} total enrollments</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 bg-dark text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-dark-light transition-colors self-start"
        >
          <Plus className="w-4 h-4" /> Manual Enrollment
        </button>
      </div>

      {successMessage && (
        <div
          role="status"
          className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700"
        >
          {successMessage}
        </div>
      )}

      {/* Toolbar */}
      <div className="admin-card flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search students or courses..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm"
          />
        </div>
        <select
          value={courseFilter}
          onChange={(e) => setCourseFilter(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
        >
          <option value="">All Courses</option>
          {courses.map((c: any) => (
            <option key={c.name} value={c.name}>{c.title || c.name}</option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
        >
          <option value="">All Statuses</option>
          <option value="Active">Active</option>
          <option value="Completed">Completed</option>
          <option value="Expired">Expired</option>
          <option value="Suspended">Suspended</option>
        </select>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex items-center justify-center h-40">
          <Loader2 className="w-6 h-6 animate-spin text-primary-dark" />
        </div>
      ) : (
        <div className="admin-card p-0 overflow-x-auto">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Student</th>
                <th>Course</th>
                <th>Enrolled</th>
                <th>Progress</th>
                <th>Access Expiry</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center text-gray-400 py-8">No enrollments found</td>
                </tr>
              ) : (
                filtered.map((e) => (
                  <tr key={e.name}>
                    <td>
                      <div>
                        <p className="font-medium text-sm">{e.member_name || e.member}</p>
                        <p className="text-xs text-gray-400">{e.member}</p>
                      </div>
                    </td>
                    <td className="text-sm">{e.course_title || e.course}</td>
                    <td className="text-sm text-gray-500">
                      {e.enrollment_date ? format(new Date(e.enrollment_date), 'MMM d, yyyy') : e.creation ? format(new Date(e.creation), 'MMM d, yyyy') : '-'}
                    </td>
                    <td className="min-w-[120px]">
                      <ProgressBar value={e.progress || 0} />
                    </td>
                    <td className="text-sm text-gray-500">
                      {e.access_end ? format(new Date(e.access_end), 'MMM d, yyyy') : 'No expiry'}
                    </td>
                    <td><StatusBadge status={e.status || 'Active'} /></td>
                    <td>
                      <div className="flex min-w-[260px] flex-wrap items-center gap-2">
                        {e.status === 'Suspended' ? (
                          <button
                            type="button"
                            onClick={() => openActionDialog(e, 'reactivate')}
                            className="inline-flex items-center gap-1.5 rounded-md border border-green-200 px-2.5 py-1.5 text-xs font-medium text-green-700 hover:bg-green-50"
                          >
                            <PlayCircle className="h-3.5 w-3.5" /> Reactivate
                          </button>
                        ) : e.status !== 'Expired' ? (
                          <button
                            type="button"
                            onClick={() => openActionDialog(e, 'suspend')}
                            className="inline-flex items-center gap-1.5 rounded-md border border-yellow-200 px-2.5 py-1.5 text-xs font-medium text-yellow-700 hover:bg-yellow-50"
                          >
                            <PauseCircle className="h-3.5 w-3.5" /> Suspend
                          </button>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => openExpiryDialog(e)}
                          className="inline-flex items-center gap-1.5 rounded-md border border-gray-200 px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                        >
                          <CalendarDays className="h-3.5 w-3.5" />
                          {e.status === 'Expired' ? 'Renew' : 'Edit expiry'}
                        </button>
                        <button
                          type="button"
                          onClick={() => openActionDialog(e, 'revoke')}
                          className="inline-flex items-center gap-1.5 rounded-md border border-red-200 px-2.5 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="h-3.5 w-3.5" /> Revoke
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

      {/* Manual Enrollment Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-heading font-semibold text-dark">Manual Enrollment</h3>
              <button onClick={() => setShowCreateModal(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Student Email</label>
                <input
                  type="email"
                  value={newStudentEmail}
                  onChange={(e) => setNewStudentEmail(e.target.value)}
                  placeholder="student@example.com"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Course</label>
                <select
                  value={newCourse}
                  onChange={(e) => setNewCourse(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
                >
                  <option value="">Select course</option>
                  {courses.map((c: any) => (
                    <option key={c.name} value={c.name}>{c.title || c.name}</option>
                  ))}
                </select>
              </div>
              {createMutation.isError && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3">
                  {enrollmentErrorMsg(createMutation.error)}
                </div>
              )}
              <div className="flex justify-end gap-3 pt-2">
                <button onClick={() => setShowCreateModal(false)} className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
                <button
                  onClick={() => createMutation.mutate({ student: newStudentEmail, course: newCourse })}
                  disabled={!newStudentEmail || !newCourse || createMutation.isPending}
                  className="px-4 py-2 text-sm bg-dark text-white rounded-lg hover:bg-dark-light disabled:opacity-50"
                >
                  {createMutation.isPending ? 'Enrolling...' : 'Enroll'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Expiry / renewal modal */}
      {expiryEnrollment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-heading font-semibold text-dark">
                {expiryEnrollment.status === 'Expired' ? 'Renew enrollment access' : 'Edit access expiry'}
              </h3>
              <button
                type="button"
                onClick={() => setExpiryEnrollment(null)}
                className="text-gray-400 hover:text-gray-600"
                aria-label="Close expiry dialog"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="mb-4 text-sm text-gray-500">
              {expiryEnrollment.member_name || expiryEnrollment.member} · {expiryEnrollment.course_title || expiryEnrollment.course}
            </p>
            <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="access-expiry">
              Access expiry
            </label>
            <input
              id="access-expiry"
              type="date"
              min={format(new Date(), 'yyyy-MM-dd')}
              value={expiryDate}
              onChange={(event) => setExpiryDate(event.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
            {expiryEnrollment.status === 'Expired' && (
              <p className="mt-2 text-xs text-gray-500">Saving will reactivate this enrollment.</p>
            )}
            {lifecycleMutation.isError && (
              <div className="mt-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3">
                {enrollmentErrorMsg(lifecycleMutation.error)}
              </div>
            )}
            <div className="flex justify-end gap-3 pt-5">
              <button
                type="button"
                onClick={() => setExpiryEnrollment(null)}
                className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => lifecycleMutation.mutate({
                  enrollment: expiryEnrollment.name,
                  action: expiryEnrollment.status === 'Expired' ? 'reactivate' : 'set_expiry',
                  accessEnd: expiryDate,
                })}
                disabled={!expiryDate || lifecycleMutation.isPending}
                className="px-4 py-2 text-sm bg-dark text-white rounded-lg hover:bg-dark-light disabled:opacity-50"
              >
                {lifecycleMutation.isPending ? 'Saving...' : expiryEnrollment.status === 'Expired' ? 'Renew access' : 'Save expiry'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Suspend / reactivate / revoke confirmation */}
      {actionDialog && confirmCopy && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4 p-6">
            <div className="flex items-start gap-3">
              <div className={`rounded-full p-2 ${actionDialog.action === 'revoke' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-heading font-semibold text-dark">{confirmCopy.title}</h3>
                <p className="mt-1 text-sm text-gray-500">{confirmCopy.body}</p>
                <p className="mt-3 text-sm font-medium text-gray-700">
                  {actionDialog.enrollment.member_name || actionDialog.enrollment.member} · {actionDialog.enrollment.course_title || actionDialog.enrollment.course}
                </p>
              </div>
            </div>
            {lifecycleMutation.isError && (
              <div className="mt-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3">
                {enrollmentErrorMsg(lifecycleMutation.error)}
              </div>
            )}
            <div className="flex justify-end gap-3 pt-5">
              <button
                type="button"
                onClick={() => setActionDialog(null)}
                className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => lifecycleMutation.mutate({
                  enrollment: actionDialog.enrollment.name,
                  action: actionDialog.action,
                })}
                disabled={lifecycleMutation.isPending}
                className={`px-4 py-2 text-sm text-white rounded-lg disabled:opacity-50 ${actionDialog.action === 'revoke' ? 'bg-red-600 hover:bg-red-700' : 'bg-dark hover:bg-dark-light'}`}
              >
                {lifecycleMutation.isPending ? 'Updating...' : confirmCopy.button}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
