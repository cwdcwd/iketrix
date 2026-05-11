import { NextRequest, NextResponse } from "next/server";
import { getOrCreateUser } from "@/lib/user";
import { prisma } from "@/lib/prisma";

// DELETE /api/memories/[memoryId] — remove a classifier memory
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ memoryId: string }> }
) {
  const user = await getOrCreateUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { memoryId } = await params;

  const memory = await prisma.classifierMemory.findFirst({
    where: { id: memoryId, userId: user.id },
  });

  if (!memory) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.classifierMemory.delete({ where: { id: memoryId } });

  return NextResponse.json({ success: true });
}
