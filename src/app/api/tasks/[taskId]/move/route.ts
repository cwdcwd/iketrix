import { NextRequest, NextResponse } from "next/server";
import { getOrCreateUser } from "@/lib/user";
import { prisma } from "@/lib/prisma";

// PATCH /api/tasks/[taskId]/move — move a task to a different quadrant
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  const user = await getOrCreateUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { taskId } = await params;
  const { quadrant } = await req.json();

  const validQuadrants = ["do", "schedule", "delegate", "delete"];
  if (!validQuadrants.includes(quadrant)) {
    return NextResponse.json({ error: "Invalid quadrant" }, { status: 400 });
  }

  const task = await prisma.task.findFirst({
    where: { id: taskId, userId: user.id },
  });
  if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 });

  const fromQuadrant = task.quadrant || "unclassified";

  // Record the override for LLM learning
  if (fromQuadrant !== quadrant) {
    await prisma.classificationOverride.create({
      data: {
        taskId,
        userId: user.id,
        fromQuadrant,
        toQuadrant: quadrant,
      },
    });
  }

  const updated = await prisma.task.update({
    where: { id: taskId },
    data: { quadrant },
  });

  return NextResponse.json({ task: updated });
}
