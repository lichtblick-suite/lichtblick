---
name: 'SDD Upstream Feature Adoption'
description: 'Evaluate and adopt a specific upstream feature using a structured compatibility and risk assessment.'
---

Use this workflow when adopting a specific upstream feature into a downstream branch.

## Inputs

- Upstream PR/commit(s)/tag introducing the feature
- Local branch target
- Optional adoption constraints

## Phase 1: Specify

1. Describe the upstream feature:
   - User value
   - Technical scope
   - Dependencies
2. Define desired local outcome and acceptance criteria.

## Phase 2: Plan

1. Evaluate compatibility:
   - Public/internal APIs
   - Existing local modifications
   - Performance and memory implications
2. Choose adoption approach:
   - Adopt as-is
   - Adopt with adaptation
   - Defer
   - Reject
3. Define implementation and validation plan.

Human checkpoint:
- Wait for approval on adoption decision and approach.

## Phase 3: Tasks

Create concrete tasks for:
1. Code integration
2. Local adaptations
3. Test updates
4. Documentation updates

## Phase 4: Implement and verify

1. Integrate feature changes.
2. Apply local adaptations with clear rationale.
3. Verify acceptance criteria and regression safety.

## Output format

- Feature summary
- Compatibility analysis
- Adoption decision + rationale
- Task checklist
- Validation results
- Deferred items
