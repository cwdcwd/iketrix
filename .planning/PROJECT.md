# Iketrix

## What This Is

A mobile-friendly PWA that consumes to-do lists (starting with GitHub issues) and classifies them through the Eisenhower Matrix using an LLM. Tasks land in a 2x2 grid (Do/Schedule/Delegate/Delete), where users can review, override, and delegate — with a viral invite loop for new users receiving delegated work.

## Core Value

LLM-powered Eisenhower classification that learns from user corrections — turning an unstructured list of tasks into a clear action plan in seconds.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] User can connect GitHub via OAuth and sync open issues as task input
- [ ] LLM classifies each imported task into one of four Eisenhower quadrants (Do, Schedule, Delegate, Delete)
- [ ] LLM logs classification reasoning and learns from user overrides as memory for future context
- [ ] Tasks display on an interactive 2x2 grid optimized for mobile
- [ ] Each quadrant expands for focused view and recategorization via drag or action
- [ ] User can override LLM classification and move tasks between quadrants
- [ ] Q3 (Delegate) tasks can be assigned to external users via email notification or GitHub issue assignment
- [ ] Assignee identity accommodates multiple methods (email, GitHub handle, Iketrix user)
- [ ] Delegated tasks show delegation status on the board
- [ ] Non-Iketrix delegatees receive a viral invite to sign up and see the task on their own board
- [ ] Iketrix delegatees see the task appear on their board for processing
- [ ] Authentication via Clerk (independent of GitHub — GitHub is for data import only)
- [ ] System architecture supports adding new input sources beyond GitHub over time

### Out of Scope

- Native mobile app — PWA provides mobile experience
- Team workspaces / shared boards — this is a solo tool with outbound delegation
- Real-time collaboration — tasks are personal; delegation is async notification
- Offline-first / local storage — cloud-first with Prisma Postgres
- Multiple LLM providers in v1 — Vercel AI Gateway is the single provider interface
- Bidirectional GitHub sync (writing back to GitHub) — import-only in v1

## Context

- Solo developer + AI builder workflow
- Eisenhower Matrix: Important+Urgent = Do (act now), Important+Not Urgent = Schedule (set deadline), Not Important+Urgent = Delegate (assign out), Not Important+Not Urgent = Delete (drop it)
- The LLM classification is the key differentiator — users shouldn't need to manually sort; the AI does it with deference to human override
- Viral loop: when you delegate to someone not on Iketrix, they get an invite — this is the growth mechanism
- GitHub issues is the first input adapter but the architecture must be pluggable for future sources (Jira, Linear, plain text, etc.)

## Constraints

- **Stack**: Next.js + Vercel + Prisma Postgres + Clerk + Vercel AI Gateway — all Vercel-native
- **Mobile-first**: PWA must work well on phone screens; the 2x2 grid is the primary UI
- **Cost**: LLM calls per task classification — architecture should batch or cache where sensible
- **Auth**: Clerk handles all identity; GitHub OAuth is solely for issue import, not login
- **Deployment**: Vercel (single platform for hosting, AI, DB integration)

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| PWA over native | Faster to ship, no app store, mobile-friendly enough | — Pending |
| Clerk for auth | Independent from input sources, handles invites well | — Pending |
| Vercel AI Gateway | Native integration, single billing, model flexibility | — Pending |
| Prisma Postgres | Vercel native integration, managed, zero-config | — Pending |
| Solo tool + viral delegation | Growth through utility (delegate = invite) without team complexity | — Pending |
| LLM learns from corrections | User overrides stored as memory to improve future classification | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition:**
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone:**
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-05-07 after initialization*
