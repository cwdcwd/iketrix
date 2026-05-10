import { NextRequest, NextResponse } from "next/server";
import { getOrCreateUser } from "@/lib/user";
import { prisma } from "@/lib/prisma";

// PATCH /api/tasks/[taskId]/matrix — move a task to a different matrix
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  const user = await getOrCreateUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { taskId } = await params;
  const { matrixId } = await req.json();

  const task = await prisma.task.findFirst({
    where: { id: taskId, userId: user.id },
  });
  if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 });

  // Verify target matrix belongs to user (or null to unscope)
  if (matrixId) {
    const matrix = await prisma.matrix.findFirst({
      where: { id: matrixId, userId: user.id },
    });
    if (!matrix) return NextResponse.json({ error: "Matrix not found" }, { status: 404 });
  }

  await prisma.task.update({
    where: { id: taskId },
    data: { matrixId: matrixId || null },
  });

  return NextResponse.json({ ok: true });
}
