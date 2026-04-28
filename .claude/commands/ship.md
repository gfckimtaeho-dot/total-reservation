---
description: Run tests, and only if they all pass, commit and push (deploy)
---

# /ship — Test → Commit → Push

You are running the deploy workflow. Follow these steps **strictly in order** and STOP at the first failure.

## 0. Sanity checks (do these in parallel)

Before doing anything else, verify in parallel:
- `git rev-parse --is-inside-work-tree` — is this a git repo?
- `git status --porcelain` — are there any changes to ship?
- `git rev-parse --abbrev-ref HEAD` — what branch are we on?
- Detect the test command (see step 1 for detection rules)

If **not a git repo**: stop and tell the user `git init` is needed first. Do not proceed.
If **no changes** in working tree and index: tell the user there's nothing to ship and stop.
If on `main` / `master`: warn the user and ask for explicit confirmation before continuing (pushing directly to main is risky).

## 1. Detect the test command

Auto-detect based on files in the project root:
- `package.json` exists → `npm test` (or `pnpm test` / `yarn test` if those lockfiles are present)
- `pyproject.toml` or `pytest.ini` or `setup.cfg` with pytest config → `pytest`
- `go.mod` → `go test ./...`
- `Cargo.toml` → `cargo test`
- `Gemfile` with rspec → `bundle exec rspec`
- Otherwise: ask the user what the test command is. Do not guess.

Print the detected command to the user before running it.

## 2. Run tests

Execute the test command. Capture exit code.

- **Exit code 0** → all tests passed. Continue to step 3.
- **Non-zero exit code** → STOP. Do not commit. Do not push. Print:
  - Which tests failed (extract from the output)
  - The first useful error message
  - A clear "❌ Tests failed — aborting deploy. Fix the failures and run /ship again."
- If the test command itself can't be found / exits with a setup error (not a test failure), stop and report that distinctly.

**Never** use `--no-verify`, skip flags, or `|| true` to bypass test failures. The whole point of /ship is the gate.

## 3. Stage changes (only after tests pass)

- `git status` — show what's modified.
- Stage **specific files by name** with `git add <path1> <path2> ...`. **Never** use `git add -A` or `git add .` — those can sweep in `.env`, credentials, or build artifacts.
- Skip files that look like secrets: `.env`, `.env.*`, `*credentials*`, `*secret*`, `*.pem`, `*.key`. If the user has clearly intentional changes in such a file, stop and confirm before adding it.
- `git diff --cached` — quickly review what's actually staged.

## 4. Commit

- Write a concise commit message describing the **why**, not the what (well-named diffs already show the what).
- Use a HEREDOC so multi-line messages format correctly.
- End with the Co-Authored-By footer.
- Do **not** amend an existing commit — always create a new one (amending after a hook failure can destroy work).

Example shape:

```bash
git commit -m "$(cat <<'EOF'
<one-line summary, imperative mood>

<optional body explaining why>

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

If a pre-commit hook fails: do **not** retry with `--no-verify`. Fix the underlying issue, re-stage, and create a **new** commit (the failed attempt did not actually create a commit, so `--amend` would clobber the *previous* commit instead).

## 5. Push

Default: `git push origin HEAD` — pushes the current branch to `origin`, creating the upstream tracking ref if needed (`-u` on first push).

- If the current branch already has an upstream, plain `git push` is fine.
- If push is rejected (non-fast-forward), STOP. Do **not** force-push. Tell the user to pull/rebase first.
- Never `--force` / `--force-with-lease` unless the user explicitly asks for it in this same session.
- Never push to `main` / `master` without the explicit confirmation from step 0.

## 6. Report

Print a short final summary:
- ✅ Tests: passed (X tests, Y.Ys)
- ✅ Commit: `<short-sha>` on `<branch>`
- ✅ Push: `<branch>` → `origin/<branch>`

That's it — keep the report under 5 lines.

## Hard rules (do not violate)

- Never commit if any test failed.
- Never `git add -A` / `git add .`.
- Never `--no-verify`, never `--force`, never amend.
- Never proceed past a failed step — stop and surface the problem.
