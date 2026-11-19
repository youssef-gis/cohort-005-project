import { renderToStaticMarkup } from "react-dom/server";
import { createMemoryRouter, RouterProvider } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LessonNote } from "../editor";

const fetcherOverrides = vi.hoisted(() => ({
  state: undefined as "submitting" | undefined,
  data: undefined as { ok: false; error: string } | undefined,
}));

vi.mock(import("react-router"), async (importOriginal) => {
  const router = await importOriginal();
  return {
    ...router,
    useFetcher: ((options) => {
      const fetcher = router.useFetcher(options);
      return {
        ...fetcher,
        state: fetcherOverrides.state ?? fetcher.state,
        data: fetcherOverrides.data ?? fetcher.data,
      };
    }) as typeof router.useFetcher,
  };
});

afterEach(() => {
  fetcherOverrides.state = undefined;
  fetcherOverrides.data = undefined;
});

function renderEditor(note: Parameters<typeof LessonNote>[0]["note"]) {
  const router = createMemoryRouter([
    { path: "/", element: <LessonNote note={note} /> },
  ]);
  return renderToStaticMarkup(<RouterProvider router={router} />);
}

describe("LessonNote", () => {
  it("labels the editor, keeps the privacy notice visible and submits a private note", () => {
    const html = renderEditor(null);
    const headingId = html.match(/<h2 id="([^"]+)"/)?.[1];
    const privacyId = html.match(/<p id="([^"]+)"/)?.[1];

    expect(headingId).toBeDefined();
    expect(privacyId).toBeDefined();
    expect(html).toContain("Only you can read this.");
    expect(html).toMatch(
      new RegExp(
        `<textarea[^>]+aria-labelledby="${headingId}"[^>]+aria-describedby="${privacyId}"`
      )
    );
    expect(html).toMatch(/<form[^>]+method="post"/);
    expect(html).toContain('name="intent" value="save-note"');
    expect(html).toContain(">Save note</button>");
    expect(html).not.toContain('role="alert"');
    expect(html).not.toContain("Last edited");
  });

  it("prefills the saved note and shows its last edit status", () => {
    const html = renderEditor({
      body: "Use <T> for a type parameter.",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });

    expect(html).toMatch(
      /<textarea[^>]+name="body"[^>]*>Use &lt;T&gt; for a type parameter\.<\/textarea>/
    );
    expect(html).toContain("Last edited");
  });

  it("disables saving while a note submission is in progress", () => {
    fetcherOverrides.state = "submitting";

    expect(renderEditor(null)).toMatch(
      /<button[^>]+disabled="">Saving\.\.\.<\/button>/
    );
  });

  it("announces a save error in place of the last edit status", () => {
    fetcherOverrides.data = { ok: false, error: "Write something first." };

    const html = renderEditor({
      body: "Existing note",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });

    const errorId = html.match(
      /<span id="([^"]+)" role="alert"[^>]*>Write something first\.<\/span>/
    )?.[1];
    const privacyId = html.match(/<p id="([^"]+)"/)?.[1];

    expect(errorId).toBeDefined();
    expect(html).toContain(`aria-describedby="${privacyId} ${errorId}"`);
    expect(html).toContain('aria-invalid="true"');
    expect(html).not.toContain("Last edited");
  });
});
