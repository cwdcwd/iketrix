import { NextRequest, NextResponse } from "next/server";
import { getOrCreateUser } from "@/lib/user";
import { prisma } from "@/lib/prisma";

// GET /api/tasks/:taskId/artifacts — list artifacts for a task
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  const user = await getOrCreateUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { taskId } = await params;

  const artifacts = await prisma.artifact.findMany({
    where: { taskId, userId: user.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      mimeType: true,
      language: true,
      toolName: true,
      createdAt: true,
    },
  });

  return NextResponse.json(artifacts);
}
