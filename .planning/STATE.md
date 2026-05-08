# Project State: Iketrix

## Current Position

**Milestone:** v1.0 MVP
**Phase:** 1 - Foundation
**Status:** Not started
**Last Activity:** 2026-05-07

## Decisions

| Date | Decision | Context |
|------|----------|---------|
| 2026-05-07 | PWA over native app | Faster to ship, mobile-friendly enough |
| 2026-05-07 | Clerk for auth (separate from GitHub) | GitHub OAuth is for data import only |
| 2026-05-07 | Vercel AI Gateway for LLM | Native integration, model flexibility |
| 2026-05-07 | Prisma Postgres (Vercel native) | Zero-config, managed, integrated |
| 2026-05-07 | Solo tool with viral delegation | Growth via utility, not team features |
| 2026-05-07 | LLM learns from user corrections | Stored as memory for future classification context |

## Blockers

None

## Todos

- [ ] Set up Clerk project and get API keys
- [ ] Set up Prisma Postgres database on Vercel
- [ ] Configure Vercel AI Gateway

## Notes

- Input adapter architecture should be pluggable from Phase 1 to support future sources
- GitHub is the first adapter; architecture must not be GitHub-specific
- Eisenhower quadrants: Do (Important+Urgent), Schedule (Important+Not Urgent), Delegate (Not Important+Urgent), Delete (Not Important+Not Urgent)
