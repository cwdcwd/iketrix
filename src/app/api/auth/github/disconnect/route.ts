import { NextResponse } from "next/server";
import { getOrCreateUser } from "@/lib/user";
import { prisma } from "@/lib/prisma";

// POST /api/auth/github/disconnect — remove GitHub token and all sources
export async function POST() {
  const user = await getOrCreateUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Remove all GitHub sources for this user
  await prisma.source.deleteMany({
    where: { userId: user.id, type: "github" },
  });

  // Clear the GitHub token and installation ID
  await prisma.user.update({
    where: { id: user.id },
    data: { githubToken: null, githubInstallationId: null },
  });

  return NextResponse.json({ ok: true });
}
