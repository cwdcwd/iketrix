import { NextRequest, NextResponse } from "next/server";
import { getOrCreateUser } from "@/lib/user";
import { prisma } from "@/lib/prisma";

// GET /api/matrices/[matrixId] — get a single matrix
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ matrixId: string }> }
) {
  const user = await getOrCreateUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { matrixId } = await params;
  const matrix = await prisma.matrix.findFirst({
    where: { id: matrixId, userId: user.id },
    include: {
      sources: { select: { id: true, name: true, type: true } },
      _count: { select: { tasks: { where: { status: "active" } } } },
    },
  });

  if (!matrix) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ matrix });
}

// PATCH /api/matrices/[matrixId] — update name/description
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ matrixId: string }> }
) {
  const user = await getOrCreateUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { matrixId } = await params;
  const existing = await prisma.matrix.findFirst({
    where: { id: matrixId, userId: user.id },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { name, description } = await req.json();
  const matrix = await prisma.matrix.update({
    where: { id: matrixId },
    data: {
      ...(name !== undefined ? { name: name.trim() } : {}),
      ...(description !== undefined ? { description: description?.trim() || null } : {}),
    },
  });

  return NextResponse.json({ matrix });
}

// DELETE /api/matrices/[matrixId] — delete a matrix (tasks become unscoped)
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ matrixId: string }> }
) {
  const user = await getOrCreateUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { matrixId } = await params;
  const existing = await prisma.matrix.findFirst({
    where: { id: matrixId, userId: user.id },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.matrix.delete({ where: { id: matrixId } });
  return NextResponse.json({ deleted: true });
}
