import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getQuiz, submitQuiz } from '@/api/client';
import { useAuth } from '@/context/AuthContext';
import type { Quiz as QuizType, QuizQuestion, QuizSubmission } from '@/types';
import { cn } from '@/lib/utils';
import {
  ChevronLeft,
  ChevronRight,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  Loader2,
  HelpCircle,
  ArrowLeft,
  Send,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Timer component
// ---------------------------------------------------------------------------

function CountdownTimer({
  seconds,
  onExpired,
}: {
  seconds: number;
  onExpired: () => void;
}) {
  const [remaining, setRemaining] = useState(seconds);
  const expiredRef = useRef(false);

  useEffect(() => {
    setRemaining(seconds);
    expiredRef.current = false;
  }, [seconds]);

  useEffect(() => {
    if (remaining <= 0) {
      if (!expiredRef.current) {
        expiredRef.current = true;
        onExpired();
      }
      return;
    }

    const timer = setInterval(() => {
      setRemaining((prev) => {
        const next = prev - 1;
        if (next <= 0) {
          clearInterval(timer);
        }
        return Math.max(0, next);
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [remaining, onExpired]);

  const minutes = Math.floor(remaining / 60);
  const secs = remaining % 60;
  const isLow = remaining <= 60;

  return (
    <div
      className={cn(
        'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-mono font-medium',
        isLow
          ? 'bg-red-50 text-red-600 animate-pulse'
          : 'bg-gray-100 text-gray-700'
      )}
    >
      <Clock className="w-4 h-4" />
      {String(minutes).padStart(2, '0')}:{String(secs).padStart(2, '0')}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Circular progress indicator for results
// ---------------------------------------------------------------------------

function ScoreCircle({ percentage, passed }: { percentage: number; passed: boolean }) {
  // Guard against non-finite values (e.g. missing/NaN score) so the ring and
  // label never render "NaN%".
  const pct = Number.isFinite(percentage) ? Math.max(0, Math.min(100, percentage)) : 0;
  const radius = 56;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (pct / 100) * circumference;
  const color = passed ? '#22C55E' : '#EF4444';

  return (
    <div className="relative w-36 h-36 mx-auto">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 128 128">
        <circle
          cx="64"
          cy="64"
          r={radius}
          fill="none"
          stroke="#E5E7EB"
          strokeWidth="8"
        />
        <circle
          cx="64"
          cy="64"
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-1000 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-bold text-dark">{Math.round(pct)}%</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Confirmation dialog
// ---------------------------------------------------------------------------

function ConfirmDialog({
  open,
  onConfirm,
  onCancel,
  title,
  message,
  isLoading,
}: {
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  title: string;
  message: string;
  isLoading?: boolean;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onCancel} />
      <div className="relative bg-white rounded-xl shadow-xl p-6 max-w-sm w-full mx-4">
        <h3 className="font-heading font-semibold text-dark text-lg mb-2">
          {title}
        </h3>
        <p className="text-sm text-gray-600 mb-5">{message}</p>
        <div className="flex items-center justify-end gap-3">
          <button
            onClick={onCancel}
            disabled={isLoading}
            className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className="flex items-center gap-2 px-4 py-2 bg-dark text-white rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
            Submit Quiz
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Option card
// ---------------------------------------------------------------------------

function OptionCard({
  option,
  selected,
  onToggle,
  type,
}: {
  option: string;
  selected: boolean;
  onToggle: () => void;
  type: 'Single Choice' | 'Multiple Choice';
}) {
  return (
    <button
      onClick={onToggle}
      className={cn(
        'w-full text-left px-4 py-3.5 rounded-xl border-2 transition-all duration-150',
        'flex items-start gap-3',
        selected
          ? 'border-primary bg-primary/5'
          : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
      )}
    >
      {/* Indicator */}
      <div className="flex-shrink-0 mt-0.5">
        {type === 'Single Choice' ? (
          <div
            className={cn(
              'w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors',
              selected ? 'border-primary' : 'border-gray-300'
            )}
          >
            {selected && (
              <div className="w-2.5 h-2.5 rounded-full bg-primary" />
            )}
          </div>
        ) : (
          <div
            className={cn(
              'w-5 h-5 rounded border-2 flex items-center justify-center transition-colors',
              selected
                ? 'border-primary bg-primary'
                : 'border-gray-300'
            )}
          >
            {selected && (
              <CheckCircle className="w-3.5 h-3.5 text-white" />
            )}
          </div>
        )}
      </div>

      {/* Option text */}
      <span
        className={cn(
          'text-sm leading-relaxed',
          selected ? 'text-dark font-medium' : 'text-gray-700'
        )}
      >
        {option}
      </span>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function QuizSkeleton() {
  return (
    <div className="min-h-screen bg-alabaster">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 animate-pulse">
        <div className="h-6 bg-gray-200 rounded w-48 mb-4" />
        <div className="h-2 bg-gray-200 rounded w-full mb-8" />
        <div className="bg-white rounded-xl p-6 space-y-4">
          <div className="h-5 bg-gray-200 rounded w-3/4" />
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-12 bg-gray-200 rounded-xl" />
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Quiz page
// ---------------------------------------------------------------------------

export default function Quiz() {
  const { quizId } = useParams<{ quizId: string }>();
  const { t } = useTranslation(['common', 'pages']);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  // =========================================================================
  // State
  // =========================================================================

  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});
  const [showConfirm, setShowConfirm] = useState(false);
  const [result, setResult] = useState<QuizSubmission | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // =========================================================================
  // Data fetching
  // =========================================================================

  const {
    data: quizData,
    isLoading: quizLoading,
    isError: quizError,
    error: quizFetchError,
  } = useQuery<QuizType>({
    queryKey: ['quiz', quizId],
    queryFn: () => getQuiz(quizId!) as Promise<QuizType>,
    enabled: !!quizId,
  });

  const quiz = quizData ?? null;
  const questions: QuizQuestion[] = quiz?.questions ?? [];
  const totalQuestions = questions.length;
  const question: QuizQuestion | null =
    currentQuestion < totalQuestions ? questions[currentQuestion] : null;

  // =========================================================================
  // Answer management
  // =========================================================================

  const setAnswer = useCallback(
    (questionName: string, value: string, type: 'Single Choice' | 'Multiple Choice') => {
      setAnswers((prev) => {
        const next = { ...prev };
        if (type === 'Single Choice') {
          next[questionName] = value;
        } else {
          // Multiple choice: toggle
          const current = (prev[questionName] as string[]) || [];
          if (current.includes(value)) {
            next[questionName] = current.filter((v) => v !== value);
          } else {
            next[questionName] = [...current, value];
          }
        }
        return next;
      });
    },
    []
  );

  const allAnswered = useMemo(() => {
    return questions.every((q) => {
      const answer = answers[q.name];
      if (!answer) return false;
      if (Array.isArray(answer)) return answer.length > 0;
      return answer.length > 0;
    });
  }, [questions, answers]);

  const answeredCount = useMemo(() => {
    return questions.filter((q) => {
      const answer = answers[q.name];
      if (!answer) return false;
      if (Array.isArray(answer)) return answer.length > 0;
      return answer.length > 0;
    }).length;
  }, [questions, answers]);

  // =========================================================================
  // Submit
  // =========================================================================

  const submitMutation = useMutation({
    mutationFn: () => {
      // Format answers for the API
      const formattedAnswers: Record<string, unknown> = {};
      for (const q of questions) {
        formattedAnswers[q.name] = answers[q.name] ?? (q.question_type === 'Multiple Choice' ? [] : '');
      }
      return submitQuiz(quizId!, formattedAnswers);
    },
    onSuccess: (data) => {
      const submission = data as QuizSubmission;
      setResult(submission);
      setShowConfirm(false);

      // Invalidate progress queries on pass
      if (submission.passed) {
        queryClient.invalidateQueries({ queryKey: ['progress'] });
        queryClient.invalidateQueries({ queryKey: ['learnChapters'] });
        queryClient.invalidateQueries({ queryKey: ['lesson'] });
      }
    },
    onError: (error: Error) => {
      setShowConfirm(false);
      const message = error.message || 'Failed to submit quiz. Please try again.';
      if (message.toLowerCase().includes('max attempts') || message.toLowerCase().includes('exceeded')) {
        setSubmitError('You have reached the maximum number of attempts for this quiz.');
      } else {
        setSubmitError(message);
      }
    },
  });

  const handleSubmit = useCallback(() => {
    setSubmitError(null);
    submitMutation.mutate();
  }, [submitMutation]);

  // Timer auto-submit
  const handleTimerExpired = useCallback(() => {
    if (!result && !submitMutation.isPending) {
      submitMutation.mutate();
    }
  }, [result, submitMutation]);

  // =========================================================================
  // Retry
  // =========================================================================

  const handleRetry = useCallback(() => {
    setResult(null);
    setAnswers({});
    setCurrentQuestion(0);
    setSubmitError(null);
    queryClient.invalidateQueries({ queryKey: ['quiz', quizId] });
  }, [quizId, queryClient]);

  // =========================================================================
  // Render guards
  // =========================================================================

  if (quizLoading) return <QuizSkeleton />;

  if (quizError || !quiz) {
    return (
      <div className="min-h-screen bg-alabaster flex items-center justify-center">
        <div className="text-center max-w-md mx-auto px-4">
          <AlertTriangle className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h2 className="font-heading text-xl font-semibold text-dark mb-2">
            Quiz not found
          </h2>
          <p className="text-gray-500 mb-6">
            {(quizFetchError as Error)?.message || 'Could not load this quiz.'}
          </p>
          <button
            onClick={() => navigate(-1)}
            className="px-5 py-2.5 bg-dark text-white rounded-lg hover:bg-primary/90 transition-colors text-sm font-medium"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  // =========================================================================
  // Results view
  // =========================================================================

  if (result) {
    const maxAttempts = quiz.max_attempts || 0;
    const attemptsUsed = result.attempt_number || 0;
    const attemptsRemaining =
      maxAttempts > 0 ? Math.max(0, maxAttempts - attemptsUsed) : -1; // -1 = unlimited

    // The backend (`submit_quiz`) returns the percentage in `score`; older code
    // expected `score_percentage`. Prefer whichever is finite so the score never
    // renders as "NaN%".
    const scorePct: number = Number.isFinite(result.score_percentage)
      ? (result.score_percentage as number)
      : Number.isFinite(result.score)
        ? result.score
        : 0;

    return (
      <div className="min-h-screen bg-alabaster">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
          {/* Back link */}
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-dark transition-colors mb-6"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Lesson
          </button>

          <div className="bg-white rounded-xl border border-gray-100 p-6 sm:p-10 text-center">
            {/* Score circle */}
            <ScoreCircle
              percentage={scorePct}
              passed={result.passed}
            />

            {/* Pass/Fail */}
            <div className="mt-5 mb-2">
              {result.passed ? (
                <div className="flex items-center justify-center gap-2 text-green-600">
                  <CheckCircle className="w-6 h-6" />
                  <span className="font-heading text-xl font-bold">Passed!</span>
                </div>
              ) : (
                <div className="flex items-center justify-center gap-2 text-red-500">
                  <XCircle className="w-6 h-6" />
                  <span className="font-heading text-xl font-bold">Not Passed</span>
                </div>
              )}
            </div>

            {/* Score details */}
            <div className="space-y-1 mb-6">
              <p className="text-sm text-gray-600">
                Your Score: <span className="font-semibold text-dark">{Math.round(scorePct)}%</span>
              </p>
              <p className="text-sm text-gray-600">
                Passing Score: <span className="font-semibold text-dark">{quiz.passing_percentage}%</span>
              </p>
              <p className="text-sm text-gray-600">
                Correct: <span className="font-semibold text-green-600">{result.correct_count}</span> / {result.total_questions}
              </p>
              {maxAttempts > 0 && (
                <p className="text-sm text-gray-600">
                  Attempts remaining:{' '}
                  <span className="font-semibold text-dark">
                    {attemptsRemaining}
                  </span>
                </p>
              )}
            </div>

            {/* Status messages */}
            {result.passed && (
              <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 mb-6">
                <p className="text-sm text-green-700 font-medium">
                  Lesson marked as complete!
                </p>
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              {result.passed ? (
                <button
                  onClick={() => navigate(-1)}
                  className="px-6 py-2.5 bg-dark text-white rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
                >
                  Continue Learning
                </button>
              ) : attemptsRemaining !== 0 ? (
                <button
                  onClick={handleRetry}
                  className="px-6 py-2.5 bg-dark text-white rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
                >
                  Retry Quiz
                </button>
              ) : (
                <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3">
                  <p className="text-sm text-red-700">
                    No attempts remaining. Please contact support for assistance.
                  </p>
                </div>
              )}

              <button
                onClick={() => navigate(-1)}
                className="px-6 py-2.5 border border-gray-200 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
              >
                Back to Lesson
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // Quiz-taking view
  // =========================================================================

  const currentAnswer = question ? answers[question.name] : undefined;

  return (
    <div className="min-h-screen bg-alabaster">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-6">
          <div className="min-w-0">
            <button
              onClick={() => navigate(-1)}
              className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-dark transition-colors mb-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Lesson
            </button>
            <h1 className="font-heading text-xl sm:text-2xl font-bold text-dark truncate">
              {quiz.title}
            </h1>
            {quiz.max_attempts > 0 && (
              <p className="text-sm text-gray-500 mt-1">
                Max {quiz.max_attempts} attempt{quiz.max_attempts !== 1 ? 's' : ''}
              </p>
            )}
          </div>

          {/* Timer */}
          {quiz.time_limit > 0 && (
            <CountdownTimer
              seconds={quiz.time_limit * 60}
              onExpired={handleTimerExpired}
            />
          )}
        </div>

        {/* Progress bar */}
        <div className="mb-6">
          <div className="flex items-center justify-between text-sm text-gray-500 mb-2">
            <span>
              Question {currentQuestion + 1} of {totalQuestions}
            </span>
            <span>
              {answeredCount} answered
            </span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-2">
            <div
              className="bg-primary h-2 rounded-full transition-all duration-300"
              style={{
                width: `${((currentQuestion + 1) / Math.max(totalQuestions, 1)) * 100}%`,
              }}
            />
          </div>
        </div>

        {/* Submit error */}
        {submitError && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-6">
            <p className="text-sm text-red-700 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              {submitError}
            </p>
          </div>
        )}

        {/* Question card */}
        {question && (
          <div className="bg-white rounded-xl border border-gray-100 p-5 sm:p-8 mb-6">
            {/* Question header */}
            <div className="flex items-start gap-3 mb-6">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                <span className="text-sm font-semibold text-primary">
                  {currentQuestion + 1}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-base sm:text-lg font-medium text-dark leading-relaxed">
                  {question.question}
                </p>
                <p className="text-xs text-gray-400 mt-1.5">
                  {question.question_type === 'Multiple Choice'
                    ? 'Select all that apply'
                    : 'Select one answer'}
                  {question.marks > 0 && (
                    <span className="ml-2">
                      ({question.marks} mark{question.marks !== 1 ? 's' : ''})
                    </span>
                  )}
                </p>
              </div>
            </div>

            {/* Options */}
            <div className="space-y-3">
              {question.options.map((opt, idx) => {
                const isSelected =
                  question.question_type === 'Single Choice'
                    ? currentAnswer === opt.option
                    : Array.isArray(currentAnswer) && currentAnswer.includes(opt.option);

                return (
                  <OptionCard
                    key={`${question.name}-${idx}`}
                    option={opt.option}
                    selected={isSelected}
                    type={question.question_type}
                    onToggle={() =>
                      setAnswer(question.name, opt.option, question.question_type)
                    }
                  />
                );
              })}
            </div>
          </div>
        )}

        {/* Question dots (jump navigation) */}
        <div className="flex items-center justify-center gap-2 flex-wrap mb-6">
          {questions.map((q, idx) => {
            const isAnswered = (() => {
              const a = answers[q.name];
              if (!a) return false;
              if (Array.isArray(a)) return a.length > 0;
              return a.length > 0;
            })();
            const isCurrent = idx === currentQuestion;

            return (
              <button
                key={q.name}
                onClick={() => setCurrentQuestion(idx)}
                className={cn(
                  'w-8 h-8 rounded-full text-xs font-medium transition-all',
                  isCurrent
                    ? 'bg-dark text-white scale-110'
                    : isAnswered
                      ? 'bg-green-100 text-green-700 hover:bg-green-200'
                      : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                )}
                title={`Question ${idx + 1}`}
              >
                {idx + 1}
              </button>
            );
          })}
        </div>

        {/* Bottom navigation */}
        <div className="flex items-center justify-between gap-4">
          {/* Previous question */}
          <button
            onClick={() => setCurrentQuestion((prev) => Math.max(0, prev - 1))}
            disabled={currentQuestion === 0}
            className="flex items-center gap-2 px-4 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="w-4 h-4" />
            Previous
          </button>

          {/* Submit or Next */}
          {currentQuestion === totalQuestions - 1 ? (
            <button
              onClick={() => setShowConfirm(true)}
              disabled={!allAnswered || submitMutation.isPending}
              className="flex items-center gap-2 px-5 py-2.5 bg-dark text-white rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {submitMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              Submit Quiz
            </button>
          ) : (
            <button
              onClick={() =>
                setCurrentQuestion((prev) => Math.min(totalQuestions - 1, prev + 1))
              }
              disabled={currentQuestion >= totalQuestions - 1}
              className="flex items-center gap-2 px-4 py-2.5 bg-dark text-white rounded-lg text-sm font-medium hover:bg-dark/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Next
              <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Not all answered hint */}
        {currentQuestion === totalQuestions - 1 && !allAnswered && (
          <p className="text-center text-xs text-gray-400 mt-3 flex items-center justify-center gap-1.5">
            <HelpCircle className="w-3.5 h-3.5" />
            Answer all questions to enable submission ({answeredCount}/{totalQuestions} answered)
          </p>
        )}
      </div>

      {/* Confirmation dialog */}
      <ConfirmDialog
        open={showConfirm}
        title="Submit Quiz?"
        message={`You are about to submit your answers for ${totalQuestions} questions. This action cannot be undone.`}
        onConfirm={handleSubmit}
        onCancel={() => setShowConfirm(false)}
        isLoading={submitMutation.isPending}
      />
    </div>
  );
}
