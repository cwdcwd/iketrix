import { NextRequest, NextResponse } from "next/server";
import { getOrCreateUser } from "@/lib/user";
import { prisma } from "@/lib/prisma";
import { classifyTask } from "@/lib/classify";

// POST /api/tasks/[taskId]/reclassify — retry classification for a stuck task
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  const user = await getOrCreateUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { taskId } = await params;

  const task = await prisma.task.findUnique({
    where: { id: taskId, userId: user.id },
  });

  if (!task) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    const result = await classifyTask(
      task.id,
      task.title,
      task.description,
      [],
      user.id
    );

    const updated = await prisma.task.findUnique({
      where: { id: taskId },
      include: {
        classification: { select: { reasoning: true, confidence: true } },
        clarifications: { select: { question: true, answer: true, createdAt: true }, orderBy: { createdAt: "asc" } },
      },
    });

    return NextResponse.json({ task: updated, result });
  } catch (err) {
    console.error(`[reclassify] Failed for "${task.title}":`, err);
    return NextResponse.json({ error: "Classification failed" }, { status: 500 });
  }
}
