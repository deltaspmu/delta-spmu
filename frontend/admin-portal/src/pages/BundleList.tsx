import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Plus, Pencil, Trash2, Package, Loader2 } from 'lucide-react';
import { deleteCourseBundle, getCourseBundles } from '@/api/client';
import type { CourseBundle } from '@/types';

export default function BundleList() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [target, setTarget] = useState<CourseBundle | null>(null);
  const { data, isLoading } = useQuery({ queryKey: ['course-bundles'], queryFn: getCourseBundles });
  const remove = useMutation({
    mutationFn: deleteCourseBundle,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['course-bundles'] }); setTarget(null); },
  });
  const bundles = (data || []) as CourseBundle[];
  return <div className="space-y-6">
    <div className="flex items-start justify-between gap-4">
      <div><h1 className="font-heading text-2xl font-bold text-dark">Course Bundles</h1><p className="text-sm text-gray-500 mt-1">Package published courses into a single offer.</p></div>
      <button onClick={() => navigate('/bundles/new')} className="flex items-center gap-2 bg-dark text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-dark-light"><Plus className="w-4 h-4" /> Create Bundle</button>
    </div>
    {isLoading ? <div className="h-48 flex items-center justify-center"><Loader2 className="animate-spin text-primary w-6 h-6" /></div> : bundles.length === 0 ? <div className="admin-card py-14 text-center text-gray-500"><Package className="w-10 h-10 mx-auto mb-3 text-gray-300" />No bundles yet.</div> :
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">{bundles.map(bundle => <article key={bundle.name} className="admin-card p-0 overflow-hidden">
        <div className="h-36 bg-primary/10">{bundle.image ? <img src={bundle.image} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center"><Package className="text-primary w-8 h-8" /></div>}</div>
        <div className="p-4 space-y-3"><div className="flex justify-between gap-2"><h2 className="font-semibold text-dark">{bundle.title}</h2><span className={`text-xs px-2 py-0.5 rounded-full ${bundle.published ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>{bundle.published ? 'Published' : 'Draft'}</span></div>
          <p className="text-xs text-gray-500">{bundle.course_count} courses · {bundle.price.toLocaleString()} {bundle.currency}</p>
          <div className="flex gap-3 pt-2 border-t text-sm"><button onClick={() => navigate(`/bundles/${bundle.name}`)} className="flex items-center gap-1 text-gray-600 hover:text-dark"><Pencil className="w-3.5 h-3.5" />Edit</button><button onClick={() => setTarget(bundle)} className="ml-auto flex items-center gap-1 text-red-500"><Trash2 className="w-3.5 h-3.5" />Delete</button></div>
        </div></article>)}</div>}
    {target && <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"><div className="bg-white rounded-xl p-6 max-w-sm w-full"><h2 className="font-semibold text-lg">Delete bundle?</h2><p className="text-sm text-gray-500 mt-2">This removes “{target.title}”. Existing purchases keep their saved access.</p><div className="flex justify-end gap-3 mt-6"><button onClick={() => setTarget(null)} className="px-3 py-2 text-sm">Cancel</button><button onClick={() => remove.mutate(target.name)} className="px-3 py-2 rounded-lg bg-red-600 text-white text-sm">Delete</button></div></div></div>}
  </div>;
}
