# Wren's query transition

Wren's search stage reuses the original `/images/wren.png` illustration. A three-second decorative loop shuffles three small documents above her folder, with teal threads, expanding search rings, and a lime highlight. These shapes do not report actual matches, filenames, confidence, or backend progress.

## Animation pieces

`src/features/requests/wren-companion.tsx` contains the existing homepage portrait and introduction. Its optional image ref lets the query controller measure the portrait before hiding it; the portrait's space stays reserved while Wren travels.

`src/features/queries/wren-search-stage.tsx` renders a temporary fixed overlay. Its `transition` prop supplies the source rectangle and a phase: `searching`, `exiting`, or `returning`. Motion handles travel and fades; scoped CSS and SVG handle the decorative loop. Nothing runs until the stage mounts. The existing Motion provider and the CSS media query respect reduced motion.

`wren-geometry.ts` centers the stage within the visible part of the main workspace, excluding the desktop sidebar. It leaves room for a loading message, caps the image at 440px, and fits small screens. Resize, workspace-size changes, and scroll recalculate the destination. An offscreen portrait uses a centered fade rather than flying in from below the page.

Movement takes 650ms. The minimum normal-motion presentation is 1.2 seconds from submission; the exit takes 300ms. A failed creation can return to the portrait in 350ms. Reduced motion uses static art, immediate transitions, and no minimum hold.

The artwork has its original pale background. It is deliberately preserved rather than replaced with a remote image or regenerated character. The reference's card styling is adapted to the actual folder position in this artwork.

## Verify the pieces

From this worktree, install the recorded dependencies with `bun install --frozen-lockfile`. Run `bun test tests/wren-geometry.test.ts` for viewport fitting, sidebar-aware centering, offscreen origins, and presentation timing. The animation itself requires browser inspection; geometry tests do not establish visual quality or request-flow behavior.
