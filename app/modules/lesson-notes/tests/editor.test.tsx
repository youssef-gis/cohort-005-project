import { renderToStaticMarkup } from "react-dom/server";
import { createMemoryRouter, RouterProvider } from "react-router";
import { describe, expect, it } from "vitest";
import { LessonNote } from "../editor";

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
});
