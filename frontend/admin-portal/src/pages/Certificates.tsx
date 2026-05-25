import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getCertificates, getCertificateDetail } from '@/api/client';
import type { Certificate } from '@/types';
import { Search, Award, X, ExternalLink } from 'lucide-react';

export default function Certificates() {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Certificate | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ['certificates', search],
    queryFn: () =>
      getCertificates({
        filters: search
          ? JSON.stringify([
              ['student_name', 'like', `%${search}%`],
              ['certificate_id', 'like', `%${search}%`],
            ])
          : undefined,
        or_filters: search ? 1 : undefined,
        limit_page_length: 50,
        order_by: 'creation desc',
      }),
  });

  const certificates: Certificate[] = data ?? [];

  const openDetail = async (cert: Certificate) => {
    setDetailLoading(true);
    try {
      const detail = await getCertificateDetail(cert.name);
      setSelected(detail);
    } catch {
      setSelected(cert);
    } finally {
      setDetailLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Certificates</h1>
          <p className="mt-1 text-sm text-gray-500">
            View all issued certificates. Certificates are generated automatically upon course completion.
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Award className="h-4 w-4" />
          <span>{certificates.length} issued</span>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="Search by student name or certificate ID..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-lg border border-gray-300 py-2 pl-10 pr-4 text-sm focus:border-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-500"
        />
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="py-12 text-center text-gray-500">Loading certificates...</div>
      ) : error ? (
        <div className="py-12 text-center text-red-500">Failed to load certificates.</div>
      ) : certificates.length === 0 ? (
        <div className="py-12 text-center text-gray-500">No certificates found.</div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Student</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Course</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Certificate ID</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Issue Date</th>
                <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {certificates.map((cert) => (
                <tr key={cert.name} className="hover:bg-gray-50 transition-colors">
                  <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900">{cert.student_name}</td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-600">{cert.course_title}</td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm font-mono text-gray-600">{cert.certificate_id}</td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                    {new Date(cert.issue_date).toLocaleDateString()}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-right">
                    <button
                      onClick={() => openDetail(cert)}
                      className="inline-flex items-center gap-1 text-sm font-medium text-dark hover:underline"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Detail Modal */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setSelected(null)}>
          <div className="relative w-full max-w-lg rounded-xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setSelected(null)} className="absolute right-4 top-4 text-gray-400 hover:text-gray-600">
              <X className="h-5 w-5" />
            </button>
            {detailLoading ? (
              <div className="py-8 text-center text-gray-500">Loading...</div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <Award className="h-8 w-8 text-dark" />
                  <h2 className="text-lg font-bold text-gray-900">Certificate Details</h2>
                </div>
                <dl className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <dt className="font-medium text-gray-500">Student</dt>
                    <dd className="mt-1 text-gray-900">{selected.student_name}</dd>
                  </div>
                  <div>
                    <dt className="font-medium text-gray-500">Email</dt>
                    <dd className="mt-1 text-gray-900">{selected.student}</dd>
                  </div>
                  <div>
                    <dt className="font-medium text-gray-500">Course</dt>
                    <dd className="mt-1 text-gray-900">{selected.course_title}</dd>
                  </div>
                  <div>
                    <dt className="font-medium text-gray-500">Certificate ID</dt>
                    <dd className="mt-1 font-mono text-gray-900">{selected.certificate_id}</dd>
                  </div>
                  <div>
                    <dt className="font-medium text-gray-500">Issue Date</dt>
                    <dd className="mt-1 text-gray-900">{new Date(selected.issue_date).toLocaleDateString()}</dd>
                  </div>
                  <div>
                    <dt className="font-medium text-gray-500">Created</dt>
                    <dd className="mt-1 text-gray-900">{new Date(selected.creation).toLocaleDateString()}</dd>
                  </div>
                </dl>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
