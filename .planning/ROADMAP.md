# Roadmap: Iketrix

## Overview

Build an LLM-powered Eisenhower Matrix PWA from the ground up. Start with infrastructure and auth, then build the core GitHub-to-classification pipeline, then the interactive matrix UI, and finally the delegation and viral invite system. Four phases from zero to shipped product.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

- [ ] **Phase 1: Foundation** - Next.js + Prisma + Clerk + Vercel deployment skeleton
- [ ] **Phase 2: Import & Classification** - GitHub OAuth import + LLM Eisenhower classification pipeline
- [ ] **Phase 3: Matrix UI** - Interactive 2x2 grid with quadrant expansion and task movement
- [ ] **Phase 4: Delegation & Viral Loop** - Task delegation, notifications, and signup invites

## Phase Details

### Phase 1: Foundation
**Goal**: Working Next.js app with Clerk auth, Prisma Postgres schema, and Vercel deployment — the skeleton everything else builds on
**Depends on**: Nothing (first phase)
**Requirements**: [AUTH-01, INFRA-01, INFRA-02, INFRA-03, IMPORT-03]
**Success Criteria** (what must be TRUE):
  1. User can sign up and log in via Clerk on the deployed Vercel URL
  2. Prisma Postgres database is connected with initial schema (users, tasks, sources tables)
  3. App is installable as a PWA on mobile
  4. Input adapter interface is defined (pluggable architecture foundation)
**Plans**: TBD

Plans:
- [ ] 01-01: TBD
- [ ] 01-02: TBD

### Phase 2: Import & Classification
**Goal**: User connects GitHub, imports issues, and LLM classifies each into Eisenhower quadrants with reasoning — the core intelligence loop
**Depends on**: Phase 1
**Requirements**: [AUTH-02, IMPORT-01, IMPORT-02, LLM-01, LLM-02, LLM-03, LLM-04]
**Success Criteria** (what must be TRUE):
  1. User can connect a GitHub repo via OAuth and see their open issues imported as tasks
  2. Each task is classified into Do/Schedule/Delegate/Delete with visible reasoning
  3. Re-syncing GitHub pulls new issues and updates closed ones
  4. User correction history is stored and available as LLM context for future classifications
**Plans**: TBD

Plans:
- [ ] 02-01: TBD
- [ ] 02-02: TBD

### Phase 3: Matrix UI
**Goal**: Interactive mobile-optimized 2x2 Eisenhower grid where users review classifications, expand quadrants, and move tasks between them
**Depends on**: Phase 2
**Requirements**: [UI-01, UI-02, UI-03, UI-04]
**Success Criteria** (what must be TRUE):
  1. Tasks render in a 2x2 grid layout organized by quadrant on mobile and desktop
  2. Each quadrant expands into a focused list view
  3. User can drag or move tasks between quadrants (overriding LLM classification)
  4. Overrides are persisted and fed back to LLM memory
**Plans**: TBD

Plans:
- [ ] 03-01: TBD

### Phase 4: Delegation & Viral Loop
**Goal**: Q3 (Delegate) tasks can be assigned to people via email or GitHub, with viral signup invites for non-users and board integration for existing users
**Depends on**: Phase 3
**Requirements**: [DEL-01, DEL-02, DEL-03, DEL-04, AUTH-03]
**Success Criteria** (what must be TRUE):
  1. User can delegate a task to someone by email address or GitHub handle
  2. Email delegatees receive a notification with task details and an Iketrix signup invite
  3. GitHub delegatees get assigned on the original GitHub issue
  4. Existing Iketrix users see delegated tasks appear on their own board
  5. Delegated tasks show delegation status on the delegator's board
**Plans**: TBD

Plans:
- [ ] 04-01: TBD
- [ ] 04-02: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation | 0/TBD | Not started | - |
| 2. Import & Classification | 0/TBD | Not started | - |
| 3. Matrix UI | 0/TBD | Not started | - |
| 4. Delegation & Viral Loop | 0/TBD | Not started | - |
