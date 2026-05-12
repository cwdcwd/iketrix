import { NextRequest, NextResponse } from "next/server";
import { getOrCreateUser } from "@/lib/user";
import { prisma } from "@/lib/prisma";
import { createDelegationAgent } from "@/lib/agents/delegation-agent";
import { createAgentUIStreamResponse, UIMessage } from "ai";

export const maxDuration = 60;

// POST /api/agent/chat — chat with the delegation agent
export async function POST(req: NextRequest) {
  const user = await getOrCreateUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { messages, conversationId, taskId } = (await req.json()) as {
    messages: UIMessage[];
    conversationId: string;
    taskId: string;
  };

  if (!conversationId || !taskId) {
    return NextResponse.json(
      { error: "conversationId and taskId required" },
      { status: 400 }
    );
  }

  // Verify conversation belongs to this user
  const conversation = await prisma.agentConversation.findFirst({
    where: { id: conversationId, userId: user.id, taskId },
  });
  if (!conversation) {
    return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
  }

  // Get task for context injection
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: { title: true, description: true, externalUrl: true },
  });

  // Get user's model preference
  const userSettings = await prisma.user.findUnique({
    where: { id: user.id },
    select: { classifierModel: true },
  });

  const agent = createDelegationAgent(
    user.id,
    taskId,
    userSettings?.classifierModel || undefined
  );

  // Persist the latest user message
  const lastMsg = messages[messages.length - 1];
  if (lastMsg && lastMsg.role === "user") {
    const textContent = lastMsg.parts
      ?.filter((p): p is { type: "text"; text: string } => p.type === "text")
      .map((p) => p.text)
      .join("\n") || "";

    if (textContent) {
      await prisma.agentMessage.create({
        data: {
          conversationId,
          role: "user",
          content: textContent,
        },
      });
    }
  }

  return createAgentUIStreamResponse({
    agent,
    uiMessages: messages,
    onStepFinish: async ({ text, toolCalls, toolResults }) => {
      // Persist assistant messages
      if (text) {
        await prisma.agentMessage.create({
          data: {
            conversationId,
            role: "assistant",
            content: text,
          },
        });
      }

      // Persist tool calls
      if (toolCalls && toolCalls.length > 0) {
        for (let i = 0; i < toolCalls.length; i++) {
          const tc = toolCalls[i] as { toolName?: string; args?: unknown };
          const tr = toolResults?.[i] as { result?: unknown } | undefined;
          await prisma.agentMessage.create({
            data: {
              conversationId,
              role: "tool",
              content: tr?.result ? JSON.stringify(tr.result) : "",
              toolName: (tc.toolName as string) || "unknown",
              toolArgs: (tc.args as object) ?? null,
              toolResult: (tr?.result as object) ?? null,
            },
          });
        }
      }
    },
  });
}
