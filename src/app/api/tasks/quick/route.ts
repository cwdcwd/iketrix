import { NextRequest, NextResponse } from "next/server";
import { getOrCreateUser } from "@/lib/user";
import { prisma } from "@/lib/prisma";
import { classifyTask } from "@/lib/classify";

// POST /api/tasks/quick — create a quick task and auto-classify it
export async function POST(req: NextRequest) {
  const user = await getOrCreateUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { title, matrixId } = await req.json();
  if (!title || typeof title !== "string" || title.trim().length === 0) {
    return NextResponse.json({ error: "title is required" }, { status: 400 });
  }

  const task = await prisma.task.create({
    data: {
      title: title.trim(),
      userId: user.id,
      matrixId: matrixId || null,
      status: "active",
    },
  });

  // Classify in the background — don't block the response
  classifyTask(task.id, task.title, null, [], user.id).catch((err) => {
    console.error(`[quick] Failed to classify "${task.title}":`, err);
  });

  return NextResponse.json({ task }, { status: 201 });
}
