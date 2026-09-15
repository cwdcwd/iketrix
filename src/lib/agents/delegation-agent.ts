import { ToolLoopAgent } from "ai";
import { gateway } from "@/lib/ai-gateway";
import { buildToolset, resolveEnabledIds, type ToolContext } from "./tool-registry";

export function createDelegationAgent(
  userId: string,
  taskId: string,
  opts?: { modelId?: string; enabledToolIds?: string[] | null; conversationId?: string }
) {
  const model = opts?.modelId || "openai/gpt-4o";
  const enabledIds = resolveEnabledIds(opts?.enabledToolIds ?? null);

  const ctx: ToolContext = { userId, taskId, conversationId: opts?.conversationId };
  const tools = buildToolset(enabledIds, ctx);

  return new ToolLoopAgent({
    model: gateway(model),
    instructions: `You are a task delegation assistant for an Eisenhower Matrix productivity app called Iketrix.

Your job is to help the user clarify and execute a delegated task. You should:
1. Understand what the task involves by asking focused clarifying questions
2. Once you understand the task, take action using your tools — create subtasks, GitHub issues, send emails, or update the task description
3. Be concise and action-oriented — don't ask too many questions before acting
4. After taking actions, summarize what you did
5. When you produce substantial written output (plans, reports, code, research), save it as an artifact so the user can review it later

You have access to the user's task context and can perform actions on their behalf. Always confirm before sending emails to external people.`,
    tools,
  });
}
