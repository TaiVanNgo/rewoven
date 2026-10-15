# Understanding loading states and skeletons

A skeleton is a temporary outline of content that has not arrived yet. For example, when you open Case library, you see the shapes of case cards and a source panel while Rewoven fetches the actual cases. The real content replaces those shapes when the request finishes.

The placeholders use the existing Rewoven colors, spacing, and responsive layouts. There are no extra dependencies or artificial delays in the application.

## Where skeletons appear

| Situation                                     | What you see                                                                                                                      |
| --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Opening the library before its first result   | Case-card placeholders beside a case summary and source-panel placeholder.                                                        |
| Selecting another case                        | A detail/source placeholder; the case list remains usable.                                                                        |
| Typing a search                               | Case-list placeholders while the new results are pending. The selected case stays visible until the result changes the selection. |
| A processing case refreshes in the background | Existing content remains visible, without flashing back to placeholders.                                                          |
| Navigating to a workspace page                | A route fallback shaped like that page, when Next.js needs it.                                                                    |

The New request route fallback resembles its form, constraints, Wren panel, and sample cards. Saved plans still has an empty-state preview, so its fallback matches that frame rather than suggesting that saved-plan functionality exists.

Adding a case and retrying processing keep their existing disabled controls, progress text, and spinner. Those actions already have visible context; replacing the form with a skeleton would hide useful information.

## Two different kinds of waiting

### Waiting for a route

Next.js recognizes a file called `loading.tsx` and uses it as a **Suspense fallback**. A fallback is temporary content displayed while a section of the page is not ready.

The implementation adds these route files:

- [New request fallback](<../../src/app/(workspace)/loading.tsx>)
- [Case library fallback](<../../src/app/(workspace)/case-library/loading.tsx>)
- [Saved plans fallback](<../../src/app/(workspace)/saved-plans/loading.tsx>)

These fallbacks render inside the existing workspace layout. The sidebar stays available, so a pending page does not block navigation.

Fast or prefetched routes may finish without displaying a fallback. Rewoven does not delay them just to show an animation.

### Waiting for browser data

Case library loads its data in a Client Component after the page has rendered. A route's `loading.tsx` does not automatically wait for those browser requests.

That is why [case-library.tsx](../../src/features/cases/case-library.tsx) also chooses a skeleton explicitly:

1. Before the first successful case list, show the full library skeleton.
2. When the text in the search box differs from the last completed query, show the list skeleton.
3. When the selected case's details have not arrived, show the detail skeleton.
4. When a request fails or returns an empty list, replace the skeleton with the appropriate error or empty state.

Requests cancelled by newer searches cannot overwrite the newer results. Detail errors belong to the selected case and offer a retry, instead of leaving its loading placeholder indefinitely.

Processing-status polling waits until current list/detail requests finish, then waits two seconds before refreshing. This prevents a slow request from being cancelled repeatedly by the next polling tick. A background refresh keeps data that is already on screen.

## The reusable components

[The Skeleton component](../../src/components/ui/skeleton.tsx) supplies a single decorative block. Its shape comes from layout classes:

```tsx
<Skeleton className="h-4 w-32" />
<Skeleton className="h-11 w-full rounded-control" />
```

`h-4 w-32` makes a short text-like bar. `h-11 w-full` reserves the space of a full-width control. The component supplies the color and pulse animation consistently across the app.

`SkeletonGroup` combines related placeholders and provides one loading announcement:

```tsx
import { Skeleton, SkeletonGroup } from "@/components/ui/skeleton";

export function ExampleLoading() {
  return (
    <SkeletonGroup label="Loading project details…">
      <div className="flex flex-col gap-3">
        <Skeleton className="h-7 w-2/3" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-4/5" />
      </div>
    </SkeletonGroup>
  );
}
```

The status announcement sits outside the busy placeholder container. The visual blocks are hidden from screen readers, have no focusable controls, and use a foreground-based tint that remains visible on both light and dark panels. With reduced motion enabled, the pulse animation stops.

The larger shapes are composed in these files:

| File                                                                                | Responsibility                                                        |
| ----------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| [page-header-skeleton.tsx](../../src/components/workspace/page-header-skeleton.tsx) | The header's section label, title, description, and control outlines. |
| [case-skeleton.tsx](../../src/features/cases/case-skeleton.tsx)                     | Full library, case list, and detail/source placeholders.              |
| [request-skeleton.tsx](../../src/features/requests/request-skeleton.tsx)            | The request form, companion panel, and sample cards.                  |

Keep a skeleton close to the layout of the content it replaces. When a page's structure changes, update its placeholder too.

## Try it locally

With the [database setup](../../README.md#quick-start) already completed:

```bash
bun run devx
```

Open [Case library](http://localhost:3000/case-library), using the printed port if different. In your browser's Network tools, enable a slow connection and disable the cache, then reload.

You should see the full library placeholder, then real case cards, then the selected case's details. Select another case and type a search to inspect the smaller loading states. Repeat in dark mode and with your device's reduced-motion preference enabled. Remove network throttling afterward.

Stop Next.js with Ctrl+C. If Supabase is already running, `bun run dev` starts only Next.js. For a production check, build first:

```bash
bun run build
bun run start --port 3002
```

Then open [the production-mode library](http://localhost:3002/case-library).

## What was verified

- Formatting, lint, TypeScript checking, production compilation, and the eight existing unit tests passed.
- Delayed browser responses verified initial loading, case selection, searching, empty results, detail errors, retry, and rapid query changes.
- Production-mode checks used requests lasting three seconds to confirm that polling waits and loaded content remains visible. A simulated session failure also ended loading correctly and stayed visible when the search text changed.
- The three route fallback components were rendered as isolated previews for visual checks. Each had one accessible status announcement, no fake buttons, no horizontal overflow at 390px, and no pulse animation under reduced motion. Desktop/light and mobile/dark previews were inspected.

Network delays and simulated failures were confined to browser verification. No preview route, test delay, or skeleton toggle was added to the public application. Cached route transitions can be too fast to show their fallback naturally. A full screen-reader audit and hosted deployment verification were not performed.
