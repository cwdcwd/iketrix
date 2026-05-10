import { NextRequest, NextResponse } from "next/server";
import { getOrCreateUser } from "@/lib/user";
import { prisma } from "@/lib/prisma";

// GET /api/matrices — list all matrices for the user
export async function GET() {
  const user = await getOrCreateUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const matrices = await prisma.matrix.findMany({
    where: { userId: user.id },
    include: {
      _count: { select: { tasks: { where: { status: "active" } }, sources: true } },
    },
    orderBy: { updatedAt: "desc" },
  });

  return NextResponse.json({ matrices });
}

// POST /api/matrices — create a new matrix
export async function POST(req: NextRequest) {
  const user = await getOrCreateUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { name, description } = await req.json();
  if (!name || typeof name !== "string" || name.trim().length === 0) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  const matrix = await prisma.matrix.create({
    data: {
      name: name.trim(),
      description: description?.trim() || null,
      userId: user.id,
    },
  });

  return NextResponse.json({ matrix }, { status: 201 });
}
