import { NextRequest, NextResponse } from "next/server";
import { getOrCreateUser } from "@/lib/user";
import { prisma } from "@/lib/prisma";

// GET /api/agent/conversations?taskId=... — find existing conversation for a task
export async function GET(req: NextRequest) {
  const user = await getOrCreateUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const taskId = req.nextUrl.searchParams.get("taskId");
  if (!taskId) {
    return NextResponse.json({ error: "taskId required" }, { status: 400 });
  }

  const conversation = await prisma.agentConversation.findUnique({
    where: { taskId },
    select: { id: true, status: true },
  });

  if (!conversation || conversation.status === "abandoned") {
    return NextResponse.json({ conversationId: null });
  }

  return NextResponse.json({ conversationId: conversation.id });
}
