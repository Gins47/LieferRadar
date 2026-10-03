---
name: iteration-workflow
description: Plan, implement, or review LieferRadar iteration checkpoints using the iteration documents and approved architecture decisions.
---

# Iteration workflow

## Establish the checkpoint

- Read [root guidance](../../../AGENTS.md), the applicable service guidance, and the requested document under `docs/iterations/` from the repository root.
- Resolve the user's requested phase, checkpoint and task mode: planning, implementation, verification or review. Read the checkpoint table and inspect relevant code and tests to distinguish completed work from planned work.
- For database work, read [the database decision](../../../docs/architecture/database.md) for approved storage contracts, test isolation and commands. Historical research supplies evidence; the current iteration document and approved decisions define implementation scope.
- Present a short checkpoint plan when one has not already been approved. A checkpoint marked "next" does not itself authorize implementation. If the requested scope is unclear, progress with inspection before requesting the missing decision.

## Work and verify

- Apply the existing project and service instructions to the authorized checkpoint. Preserve acceptance criteria from completed iterations while introducing the checkpoint's changes.
- Select checks from the checkpoint's acceptance gate and actual changes. For PostgreSQL integration and HTTP verification, use the isolated workflow in the database decision; run the separate cleanup check when the runner or teardown behavior changes.
- Report actual command outcomes, including failures and environment limitations. Distinguish earlier verification records from checks run in the current task. For documentation changes, validate references and format without starting application work.
- Review the Git diff against the checkpoint and the starting worktree; report unrelated existing changes separately.

## Handoff

- Update only the relevant checkpoint record: completed deliverables, verification evidence, remaining conditions and the next checkpoint. A successful infrastructure check does not complete a later persistence or feature checkpoint.
- Report files changed and any unresolved decisions. Stop at the requested checkpoint for review unless the user has already authorized continuation. Do not infer permission to commit from checkpoint approval.
