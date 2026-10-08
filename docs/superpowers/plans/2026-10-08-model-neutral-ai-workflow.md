# План: модельно-нейтральный AI workflow

**Spec:** `docs/superpowers/specs/2026-10-08-model-neutral-ai-workflow.md`

## Task packet

- Goal: удалить из активного контракта Memora допуск и блокировки по названию
  модели, сохранив те же risk, quality, security и authorization gates.
- Class: bounded, только документация/governance; runtime behavior не меняется.
- Plan: этот файл, Task 1.
- Baseline: `powershell -NoProfile -ExecutionPolicy Bypass -File
  .\scripts\verify-ai-governance.ps1` — passed до изменений.
- Allowed files:
  - `AGENTS.md`
  - `README.md`
  - `docs/ai/MODEL_ROUTING.md`
  - `docs/ai/WORKFLOW.md`
  - `docs/ai/TASK_PACKET.md`
  - `docs/ai/QUALITY_GATES.md`
  - `docs/ai/SECURITY_AND_PRIVACY.md`
  - `scripts/verify-ai-governance.ps1`
  - `docs/superpowers/specs/2026-09-18-ai-engineering-system-design.md`
  - `docs/superpowers/plans/2026-09-18-ai-engineering-system.md`
  - `docs/superpowers/plans/2026-09-19-documents.md`
  - `docs/superpowers/plans/2026-09-19-mcp-cli-codex-integration.md`
  - `docs/superpowers/plans/2026-09-19-document-records-ocr.md`
  - `docs/superpowers/specs/2026-10-08-model-neutral-ai-workflow.md`
  - `docs/superpowers/plans/2026-10-08-model-neutral-ai-workflow.md`
- Out of scope: product/runtime changes, loosening required checks, credentials,
  production writes or external actions.
- Interfaces: active agent instructions and governance verifier; no runtime API.
- Acceptance:
  - [ ] No active instruction blocks work based on model name or demands a named
    model handoff/review.
  - [ ] The packet template has no model-tier requirement.
  - [ ] The governance verifier rejects a reintroduced model-name gate.
  - [ ] Governance verification and `git diff --check` pass.
- TDD evidence: docs-only exception. Baseline governance check passed before
  edits; target governance/link verification and active-policy search pass after
  edits. No runtime TDD is applicable.
- Risk/recovery: restore the policy with one `git revert`; quality and authority
  requirements must remain unchanged.
- Commit: `docs(ai): убрать допуск по названию модели`.

## Task 1 — update the active contract

1. Rewrite `MODEL_ROUTING.md` as advisory complexity/risk guidance with no model
   eligibility, handoff, or reviewer requirement.
2. Update the root instructions, workflow, task packet, quality/security docs,
   and README to use that model-neutral policy.
3. Mark the 2026-09-18 spec and plan as historical where they describe named
   model tiers; remove model tiers from active feature plans while preserving
   their architecture and security classifications.
4. Update the governance verifier to enforce current headings and reject old
   gate language in active instructions.
5. Run governance verification, search active files for old gates, and review
   the entire diff.
