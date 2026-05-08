# Requirements: Iketrix

**Defined:** 2026-05-07
**Core Value:** LLM-powered Eisenhower classification that learns from user corrections — turning an unstructured list of tasks into a clear action plan in seconds.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Authentication

- [ ] **AUTH-01**: User can sign up and log in via Clerk
- [ ] **AUTH-02**: User can connect GitHub account via OAuth for issue import (separate from login)
- [ ] **AUTH-03**: Non-Iketrix users receiving delegated tasks get a viral signup invite

### Input / Import

- [ ] **IMPORT-01**: User can connect a GitHub repo and sync open issues as tasks
- [ ] **IMPORT-02**: Synced issues update on re-sync (new issues appear, closed issues reflect status)
- [ ] **IMPORT-03**: Input adapter architecture is pluggable for future sources (Jira, Linear, plain text)

### LLM Classification

- [ ] **LLM-01**: Each imported task is classified into an Eisenhower quadrant (Do/Schedule/Delegate/Delete) via Vercel AI Gateway
- [ ] **LLM-02**: Classification includes reasoning visible to the user
- [ ] **LLM-03**: User overrides are stored as memory for future LLM context
- [ ] **LLM-04**: Classification improves over time using stored correction history

### Matrix UI

- [ ] **UI-01**: Tasks display on an interactive 2x2 Eisenhower grid (mobile-optimized PWA)
- [ ] **UI-02**: Each quadrant expands for focused view
- [ ] **UI-03**: User can move tasks between quadrants (override LLM classification)
- [ ] **UI-04**: Delegated tasks show delegation status on the board

### Delegation

- [ ] **DEL-01**: User can delegate Q3 tasks to external people by email or GitHub handle
- [ ] **DEL-02**: Email delegatees receive notification with task details + Iketrix signup invite
- [ ] **DEL-03**: GitHub delegatees get assigned via GitHub issue (if source was GitHub)
- [ ] **DEL-04**: Iketrix users receiving delegation see the task on their own board

### Infrastructure

- [ ] **INFRA-01**: Next.js app deployed on Vercel
- [ ] **INFRA-02**: Prisma Postgres for data persistence
- [ ] **INFRA-03**: PWA manifest and service worker for mobile install

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Input Sources

- **INPUT-V2-01**: Jira integration as input adapter
- **INPUT-V2-02**: Linear integration as input adapter
- **INPUT-V2-03**: Plain text / paste import

### Sync

- **SYNC-V2-01**: Bidirectional GitHub sync (write classification back to GitHub labels/comments)

### Collaboration

- **COLLAB-V2-01**: Team dashboards / shared views
- **COLLAB-V2-02**: Calendar integration for Q2 (Schedule) items

### Resilience

- **RES-V2-01**: Offline support with local-first sync

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Native mobile app | PWA provides sufficient mobile experience |
| Team workspaces / shared boards | Solo tool — delegation is outbound-only |
| Real-time collaboration | Tasks are personal; delegation is async |
| Multiple LLM provider UIs | Vercel AI Gateway abstracts provider selection |
| Bidirectional GitHub sync (v1) | Import-only keeps v1 scope tight |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| AUTH-01 | Phase 1: Foundation | Not started |
| AUTH-02 | Phase 2: Import & Classification | Not started |
| AUTH-03 | Phase 4: Delegation & Viral Loop | Not started |
| IMPORT-01 | Phase 2: Import & Classification | Not started |
| IMPORT-02 | Phase 2: Import & Classification | Not started |
| IMPORT-03 | Phase 1: Foundation | Not started |
| LLM-01 | Phase 2: Import & Classification | Not started |
| LLM-02 | Phase 2: Import & Classification | Not started |
| LLM-03 | Phase 2: Import & Classification | Not started |
| LLM-04 | Phase 2: Import & Classification | Not started |
| UI-01 | Phase 3: Matrix UI | Not started |
| UI-02 | Phase 3: Matrix UI | Not started |
| UI-03 | Phase 3: Matrix UI | Not started |
| UI-04 | Phase 3: Matrix UI | Not started |
| DEL-01 | Phase 4: Delegation & Viral Loop | Not started |
| DEL-02 | Phase 4: Delegation & Viral Loop | Not started |
| DEL-03 | Phase 4: Delegation & Viral Loop | Not started |
| DEL-04 | Phase 4: Delegation & Viral Loop | Not started |
| INFRA-01 | Phase 1: Foundation | Not started |
| INFRA-02 | Phase 1: Foundation | Not started |
| INFRA-03 | Phase 1: Foundation | Not started |
