import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getEnrollments, getCourses, createEnrollment } from '@/api/client';
import type { Enrollment } from '@/types';
import {
  Search,
  Loader2,
  Plus,
  X,
  Filter,
} from 'lucide-react';
import { format } from 'date-fns';

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    Active: 'bg-green-100 text-green-700',
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

  // Form state for manual enrollment
  const [newStudentEmail, setNewStudentEmail] = useState('');
  const [newCourse, setNewCourse] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['admin-enrollments'],
    queryFn: () =>
      getEnrollments({
        fields: JSON.stringify([
          'name', 'student', 'student_name', 'student_email', 'course', 'course_title',
          'enrollment_date', 'progress', 'access_start', 'access_end', 'status', 'creation',
        ]),
        limit_page_length: 0,
        order_by: 'creation desc',
      }),
  });

  const { data: coursesData } = useQuery({
    queryKey: ['courses-list'],
    queryFn: () => getCourses({ fields: JSON.stringify(['name', 'title']), limit_page_length: 0 }),
  });

  const createMutation = useMutation({
    mutationFn: (data: Record<string, any>) => createEnrollment(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-enrollments'] });
      setShowCreateModal(false);
      setNewStudentEmail('');
      setNewCourse('');
    },
  });

  const enrollments: Enrollment[] = Array.isArray(data) ? data : data?.data || [];
  const courses = Array.isArray(coursesData) ? coursesData : coursesData?.data || [];

  const filtered = enrollments.filter((e) => {
    const matchesSearch =
      !search ||
      (e.student_name || '').toLowerCase().includes(search.toLowerCase()) ||
      (e.student_email || '').toLowerCase().includes(search.toLowerCase()) ||
      (e.course_title || '').toLowerCase().includes(search.toLowerCase());
    const matchesCourse = !courseFilter || e.course === courseFilter;
    const matchesStatus = !statusFilter || e.status === statusFilter;
    return matchesSearch && matchesCourse && matchesStatus;
  });

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
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center text-gray-400 py-8">No enrollments found</td>
                </tr>
              ) : (
                filtered.map((e) => (
                  <tr key={e.name}>
                    <td>
                      <div>
                        <p className="font-medium text-sm">{e.student_name || e.student}</p>
                        <p className="text-xs text-gray-400">{e.student_email}</p>
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
                  Failed to create enrollment. Please check the student email and try again.
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
    </div>
  );
}
