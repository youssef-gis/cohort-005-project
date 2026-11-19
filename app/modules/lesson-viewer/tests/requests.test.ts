import { beforeEach, describe, expect, it, vi } from "vitest";
import { sql } from "drizzle-orm";
import * as schema from "~/db/schema";
import { setCurrentUserId } from "~/lib/session";
import { createTestDb, seedBaseData, type TestDb } from "~/test/setup";
import { actOnLesson, loadLesson } from "../index.server";

let db: TestDb;
let base: ReturnType<typeof seedBaseData>;
let params: { slug: string; lessonId: string };

vi.mock("~/db", () => ({
  db: new Proxy({} as TestDb, {
    get(_target, key) {
      const value = Reflect.get(db, key);
      return typeof value === "function" ? value.bind(db) : value;
    },
  }),
}));

beforeEach(() => {
  db = createTestDb();
  base = seedBaseData(db);
  db.insert(schema.enrollments)
    .values({ userId: base.user.id, courseId: base.course.id })
    .run();
  const module = db
    .insert(schema.modules)
    .values({ courseId: base.course.id, title: "Basics", position: 1 })
    .returning()
    .get();
  const lesson = db
    .insert(schema.lessons)
    .values({ moduleId: module.id, title: "Basics", position: 1 })
    .returning()
    .get();
  params = { slug: base.course.slug, lessonId: String(lesson.id) };
});

async function makeRequest(
  fields?: Record<string, string>,
  userId = base.user.id
) {
  const url = `http://localhost/courses/${params.slug}/lessons/${params.lessonId}`;
  const cookie = await setCurrentUserId(new Request(url), userId);
  const headers = { Cookie: cookie.split(";")[0] };
  const request = fields
    ? new Request(url, {
        method: "POST",
        headers,
        body: new URLSearchParams(fields),
      })
    : new Request(url, { headers });
  return { params, request };
}

function addQuiz() {
  const quiz = db
    .insert(schema.quizzes)
    .values({
      lessonId: Number(params.lessonId),
      title: "Basics",
      passingScore: 0.7,
    })
    .returning()
    .get();
  const question = db
    .insert(schema.quizQuestions)
    .values({
      quizId: quiz.id,
      questionText: "TypeScript checks types?",
      questionType: schema.QuestionType.TrueFalse,
      position: 1,
    })
    .returning()
    .get();
  const option = db
    .insert(schema.quizOptions)
    .values({ questionId: question.id, optionText: "True", isCorrect: true })
    .returning()
    .get();
  return {
    intent: "submit-quiz",
    quizId: String(quiz.id),
    [`question-${question.id}`]: String(option.id),
  };
}

describe("lesson requests", () => {
  it("gives the editor a field error when the note body is missing", async () => {
    const result = await actOnLesson(
      await makeRequest({ intent: "save-note" })
    );
    expect(result).toMatchObject({
      init: { status: 400 },
      data: { ok: false, error: "Write something before saving your note." },
    });
  });

  it("loads the saved note only for its author", async () => {
    const result = await actOnLesson(
      await makeRequest({ intent: "save-note", body: "  Private note  " })
    );
    expect(result).toEqual({ ok: true });
    expect(await loadLesson(await makeRequest())).toMatchObject({
      note: { body: "Private note" },
    });
    expect(
      await loadLesson(await makeRequest(undefined, base.instructor.id))
    ).toMatchObject({
      note: null,
    });
  });

  it("rejects a quiz form without an ID", async () => {
    const request = await makeRequest({ intent: "submit-quiz" });
    await expect(actOnLesson(request)).rejects.toMatchObject({
      init: { status: 400 },
    });
  });

  it("returns not found for a quiz that no longer exists", async () => {
    const request = await makeRequest({ intent: "submit-quiz", quizId: "1" });
    await expect(actOnLesson(request)).rejects.toMatchObject({
      init: { status: 404 },
    });
  });

  it("scores a submission and persists its answers", async () => {
    const result = await actOnLesson(await makeRequest(addQuiz()));
    expect(result).toMatchObject({
      quizResult: {
        score: 1,
        passed: true,
        totalQuestions: 1,
        questionResults: [{ correct: true }],
      },
    });
    expect(db.select().from(schema.quizAnswers).all()).toHaveLength(1);
  });

  it("rolls back the attempt if recording an answer fails", async () => {
    const submission = addQuiz();
    db.run(sql`CREATE TRIGGER fail_answer BEFORE INSERT ON quiz_answers
      BEGIN SELECT RAISE(ABORT, 'test write failure'); END`);
    await expect(actOnLesson(await makeRequest(submission))).rejects.toThrow();
    expect(db.select().from(schema.quizAttempts).all()).toEqual([]);
  });
});
