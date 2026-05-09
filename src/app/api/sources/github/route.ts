import { NextRequest, NextResponse } from "next/server";
import { getOrCreateUser } from "@/lib/user";
import { prisma } from "@/lib/prisma";
import { GitHubAdapter } from "@/lib/adapters/github";

const adapter = new GitHubAdapter();

// POST /api/sources/github — connect a GitHub repo (uses user's OAuth token)
export async function POST(req: NextRequest) {
  const user = await getOrCreateUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { repo } = await req.json();
  if (!repo) {
    return NextResponse.json({ error: "repo required" }, { status: 400 });
  }

  // Get the user's stored GitHub OAuth token
  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { githubToken: true },
  });
  if (!dbUser?.githubToken) {
    return NextResponse.json(
      { error: "GitHub not connected. Please connect GitHub first." },
      { status: 400 }
    );
  }

  const accessToken = dbUser.githubToken;

  const valid = await adapter.validateConnection({
    id: "",
    type: "github",
    name: repo,
    accessToken,
  });
  if (!valid) {
    return NextResponse.json({ error: "Cannot access this repository" }, { status: 400 });
  }

  const source = await prisma.source.upsert({
    where: {
      userId_type_name: { userId: user.id, type: "github", name: repo },
    },
    create: {
      type: "github",
      name: repo,
      accessToken,
      userId: user.id,
    },
    update: { accessToken },
  });

  return NextResponse.json({ source: { id: source.id, name: source.name } });
}

// GET /api/sources/github — list connected repos
export async function GET() {
  const user = await getOrCreateUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sources = await prisma.source.findMany({
    where: { userId: user.id, type: "github" },
    select: { id: true, name: true, createdAt: true, updatedAt: true },
  });

  return NextResponse.json({ sources });
}
