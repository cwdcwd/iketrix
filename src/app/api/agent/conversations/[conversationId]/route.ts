import { NextRequest, NextResponse } from "next/server";
import { getOrCreateUser } from "@/lib/user";
import { prisma } from "@/lib/prisma";

// GET /api/agent/conversations/[conversationId] — load conversation messages
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  const user = await getOrCreateUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { conversationId } = await params;

  const conversation = await prisma.agentConversation.findFirst({
    where: { id: conversationId, userId: user.id },
    include: {
      task: { select: { id: true, title: true, description: true, status: true } },
      messages: { orderBy: { createdAt: "asc" } },
    },
  });

  if (!conversation) {
    return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
  }

  return NextResponse.json({ conversation });
}

// PATCH /api/agent/conversations/[conversationId] — update conversation status
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  const user = await getOrCreateUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { conversationId } = await params;
  const { status, summary } = await req.json();

  if (!status || !["completed", "abandoned"].includes(status)) {
    return NextResponse.json({ error: "status must be 'completed' or 'abandoned'" }, { status: 400 });
  }

  const conversation = await prisma.agentConversation.findFirst({
    where: { id: conversationId, userId: user.id },
  });
  if (!conversation) {
    return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
  }

  const updated = await prisma.agentConversation.update({
    where: { id: conversationId },
    data: { status, summary: summary || null },
  });

  return NextResponse.json({ conversation: updated });
}
