---
name: checkpoint-review
description: Review a LieferRadar iteration checkpoint through its focused diff and acceptance criteria without modifying the worktree.
---

# Checkpoint review

## Establish the review

- Read [root guidance](../../../AGENTS.md), [architecture guidance](../../../docs/architecture/architecture.md), and the active document under `docs/iterations/`.
- Identify the requested checkpoint, its acceptance criteria, and the changed paths from `git diff` and `git diff --cached`.
- Read a service-level `AGENTS.md` only when changed paths belong to that service.
- Treat the architecture document as the stable architecture source. Inspect surrounding implementation only when needed to understand a changed section or verify a concrete concern.
- Do not scan unrelated modules or rediscover the whole repository without a finding that requires it.

## Review

- Check the diff against the checkpoint acceptance criteria and approved architecture.
- Focus on correctness; boundaries; scope and abstractions; database/data-model, concurrency, consistency, error and failure behavior; tests; API regressions; relevant security; provenance and simulation-versus-real-data claims; AI boundaries; and human authorization for operational recommendations or actions.
- Prefer reported verification and existing focused checks. Run an additional focused check only to investigate a concrete concern; do not automatically run the full test suite.
- Do not invent findings. State clearly when no meaningful issue is found.

## Output

Use this concise structure:

1. **Verdict:** `APPROVE`, `APPROVE WITH TODO`, or `CHANGES REQUIRED`
2. **Findings:** ordered by severity, with file/code references and why each matters
3. **Acceptance criteria:** pass/fail summary
4. **TODOs:** non-blocking follow-ups only
5. **Next checkpoint:** whether it is safe to proceed

## Read-only boundary

This skill is review-only. Do not modify implementation or documentation, stage files, commit, push, or automatically fix findings. Report required changes and stop so `iteration-workflow` can implement separately after approval.
