import { NextRequest, NextResponse } from "next/server";
import { getOrCreateUser } from "@/lib/user";
import { prisma } from "@/lib/prisma";

// PATCH /api/tasks/[taskId]/complete — toggle task completed/active
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  const user = await getOrCreateUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { taskId } = await params;
  const { completed } = await req.json();

  const task = await prisma.task.findFirst({
    where: { id: taskId, userId: user.id },
  });
  if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 });

  const updated = await prisma.task.update({
    where: { id: taskId },
    data: { status: completed ? "completed" : "active" },
  });

  return NextResponse.json({ task: updated });
}
