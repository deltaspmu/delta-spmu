import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getCourseDetail,
  createCourse,
  updateCourse,
  getCourseChapters,
  createChapter,
  updateChapter,
  deleteChapter,
  createLesson,
  updateLesson,
  deleteLesson,
  getCategories,
  getQuizzes,
  uploadFile,
} from '@/api/client';
import { vimeoService } from '@/api/vimeo';
import type { Chapter, Lesson } from '@/types';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import {
  Save,
  Eye,
  Loader2,
  Plus,
  Trash2,
  GripVertical,
  ChevronDown,
  ChevronRight,
  Video,
  X,
  Search,
  AlertTriangle,
  Image as ImageIcon,
  UploadCloud,
  Pencil,
  CheckCircle,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Tiptap Rich Text Editor Component
// ---------------------------------------------------------------------------
function RichTextEditor({
  content,
  onChange,
  placeholder,
}: {
  content: string;
  onChange: (html: string) => void;
  placeholder?: string;
}) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Link.configure({ openOnClick: false }),
      Placeholder.configure({ placeholder: placeholder || 'Start writing...' }),
    ],
    content,
    onUpdate: ({ editor: ed }) => onChange(ed.getHTML()),
  });

  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content, { emitUpdate: false });
    }
  }, [content]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!editor) return null;

  return (
    <div className="tiptap-editor border border-gray-300 rounded-lg overflow-hidden">
      <div className="flex gap-1 p-2 border-b border-gray-200 bg-gray-50">
        <button type="button" onClick={() => editor.chain().focus().toggleBold().run()} className={`p-1.5 rounded text-xs font-bold ${editor.isActive('bold') ? 'bg-dark text-white' : 'hover:bg-gray-200'}`}>B</button>
        <button type="button" onClick={() => editor.chain().focus().toggleItalic().run()} className={`p-1.5 rounded text-xs italic ${editor.isActive('italic') ? 'bg-dark text-white' : 'hover:bg-gray-200'}`}>I</button>
        <button type="button" onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} className={`p-1.5 rounded text-xs ${editor.isActive('heading', { level: 2 }) ? 'bg-dark text-white' : 'hover:bg-gray-200'}`}>H2</button>
        <button type="button" onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} className={`p-1.5 rounded text-xs ${editor.isActive('heading', { level: 3 }) ? 'bg-dark text-white' : 'hover:bg-gray-200'}`}>H3</button>
        <button type="button" onClick={() => editor.chain().focus().toggleBulletList().run()} className={`p-1.5 rounded text-xs ${editor.isActive('bulletList') ? 'bg-dark text-white' : 'hover:bg-gray-200'}`}>UL</button>
        <button type="button" onClick={() => editor.chain().focus().toggleOrderedList().run()} className={`p-1.5 rounded text-xs ${editor.isActive('orderedList') ? 'bg-dark text-white' : 'hover:bg-gray-200'}`}>OL</button>
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Course Image Upload
//
// Drag-and-drop OR click-to-pick. Posts via Frappe's upload_file endpoint
// and stores the returned file_url (e.g. /files/img.jpg) on the course.
// ---------------------------------------------------------------------------

// Same-origin by default — Vercel rewrites /files/* to api.deltaspmu.com.
const FRAPPE_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? '';

function CourseImageUpload({
  image,
  onUpload,
  docname,
}: {
  image: string;
  onUpload: (fileUrl: string) => void;
  docname?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const handleFile = async (file: File) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Please choose an image file (PNG, JPG, WEBP).');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Image is too large (max 5 MB).');
      return;
    }
    setError(null);
    setUploading(true);
    try {
      const result = await uploadFile(file, {
        doctype: docname ? 'LMS Course' : undefined,
        docname,
        folder: 'Home',
      });
      onUpload(result.file_url);
    } catch (err: any) {
      const msg =
        err?.response?.data?._server_messages ||
        err?.response?.data?.exception ||
        err?.message ||
        'Upload failed.';
      setError(String(msg));
    } finally {
      setUploading(false);
    }
  };

  const displayUrl = image
    ? image.startsWith('http') || image.startsWith('/images/') || image.startsWith('/assets/')
      ? image
      : `${FRAPPE_BASE}${image.startsWith('/') ? '' : '/'}${image}`
    : '';

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1.5">Course Image</label>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleFile(file);
          e.target.value = '';
        }}
      />

      {image ? (
        <div className="flex items-stretch gap-3">
          <div className="w-32 h-20 rounded-lg border border-gray-200 overflow-hidden shrink-0 bg-gray-50">
            <img src={displayUrl} alt="Course" className="w-full h-full object-cover" />
          </div>
          <div className="flex-1 flex flex-col justify-between min-w-0">
            <p className="text-xs text-gray-500 truncate">{image}</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                disabled={uploading}
                className="flex items-center gap-1.5 text-sm px-3 py-1.5 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
              >
                <UploadCloud className="w-3.5 h-3.5" />
                {uploading ? 'Uploading...' : 'Change'}
              </button>
              <button
                type="button"
                onClick={() => onUpload('')}
                disabled={uploading}
                className="flex items-center gap-1.5 text-sm px-3 py-1.5 border border-gray-300 rounded-lg text-red-600 hover:bg-red-50 disabled:opacity-50"
              >
                <X className="w-3.5 h-3.5" />
                Remove
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div
          onClick={() => !uploading && inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            const file = e.dataTransfer.files?.[0];
            if (file) void handleFile(file);
          }}
          className={`flex flex-col items-center justify-center px-6 py-8 rounded-lg border-2 border-dashed cursor-pointer transition-colors ${
            dragOver
              ? 'border-primary bg-primary-light/30'
              : 'border-gray-300 hover:border-gray-400 bg-gray-50'
          } ${uploading ? 'opacity-60 cursor-wait' : ''}`}
        >
          {uploading ? (
            <>
              <UploadCloud className="w-8 h-8 text-primary-dark animate-pulse mb-2" />
              <p className="text-sm text-gray-600">Uploading...</p>
            </>
          ) : (
            <>
              <ImageIcon className="w-8 h-8 text-gray-400 mb-2" />
              <p className="text-sm text-dark font-medium">
                Click to upload or drag &amp; drop
              </p>
              <p className="text-xs text-gray-500 mt-0.5">PNG, JPG, or WEBP up to 5&nbsp;MB</p>
            </>
          )}
        </div>
      )}

      {error && (
        <p className="mt-2 text-xs text-red-600">{error}</p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Video Picker Modal
// ---------------------------------------------------------------------------
function VideoPickerModal({
  open,
  onClose,
  onSelect,
}: {
  open: boolean;
  onClose: () => void;
  onSelect: (videoRef: string) => void;
}) {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['vimeo-videos', search, page],
    queryFn: () => vimeoService.listVideos(page, 12, search || undefined),
    enabled: open,
  });

  const videos = data?.data || [];

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl max-w-3xl w-full mx-4 max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="font-heading font-semibold text-dark">Select Video from Library</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-4 border-b">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search videos..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {isLoading ? (
            <div className="flex items-center justify-center h-40"><Loader2 className="w-6 h-6 animate-spin text-primary-dark" /></div>
          ) : videos.length === 0 ? (
            <div className="text-center py-12 text-gray-400">No videos found</div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {videos.map((v: any) => {
                const videoId = v.uri ? v.uri.replace(/^\/videos\//, '') : '';
                const thumb = v.pictures?.sizes?.slice(-1)[0]?.link || null;
                return (
                <button
                  key={videoId}
                  onClick={() => { onSelect(`${videoId}/${videoId}`); onClose(); }}
                  className="text-left border rounded-lg overflow-hidden hover:ring-2 hover:ring-primary-dark transition-all"
                >
                  <div className="aspect-video bg-gray-100">
                    {thumb && <img src={thumb} alt={v.name} className="w-full h-full object-cover" />}
                  </div>
                  <div className="p-2">
                    <p className="text-xs font-medium text-dark line-clamp-1">{v.name}</p>
                    <p className="text-xs text-gray-400">{v.duration ? `${Math.floor(v.duration / 60)}:${String(v.duration % 60).padStart(2, '0')}` : '-'}</p>
                  </div>
                </button>
                );
              })}
            </div>
          )}
        </div>
        {(data?.total || 0) > 12 && (
          <div className="flex items-center justify-center gap-2 p-3 border-t">
            <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="px-3 py-1 text-sm border rounded disabled:opacity-40">Prev</button>
            <span className="text-sm text-gray-500">Page {page}</span>
            <button disabled={videos.length < 12} onClick={() => setPage(page + 1)} className="px-3 py-1 text-sm border rounded disabled:opacity-40">Next</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Lesson Editor Row
// ---------------------------------------------------------------------------
function LessonRow({
  lesson,
  onUpdate,
  onDelete,
  quizzes,
  index,
}: {
  lesson: Partial<Lesson> & { _key: string };
  onUpdate: (data: Partial<Lesson>) => void;
  onDelete: () => void;
  quizzes: any[];
  index: number;
}) {
  const [showEdit, setShowEdit] = useState(false);
  const hasVideo = !!lesson.youtube;
  const isUnsaved = !lesson.name && (lesson.title || '').trim() === '';

  return (
    <>
      <div
        className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-colors ${
          hasVideo
            ? 'border-gray-200 bg-white hover:bg-gray-50'
            : 'border-amber-200 bg-amber-50/50 hover:bg-amber-50'
        }`}
      >
        {/* Lesson index */}
        <span className="text-xs font-mono text-gray-400 w-6 shrink-0">{index}</span>

        {/* Video status icon */}
        <div
          className={`w-8 h-8 rounded-md flex items-center justify-center shrink-0 ${
            hasVideo ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'
          }`}
          title={hasVideo ? 'Has video' : 'No video yet'}
        >
          <Video className="w-4 h-4" />
        </div>

        {/* Title + meta */}
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-medium truncate ${isUnsaved ? 'text-gray-400 italic' : 'text-dark'}`}>
            {lesson.title || 'Untitled lesson'}
          </p>
          {(lesson.duration || hasVideo) && (
            <p className="text-xs text-gray-400 mt-0.5">
              {lesson.duration ? `${lesson.duration} min` : ''}
              {lesson.duration && hasVideo ? ' · ' : ''}
              {hasVideo ? `Video ID: ${(lesson.youtube || '').split('/')[0]}` : ''}
            </p>
          )}
        </div>

        {/* Actions */}
        <button
          type="button"
          onClick={() => setShowEdit(true)}
          className="p-1.5 text-gray-500 hover:text-dark hover:bg-gray-100 rounded transition-colors"
          aria-label="Edit lesson"
        >
          <Pencil className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded transition-colors"
          aria-label="Delete lesson"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      <EditLessonModal
        open={showEdit}
        lesson={lesson}
        quizzes={quizzes}
        onClose={() => setShowEdit(false)}
        onSave={(data) => {
          onUpdate(data);
          setShowEdit(false);
        }}
      />
    </>
  );
}

// ---------------------------------------------------------------------------
// Edit Lesson Modal
// ---------------------------------------------------------------------------
function EditLessonModal({
  open,
  lesson,
  quizzes,
  onClose,
  onSave,
}: {
  open: boolean;
  lesson: Partial<Lesson> & { _key: string };
  quizzes: any[];
  onClose: () => void;
  onSave: (data: Partial<Lesson>) => void;
}) {
  const [title, setTitle] = useState(lesson.title || '');
  const [content, setContent] = useState(lesson.content || '');
  const [youtube, setYoutube] = useState(lesson.youtube || '');
  const [quizId, setQuizId] = useState(lesson.quiz_id || '');
  const [duration, setDuration] = useState(lesson.duration || 0);
  const [showVideoPicker, setShowVideoPicker] = useState(false);

  // Reset local state when modal opens with a different lesson
  useEffect(() => {
    if (open) {
      setTitle(lesson.title || '');
      setContent(lesson.content || '');
      setYoutube(lesson.youtube || '');
      setQuizId(lesson.quiz_id || '');
      setDuration(lesson.duration || 0);
    }
  }, [open, lesson._key]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full">
        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-gray-100">
          <div>
            <h3 className="font-heading text-lg font-semibold text-dark">Edit Lesson</h3>
            <p className="text-xs text-gray-500 mt-0.5">Update lesson details and content</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Video card */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Video</label>
            <div className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 bg-gray-50">
              <div
                className={`w-12 h-12 rounded-md flex items-center justify-center shrink-0 ${
                  youtube ? 'bg-emerald-100 text-emerald-600' : 'bg-gray-200 text-gray-400'
                }`}
              >
                <Video className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                {youtube ? (
                  <>
                    <p className="text-xs text-gray-500">Video ID</p>
                    <p className="text-sm font-mono text-dark truncate">{youtube.split('/')[0]}</p>
                  </>
                ) : (
                  <p className="text-sm text-gray-500">No video attached</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setShowVideoPicker(true)}
                className="text-sm font-medium text-primary-dark hover:underline shrink-0"
              >
                {youtube ? 'Change' : 'Add video'}
              </button>
              {youtube && (
                <button
                  type="button"
                  onClick={() => setYoutube('')}
                  className="text-sm text-red-600 hover:text-red-700 shrink-0"
                  title="Remove video"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Title + Duration */}
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_120px] gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Lesson Title <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none"
                placeholder="e.g. Skin Anatomy Basics"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Duration (min)</label>
              <input
                type="number"
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
                min={0}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
          </div>

          {/* Quiz */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Linked Quiz</label>
            <select
              value={quizId}
              onChange={(e) => setQuizId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
            >
              <option value="">No quiz</option>
              {quizzes.map((q: any) => (
                <option key={q.name} value={q.name}>
                  {q.title}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-400 mt-1">
              Students take this quiz at the end of the lesson.
            </p>
          </div>

          {/* Description / Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description / Notes</label>
            <RichTextEditor
              content={content}
              onChange={setContent}
              placeholder="What will students learn in this lesson..."
            />
            <p className="text-xs text-gray-400 mt-1">
              Shown to students below the video.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 p-4 border-t border-gray-100 bg-gray-50 rounded-b-xl">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-100"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() =>
              onSave({
                title: title.trim(),
                content,
                youtube: youtube || undefined,
                quiz_id: quizId || undefined,
                duration,
              })
            }
            disabled={!title.trim()}
            className="px-5 py-2 text-sm bg-dark text-white rounded-lg hover:bg-dark-light disabled:opacity-50"
          >
            Save Changes
          </button>
        </div>
      </div>

      <VideoPickerModal
        open={showVideoPicker}
        onClose={() => setShowVideoPicker(false)}
        onSelect={(ref) => {
          setYoutube(ref);
          setShowVideoPicker(false);
        }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Chapter Section
// ---------------------------------------------------------------------------
interface ChapterState extends Partial<Chapter> {
  _key: string;
  _expanded: boolean;
  _lessons: (Partial<Lesson> & { _key: string })[];
}

function ChapterSection({
  chapter,
  onUpdate,
  onDelete,
  onUpdateLesson,
  onAddLesson,
  onDeleteLesson,
  quizzes,
}: {
  chapter: ChapterState;
  onUpdate: (data: Partial<Chapter> & { _expanded?: boolean }) => void;
  onDelete: () => void;
  onUpdateLesson: (lessonKey: string, data: Partial<Lesson>) => void;
  onAddLesson: () => void;
  onDeleteLesson: (lessonKey: string) => void;
  quizzes: any[];
}) {
  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      <div className="flex items-center gap-2 p-3 bg-white">
        <GripVertical className="w-4 h-4 text-gray-300" />
        <button type="button" onClick={() => onUpdate({ _expanded: !chapter._expanded })} className="p-1">
          {chapter._expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </button>
        <input
          type="text"
          value={chapter.title || ''}
          onChange={(e) => onUpdate({ title: e.target.value })}
          placeholder="Chapter title"
          className="flex-1 px-2 py-1.5 border border-gray-300 rounded text-sm font-medium"
        />
        <span className="text-xs text-gray-400">{chapter._lessons.length} lessons</span>
        <button type="button" onClick={onDelete} className="p-1 text-red-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
      </div>
      {chapter._expanded && (
        <div className="p-3 space-y-2 bg-gray-50/50 border-t">
          {chapter._lessons.map((lesson, idx) => (
            <LessonRow
              key={lesson._key}
              lesson={lesson}
              index={idx + 1}
              onUpdate={(d) => onUpdateLesson(lesson._key, d)}
              onDelete={() => onDeleteLesson(lesson._key)}
              quizzes={quizzes}
            />
          ))}
          <button
            type="button"
            onClick={onAddLesson}
            className="flex items-center gap-1 text-xs text-primary-dark hover:text-dark"
          >
            <Plus className="w-3.5 h-3.5" /> Add Lesson
          </button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main CourseEditor Page
// ---------------------------------------------------------------------------
let _keyCounter = 0;
function nextKey() { return `_k${++_keyCounter}`; }

export default function CourseEditor() {
  const { id } = useParams<{ id: string }>();
  const isNew = !id || id === 'new';
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Course fields
  const [title, setTitle] = useState('');
  const [shortIntro, setShortIntro] = useState('');
  const [description, setDescription] = useState('');
  const [image, setImage] = useState('');
  const [category, setCategory] = useState('');
  const [price, setPrice] = useState(0);
  const [currency, setCurrency] = useState('ETB');
  const [published, setPublished] = useState(false);
  // Learning outcomes (newline-separated, stored in Custom Field on LMS Course)
  const [learningOutcomes, setLearningOutcomes] = useState<string[]>([]);
  const [newOutcome, setNewOutcome] = useState('');

  // Chapters & lessons state
  const [chapters, setChapters] = useState<ChapterState[]>([]);

  // Tab state — matches Afritutors admin layout: Details vs Content & Videos
  const [activeTab, setActiveTab] = useState<'details' | 'content'>('details');

  // Load course data — React Query v5 dropped `onSuccess`, so we react via useEffect
  const { data: courseData, isLoading: courseLoading } = useQuery({
    queryKey: ['course-detail', id],
    queryFn: () => getCourseDetail(id!),
    enabled: !isNew,
  });

  useEffect(() => {
    if (!courseData) return;
    const d: any = courseData;
    setTitle(d.title || '');
    setShortIntro(d.short_introduction || '');
    setDescription(d.description || '');
    setImage(d.image || '');
    setCategory(d.category || '');
    setPrice(d.course_price || 0);
    setCurrency(d.currency || 'ETB');
    setPublished(!!d.published);
    // Split outcomes by newline, trim, drop blanks
    const outcomesRaw: string = d.learning_outcomes || '';
    setLearningOutcomes(
      outcomesRaw
        .split('\n')
        .map((s: string) => s.trim())
        .filter(Boolean),
    );
  }, [courseData]);

  // Load chapters
  const { data: chaptersData, isLoading: chaptersLoading } = useQuery({
    queryKey: ['course-chapters', id],
    queryFn: () => getCourseChapters(id!),
    enabled: !isNew,
  });

  useEffect(() => {
    if (!chaptersData) return;
    const chaps = (Array.isArray(chaptersData) ? chaptersData : []).map((ch: Chapter) => ({
      ...ch,
      _key: nextKey(),
      _expanded: false,
      _lessons: (ch.lessons || []).map((l) => ({ ...l, _key: nextKey() })),
    }));
    setChapters(chaps);
  }, [chaptersData]);

  // Load categories
  const { data: categoriesData } = useQuery({
    queryKey: ['categories'],
    queryFn: () => getCategories({ limit_page_length: 0 }),
  });
  const categories = Array.isArray(categoriesData) ? categoriesData : categoriesData?.data || [];

  // Load quizzes for dropdown
  const { data: quizzesData } = useQuery({
    queryKey: ['quizzes-list'],
    queryFn: () => getQuizzes({ fields: JSON.stringify(['name', 'title']), limit_page_length: 0 }),
  });
  const quizzes = Array.isArray(quizzesData) ? quizzesData : quizzesData?.data || [];

  // Save course mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      const courseData = {
        title,
        short_introduction: shortIntro,
        description,
        image,
        category,
        course_price: price,
        currency,
        published: published ? 1 : 0,
        learning_outcomes: learningOutcomes.join('\n'),
      };

      let courseName = id;
      if (isNew) {
        const res = await createCourse(courseData);
        courseName = res.name;
      } else {
        await updateCourse(id!, courseData);
      }

      // Save chapters & lessons. NOTE: Course Chapter and Course Lesson
      // doctypes on this Frappe install don't have explicit
      // chapter_number / lesson_number columns — Frappe auto-manages
      // ordering via `idx`. We pass idx instead.
      for (let ci = 0; ci < chapters.length; ci++) {
        const ch = chapters[ci];
        const chapterData = { title: ch.title, course: courseName, idx: ci + 1 };
        let chName = ch.name;
        if (chName) {
          await updateChapter(chName, chapterData);
        } else {
          const res = await createChapter(chapterData);
          chName = res.name;
        }
        for (let li = 0; li < ch._lessons.length; li++) {
          const ls = ch._lessons[li];
          const lessonData: Record<string, any> = {
            title: ls.title,
            content: ls.content || '',
            chapter: chName,
            course: courseName,
            idx: li + 1,
            duration: ls.duration || 0,
          };
          // Optional fields — only include when set, to avoid Frappe
          // rejecting empty strings on Link fields.
          if (ls.youtube) lessonData.youtube = ls.youtube;
          if (ls.quiz_id) lessonData.quiz_id = ls.quiz_id;
          if (ls.name) {
            await updateLesson(ls.name, lessonData);
          } else {
            await createLesson(lessonData);
          }
        }
      }

      return courseName;
    },
    onSuccess: (courseName) => {
      queryClient.invalidateQueries({ queryKey: ['admin-courses'] });
      queryClient.invalidateQueries({ queryKey: ['course-detail', courseName] });
      if (isNew && courseName) navigate(`/courses/${courseName}`, { replace: true });
    },
  });

  // Chapter helpers
  const addChapter = () => {
    setChapters((prev) => [...prev, { _key: nextKey(), _expanded: true, _lessons: [], title: '' }]);
  };

  const updateChapterState = (key: string, data: Partial<ChapterState>) => {
    setChapters((prev) => prev.map((ch) => (ch._key === key ? { ...ch, ...data } : ch)));
  };

  const removeChapter = (key: string) => {
    const ch = chapters.find((c) => c._key === key);
    if (ch?.name) deleteChapter(ch.name);
    setChapters((prev) => prev.filter((c) => c._key !== key));
  };

  const addLessonToChapter = (chapterKey: string) => {
    setChapters((prev) =>
      prev.map((ch) =>
        ch._key === chapterKey
          ? { ...ch, _lessons: [...ch._lessons, { _key: nextKey(), title: '', content: '' }] }
          : ch,
      ),
    );
  };

  const updateLessonInChapter = (chapterKey: string, lessonKey: string, data: Partial<Lesson>) => {
    setChapters((prev) =>
      prev.map((ch) =>
        ch._key === chapterKey
          ? { ...ch, _lessons: ch._lessons.map((l) => (l._key === lessonKey ? { ...l, ...data } : l)) }
          : ch,
      ),
    );
  };

  const removeLessonFromChapter = (chapterKey: string, lessonKey: string) => {
    const ch = chapters.find((c) => c._key === chapterKey);
    const ls = ch?._lessons.find((l) => l._key === lessonKey);
    if (ls?.name) deleteLesson(ls.name);
    setChapters((prev) =>
      prev.map((c) =>
        c._key === chapterKey
          ? { ...c, _lessons: c._lessons.filter((l) => l._key !== lessonKey) }
          : c,
      ),
    );
  };

  if (!isNew && (courseLoading || chaptersLoading)) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary-dark" />
      </div>
    );
  }

  return (
    <div className="space-y-6 sm:space-y-8 max-w-4xl">
      {/* Header — stacks on mobile so the action buttons don't squeeze
          the title into ellipsis territory */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="font-heading text-xl sm:text-2xl font-bold text-dark">
            {isNew ? 'Create Course' : 'Edit Course'}
          </h1>
          <p className="text-sm text-gray-500 mt-1 truncate">{isNew ? 'Add a new course to the platform' : title}</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => { setPublished(false); saveMutation.mutate(); }}
            disabled={saveMutation.isPending}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 border border-gray-300 px-4 py-2 rounded-lg text-sm hover:bg-gray-50 disabled:opacity-50"
          >
            <Save className="w-4 h-4" /> Save Draft
          </button>
          <button
            onClick={() => { setPublished(true); saveMutation.mutate(); }}
            disabled={saveMutation.isPending}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-dark text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-dark-light disabled:opacity-50"
          >
            <Eye className="w-4 h-4" /> {saveMutation.isPending ? 'Saving...' : 'Publish'}
          </button>
        </div>
      </div>

      {saveMutation.isError && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3">
          Failed to save course. Please try again.
        </div>
      )}
      {saveMutation.isSuccess && (
        <div className="bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg p-3">
          Course saved successfully.
        </div>
      )}

      {/* Tab switcher — only available once the course exists.
          New courses jump straight to the Details tab; you must save
          before chapters/lessons can be added. */}
      {!isNew && (
        <div className="bg-white rounded-xl border border-gray-200 p-1.5 inline-flex gap-1 w-full sm:w-auto">
          <button
            onClick={() => setActiveTab('details')}
            className={`flex-1 sm:flex-none px-5 py-2 rounded-lg font-medium text-sm transition-all ${
              activeTab === 'details'
                ? 'bg-dark text-white shadow-sm'
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            Course Details
          </button>
          <button
            onClick={() => setActiveTab('content')}
            className={`flex-1 sm:flex-none px-5 py-2 rounded-lg font-medium text-sm transition-all ${
              activeTab === 'content'
                ? 'bg-dark text-white shadow-sm'
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            Content & Videos
            {chapters.length > 0 && (
              <span className="ml-2 px-2 py-0.5 bg-white/20 rounded-full text-xs">
                {chapters.reduce((acc, c) => acc + c._lessons.length, 0)}
              </span>
            )}
          </button>
        </div>
      )}

      {/* Basic Info — Course Details tab */}
      {(isNew || activeTab === 'details') && (
      <>
      <div className="admin-card space-y-4">
        <h2 className="font-heading text-lg font-semibold text-dark">Basic Information</h2>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
          <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" placeholder="Course title" />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Short Introduction</label>
          <input type="text" value={shortIntro} onChange={(e) => setShortIntro(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" placeholder="Brief description for cards and previews" />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
          <RichTextEditor content={description} onChange={setDescription} placeholder="Full course description..." />
        </div>

        <CourseImageUpload
          image={image}
          onUpload={setImage}
          docname={isNew ? undefined : id}
        />
        <p className="text-xs text-gray-400 -mt-2">
          Recommended: 16:9 aspect ratio, at least 1280&times;720 px, under 2&nbsp;MB. PNG / JPG.
        </p>

        {/* Learning Outcomes — bullet list shown on the course detail page */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            What You&apos;ll Learn
          </label>
          <p className="text-xs text-gray-400 mb-3">
            These appear on the course page as learning outcomes for students.
          </p>

          {learningOutcomes.length > 0 && (
            <ul className="space-y-2 mb-3">
              {learningOutcomes.map((outcome, i) => (
                <li
                  key={i}
                  className="flex items-start gap-2 px-3 py-2 bg-emerald-50/50 border border-emerald-100 rounded-lg"
                >
                  <CheckCircle className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                  <span className="text-sm text-dark flex-1">{outcome}</span>
                  <button
                    type="button"
                    onClick={() =>
                      setLearningOutcomes((prev) => prev.filter((_, idx) => idx !== i))
                    }
                    className="text-xs text-red-500 hover:text-red-700 shrink-0"
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="flex gap-2">
            <input
              type="text"
              value={newOutcome}
              onChange={(e) => setNewOutcome(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && newOutcome.trim()) {
                  e.preventDefault();
                  setLearningOutcomes((prev) => [...prev, newOutcome.trim()]);
                  setNewOutcome('');
                }
              }}
              placeholder="e.g. Map brows using the golden ratio"
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none"
            />
            <button
              type="button"
              onClick={() => {
                if (!newOutcome.trim()) return;
                setLearningOutcomes((prev) => [...prev, newOutcome.trim()]);
                setNewOutcome('');
              }}
              className="px-4 py-2 text-sm bg-dark text-white rounded-lg hover:bg-dark-light disabled:opacity-50"
              disabled={!newOutcome.trim()}
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
            <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white">
              <option value="">Select category</option>
              {categories.map((c: any) => (
                <option key={c.name} value={c.name}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Price</label>
            <input type="number" value={price} onChange={(e) => setPrice(Number(e.target.value))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" min={0} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Currency</label>
            <select value={currency} onChange={(e) => setCurrency(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white">
              <option value="ETB">ETB</option>
              <option value="USD">USD</option>
            </select>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <label className="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" checked={published} onChange={(e) => setPublished(e.target.checked)} className="sr-only peer" />
            <div className="w-9 h-5 bg-gray-200 peer-checked:bg-dark rounded-full peer-focus:ring-2 peer-focus:ring-primary-dark after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-full" />
          </label>
          <span className="text-sm text-gray-700">Published</span>
        </div>
      </div>
      </>
      )}

      {/* Content & Videos tab — only available for saved courses */}
      {!isNew && activeTab === 'content' && (
      <>
      {/* Stat cards */}
      {(() => {
        const totalLessons = chapters.reduce((acc, c) => acc + c._lessons.length, 0);
        const lessonsWithVideo = chapters.reduce(
          (acc, c) => acc + c._lessons.filter((l) => l.youtube).length, 0,
        );
        const lessonsWithoutVideo = totalLessons - lessonsWithVideo;
        const totalDurationMin = chapters.reduce(
          (acc, c) => acc + c._lessons.reduce((a, l) => a + (l.duration || 0), 0), 0,
        );
        const formatDuration = (mins: number) => {
          if (mins <= 0) return '0m';
          const h = Math.floor(mins / 60);
          const m = mins % 60;
          return h > 0 ? `${h}h ${m}m` : `${m}m`;
        };
        return (
          <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <div className="rounded-2xl p-4 shadow-sm bg-gradient-to-br from-dark to-dark-light text-white">
              <p className="text-white/70 text-xs font-medium mb-1">Chapters</p>
              <p className="text-2xl font-bold">{chapters.length}</p>
            </div>
            <div className="rounded-2xl p-4 shadow-sm bg-gradient-to-br from-purple-500 to-purple-600 text-white">
              <p className="text-white/80 text-xs font-medium mb-1">Total Lessons</p>
              <p className="text-2xl font-bold">{totalLessons}</p>
            </div>
            <div className="rounded-2xl p-4 shadow-sm bg-gradient-to-br from-emerald-500 to-emerald-600 text-white">
              <p className="text-white/80 text-xs font-medium mb-1">With Videos</p>
              <p className="text-2xl font-bold">{lessonsWithVideo}</p>
            </div>
            <div className="rounded-2xl p-4 shadow-sm bg-gradient-to-br from-blue-500 to-blue-600 text-white">
              <p className="text-white/80 text-xs font-medium mb-1">Duration</p>
              <p className="text-2xl font-bold">{formatDuration(totalDurationMin)}</p>
            </div>
          </div>

          {lessonsWithoutVideo > 0 && (
            <div className="mt-4 bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium text-amber-800">
                  {lessonsWithoutVideo} lesson{lessonsWithoutVideo > 1 ? 's' : ''} without video
                </p>
                <p className="text-sm text-amber-700 mt-0.5">
                  Add videos to all lessons before publishing — lessons without videos
                  are highlighted in amber below.
                </p>
              </div>
            </div>
          )}
          </>
        );
      })()}

      {/* Chapters list */}
      <div className="admin-card space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-heading text-lg font-semibold text-dark">Chapters & Lessons</h2>
          <button type="button" onClick={addChapter} className="flex items-center gap-1 text-sm bg-primary text-dark px-3 py-1.5 rounded-lg hover:bg-primary-dark transition-colors">
            <Plus className="w-4 h-4" /> Add Chapter
          </button>
        </div>

        {chapters.length === 0 ? (
          <div className="text-center py-12 px-4">
            <div className="w-16 h-16 bg-primary-light/40 rounded-full flex items-center justify-center mx-auto mb-4">
              <Video className="w-7 h-7 text-primary-dark" />
            </div>
            <h3 className="font-heading text-lg font-semibold text-dark mb-1">Build Your Course</h3>
            <p className="text-sm text-gray-500 mb-4 max-w-sm mx-auto">
              Start by adding a chapter — each chapter holds multiple lessons.
              Videos can be uploaded directly from the lesson editor.
            </p>
            <button
              type="button"
              onClick={addChapter}
              className="inline-flex items-center gap-2 bg-dark text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-dark-light transition-colors"
            >
              <Plus className="w-4 h-4" /> Add First Chapter
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {chapters.map((ch) => (
              <ChapterSection
                key={ch._key}
                chapter={ch}
                onUpdate={(d) => updateChapterState(ch._key, d)}
                onDelete={() => removeChapter(ch._key)}
                onUpdateLesson={(lk, d) => updateLessonInChapter(ch._key, lk, d)}
                onAddLesson={() => addLessonToChapter(ch._key)}
                onDeleteLesson={(lk) => removeLessonFromChapter(ch._key, lk)}
                quizzes={quizzes}
              />
            ))}
          </div>
        )}
      </div>
      </>
      )}
    </div>
  );
}
