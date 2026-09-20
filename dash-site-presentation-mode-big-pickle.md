# Big Pickle Implementation Prompt --- Dash-site Presentation / Slideshow Mode

Repository: `vcharyanaco-tech/dash-site`

## Objective

Implement a production-ready **Presentation / Slideshow Mode** for the
existing India Post dashboard without breaking any existing
functionality.

The feature is for screen sharing, meetings, projection, and executive
walkthroughs.

## Existing architecture constraints

Before changing anything:

1.  Inspect the existing repository and understand the current dashboard
    implementation.
2.  Preserve the current application architecture.
3.  Do **not** rewrite the dashboard from scratch.
4.  Do not remove or regress existing dashboard features.
5.  The project has a generated `app.js` assembled from modules under
    `src/app`; respect the existing build/split workflow.
6.  Prefer an additive implementation that can be disabled/removed
    cleanly.
7.  Keep existing authentication, permissions, API contracts,
    submissions, review workflow, link preview, PWA behavior, and normal
    dashboard rendering intact.
8.  Run the existing tests/build/syntax checks after implementation.

## Feature requirements

### 1. Presentation Mode entry

Add a clearly visible **Presentation Mode** button to the normal
dashboard.

Also support:

-   `Ctrl + Shift + P` on Windows/Linux
-   `Cmd + Shift + P` on macOS

The normal dashboard must remain unchanged when Presentation Mode is not
active.

### 2. Full-screen presentation

When Presentation Mode opens:

-   Take over the viewport.
-   Hide the normal dashboard chrome/navigation/sidebar.
-   Show one dashboard record/card at a time.
-   The card should feel like a polished presentation slide.
-   Use the existing dashboard card data and rendering semantics rather
    than duplicating business logic.
-   Keep the design professional, eye-catching, readable, and
    comfortable for long screen-sharing sessions.
-   Make excellent use of large screens and projectors.
-   Maintain responsive behavior on phones/tablets.

### 3. Horizontal slideshow navigation

Cards must behave like horizontal slides.

Support all of:

-   Left/right keyboard arrows
-   Page Up/Page Down
-   On-screen left/right navigation buttons positioned near the screen
    edges
-   Touch swipe left/right
-   Escape to exit

Navigation should wrap from the last slide to the first and vice versa,
unless the existing UX conventions strongly suggest otherwise.

Show a small position indicator such as:

`7 / 42`

### 4. Presentation controls

Inside Presentation Mode, expose **only these record actions**:

1.  **Show/Hide Submissions**
2.  **Mark as Completed**

Do not expose the normal dashboard action toolbar such as:

-   Edit
-   Delete
-   Print
-   AI Insight
-   Analyze Link
-   Display toggle
-   Other administrative actions

Do not create a second competing implementation of the underlying
operations.

Use the existing application functions/API semantics.

### 5. Completion semantics

The existing dashboard already has a review completion workflow.

Inspect and reuse the existing:

-   `markReviewDone`
-   `markReviewNotDone`
-   `ApiService.markReviewDone`
-   `reviewStatus`

For Presentation Mode, **Mark as Completed** should map to the existing
review-completion semantics rather than inventing a new backend status.

If the record is already completed:

-   Show `Completed`
-   Disable the completion button or otherwise make its state obvious.

After completion:

-   Update the visible slide immediately.
-   Do not force a full page reload.
-   Preserve the current slideshow position.
-   Preserve the rest of the dashboard state.

### 6. Show/Hide Submissions

Reuse the existing submission/update rendering and toggle state.

The Presentation Mode control should display:

-   `Hide submissions` when submissions are visible
-   `Show submissions` when submissions are hidden

Do not create a second submission data model.

The existing per-record submission visibility state should remain
authoritative.

### 7. Links

Dashboard cards can contain links.

In Presentation Mode:

-   Preserve clickable links.
-   Clicking a link must open it using the **same existing
    popup/link-preview mechanism** used by the normal dashboard.
-   Do not create a visually unrelated link popup.
-   Reuse existing preview behavior whenever possible.

The existing preview already has an 80% zoom UI. Presentation Mode
should open previews at **80% by default**.

### 8. Link preloading / buffering

Before a user reaches a card, preload/warm relevant links in the
background.

At minimum:

-   Current card
-   Next card
-   Next-next card

When practical, also warm the previous card.

Use safe browser-native mechanisms:

-   fetch/cache where permitted
-   Cache API/service worker where appropriate
-   preconnect where useful
-   iframe/resource warming where technically allowed

Do not cause a large burst of requests.

Add sensible:

-   concurrency limits
-   timeouts
-   deduplication
-   cancellation/abort behavior

### Important technical limitation

Do **not** promise impossible behavior.

Cross-origin sites may:

-   block iframe embedding with `X-Frame-Options`
-   block embedding with CSP `frame-ancestors`
-   reject CORS requests
-   require authentication
-   prevent meaningful prefetching

For such links:

-   use the existing popup behavior
-   display the existing fallback/open-in-new-tab message
-   never break the slideshow

The goal is to make previews feel instant whenever browser/server
policies allow it, not to bypass cross-origin security.

### 9. Popup performance

When a user opens a link:

-   Reuse the existing preview modal.
-   Default zoom must be 80%.
-   Do not recreate the entire modal implementation.
-   If a link was successfully warmed/cached, use the warmed resource
    where browser security permits.
-   If it cannot be prefetched, open normally without delaying the UI.

The popup should appear immediately, with loading state handled inside
the existing preview UI.

### 10. Keyboard safety

Keyboard handlers must only intercept slideshow navigation while
Presentation Mode is active.

Do not interfere with:

-   normal dashboard keyboard shortcuts
-   typing in inputs
-   modal interactions
-   command palette
-   existing Escape behavior

Escape should close Presentation Mode first when it is active.

### 11. Touch behavior

Support:

-   swipe left → next
-   swipe right → previous

Avoid accidental navigation when:

-   the user is scrolling within a long card
-   the user interacts with buttons
-   the user interacts with an iframe/link preview

Use a sensible horizontal-distance threshold.

### 12. Accessibility

Include:

-   semantic dialog/region
-   accessible labels for navigation buttons
-   visible keyboard focus
-   sufficient contrast
-   `aria-label` / `aria-live` where appropriate
-   buttons must be real `<button>` elements
-   Escape must always provide an exit path

### 13. Responsive design

Desktop:

-   Large presentation card
-   Large typography
-   Edge navigation
-   Comfortable spacing

Tablet:

-   Adjust card dimensions and typography.

Mobile:

-   Keep controls reachable.
-   Navigation buttons must not cover important content.
-   Support swipe.
-   Avoid horizontal page scrolling outside the intended slide
    interaction.

### 14. Existing link preview integration

Inspect the existing implementation for:

-   `previewModal`
-   `previewFrame`
-   `openLinkPreview`
-   `closeLinkPreview`
-   `previewZoomReset`
-   `previewZoomValue`
-   related link parsing/rendering functions

Do not duplicate this functionality if it can be reused.

Ensure default zoom is 80%.

### 15. Existing card integration

Inspect and reuse:

-   `buildCardHtml`
-   `cardFieldHtml_`
-   `groupCardFields_`
-   `rowUpdatesHtml_`
-   `toggleCardUpdates`
-   existing review badge/action functions

Presentation Mode should render the same underlying record information
users already see in normal card view.

Do not silently change card data semantics.

## Recommended implementation approach

A good implementation may use:

-   a small Presentation Mode controller/module
-   a dedicated presentation stylesheet
-   minimal markup added to `app.html` or dynamically created by the
    controller
-   existing dashboard functions as the data/rendering source
-   service-worker/cache support only where safe

If the project build system requires adding a source module, update the
module manifest and rebuild `app.js` using the existing scripts.

Do not manually create a divergent generated `app.js`.

## Important state behavior

Entering Presentation Mode should capture the current dashboard
dataset/filter context.

If the user has:

-   search filters
-   sector filter
-   review filter
-   hidden-record preference

respect the currently visible record set unless there is an explicit
existing product convention saying otherwise.

Do not unexpectedly reset the dashboard.

If background refresh happens while Presentation Mode is open:

-   do not destroy the current slide
-   preserve the current record if possible
-   update data safely
-   keep the current presentation index stable

## Performance requirements

Presentation Mode must not make the normal dashboard slower in a
noticeable way.

Avoid:

-   rendering all cards simultaneously
-   preloading every link at once
-   duplicate API requests
-   repeated DOM-wide queries on every navigation
-   memory leaks
-   unbounded caches

Only render the active slide, or at most a very small adjacent window.

Use cleanup when Presentation Mode exits.

## Error handling

Presentation Mode must survive:

-   missing record data
-   malformed links
-   failed preloads
-   blocked iframes
-   offline state
-   API failures
-   completion failures
-   submission toggle failures

Failures should be non-fatal and should not crash the dashboard.

## Testing checklist

Before considering the work complete, verify:

### Normal dashboard

-   [ ] Dashboard loads normally.
-   [ ] Cards still render.
-   [ ] Table view still works.
-   [ ] Search still works.
-   [ ] Filters still work.
-   [ ] Pagination still works.
-   [ ] Submissions still work.
-   [ ] Review completion still works.
-   [ ] Link preview still works.
-   [ ] Existing modals still work.
-   [ ] Existing keyboard shortcuts still work.

### Presentation Mode

-   [ ] Button opens Presentation Mode.
-   [ ] Ctrl/Cmd + Shift + P opens it.
-   [ ] One full-size card is shown.
-   [ ] Left button works.
-   [ ] Right button works.
-   [ ] Left arrow works.
-   [ ] Right arrow works.
-   [ ] Page Up/Page Down work.
-   [ ] Touch swipe works.
-   [ ] Escape exits.
-   [ ] Position counter is correct.
-   [ ] Only requested controls are exposed.
-   [ ] Show/Hide Submissions works.
-   [ ] Mark as Completed works.
-   [ ] Completed state is reflected immediately.
-   [ ] Links remain clickable.
-   [ ] Existing link popup opens.
-   [ ] Link preview defaults to 80%.
-   [ ] Preloading/warming is deduplicated.
-   [ ] Failed preload does not break navigation.
-   [ ] Long cards remain readable.
-   [ ] Mobile layout works.
-   [ ] Accessibility labels/focus work.

## Validation commands

Use the repository's existing validation workflow. At minimum:

-   JavaScript syntax checks
-   application build/split consistency checks
-   server test suite
-   existing CI checks

Do not claim success unless the checks actually pass.

## Git workflow

Prefer:

1.  Create a feature branch: `feature/presentation-mode`
2.  Implement changes.
3.  Run tests/checks.
4.  Review the diff carefully.
5.  Commit with a clear message such as:
    `feat: add dashboard presentation mode`
6.  Open a PR against `main`.

Do not push a knowingly broken implementation to `main`.

## Acceptance criteria

The feature is accepted only if:

1.  Normal dashboard behavior is unchanged outside Presentation Mode.
2.  Presentation Mode shows dashboard records as polished full-screen
    slides.
3.  Horizontal keyboard, button, and touch navigation works.
4.  Only Show/Hide Submissions and Mark as Completed are exposed inside
    Presentation Mode.
5.  Existing submission and review-completion logic is reused.
6.  Existing link popup behavior is reused.
7.  Preview starts at 80% zoom.
8.  Relevant links are warmed/preloaded responsibly.
9.  Cross-origin restrictions are respected.
10. No new backend API is introduced unless absolutely necessary.
11. Existing tests and syntax checks pass.
12. The implementation is clean, maintainable, and consistent with the
    repository architecture.

## Final response required from Big Pickle

After implementing, report:

-   files changed
-   branch name
-   commit SHA
-   tests/checks run
-   whether all checks passed
-   any browser limitations affecting cross-origin link
    preloading/embedding
-   a concise user-facing explanation of how to use Presentation Mode

Do not merely describe how to implement it. Actually implement and
validate it.
