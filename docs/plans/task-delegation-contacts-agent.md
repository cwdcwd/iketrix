# Plan: Task Delegation — Contacts & Agent

**TL;DR**: Extend the delegate quadrant with two new delegation paths: (1) delegate to a **Contact** (existing app user or invited via Clerk), and (2) delegate to an **AI Agent** that clarifies the task via a persistent chat, then executes actions (creates subtasks, GitHub issues, sends emails). Requires upgrading to AI SDK v6 (`ToolLoopAgent`, `useChat`, `createAgentUIStreamResponse`), a new Contact model, and persistent agent conversation storage.

---

## Phase 1: AI SDK v6 Upgrade + Foundation

1. Upgrade `ai` from `^4.3.0` → `^6.x` and `@ai-sdk/openai` to compatible version. Install `@ai-sdk/react`. Update imports in existing code to match v6 API changes.
2. Verify existing classification still works after upgrade (`generateObject` in `src/lib/classify.ts` and `src/lib/classifier-memory.ts`).

**Verification**: `npm run build` clean, quick-add a task → classifies correctly.

---

## Phase 2: Data Model — Contact, AgentConversation, AgentMessage

3. **Contact** model in `prisma/schema.prisma`: `id`, `userId` (owner), `email`, `name?`, `linkedUserId?` (FK → User, set when contact joins), `clerkInvitationId?`, `inviteStatus` ("pending" | "accepted" | null). Unique `@@unique([userId, email])`.
4. **AgentConversation** model: `id`, `taskId` (FK → Task), `userId` (FK → User), `status` ("active" | "completed" | "abandoned"), `summary?`, `createdAt`, `updatedAt`.
5. **AgentMessage** model: `id`, `conversationId` (FK), `role` ("user" | "assistant" | "tool"), `content`, `toolName?`, `toolArgs?` (JSON), `toolResult?` (JSON), `createdAt`.
6. Extend **Task**: add `delegatedToContactId?` (FK → Contact).
7. Add relations to **User**: `contacts`, `linkedUser` back-references.
8. Run migration.

**Verification**: `npx prisma migrate dev` + `prisma generate` succeed.

---

## Phase 3: Contact Management API

9. `src/app/api/contacts/route.ts` — `GET` (list contacts), `POST` (create; auto-link if email matches existing User). *Parallel with step 10–11.*
10. `src/app/api/contacts/[contactId]/route.ts` — `PATCH` (update name), `DELETE`.
11. `src/app/api/contacts/[contactId]/invite/route.ts` — `POST` sends Clerk invitation via `clerkClient.invitations.createInvitation()`, stores `clerkInvitationId`.
12. `src/app/api/webhooks/clerk/route.ts` — handles `user.created` webhook: auto-links Contact by email, clones pending delegated tasks to the new user's board with `quadrant: "do"`. Exclude this path from Clerk auth in `src/middleware.ts`.

**Verification**: Create contact with known email → auto-linked. Invite unknown email → Clerk invite sent. Simulate webhook → tasks cloned.

---

## Phase 4: Update Delegate-to-Contact Flow

13. Refactor `src/app/api/tasks/[taskId]/delegate/route.ts`: new body `{ mode: "contact" | "agent", contactId?, ... }`. For contacts: set `delegatedToContactId`, clone task if linked, else send Clerk invite. For agent: create `AgentConversation`, return `conversationId`.

**Verification**: Delegate to linked contact → task on their board. Delegate to unlinked → invite. Delegate to agent → conversation created.

---

## Phase 5: Delegation Agent — Backend

14. Create `src/lib/agents/delegation-agent.ts` — a `ToolLoopAgent` with tools:
    - `createSubtask` — creates a Task on the user's board (title, description, quadrant)
    - `createGitHubIssue` — uses `GitHubAdapter` to create issues on connected repos
    - `sendEmail` — sends via Resend (to, subject, body)
    - `updateTask` — enriches the original task's title/description
    - `markTaskComplete` — marks the delegated task as completed
    - `getTaskContext` — retrieves full task details + classification + clarifications

15. Create `src/app/api/agent/chat/route.ts` — `POST` handler using `createAgentUIStreamResponse`. Loads task context into system prompt, passes user's model preference, persists messages to `AgentMessage` via `onStepFinish`.

16. Create `src/app/api/agent/conversations/[conversationId]/route.ts` — `GET` (load messages for resume), `PATCH` (complete/abandon).

**Verification**: POST to chat → agent asks clarifying questions. Answer → agent uses tools (subtask visible on board). GET conversation → history returned. Resume after reload → conversation intact.

---

## Phase 6: UI — Enhanced Delegate Modal + Agent Chat

17. Refactor delegate modal in `src/components/MatrixBoard.tsx`: replace Email/GitHub toggle with **Contact** / **Agent** tabs.
18. Create `src/components/ContactPicker.tsx` — debounced search, status badges (linked ✓, invited ⏳, new), inline "Add new" form.
19. Create `src/components/AgentChat.tsx` — uses `useChat` from `@ai-sdk/react` with `DefaultChatTransport` → `/api/agent/chat`. Renders streaming messages with tool call indicators ("Creating subtask...", "✓ GitHub issue created"). Loads prior messages on mount for resume.
20. Add delegation indicators on board tasks: contact name + status for contact delegation, "Agent" badge + resume link for agent delegation.
21. Add "Contacts" section in `src/app/settings/page.tsx` for managing contacts.

**Verification**: Modal shows Contact/Agent tabs. Search contacts works. Agent chat streams and tools execute visibly. Reload → resume works.

---

## Decisions

- **AI SDK v6 upgrade** required for `ToolLoopAgent` + `createAgentUIStreamResponse`
- **Minimal Contact model** — email + name + optional linkedUserId (not a full address book)
- **Agent conversations persisted** in DB — resumable across sessions
- **Clerk Invitations API** for non-user contacts (tracks invite status)
- **Agent tools scoped to user's permissions** — uses their GitHub tokens, their matrices
- **Agent model follows user's `classifierModel` setting**

## Excluded from scope

- Contact import from external services (Google, etc.)
- Agent memory across different conversations
- Real-time notifications (WebSocket) for delegated task acceptance
- Multi-day agent workflows
