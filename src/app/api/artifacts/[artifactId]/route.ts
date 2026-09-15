import { NextRequest, NextResponse } from "next/server";
import { getOrCreateUser } from "@/lib/user";
import { prisma } from "@/lib/prisma";

// GET /api/artifacts/:artifactId — get a single artifact with content
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ artifactId: string }> }
) {
  const user = await getOrCreateUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { artifactId } = await params;

  const artifact = await prisma.artifact.findUnique({
    where: { id: artifactId },
  });

  if (!artifact || artifact.userId !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(artifact);
}

// DELETE /api/artifacts/:artifactId — delete an artifact
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ artifactId: string }> }
) {
  const user = await getOrCreateUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { artifactId } = await params;

  const artifact = await prisma.artifact.findUnique({
    where: { id: artifactId },
    select: { userId: true },
  });

  if (!artifact || artifact.userId !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.artifact.delete({ where: { id: artifactId } });
  return NextResponse.json({ success: true });
}
