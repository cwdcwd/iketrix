import { NextRequest, NextResponse } from "next/server";
import { getOrCreateUser } from "@/lib/user";
import { prisma } from "@/lib/prisma";
import { GitHubAdapter } from "@/lib/adapters/github";
import { getValidGitHubToken } from "@/lib/github-token";

const github = new GitHubAdapter();

// PATCH /api/tasks/[taskId]/complete — toggle task completed/active
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  const user = await getOrCreateUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { taskId } = await params;
  const { completed } = await req.json();

  const task = await prisma.task.findFirst({
    where: { id: taskId, userId: user.id },
    include: { source: { select: { id: true, type: true, name: true, accessToken: true } } },
  });
  if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 });

  const updated = await prisma.task.update({
    where: { id: taskId },
    data: { status: completed ? "completed" : "active" },
  });

  // Sync state to GitHub issue (fire-and-forget)
  if (task.source?.type === "github" && task.externalId) {
    const token = await getValidGitHubToken(user.id) || task.source.accessToken;
    const connection = { id: task.source.id, type: task.source.type, name: task.source.name, accessToken: token };
    github.setIssueState(connection, task.externalId, completed ? "closed" : "open")
      .then((ok) => { if (ok) console.log(`[github] ${completed ? "Closed" : "Reopened"} #${task.externalId}`); })
      .catch((err) => console.error("[github] Failed to sync issue state:", err));
  }

  return NextResponse.json({ task: updated });
}
