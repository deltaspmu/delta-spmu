import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getReviews, deleteReview, getCourses } from '@/api/client';
import type { Review } from '@/types';
import { Star, Trash2, Filter } from 'lucide-react';

function Stars({ count }: { count: number }) {
  return (
    <div className="inline-flex gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} className={`h-4 w-4 ${i <= count ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`} />
      ))}
    </div>
  );
}

export default function Reviews() {
  const queryClient = useQueryClient();
  const [courseFilter, setCourseFilter] = useState('');
  const [ratingFilter, setRatingFilter] = useState<number | ''>('');
  const [deleteTarget, setDeleteTarget] = useState<Review | null>(null);

  const { data: coursesData } = useQuery({
    queryKey: ['courses-list'],
    queryFn: () => getCourses({ fields: JSON.stringify(['name', 'title']), limit_page_length: 100 }),
  });

  const buildFilters = () => {
    const filters: [string, string, unknown][] = [];
    if (courseFilter) filters.push(['course', '=', courseFilter]);
    if (ratingFilter !== '') filters.push(['rating', '=', ratingFilter]);
    return filters.length > 0 ? JSON.stringify(filters) : undefined;
  };

  const { data, isLoading, error } = useQuery({
    queryKey: ['reviews', courseFilter, ratingFilter],
    queryFn: () =>
      getReviews({
        filters: buildFilters(),
        limit_page_length: 50,
        order_by: 'creation desc',
      }),
  });

  const reviews: Review[] = data ?? [];
  const courses = coursesData ?? [];

  const deleteMut = useMutation({
    mutationFn: (name: string) => deleteReview(name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reviews'] });
      setDeleteTarget(null);
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Reviews</h1>
        <p className="mt-1 text-sm text-gray-500">Moderate course reviews. You can remove inappropriate content.</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <Filter className="h-4 w-4 text-gray-400" />
        <select
          value={courseFilter}
          onChange={(e) => setCourseFilter(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
        >
          <option value="">All courses</option>
          {courses.map((c: { name: string; title: string }) => (
            <option key={c.name} value={c.name}>{c.title}</option>
          ))}
        </select>
        <select
          value={ratingFilter}
          onChange={(e) => setRatingFilter(e.target.value ? Number(e.target.value) : '')}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
        >
          <option value="">All ratings</option>
          {[5, 4, 3, 2, 1].map((r) => (
            <option key={r} value={r}>{r} star{r > 1 ? 's' : ''}</option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <div className="py-12 text-center text-gray-500">Loading reviews...</div>
      ) : error ? (
        <div className="py-12 text-center text-red-500">Failed to load reviews.</div>
      ) : reviews.length === 0 ? (
        <div className="py-12 text-center text-gray-500">No reviews found.</div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Course</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Reviewer</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Rating</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Review</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Date</th>
                <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {reviews.map((rev) => (
                <tr key={rev.name} className="hover:bg-gray-50">
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-700">{rev.course_title}</td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900">{rev.owner_name}</td>
                  <td className="whitespace-nowrap px-6 py-4"><Stars count={rev.rating} /></td>
                  <td className="max-w-xs truncate px-6 py-4 text-sm text-gray-600">{rev.review}</td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">{new Date(rev.creation).toLocaleDateString()}</td>
                  <td className="whitespace-nowrap px-6 py-4 text-right">
                    <button
                      onClick={() => setDeleteTarget(rev)}
                      className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-500"
                      title="Delete review"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setDeleteTarget(null)}>
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-gray-900">Delete Review</h2>
            <p className="mt-2 text-sm text-gray-600">
              Remove this review by <span className="font-medium">{deleteTarget.owner_name}</span>? This cannot be undone.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setDeleteTarget(null)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">Cancel</button>
              <button
                onClick={() => deleteMut.mutate(deleteTarget.name)}
                disabled={deleteMut.isPending}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {deleteMut.isPending ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
