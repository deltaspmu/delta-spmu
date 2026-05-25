import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { getCourses, deleteCourse, cloneCourse } from '@/api/client';
import type { Course } from '@/types';
import {
  Plus,
  Search,
  LayoutGrid,
  List,
  Edit,
  Copy,
  Trash2,
  Loader2,
  X,
  AlertTriangle,
} from 'lucide-react';

type ViewMode = 'grid' | 'list';
type FilterStatus = 'all' | 'published' | 'draft';

function StatusBadge({ published }: { published: number }) {
  return published ? (
    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">Published</span>
  ) : (
    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">Draft</span>
  );
}

export default function CourseList() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterStatus>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [deleteTarget, setDeleteTarget] = useState<Course | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-courses'],
    queryFn: () =>
      getCourses({
        fields: JSON.stringify([
          'name', 'title', 'image', 'instructor_name', 'published',
          'enrollment_count', 'course_price', 'currency', 'creation',
        ]),
        limit_page_length: 0,
        order_by: 'creation desc',
      }),
  });

  const deleteMutation = useMutation({
    mutationFn: (name: string) => deleteCourse(name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-courses'] });
      setDeleteTarget(null);
    },
  });

  const cloneMutation = useMutation({
    mutationFn: (name: string) => cloneCourse(name),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-courses'] }),
  });

  const courses: Course[] = Array.isArray(data) ? data : data?.data || [];

  const filtered = courses.filter((c) => {
    const matchesSearch =
      !search ||
      c.title.toLowerCase().includes(search.toLowerCase()) ||
      (c.instructor_name || '').toLowerCase().includes(search.toLowerCase());
    const matchesFilter =
      filter === 'all' ||
      (filter === 'published' && c.published === 1) ||
      (filter === 'draft' && c.published === 0);
    return matchesSearch && matchesFilter;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-bold text-dark">Courses</h1>
          <p className="text-sm text-gray-500 mt-1">{courses.length} total courses</p>
        </div>
        <button
          onClick={() => navigate('/courses/new')}
          className="flex items-center gap-2 bg-dark text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-dark-light transition-colors self-start"
        >
          <Plus className="w-4 h-4" /> Create Course
        </button>
      </div>

      {/* Toolbar */}
      <div className="admin-card flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search courses..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm"
          />
        </div>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value as FilterStatus)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
        >
          <option value="all">All Statuses</option>
          <option value="published">Published</option>
          <option value="draft">Draft</option>
        </select>
        <div className="flex border border-gray-300 rounded-lg overflow-hidden">
          <button
            onClick={() => setViewMode('grid')}
            className={`p-2 ${viewMode === 'grid' ? 'bg-dark text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`p-2 ${viewMode === 'list' ? 'bg-dark text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}
          >
            <List className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center h-40">
          <Loader2 className="w-6 h-6 animate-spin text-primary-dark" />
        </div>
      )}

      {/* Grid View */}
      {!isLoading && viewMode === 'grid' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((course) => (
            <div key={course.name} className="admin-card p-0 overflow-hidden">
              <div className="h-40 bg-gray-100">
                {course.image ? (
                  <img src={course.image} alt={course.title} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-300 text-sm">No Image</div>
                )}
              </div>
              <div className="p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-heading font-semibold text-dark text-sm leading-tight line-clamp-2">{course.title}</h3>
                  <StatusBadge published={course.published} />
                </div>
                <p className="text-xs text-gray-500">{course.instructor_name || 'No instructor'}</p>
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span>{course.enrollment_count || 0} enrolled</span>
                  <span className="font-medium text-dark">{course.course_price} {course.currency || 'ETB'}</span>
                </div>
                <div className="flex gap-2 pt-2 border-t border-gray-100">
                  <button onClick={() => navigate(`/courses/${course.name}`)} className="flex items-center gap-1 text-xs text-gray-600 hover:text-dark">
                    <Edit className="w-3.5 h-3.5" /> Edit
                  </button>
                  <button onClick={() => cloneMutation.mutate(course.name)} className="flex items-center gap-1 text-xs text-gray-600 hover:text-dark">
                    <Copy className="w-3.5 h-3.5" /> Clone
                  </button>
                  <button onClick={() => setDeleteTarget(course)} className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700 ml-auto">
                    <Trash2 className="w-3.5 h-3.5" /> Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* List View */}
      {!isLoading && viewMode === 'list' && (
        <div className="admin-card p-0 overflow-x-auto">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Course</th>
                <th>Instructor</th>
                <th>Status</th>
                <th>Enrolled</th>
                <th>Price</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((course) => (
                <tr key={course.name}>
                  <td>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded bg-gray-100 overflow-hidden shrink-0">
                        {course.image && <img src={course.image} alt="" className="w-full h-full object-cover" />}
                      </div>
                      <span className="font-medium text-sm">{course.title}</span>
                    </div>
                  </td>
                  <td className="text-sm">{course.instructor_name || '-'}</td>
                  <td><StatusBadge published={course.published} /></td>
                  <td className="text-sm">{course.enrollment_count || 0}</td>
                  <td className="text-sm font-medium">{course.course_price} {course.currency || 'ETB'}</td>
                  <td>
                    <div className="flex gap-2">
                      <button onClick={() => navigate(`/courses/${course.name}`)} className="p-1 text-gray-500 hover:text-dark"><Edit className="w-4 h-4" /></button>
                      <button onClick={() => cloneMutation.mutate(course.name)} className="p-1 text-gray-500 hover:text-dark"><Copy className="w-4 h-4" /></button>
                      <button onClick={() => setDeleteTarget(course)} className="p-1 text-red-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!isLoading && filtered.length === 0 && (
        <div className="text-center py-12 text-gray-400">No courses found.</div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full mx-4 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <h3 className="font-heading font-semibold text-dark">Delete Course</h3>
              <button onClick={() => setDeleteTarget(null)} className="ml-auto text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm text-gray-600 mb-6">
              Are you sure you want to delete <strong>{deleteTarget.title}</strong>? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setDeleteTarget(null)} className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
              <button
                onClick={() => deleteMutation.mutate(deleteTarget.name)}
                disabled={deleteMutation.isPending}
                className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
