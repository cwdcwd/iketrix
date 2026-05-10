import { NextResponse } from "next/server";
import { getOrCreateUser } from "@/lib/user";
import { prisma } from "@/lib/prisma";
import { Octokit } from "octokit";

// GET /api/auth/github/status — check if GitHub is connected and return username
export async function GET() {
  const user = await getOrCreateUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { githubToken: true },
  });

  if (!dbUser?.githubToken) {
    return NextResponse.json({ connected: false });
  }

  try {
    const octokit = new Octokit({ auth: dbUser.githubToken });
    const { data } = await octokit.rest.users.getAuthenticated();
    return NextResponse.json({
      connected: true,
      username: data.login,
      avatarUrl: data.avatar_url,
    });
  } catch {
    return NextResponse.json({ connected: false });
  }
}
