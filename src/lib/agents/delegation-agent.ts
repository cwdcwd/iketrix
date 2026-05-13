import { ToolLoopAgent, tool } from "ai";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { gateway } from "@/lib/ai-gateway";
import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

export function createDelegationAgent(userId: string, taskId: string, modelId?: string) {
  const model = modelId || "openai/gpt-4o";

  // Wrapper to ensure tool outputs are always strings (required by OpenAI Responses API)
  const stringTool = <T extends z.ZodType>(opts: {
    description: string;
    inputSchema: T;
    execute: (input: z.infer<T>) => Promise<unknown>;
  }) =>
    tool({
      description: opts.description,
      inputSchema: opts.inputSchema,
      execute: async (input: z.infer<T>) => {
        const result = await opts.execute(input);
        return JSON.stringify(result);
      },
    });

  return new ToolLoopAgent({
    model: gateway(model),
    instructions: `You are a task delegation assistant for an Eisenhower Matrix productivity app called Iketrix.

Your job is to help the user clarify and execute a delegated task. You should:
1. Understand what the task involves by asking focused clarifying questions
2. Once you understand the task, take action using your tools — create subtasks, GitHub issues, send emails, or update the task description
3. Be concise and action-oriented — don't ask too many questions before acting
4. After taking actions, summarize what you did

You have access to the user's task context and can perform actions on their behalf. Always confirm before sending emails to external people.`,
    tools: {
      getTaskContext: stringTool({
        description: "Get the full details of the task being delegated, including its classification, clarification history, and source info.",
        inputSchema: z.object({}),
        execute: async () => {
          const task = await prisma.task.findUnique({
            where: { id: taskId },
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

      createSubtask: stringTool({
        description: "Create a new subtask on the user's board. Use this to break down the delegated task into actionable items.",
        inputSchema: z.object({
          title: z.string().describe("Title of the subtask"),
          description: z.string().optional().describe("Optional description"),
          quadrant: z.enum(["do", "schedule", "delegate", "delete"]).optional().describe("Which quadrant to place it in. Defaults to 'do'."),
        }),
        execute: async ({ title, description, quadrant }) => {
          // Get user's default matrix
          const matrix = await prisma.matrix.findFirst({
            where: { userId },
            orderBy: { createdAt: "asc" },
          });

          const subtask = await prisma.task.create({
            data: {
              title,
              description: description || null,
              userId,
              matrixId: matrix?.id || null,
              quadrant: quadrant || "do",
              status: "active",
            },
          });

          return { success: true, taskId: subtask.id, title: subtask.title, quadrant: subtask.quadrant };
        },
      }),

      createGitHubIssue: stringTool({
        description: "Create a GitHub issue on one of the user's connected repositories.",
        inputSchema: z.object({
          repo: z.string().describe("Repository name in 'owner/repo' format"),
          title: z.string().describe("Issue title"),
          body: z.string().optional().describe("Issue body/description in markdown"),
          labels: z.array(z.string()).optional().describe("Labels to apply"),
        }),
        execute: async ({ repo, title, body, labels }) => {
          const source = await prisma.source.findFirst({
            where: { userId, type: "github", name: repo },
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
            return {
              success: true,
              issueNumber: result.data.number,
              url: result.data.html_url,
            };
          } catch (err) {
            return { error: `Failed to create issue: ${err instanceof Error ? err.message : "unknown error"}` };
          }
        },
      }),

      sendEmail: stringTool({
        description: "Send an email to someone. Use this to delegate tasks via email or notify someone about a task.",
        inputSchema: z.object({
          to: z.string().email().describe("Recipient email address"),
          subject: z.string().describe("Email subject"),
          body: z.string().describe("Email body in HTML"),
        }),
        execute: async ({ to, subject, body }) => {
          if (!resend) {
            return { error: "Email service not configured" };
          }
          try {
            await resend.emails.send({
              from: "Iketrix <noreply@iketrix.app>",
              to,
              subject,
              html: body,
            });
            return { success: true, sentTo: to };
          } catch (err) {
            return { error: `Failed to send email: ${err instanceof Error ? err.message : "unknown error"}` };
          }
        },
      }),

      updateTask: stringTool({
        description: "Update the original task's title or description with enriched details based on the conversation.",
        inputSchema: z.object({
          title: z.string().optional().describe("New title for the task"),
          description: z.string().optional().describe("Updated description with more details"),
        }),
        execute: async ({ title, description }) => {
          const data: Record<string, string> = {};
          if (title) data.title = title;
          if (description) data.description = description;

          if (Object.keys(data).length === 0) {
            return { error: "Nothing to update" };
          }

          const updated = await prisma.task.update({
            where: { id: taskId },
            data,
          });
          return { success: true, title: updated.title, description: updated.description };
        },
      }),

      markTaskComplete: stringTool({
        description: "Mark the delegated task as completed after all actions have been taken.",
        inputSchema: z.object({
          summary: z.string().describe("Brief summary of what was accomplished"),
        }),
        execute: async ({ summary }) => {
          await prisma.task.update({
            where: { id: taskId },
            data: { status: "completed" },
          });

          // Update the conversation summary
          await prisma.agentConversation.updateMany({
            where: { taskId, userId },
            data: { status: "completed", summary },
          });

          return { success: true, summary };
        },
      }),
    },
  });
}
