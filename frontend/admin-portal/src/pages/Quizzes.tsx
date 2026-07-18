import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getQuizzes,
  getQuizQuestions,
  createQuiz,
  updateQuiz,
  deleteQuiz,
  addQuizQuestion,
  updateQuizQuestion,
  deleteQuizQuestion,
  getCourses,
} from '@/api/client';
import type { Quiz, QuizQuestion } from '@/types';
import {
  Plus,
  Search,
  Loader2,
  X,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Trash2,
  Pencil,
  CheckCircle,
  Circle,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Create/Edit Quiz Modal
// ---------------------------------------------------------------------------
function QuizModal({
  open,
  quiz,
  courses,
  onClose,
  onSave,
  saving,
}: {
  open: boolean;
  quiz: Partial<Quiz> | null;
  courses: any[];
  onClose: () => void;
  onSave: (data: Record<string, any>) => void;
  saving: boolean;
}) {
  const [title, setTitle] = useState(quiz?.title || '');
  const [course, setCourse] = useState(quiz?.course || '');
  const [passingPct, setPassingPct] = useState(quiz?.passing_percentage || 50);
  const [maxAttempts, setMaxAttempts] = useState(quiz?.max_attempts || 3);
  const [timeLimit, setTimeLimit] = useState(Number(quiz?.duration) || 0);
  const [negativeMarking, setNegativeMarking] = useState(!!quiz?.enable_negative_marking);

  React.useEffect(() => {
    if (quiz) {
      setTitle(quiz.title || '');
      setCourse(quiz.course || '');
      setPassingPct(quiz.passing_percentage || 50);
      setMaxAttempts(quiz.max_attempts || 3);
      setTimeLimit(Number(quiz.duration) || 0);
      setNegativeMarking(!!quiz.enable_negative_marking);
    } else {
      setTitle('');
      setCourse('');
      setPassingPct(50);
      setMaxAttempts(3);
      setTimeLimit(0);
      setNegativeMarking(false);
    }
  }, [quiz, open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-heading font-semibold text-dark">{quiz?.name ? 'Edit Quiz' : 'Create Quiz'}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" placeholder="Quiz title" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Course</label>
            <select value={course} onChange={(e) => setCourse(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white">
              <option value="">Select course</option>
              {courses.map((c: any) => (
                <option key={c.name} value={c.name}>{c.title || c.name}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Passing %</label>
              <input type="number" value={passingPct} onChange={(e) => setPassingPct(Number(e.target.value))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" min={0} max={100} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Max Attempts</label>
              <input type="number" value={maxAttempts} onChange={(e) => setMaxAttempts(Number(e.target.value))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" min={1} />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Time Limit (minutes, 0 = unlimited)</label>
            <input type="number" value={timeLimit} onChange={(e) => setTimeLimit(Number(e.target.value))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" min={0} />
          </div>
          <div className="flex items-center gap-3">
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" checked={negativeMarking} onChange={(e) => setNegativeMarking(e.target.checked)} className="sr-only peer" />
              <div className="w-9 h-5 bg-gray-200 peer-checked:bg-dark rounded-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-full" />
            </label>
            <span className="text-sm text-gray-700">Enable negative marking</span>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={onClose} className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
            <button
              onClick={() => onSave({ title, course, passing_percentage: passingPct, max_attempts: maxAttempts, duration: timeLimit, negative_marking: negativeMarking ? 1 : 0 })}
              disabled={!title || saving}
              className="px-4 py-2 text-sm bg-dark text-white rounded-lg hover:bg-dark-light disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Add/Edit Question Form
// ---------------------------------------------------------------------------
function QuestionForm({
  quizName,
  initialQuestion,
  onAdded,
  onCancel,
}: {
  quizName: string;
  initialQuestion?: QuizQuestion;
  onAdded: () => void;
  onCancel?: () => void;
}) {
  const [question, setQuestion] = useState(initialQuestion?.question || '');
  const [questionType, setQuestionType] = useState<'Single Choice' | 'Multiple Choice'>(initialQuestion?.question_type || 'Single Choice');
  const [options, setOptions] = useState<{ option: string; is_correct: boolean }[]>(
    initialQuestion?.options.map((option) => ({ option: option.option, is_correct: !!option.is_correct })) ||
    [{ option: '', is_correct: false }, { option: '', is_correct: false }],
  );
  const [marks, setMarks] = useState(initialQuestion?.marks || 1);
  const [negativeMarks, setNegativeMarks] = useState(0);

  const saveMutation = useMutation({
    mutationFn: (data: Record<string, any>) =>
      initialQuestion
        ? updateQuizQuestion(initialQuestion.name, data)
        : addQuizQuestion(quizName, data),
    onSuccess: () => {
      setQuestion('');
      setOptions([{ option: '', is_correct: false }, { option: '', is_correct: false }]);
      setMarks(1);
      setNegativeMarks(0);
      onAdded();
    },
  });

  const addOption = () => {
    if (options.length < 4) setOptions([...options, { option: '', is_correct: false }]);
  };

  const removeOption = (index: number) => {
    if (options.length <= 2) return;
    setOptions(options.filter((_, i) => i !== index));
  };

  const updateOption = (index: number, data: Partial<{ option: string; is_correct: boolean }>) => {
    setOptions(options.map((o, i) => (i === index ? { ...o, ...data } : o)));
  };

  const toggleCorrect = (index: number) => {
    if (questionType === 'Single Choice') {
      setOptions(options.map((o, i) => ({ ...o, is_correct: i === index })));
    } else {
      updateOption(index, { is_correct: !options[index].is_correct });
    }
  };

  const handleSubmit = () => {
    saveMutation.mutate({
      question,
      question_type: questionType,
      options: JSON.stringify(options),
      marks,
      negative_marks: negativeMarks,
    });
  };

  const validOptions = options.filter((option) => option.option.trim());
  const canSave =
    question.trim() &&
    validOptions.length >= 2 &&
    validOptions.some((option) => option.is_correct) &&
    (questionType === 'Multiple Choice' || validOptions.filter((option) => option.is_correct).length === 1);

  return (
    <div className="border border-dashed border-gray-300 rounded-lg p-4 space-y-3 bg-gray-50/50">
      <div className="flex items-center justify-between">
        <h5 className="text-sm font-medium text-dark">{initialQuestion ? 'Edit Question' : 'Add Question'}</h5>
        {onCancel && <button type="button" onClick={onCancel} className="text-xs text-gray-500 hover:text-dark">Cancel editing</button>}
      </div>
      <div>
        <input
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Question text"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
        />
      </div>
      <div className="flex gap-3">
        <select
          value={questionType}
          onChange={(e) => setQuestionType(e.target.value as any)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
        >
          <option value="Single Choice">Single Choice</option>
          <option value="Multiple Choice">Multiple Choice</option>
        </select>
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-500">Marks:</label>
          <input type="number" value={marks} onChange={(e) => setMarks(Number(e.target.value))} className="w-16 px-2 py-1.5 border border-gray-300 rounded text-sm" min={0} />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-500">Neg:</label>
          <input type="number" value={negativeMarks} onChange={(e) => setNegativeMarks(Number(e.target.value))} className="w-16 px-2 py-1.5 border border-gray-300 rounded text-sm" min={0} />
        </div>
      </div>
      <div className="space-y-2">
        <label className="text-xs text-gray-500">Options (click to mark correct)</label>
        {options.map((opt, i) => (
          <div key={i} className="flex items-center gap-2">
            <button type="button" onClick={() => toggleCorrect(i)} className="shrink-0">
              {opt.is_correct ? <CheckCircle className="w-5 h-5 text-green-600" /> : <Circle className="w-5 h-5 text-gray-300" />}
            </button>
            <input
              type="text"
              value={opt.option}
              onChange={(e) => updateOption(i, { option: e.target.value })}
              placeholder={`Option ${i + 1}`}
              className="flex-1 px-2 py-1.5 border border-gray-300 rounded text-sm"
            />
            <button type="button" onClick={() => removeOption(i)} className="p-1 text-red-400 hover:text-red-600" disabled={options.length <= 2}>
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
        {options.length < 4 && <button type="button" onClick={addOption} className="text-xs text-primary-dark hover:text-dark">+ Add Option</button>}
      </div>
      {saveMutation.isError && (
        <p className="text-xs text-red-600">
          {(saveMutation.error as any)?.response?.data?.exception || (saveMutation.error as Error).message || 'Unable to save question'}
        </p>
      )}
      <div className="flex justify-end">
        <button
          onClick={handleSubmit}
          disabled={!canSave || saveMutation.isPending}
          className="px-4 py-1.5 text-sm bg-primary text-dark rounded-lg hover:bg-primary-dark disabled:opacity-50"
        >
          {saveMutation.isPending ? 'Saving...' : initialQuestion ? 'Save Question' : 'Add Question'}
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Expanded Quiz Row (questions)
// ---------------------------------------------------------------------------
function QuizQuestions({ quizName }: { quizName: string }) {
  const queryClient = useQueryClient();
  const [editingQuestion, setEditingQuestion] = useState<QuizQuestion | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['quiz-questions', quizName],
    queryFn: () => getQuizQuestions(quizName),
  });

  const deleteQMutation = useMutation({
    mutationFn: (questionName: string) => deleteQuizQuestion(quizName, questionName),
    onSuccess: () => {
      setEditingQuestion(null);
      queryClient.invalidateQueries({ queryKey: ['quiz-questions', quizName] });
    },
  });

  const questions: QuizQuestion[] = Array.isArray(data) ? data : data?.questions || [];

  if (isLoading) {
    return <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-primary-dark" /></div>;
  }

  return (
    <div className="space-y-3 p-4 bg-gray-50/50 border-t">
      {questions.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-2">No questions yet</p>
      ) : (
        questions.map((q, idx) => (
          <div key={q.name} className="bg-white border border-gray-200 rounded-lg p-3">
            <div className="flex items-start justify-between gap-2 mb-2">
              <div>
                <span className="text-xs text-gray-400 mr-2">Q{idx + 1}</span>
                <span className="text-sm font-medium text-dark">{q.question}</span>
                <span className="ml-2 text-xs text-gray-400">({q.question_type} | {q.marks} marks)</span>
              </div>
              <div className="flex shrink-0 gap-1">
                <button onClick={() => setEditingQuestion(q)} aria-label={`Edit question ${idx + 1}`} className="p-1 text-gray-400 hover:text-dark">
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => { if (confirm('Delete this question?')) deleteQMutation.mutate(q.name); }}
                  aria-label={`Delete question ${idx + 1}`}
                  className="p-1 text-red-400 hover:text-red-600"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-1">
              {q.options.map((opt, oi) => (
                <div key={oi} className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded ${opt.is_correct ? 'bg-green-50 text-green-700' : 'text-gray-500'}`}>
                  {opt.is_correct ? <CheckCircle className="w-3 h-3" /> : <Circle className="w-3 h-3" />}
                  {opt.option}
                </div>
              ))}
            </div>
          </div>
        ))
      )}
      <QuestionForm
        key={editingQuestion?.name || 'new'}
        quizName={quizName}
        initialQuestion={editingQuestion || undefined}
        onCancel={editingQuestion ? () => setEditingQuestion(null) : undefined}
        onAdded={() => {
          setEditingQuestion(null);
          queryClient.invalidateQueries({ queryKey: ['quiz-questions', quizName] });
        }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Quizzes Page
// ---------------------------------------------------------------------------
export default function Quizzes() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [expandedQuiz, setExpandedQuiz] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editQuiz, setEditQuiz] = useState<Partial<Quiz> | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Quiz | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-quizzes'],
    queryFn: () =>
      getQuizzes({
        fields: JSON.stringify(['name', 'title', 'course', 'max_attempts', 'passing_percentage', 'duration', 'enable_negative_marking', 'creation']),
        limit_page_length: 0,
        order_by: 'creation desc',
      }),
  });

  const { data: coursesData } = useQuery({
    queryKey: ['courses-list'],
    queryFn: () => getCourses({ fields: JSON.stringify(['name', 'title']), limit_page_length: 0 }),
  });

  const saveMutation = useMutation({
    mutationFn: (data: Record<string, any>) => {
      if (editQuiz?.name) {
        return updateQuiz(editQuiz.name, data);
      }
      return createQuiz(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-quizzes'] });
      setShowModal(false);
      setEditQuiz(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (name: string) => deleteQuiz(name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-quizzes'] });
      setDeleteTarget(null);
    },
  });

  const quizzes: Quiz[] = Array.isArray(data) ? data : data?.data || [];
  const courses = Array.isArray(coursesData) ? coursesData : coursesData?.data || [];

  const filtered = quizzes.filter((q) =>
    !search ||
    q.title.toLowerCase().includes(search.toLowerCase()) ||
    (q.course || '').toLowerCase().includes(search.toLowerCase()),
  );

  // Map course name to title for display
  const courseMap = new Map(courses.map((c: any) => [c.name, c.title || c.name]));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-bold text-dark">Quizzes</h1>
          <p className="text-sm text-gray-500 mt-1">{quizzes.length} quizzes</p>
        </div>
        <button
          onClick={() => { setEditQuiz(null); setShowModal(true); }}
          className="flex items-center gap-2 bg-dark text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-dark-light transition-colors self-start"
        >
          <Plus className="w-4 h-4" /> Create Quiz
        </button>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder="Search quizzes..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm"
        />
      </div>

      {/* Quiz List */}
      {isLoading ? (
        <div className="flex items-center justify-center h-40">
          <Loader2 className="w-6 h-6 animate-spin text-primary-dark" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-400">No quizzes found</div>
      ) : (
        <div className="space-y-2">
          {filtered.map((quiz) => (
            <div key={quiz.name} className="admin-card p-0 overflow-hidden">
              {/* Quiz header row */}
              <div className="flex items-center gap-3 p-4">
                <button onClick={() => setExpandedQuiz(expandedQuiz === quiz.name ? null : quiz.name)} className="shrink-0">
                  {expandedQuiz === quiz.name ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
                </button>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-medium text-dark">{quiz.title}</h3>
                  <p className="text-xs text-gray-400">{String(courseMap.get(quiz.course) || quiz.course || 'No course')}</p>
                </div>
                <div className="hidden sm:flex items-center gap-4 text-xs text-gray-500">
                  <span>Pass: {quiz.passing_percentage}%</span>
                  <span>Attempts: {quiz.max_attempts}</span>
                  {Number(quiz.duration) > 0 && <span>{quiz.duration} min</span>}
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => { setEditQuiz(quiz); setShowModal(true); }}
                    className="px-2 py-1 text-xs text-gray-500 hover:text-dark border border-gray-200 rounded"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => setDeleteTarget(quiz)}
                    className="p-1 text-red-400 hover:text-red-600"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Expanded questions */}
              {expandedQuiz === quiz.name && (
                <QuizQuestions quizName={quiz.name} />
              )}
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      <QuizModal
        open={showModal}
        quiz={editQuiz}
        courses={courses}
        onClose={() => { setShowModal(false); setEditQuiz(null); }}
        onSave={(data) => saveMutation.mutate(data)}
        saving={saveMutation.isPending}
      />

      {/* Delete Confirmation */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full mx-4 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <h3 className="font-heading font-semibold text-dark">Delete Quiz</h3>
              <button onClick={() => setDeleteTarget(null)} className="ml-auto text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <p className="text-sm text-gray-600 mb-6">
              Are you sure you want to delete <strong>{deleteTarget.title}</strong>? All questions will be removed.
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
