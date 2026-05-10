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
