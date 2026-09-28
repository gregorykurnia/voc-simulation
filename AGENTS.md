# Repository workflow

- For every change made in this repository, complete the relevant checks, create a focused commit, and push it to the configured upstream branch without waiting for a separate request. For multi-step tasks, commit and push each independently complete unit of work.
- After each push, tell the user what changed, which checks were run, and the commit hash and push result.
- Before staging, review the changed-file list. Never commit secrets, local environment files, dependency folders, or generated build output. Keep `.env.local`, `node_modules/`, and `dist/` out of commits.
- Do not force-push, rewrite published history, or push to a different repository or branch than the configured upstream without explicit user direction.
