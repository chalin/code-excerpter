# Releasing

This document records the project’s release-prep workflow.

## Prepare

Prepare the release on a short-lived PR branch based on `main` (for example,
`release-prep-X.Y.Z`). The actual tag and publication come from merged `main`.

1. Ensure the working tree is clean.
2. Ensure the release prep PR branch is current relative to `main`.
3. Decide whether the remaining unchecked items in [docs/plan.md](plan.md) are
   release blockers or post-release follow-ups.
4. Optionally refresh dependencies:

   ```sh
   # (a) Ensure the Node version is up to date
   nvm install

   # (b) Update dependency ranges
   npm run update:packages

   # (c) Review dependency changes and adjust as needed

   # (d) If there are dependency changes, then:
   npm install
   ```

5. Run:

   ```sh
   npm run seq -- fix test
   ```

   If there are issues, then address them and rerun the command.

6. Update task tracking:
   - Mark completed release tasks done
   - Move carry-over work into the next-version task file under `.tasks/`

7. Review workspace changes introduced by the previous steps.

8. Review [CHANGELOG.md](../CHANGELOG.md) for sufficiency and concision. Make
   sure to include any last minute changes introduced by the previous steps.

9. Bump the version with:

   ```sh
   REL=X.Y.Z
   echo $REL
   npm version $REL --no-git-tag-version
   ```

   This updates `package.json` and `package-lock.json` together.

10. Commit any changes. Use a meaningful commit title. Write the commit message
    body as a very terse Markdown list summary of the changes, each item
    starting with a verb in the 3rd person, present tense.

11. Run a final check: `npm run seq -- fix test`

12. Submit a pull request for review.

13. Ensure PR checks pass, if not, address issues and repeat the previous steps.

14. Once approved, merge the pull request, and pull the updated `main` branch
    locally.

## Verify

From the updated `main` branch:

1. Ensure CI checks pass on the merged release commit.
2. Build the publishable tarball: `npm pack`
3. Address any reported issues and inspect the tarball contents briefly.

## Tagging

From `main`:

1. Create a lightweight tag for the release version, for example:

   ```sh
   REL=$(node -p 'require("./package.json").version')
   echo $REL
   git tag v$REL
   ```

2. From the same shell session, push the tag:

   ```sh
   git push origin v$REL
   ```

## GitHub release

- Create the GitHub release from the matching `vX.Y.Z` tag, select generated
  release notes.
- Add a link to the repository's [CHANGELOG.md](../CHANGELOG.md):

  ```markdown
  - [CHANGELOG.md](https://github.com/chalin/code-excerpter/blob/main/CHANGELOG.md)
  ```

## npm release

1. Publish the package version that matches `package.json`, for example:

   ```sh
   npm publish
   ```

2. Ensure the release commit, tag, and GitHub release already exist before
   publishing.

## After release

1. Verify the package version appears on npm.
2. Verify the tag and GitHub release are visible.
3. If this repo continues with `-dev` versions, bump to the next development
   version in a follow-up change.
