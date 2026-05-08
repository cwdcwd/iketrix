# Phase 1: Foundation — Research

**Date:** 2026-05-07
**Phase:** 01-foundation

## Stack Confirmation

### Next.js (App Router)
- Use `create-next-app` with App Router, TypeScript, Tailwind CSS
- App Router is the default and recommended approach

### Prisma Postgres
- Prisma Postgres is a managed PostgreSQL service from Prisma
- Requires: `prisma`, `@prisma/client`, `@prisma/adapter-pg`, `pg`, `dotenv`
- Init: `npx prisma init --output ../generated/prisma`
- Creates `prisma.config.ts` (ESM-first) with `defineConfig`
- Schema uses `generator client` with `provider = "prisma-client"` and custom output path `"../generated/prisma"`
- Client instantiation uses `PrismaPg` adapter: `new PrismaPg({ connectionString })` → `new PrismaClient({ adapter })`
- Migrations: `npx prisma migrate dev --name init` then `npx prisma generate`
- Database creation: `npx create-db` (CLI command to provision Prisma Postgres instance)
- For Vercel Edge/Serverless: use Prisma Postgres serverless driver instead of `pg` adapter

### Clerk (Next.js App Router)
- Install: `@clerk/nextjs`
- Middleware file: `proxy.ts` (Next.js 16+) or `middleware.ts` (Next.js ≤15)
- Export `clerkMiddleware()` with matcher config
- Wrap app in `<ClerkProvider>` in root layout
- Components: `<Show when="signed-in">`, `<Show when="signed-out">`, `<UserButton />`, `<SignInButton />`, `<SignUpButton />`
- Env vars: `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`
- By default all routes are public; opt-in to protection

### Vercel AI Gateway
- Unified API: one key, hundreds of models via `ai` SDK
- Usage: `import { generateText } from 'ai'` → `generateText({ model: 'anthropic/claude-opus-4.6', prompt: '...' })`
- Works with AI SDK v5/v6
- Zero markup on tokens, spend monitoring included
- Fallbacks and retry across providers built-in

### PWA
- Next.js PWA via `next-pwa` or `@serwist/next` (successor to next-pwa)
- Requires: `manifest.json` in `/public`, service worker registration
- Mobile install prompt with proper manifest (name, icons, display: standalone)

## Architecture Notes

### Input Adapter Pattern
- Define a TypeScript interface: `InputAdapter` with methods like `connect()`, `sync()`, `disconnect()`
- GitHub adapter is first implementation
- Interface should return normalized `TaskInput[]` regardless of source
- This is the pluggable foundation for future Jira/Linear/text adapters

### Schema Design (Initial)
Key tables for Phase 1:
- `User` — synced from Clerk via webhook or on-demand
- `Task` — the core entity (title, description, quadrant, source, sourceId)
- `Source` — input source connection (type: github, credentials/tokens)
- `TaskClassification` — LLM classification results (quadrant, reasoning, confidence)
- `ClassificationOverride` — user corrections (original quadrant, new quadrant, timestamp) — feeds LLM memory

### Key Considerations
- Clerk user sync: Use Clerk webhooks or `currentUser()` server-side to create local DB user records
- GitHub OAuth tokens: Store encrypted in Source table, separate from Clerk auth
- Schema should anticipate Phase 2 needs (classification, overrides) but only create what's needed now

## Don't Hand-Roll
- Auth: Use Clerk entirely (no custom auth)
- Database: Use Prisma Postgres managed service (no self-hosted DB)
- AI: Use Vercel AI Gateway SDK (no raw API calls)
- PWA: Use established library (`@serwist/next`) not manual service worker

## Common Pitfalls
- **Prisma in serverless**: Use connection pooling or Prisma Postgres serverless driver to avoid connection exhaustion
- **Clerk middleware matcher**: Must include API routes in matcher or auth won't work for API calls
- **PWA caching**: Overly aggressive caching can break auth flows — exclude auth-related routes from cache
- **Next.js App Router**: Server components can't use hooks — separate client/server boundaries clearly
