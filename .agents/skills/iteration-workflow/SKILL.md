---
name: iteration-workflow
description: Plan or implement LieferRadar iteration checkpoints using explicit PLAN and IMPLEMENT modes, iteration documents and approved architecture decisions.
---

# Iteration workflow

## Establish the checkpoint

- Read [root guidance](../../../AGENTS.md), the applicable service guidance, and the requested document under `docs/iterations/` from the repository root.
- Resolve the requested phase, checkpoint and mode: PLAN or IMPLEMENT. Follow the user's requested mode; without an approved plan and implementation authorization, use PLAN. A checkpoint marked "next" does not authorize implementation. Review-only requests remain read-only.
- Read the checkpoint table and inspect relevant code and tests to distinguish completed work from planned work.
- For database work, read [the database decision](../../../docs/architecture/database.md) for approved storage contracts, test isolation and commands. Historical research supplies evidence; the current iteration document and approved decisions define implementation scope.

## PLAN

- Do not modify files. Inspect the existing code, relevant iteration specification, dependencies and reusable patterns.
- Present a concise plan covering architectural decisions and ambiguities, implementation steps with independently testable checkpoints, risks, and acceptance criteria with planned checks. Identify decisions requiring approval.
- Stop for approval; do not transition to IMPLEMENT automatically.

## IMPLEMENT

- Follow the approved checkpoint plan and existing project and service guidance. Implement only the approved scope, preserving acceptance criteria from completed iterations. Resolve any blocking scope or architectural decision before dependent changes.
- Select checks from the checkpoint's acceptance gate and actual changes. For PostgreSQL integration and HTTP verification, use the isolated workflow in the database decision; run the separate cleanup check when the runner or teardown behavior changes.
- Report actual command outcomes, including failures and environment limitations. Distinguish earlier verification records from checks run in the current task. For documentation changes, validate references and format without starting application work.
- Review the Git diff against the approved scope and the starting worktree; report unrelated existing changes separately.
- When checkpoint documentation is in scope, record completed deliverables, verification evidence, remaining conditions and the next checkpoint. Infrastructure checks do not complete later persistence or feature checkpoints.
- Report files changed, test results, decisions and remaining concerns. Stop for review before proceeding to another checkpoint. Checkpoint approval does not authorize a commit.
- If implementation reveals a significant deviation from the approved plan, stop and request approval before proceeding.
