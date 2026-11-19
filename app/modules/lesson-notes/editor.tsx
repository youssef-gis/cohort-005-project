import { useId } from "react";
import { useFetcher } from "react-router";
import { LockKeyhole, NotebookPen } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Textarea } from "~/components/ui/textarea";
import { formatRelativeTime } from "~/lib/utils";

export function LessonNote({
  note,
}: {
  note: { body: string; updatedAt: string } | null;
}) {
  const headingId = useId();
  const privacyId = useId();
  const errorId = useId();
  const fetcher = useFetcher<{ ok: boolean; error?: string }>();
  const isSaving = fetcher.state !== "idle";
  const error = fetcher.data?.error;

  return (
    <section aria-labelledby={headingId} className="space-y-4 p-4 sm:p-6">
      <NoteHeading headingId={headingId} privacyId={privacyId} />

      <fetcher.Form method="post" className="space-y-3">
        <input type="hidden" name="intent" value="save-note" />
        <Textarea
          name="body"
          rows={4}
          defaultValue={note?.body ?? ""}
          aria-labelledby={headingId}
          aria-describedby={error ? `${privacyId} ${errorId}` : privacyId}
          aria-invalid={error ? true : undefined}
          placeholder="Write a note for this lesson…"
          className="resize-y bg-background"
        />
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <Button type="submit" size="sm" disabled={isSaving}>
            {isSaving ? "Saving..." : "Save note"}
          </Button>
          <NoteSaveStatus
            error={error}
            errorId={errorId}
            updatedAt={note?.updatedAt}
          />
        </div>
      </fetcher.Form>
    </section>
  );
}

function NoteSaveStatus({
  error,
  errorId,
  updatedAt,
}: {
  error?: string;
  errorId: string;
  updatedAt?: string;
}) {
  if (error) {
    return (
      <span id={errorId} role="alert" className="text-sm text-destructive">
        {error}
      </span>
    );
  }

  if (!updatedAt) return null;

  return (
    <output suppressHydrationWarning className="text-xs text-muted-foreground">
      Last edited {formatRelativeTime(updatedAt)}
    </output>
  );
}

function NoteHeading({
  headingId,
  privacyId,
}: {
  headingId: string;
  privacyId: string;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
      <h2
        id={headingId}
        className="flex items-center gap-2 text-xl font-semibold"
      >
        <NotebookPen aria-hidden="true" className="size-5 text-primary" />
        Your notes
      </h2>
      <p
        id={privacyId}
        className="flex items-center gap-1.5 text-sm text-muted-foreground"
      >
        <LockKeyhole aria-hidden="true" className="size-3.5" />
        Only you can read this.
      </p>
    </div>
  );
}
