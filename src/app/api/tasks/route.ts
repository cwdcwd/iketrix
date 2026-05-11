import { NextRequest, NextResponse } from "next/server";
import { getOrCreateUser } from "@/lib/user";
import { prisma } from "@/lib/prisma";

// GET /api/tasks?matrixId=...&status=... — get tasks for a matrix (or all if no matrixId)
export async function GET(req: NextRequest) {
  const user = await getOrCreateUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const matrixId = req.nextUrl.searchParams.get("matrixId");
  const status = req.nextUrl.searchParams.get("status");

  const statusFilter = status === "completed"
    ? { status: "completed" }
    : { status: { in: ["active", "delegated"] } };

  const tasks = await prisma.task.findMany({
    where: {
      userId: user.id,
      ...statusFilter,
      ...(matrixId ? { matrixId } : {}),
    },
    include: {
      classification: { select: { reasoning: true, confidence: true } },
      clarifications: { select: { question: true, answer: true, createdAt: true }, orderBy: { createdAt: "asc" } },
      source: { select: { name: true, type: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ tasks });
}

// PATCH /api/tasks — update a task's title
export async function PATCH(req: NextRequest) {
  const user = await getOrCreateUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, title } = await req.json();
  if (!id || typeof title !== "string" || !title.trim()) {
    return NextResponse.json({ error: "id and non-empty title required" }, { status: 400 });
  }

  const task = await prisma.task.findFirst({ where: { id, userId: user.id } });
  if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 });

  const updated = await prisma.task.update({
    where: { id },
    data: { title: title.trim() },
  });

  return NextResponse.json({ task: updated });
}
