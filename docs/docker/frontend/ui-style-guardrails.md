# UI Style Guardrails

Reference workflow:
- `../plans/ui-single-page-governance.md`
- `../plans/ui-page-health-template.md`
- `../plans/ui-page-tracker.md`

## Allowed
- Use global tokens in `src/styles/index.css` (typography, spacing, radius, shell width).
- Prefer semantic Tailwind sizes (`text-sm`, `text-base`, `px-3`, `py-2`) over raw pixel literals.
- Use shared admin/user layout containers (`ws-fluid-container`, `ws-admin-page`, `panel-card-*`).
- Keep exceptions isolated and documented with local comments.

## Disallowed (Default)
- New hardcoded pixel typography (`font-size: 13px`, `text-[13px]`) in business pages.
- New hardcoded layout dimensions for major containers (`w-[256px]`, `height: 64px`) without token mapping.
- Mixed local scale systems in one screen (header/title/content each using unrelated size ladders).
- Reintroducing unbounded spacing drift (random `6/10/14/22px` combinations in same module).

## Exception Policy
- If product constraints require fixed values (e.g., canvas, media viewport, drag handles), keep them:
  - localized in one file/module,
  - documented with a short reason comment,
  - excluded minimally from future refactors.
