import { NextRequest, NextResponse } from "next/server";
import { getOrCreateUser } from "@/lib/user";
import { prisma } from "@/lib/prisma";
import { classifyTask } from "@/lib/classify";

// POST /api/tasks/[taskId]/clarify — submit a clarification answer and reclassify
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  const user = await getOrCreateUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { taskId } = await params;
  const { answer } = await req.json();

  if (!answer || typeof answer !== "string" || answer.trim().length === 0) {
    return NextResponse.json({ error: "answer is required" }, { status: 400 });
  }

  const task = await prisma.task.findFirst({
    where: { id: taskId, userId: user.id },
  });
  if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 });

  // Store the clarification
  await prisma.clarification.create({
    data: {
      taskId,
      question: task.pendingQuestion || "User-provided context",
      answer: answer.trim(),
    },
  });

  // Clear the pending state before reclassifying
  await prisma.task.update({
    where: { id: taskId },
    data: {
      needsClarification: false,
      pendingQuestion: null,
    },
  });

  // Reclassify with the new clarification context
  try {
    const result = await classifyTask(
      taskId,
      task.title,
      task.description,
      [],
      user.id
    );

    // Fetch updated task
    const updated = await prisma.task.findUnique({
      where: { id: taskId },
      include: {
        classification: { select: { reasoning: true, confidence: true } },
        clarifications: { select: { question: true, answer: true, createdAt: true }, orderBy: { createdAt: "asc" } },
        source: { select: { name: true, type: true } },
      },
    });

    return NextResponse.json({ task: updated, result });
  } catch (err) {
    console.error(`[clarify] Failed to reclassify task "${task.title}":`, err);
    return NextResponse.json({ error: "Classification failed" }, { status: 500 });
  }
}
