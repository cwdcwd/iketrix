import { tool } from "ai";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { gateway } from "@/lib/ai-gateway";
import { Resend } from "resend";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ToolCategory = "task-mgmt" | "output" | "development" | "research" | "communication";

export interface ToolDefinition {
  id: string;
  name: string;
  description: string;
  category: ToolCategory;
  enabledByDefault: boolean;
  /** If true the tool is always included and cannot be toggled off */
  locked?: boolean;
}

export interface ToolContext {
  userId: string;
  taskId: string;
  conversationId?: string;
}

// ---------------------------------------------------------------------------
// Catalog – the master list of available tools (UI-facing metadata)
// ---------------------------------------------------------------------------

export const TOOL_CATALOG: ToolDefinition[] = [
  {
    id: "get_task_context",
    name: "Get Task Context",
    description: "Read full task details including classification, clarification history, and source info.",
    category: "task-mgmt",
    enabledByDefault: true,
    locked: true,
  },
  {
    id: "create_subtask",
    name: "Create Subtask",
    description: "Create new subtasks on the user's board to break down work.",
    category: "task-mgmt",
    enabledByDefault: true,
  },
  {
    id: "update_task",
    name: "Update Task",
    description: "Edit the original task's title or description with enriched details.",
    category: "task-mgmt",
    enabledByDefault: true,
  },
  {
    id: "mark_complete",
    name: "Mark Complete",
    description: "Mark the delegated task as completed after all actions are taken.",
    category: "task-mgmt",
    enabledByDefault: true,
  },
  {
    id: "create_artifact",
    name: "Create Artifact",
    description: "Save a document, code file, or structured data as a reviewable artifact attached to the task.",
    category: "output",
    enabledByDefault: true,
  },
  {
    id: "create_github_issue",
    name: "Create GitHub Issue",
    description: "Create issues on the user's connected GitHub repositories.",
    category: "development",
    enabledByDefault: true,
  },
  {
    id: "send_email",
    name: "Send Email",
    description: "Send emails to delegate tasks or notify people.",
    category: "communication",
    enabledByDefault: false,
  },
  {
    id: "web_search",
    name: "Web Search",
    description: "Search the web for real-time information using OpenAI's built-in search.",
    category: "research",
    enabledByDefault: true,
  },
  {
    id: "web_fetch",
    name: "Fetch URL Content",
    description: "Fetch and extract text content from a web page URL.",
    category: "research",
    enabledByDefault: true,
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

/** Wraps a tool so its execute always returns a JSON string (OpenAI Responses API compat) */
function stringTool<T extends z.ZodType>(opts: {
  description: string;
  inputSchema: T;
  execute: (input: z.infer<T>) => Promise<unknown>;
}) {
  return tool({
    description: opts.description,
    inputSchema: opts.inputSchema,
    execute: async (input: z.infer<T>) => {
      const result = await opts.execute(input);
      return JSON.stringify(result);
    },
  });
}

/** Compute the default set of enabled tool IDs from the catalog */
export function getDefaultToolIds(): string[] {
  return TOOL_CATALOG.filter((t) => t.enabledByDefault).map((t) => t.id);
}

/** Resolve enabled IDs – always includes locked tools */
export function resolveEnabledIds(userIds: string[] | null): string[] {
  const lockedIds = TOOL_CATALOG.filter((t) => t.locked).map((t) => t.id);
  const base = userIds ?? getDefaultToolIds();
  return [...new Set([...lockedIds, ...base])];
}

// ---------------------------------------------------------------------------
// Tool factories – each returns the AI SDK tool object for a given context
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyTool = ReturnType<typeof tool<any, any>>;
type ToolFactory = (ctx: ToolContext) => AnyTool;

const toolFactories: Record<string, ToolFactory> = {
  // ---- task-mgmt --------------------------------------------------------
  get_task_context: (ctx) =>
    stringTool({
      description: "Get the full details of the task being delegated, including its classification, clarification history, and source info.",
      inputSchema: z.object({}),
      execute: async () => {
        const task = await prisma.task.findUnique({
          where: { id: ctx.taskId },
          include: {
            classification: true,
            clarifications: true,
            source: { select: { type: true, name: true } },
          },
        });
        if (!task) return { error: "Task not found" };
        return {
          title: task.title,
          description: task.description,
          quadrant: task.quadrant,
          status: task.status,
          externalUrl: task.externalUrl,
          classification: task.classification
            ? { reasoning: task.classification.reasoning, confidence: task.classification.confidence }
            : null,
          clarifications: task.clarifications.map((c) => ({ question: c.question, answer: c.answer })),
          source: task.source ? { type: task.source.type, name: task.source.name } : null,
        };
      },
    }),

  create_subtask: (ctx) =>
    stringTool({
      description: "Create a new subtask on the user's board. Use this to break down the delegated task into actionable items.",
      inputSchema: z.object({
        title: z.string().describe("Title of the subtask"),
        description: z.string().optional().describe("Optional description"),
        quadrant: z.enum(["do", "schedule", "delegate", "delete"]).optional().describe("Which quadrant to place it in. Defaults to 'do'."),
      }),
      execute: async ({ title, description, quadrant }) => {
        const matrix = await prisma.matrix.findFirst({
          where: { userId: ctx.userId },
          orderBy: { createdAt: "asc" },
        });
        const subtask = await prisma.task.create({
          data: {
            title,
            description: description || null,
            userId: ctx.userId,
            matrixId: matrix?.id || null,
            quadrant: quadrant || "do",
            status: "active",
          },
        });
        return { success: true, taskId: subtask.id, title: subtask.title, quadrant: subtask.quadrant };
      },
    }),

  update_task: (ctx) =>
    stringTool({
      description: "Update the original task's title or description with enriched details based on the conversation.",
      inputSchema: z.object({
        title: z.string().optional().describe("New title for the task"),
        description: z.string().optional().describe("Updated description with more details"),
      }),
      execute: async ({ title, description }) => {
        const data: Record<string, string> = {};
        if (title) data.title = title;
        if (description) data.description = description;
        if (Object.keys(data).length === 0) return { error: "Nothing to update" };
        const updated = await prisma.task.update({ where: { id: ctx.taskId }, data });
        return { success: true, title: updated.title, description: updated.description };
      },
    }),

  mark_complete: (ctx) =>
    stringTool({
      description: "Mark the delegated task as completed after all actions have been taken.",
      inputSchema: z.object({
        summary: z.string().describe("Brief summary of what was accomplished"),
      }),
      execute: async ({ summary }) => {
        await prisma.task.update({ where: { id: ctx.taskId }, data: { status: "completed" } });
        await prisma.agentConversation.updateMany({
          where: { taskId: ctx.taskId, userId: ctx.userId },
          data: { status: "completed", summary },
        });
        return { success: true, summary };
      },
    }),

  // ---- output -----------------------------------------------------------
  create_artifact: (ctx) =>
    stringTool({
      description:
        "Save a document, code file, plan, or structured data as a reviewable artifact. Use this when you produce any substantial output the user should be able to review later.",
      inputSchema: z.object({
        title: z.string().describe("Short descriptive title for the artifact"),
        content: z.string().describe("The full content of the artifact (markdown, code, JSON, etc.)"),
        mimeType: z
          .enum(["text/markdown", "text/plain", "application/json", "text/csv", "text/x-python", "text/x-typescript", "text/x-javascript"])
          .optional()
          .describe("Content type. Defaults to text/markdown."),
        language: z.string().optional().describe("Programming language if this is a code artifact (e.g. typescript, python)"),
      }),
      execute: async ({ title, content, mimeType, language }) => {
        const artifact = await prisma.artifact.create({
          data: {
            title,
            content,
            mimeType: mimeType || "text/markdown",
            language: language || null,
            toolName: "create_artifact",
            taskId: ctx.taskId,
            userId: ctx.userId,
            conversationId: ctx.conversationId || null,
          },
        });
        return { success: true, artifactId: artifact.id, title: artifact.title, mimeType: artifact.mimeType };
      },
    }),

  // ---- development ------------------------------------------------------
  create_github_issue: (ctx) =>
    stringTool({
      description: "Create a GitHub issue on one of the user's connected repositories.",
      inputSchema: z.object({
        repo: z.string().describe("Repository name in 'owner/repo' format"),
        title: z.string().describe("Issue title"),
        body: z.string().optional().describe("Issue body/description in markdown"),
        labels: z.array(z.string()).optional().describe("Labels to apply"),
      }),
      execute: async ({ repo, title, body, labels }) => {
        const source = await prisma.source.findFirst({
          where: { userId: ctx.userId, type: "github", name: repo },
        });
        if (!source) {
          return { error: `No connected GitHub source found for ${repo}. Available sources can be checked in settings.` };
        }
        try {
          const { Octokit } = await import("octokit");
          const octokit = new Octokit({ auth: source.accessToken });
          const [owner, repoName] = repo.split("/");
          const result = await octokit.rest.issues.create({
            owner,
            repo: repoName,
            title,
            body: body || "",
            labels: labels || [],
          });
          return { success: true, issueNumber: result.data.number, url: result.data.html_url };
        } catch (err) {
          return { error: `Failed to create issue: ${err instanceof Error ? err.message : "unknown error"}` };
        }
      },
    }),

  // ---- communication ----------------------------------------------------
  send_email: () =>
    stringTool({
      description: "Send an email to someone. Use this to delegate tasks via email or notify someone about a task.",
      inputSchema: z.object({
        to: z.string().email().describe("Recipient email address"),
        subject: z.string().describe("Email subject"),
        body: z.string().describe("Email body in HTML"),
      }),
      execute: async ({ to, subject, body }) => {
        if (!resend) return { error: "Email service not configured" };
        try {
          await resend.emails.send({ from: "Iketrix <noreply@iketrix.app>", to, subject, html: body });
          return { success: true, sentTo: to };
        } catch (err) {
          return { error: `Failed to send email: ${err instanceof Error ? err.message : "unknown error"}` };
        }
      },
    }),

  // ---- research ---------------------------------------------------------
  web_search: () => {
    // Provider-executed: OpenAI handles the search server-side
    return gateway.tools.webSearch();
  },

  web_fetch: () =>
    stringTool({
      description: "Fetch and extract the main text content from a web page URL. Useful for researching topics or reading documentation.",
      inputSchema: z.object({
        url: z.string().url().describe("The URL to fetch"),
      }),
      execute: async ({ url }) => {
        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 10_000);
          const res = await fetch(url, {
            signal: controller.signal,
            headers: { "User-Agent": "Iketrix-Agent/1.0" },
          });
          clearTimeout(timeout);
          if (!res.ok) return { error: `HTTP ${res.status}: ${res.statusText}` };
          const html = await res.text();
          // Simple HTML-to-text: strip tags, decode entities, collapse whitespace
          const text = html
            .replace(/<script[\s\S]*?<\/script>/gi, "")
            .replace(/<style[\s\S]*?<\/style>/gi, "")
            .replace(/<[^>]+>/g, " ")
            .replace(/&nbsp;/g, " ")
            .replace(/&amp;/g, "&")
            .replace(/&lt;/g, "<")
            .replace(/&gt;/g, ">")
            .replace(/&quot;/g, '"')
            .replace(/\s+/g, " ")
            .trim()
            .slice(0, 8000);
          return { success: true, url, contentLength: text.length, content: text };
        } catch (err) {
          return { error: `Failed to fetch: ${err instanceof Error ? err.message : "unknown error"}` };
        }
      },
    }),
};

// ---------------------------------------------------------------------------
// buildToolset – compose the final tools object for ToolLoopAgent
// ---------------------------------------------------------------------------

export function buildToolset(
  enabledIds: string[],
  ctx: ToolContext
): Record<string, AnyTool> {
  const tools: Record<string, AnyTool> = {};
  for (const id of enabledIds) {
    const factory = toolFactories[id];
    if (factory) {
      // Use camelCase key names for the agent
      const key = id.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
      tools[key] = factory(ctx);
    }
  }
  return tools;
}
