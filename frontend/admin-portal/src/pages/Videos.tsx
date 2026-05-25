import React, { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { vimeoService, uploadVideoFile } from '@/api/vimeo';
import {
  Search,
  Upload,
  Trash2,
  Loader2,
  X,
  AlertTriangle,
  Video,
  Clock,
  Calendar,
  Pencil,
} from 'lucide-react';
import { format } from 'date-fns';

function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function EditVideoModal({
  video,
  onClose,
  onSave,
  saving,
}: {
  video: any;
  onClose: () => void;
  onSave: (name: string, description: string) => void;
  saving: boolean;
}) {
  const [name, setName] = useState(video.name || '');
  const [description, setDescription] = useState(video.description || '');

  useEffect(() => {
    setName(video.name || '');
    setDescription(video.description || '');
  }, [video]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-heading font-semibold text-dark">Edit Video</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              placeholder="Video title"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              placeholder="Optional description"
            />
          </div>
          <p className="text-xs text-gray-400 font-mono">ID: {video.id}</p>
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={() => onSave(name.trim(), description.trim())}
            disabled={saving || !name.trim()}
            className="px-4 py-2 text-sm bg-dark text-white rounded-lg hover:bg-dark-light transition-colors disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Videos() {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null);
  const [editTarget, setEditTarget] = useState<any | null>(null);

  // Upload state
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadName, setUploadName] = useState('');
  const [uploadError, setUploadError] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['vimeo-videos', search, page],
    queryFn: () => vimeoService.listVideos(page, 12, search || undefined),
  });

  const videos = data?.data || [];
  const total = data?.total || 0;

  const deleteMutation = useMutation({
    mutationFn: (videoId: string) => vimeoService.deleteVideo(videoId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vimeo-videos'] });
      setDeleteTarget(null);
    },
  });

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setUploadProgress(0);
    setUploadName(file.name);
    setUploadError(null);

    try {
      const videoName = file.name.replace(/\.[^.]+$/, '');
      const { videoId, uploadLink } = await vimeoService.createUpload(videoName, '', file.size);

      await uploadVideoFile(uploadLink, file, (pct) => setUploadProgress(pct));

      await vimeoService.completeUpload(videoId);
      queryClient.invalidateQueries({ queryKey: ['vimeo-videos'] });
    } catch (err: any) {
      console.error('Upload error:', err);
      const message =
        err?.response?.data?.exc_type ||
        err?.response?.data?._error_message ||
        err?.message ||
        'Upload failed. Check your Vimeo access token and network connection.';
      setUploadError(message);
    } finally {
      setUploading(false);
      setUploadProgress(0);
      setUploadName('');
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const updateMutation = useMutation({
    mutationFn: ({ videoId, name, description }: { videoId: string; name: string; description: string }) =>
      vimeoService.updateVideo(videoId, { name, description }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vimeo-videos'] });
      setEditTarget(null);
    },
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-bold text-dark">Video Library</h1>
          <p className="text-sm text-gray-500 mt-1">{total} videos on Vimeo</p>
        </div>
        <div>
          <input ref={fileInputRef} type="file" accept="video/*" onChange={handleFileSelect} className="hidden" />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-2 bg-dark text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-dark-light transition-colors disabled:opacity-50"
          >
            <Upload className="w-4 h-4" /> Upload Video
          </button>
        </div>
      </div>

      {/* Upload Progress */}
      {uploading && (
        <div className="admin-card">
          <div className="flex items-center gap-3 mb-2">
            <Loader2 className="w-4 h-4 animate-spin text-primary-dark" />
            <span className="text-sm font-medium text-dark">Uploading: {uploadName}</span>
            <span className="text-sm text-gray-500 ml-auto">{uploadProgress}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-primary-dark h-2 rounded-full transition-all duration-300"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
        </div>
      )}

      {/* Upload Error */}
      {uploadError && !uploading && (
        <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
          <AlertTriangle className="w-5 h-5 mt-0.5 flex-shrink-0" />
          <div className="flex-1 text-sm">
            <p className="font-medium">Upload failed</p>
            <p className="mt-0.5 text-red-600">{uploadError}</p>
          </div>
          <button
            onClick={() => setUploadError(null)}
            className="text-red-400 hover:text-red-600"
            aria-label="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder="Search videos..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm"
        />
      </div>

      {/* Video Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center h-40">
          <Loader2 className="w-6 h-6 animate-spin text-primary-dark" />
        </div>
      ) : videos.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Video className="w-12 h-12 mx-auto mb-3 opacity-40" />
          <p>No videos found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {videos.map((v: any) => {
            const videoId = v.uri ? v.uri.replace(/^\/videos\//, '') : v.id;
            const thumbnail = v.pictures?.sizes?.slice(-1)[0]?.link || null;
            return (
              <div key={videoId} className="admin-card p-0 overflow-hidden group">
                <div className="aspect-video bg-gray-100 relative">
                  {thumbnail ? (
                    <img src={thumbnail} alt={v.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-300"><Video className="w-8 h-8" /></div>
                  )}
                  {v.status && v.status !== 'available' && (
                    <span className="absolute top-2 left-2 px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded text-xs font-medium">{v.status}</span>
                  )}
                  <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => setEditTarget({ ...v, id: videoId })}
                      className="p-1.5 bg-white/90 rounded-lg text-gray-600 hover:text-dark"
                      aria-label="Edit video"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setDeleteTarget({ ...v, id: videoId })}
                      className="p-1.5 bg-white/90 rounded-lg text-red-500 hover:text-red-700"
                      aria-label="Delete video"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                <div className="p-3">
                  <p className="text-sm font-medium text-dark line-clamp-1">{v.name}</p>
                  <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                    {v.duration != null && (
                      <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{formatDuration(v.duration)}</span>
                    )}
                    {v.created_time && (
                      <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{format(new Date(v.created_time), 'MMM d, yyyy')}</span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 mt-1 font-mono">ID: {videoId}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {total > 12 && (
        <div className="flex items-center justify-center gap-3">
          <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="px-4 py-2 text-sm border border-gray-300 rounded-lg disabled:opacity-40 hover:bg-gray-50">Previous</button>
          <span className="text-sm text-gray-500">Page {page}</span>
          <button disabled={videos.length < 12} onClick={() => setPage(page + 1)} className="px-4 py-2 text-sm border border-gray-300 rounded-lg disabled:opacity-40 hover:bg-gray-50">Next</button>
        </div>
      )}

      {/* Edit Video Modal */}
      {editTarget && (
        <EditVideoModal
          video={editTarget}
          onClose={() => setEditTarget(null)}
          onSave={(name, description) => updateMutation.mutate({ videoId: editTarget.id, name, description })}
          saving={updateMutation.isPending}
        />
      )}

      {/* Delete Confirmation */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full mx-4 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <h3 className="font-heading font-semibold text-dark">Delete Video</h3>
              <button onClick={() => setDeleteTarget(null)} className="ml-auto text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <p className="text-sm text-gray-600 mb-6">
              Are you sure you want to delete <strong>{deleteTarget.name}</strong>? This permanently removes the video from Vimeo.
            </p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setDeleteTarget(null)} className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
              <button
                onClick={() => deleteMutation.mutate(deleteTarget.id)}
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
