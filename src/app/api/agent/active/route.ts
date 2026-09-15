import { NextResponse } from "next/server";
import { getOrCreateUser } from "@/lib/user";
import { prisma } from "@/lib/prisma";

// GET /api/agent/active — active conversations + recent artifacts for sidebar
export async function GET() {
  const user = await getOrCreateUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [conversations, artifacts] = await Promise.all([
    prisma.agentConversation.findMany({
      where: { userId: user.id, status: "active" },
      orderBy: { updatedAt: "desc" },
      take: 10,
      include: {
        task: { select: { id: true, title: true, quadrant: true } },
      },
    }),
    prisma.artifact.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true,
        title: true,
        mimeType: true,
        language: true,
        toolName: true,
        createdAt: true,
        task: { select: { id: true, title: true } },
      },
    }),
  ]);

  return NextResponse.json({ conversations, artifacts });
}
