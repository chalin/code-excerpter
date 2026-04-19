# Next Work and `0.2` Assessment

## Current status

- [x] The repo is green.
- [x] `npm run seq -- fix test` passes.
- [x] Phase 6 real-repo validation is complete:
  - [x] `open-telemetry/opentelemetry.io`
  - [x] `dart-lang/site-www`
- [x] The old vendored updater-fixture harness is gone:
  - [x] `test/updater-goldens.test.ts` removed
  - [x] `test/fixtures/code-excerpt-updater/` removed
  - [x] repo-owned updater coverage now lives under `test/fixtures/updater/`
- [x] The inject/update API boundary now reports structured issues through
      `onIssue({ kind, message })`; `updatePaths` still exposes `warnings[]` and
      `errors[]`.

## Highest-value next candidates

1. [ ] **Phase 5a A: site-shared updater goldens**
   - Vendor `dart-lang/site-shared/pkgs/excerpter/test_data`.
   - Add Vitest updater goldens aligned with upstream `updater_test.dart`.
   - This is the clearest remaining coverage gap in `docs/plan.md`.

2. [ ] **Revisit literal `<?code-excerpt` in prose**
   - Today mid-line prose mentions can still report invalid PI errors.
   - Decide whether to keep the current `&lt;` workaround or relax parsing so
     only real line-start PI attempts are diagnosed.

3. [ ] **Release prep for `0.2`**
   - Review whether the current changelog is sufficient for the release.
   - Decide whether the remaining open items in `docs/plan.md` are blockers or
     post-`0.2` follow-ups.
   - If not blocked, bump from `0.2.0-dev` and cut the release.

## Lower-priority candidates

- Refreshing excerpts in non-`.md` targets.
- Broader issue-reporting rollout beyond the current inject/update boundary.

## Recommendation for `0.2`

`0.2` is close.

Recommended release gate:

1. Decide whether `site-shared` updater goldens are required before release.
2. Decide whether the prose `<?code-excerpt` behavior needs to change now.
3. If both are deferred, proceed with release preparation.
