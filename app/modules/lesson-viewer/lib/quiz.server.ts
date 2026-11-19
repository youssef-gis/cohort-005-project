import { db } from "~/db";
import {
  quizzes,
  quizQuestions,
  quizOptions,
  quizAttempts,
  quizAnswers,
  QuestionType,
} from "~/db/schema";
import { and, asc, desc, eq } from "drizzle-orm";

export function getQuizByLessonId(lessonId: number) {
  return db.select().from(quizzes).where(eq(quizzes.lessonId, lessonId)).get();
}

export function findLessonQuiz(lessonId: number, quizId: number) {
  return db
    .select({ id: quizzes.id })
    .from(quizzes)
    .where(and(eq(quizzes.id, quizId), eq(quizzes.lessonId, lessonId)))
    .get();
}

export function getQuizWithQuestions(quizId: number) {
  const quiz = db.select().from(quizzes).where(eq(quizzes.id, quizId)).get();
  if (!quiz) return null;

  const questionsWithOptions = getQuestionsWithOptions(quizId);

  return { ...quiz, questions: questionsWithOptions };
}

function getQuestionsWithOptions(quizId: number) {
  const rows = db
    .select({ question: quizQuestions, option: quizOptions })
    .from(quizQuestions)
    .leftJoin(quizOptions, eq(quizOptions.questionId, quizQuestions.id))
    .where(eq(quizQuestions.quizId, quizId))
    .orderBy(
      asc(quizQuestions.position),
      asc(quizQuestions.id),
      asc(quizOptions.id)
    )
    .all();

  const questions = new Map<
    number,
    typeof quizQuestions.$inferSelect & {
      options: (typeof quizOptions.$inferSelect)[];
    }
  >();
  for (const { question, option } of rows) {
    const grouped = questions.get(question.id) ?? { ...question, options: [] };
    if (option) grouped.options.push(option);
    questions.set(question.id, grouped);
  }

  return [...questions.values()];
}

export function getBestAttempt(userId: number, quizId: number) {
  return db
    .select()
    .from(quizAttempts)
    .where(
      and(eq(quizAttempts.userId, userId), eq(quizAttempts.quizId, quizId))
    )
    .orderBy(desc(quizAttempts.score))
    .limit(1)
    .get();
}

function calculateGrade(score: number): string {
  if (score >= 0.9) return "A";
  if (score >= 0.8) return "B";
  if (score >= 0.7) return "C";
  if (score >= 0.6) return "D";
  return "F";
}

type QuestionResult = {
  questionId: number;
  correct: boolean;
  selectedOptionId: number | null;
  correctOptionId: number | null;
};

export function computeResult(
  userId: number,
  quizId: number,
  selectedAnswers: Record<number, number>
) {
  const questions = getQuestionsWithOptions(quizId);
  const questionResults = questions.map((question): QuestionResult => {
    const selected = selectedAnswers[question.id] ?? null;
    const canScore =
      question.questionType === QuestionType.MultipleChoice ||
      question.questionType === QuestionType.TrueFalse;
    const correctOptionId =
      selected !== null && canScore
        ? (question.options.find((option) => option.isCorrect)?.id ?? null)
        : null;

    return {
      questionId: question.id,
      correct: selected !== null && selected === correctOptionId,
      selectedOptionId: selected,
      correctOptionId,
    };
  });
  const totalCorrect = questionResults.filter(
    (result) => result.correct
  ).length;
  const totalQuestions = questions.length;
  const score = totalQuestions > 0 ? totalCorrect / totalQuestions : 0;
  const passed = score > 0.7;
  const attemptId = recordAttempt(
    { userId, quizId, score, passed },
    questionResults
  );

  return {
    attemptId,
    score,
    passed,
    grade: calculateGrade(score),
    totalCorrect,
    totalQuestions,
    questionResults,
  };
}

function recordAttempt(
  values: typeof quizAttempts.$inferInsert,
  results: QuestionResult[]
) {
  return db.transaction((tx) => {
    const attempt = tx.insert(quizAttempts).values(values).returning().get();

    for (const result of results) {
      if (result.selectedOptionId !== null) {
        tx.insert(quizAnswers)
          .values({
            attemptId: attempt.id,
            questionId: result.questionId,
            selectedOptionId: result.selectedOptionId,
          })
          .run();
      }
    }

    return attempt.id;
  });
}
