import { NextRequest, NextResponse } from "next/server";
import { getOrCreateUser } from "@/lib/user";
import { prisma } from "@/lib/prisma";
import { GitHubAdapter } from "@/lib/adapters/github";
import { classifyTasks } from "@/lib/classify";
import { refreshGitHubToken } from "@/lib/github-token";

const adapter = new GitHubAdapter();

// POST /api/sources/github/[sourceId]/sync — import/sync issues from a GitHub repo
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ sourceId: string }> }
) {
  const user = await getOrCreateUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { sourceId } = await params;
  const source = await prisma.source.findFirst({
    where: { id: sourceId, userId: user.id },
  });
  if (!source) return NextResponse.json({ error: "Source not found" }, { status: 404 });

  const connection = {
    id: source.id,
    type: source.type,
    name: source.name,
    accessToken: source.accessToken,
  };

  // Check if we have existing tasks — if so, sync; otherwise fetch all
  const existingCount = await prisma.task.count({
    where: { sourceId: source.id },
  });

  let imported: Array<{ id: string; title: string; description: string | null; labels: string[] }> = [];

  console.log(`[sync] Starting sync for source ${source.name} (${sourceId}), existing tasks: ${existingCount}`);

  try {
  if (existingCount === 0) {
    // First import — fetch all
    console.log(`[sync] First import — fetching all issues from ${source.name}`);
    const tasks = await adapter.fetchAll(connection);
    console.log(`[sync] Fetched ${tasks.length} issues from ${source.name}`);
    for (const task of tasks) {
      const created = await prisma.task.upsert({
        where: {
          sourceId_externalId: {
            sourceId: source.id,
            externalId: task.externalId,
          },
        },
        create: {
          title: task.title,
          description: task.description,
          externalId: task.externalId,
          externalUrl: task.externalUrl,
          sourceId: source.id,
          userId: user.id,
          matrixId: source.matrixId,
          status: task.state === "closed" ? "completed" : "active",
        },
        update: {
          title: task.title,
          description: task.description,
          externalUrl: task.externalUrl,
          status: task.state === "closed" ? "completed" : "active",
        },
      });
      if (task.state === "open") {
        imported.push({
          id: created.id,
          title: created.title,
          description: created.description,
          labels: task.labels,
        });
      }
    }
  } else {
    // Sync — fetch only updates since last sync
    const lastTask = await prisma.task.findFirst({
      where: { sourceId: source.id },
      orderBy: { updatedAt: "desc" },
    });
    const since = lastTask?.updatedAt ?? new Date(0);
    const result = await adapter.sync(connection, since);

    for (const task of [...result.added, ...result.updated]) {
      const upserted = await prisma.task.upsert({
        where: {
          sourceId_externalId: {
            sourceId: source.id,
            externalId: task.externalId,
          },
        },
        create: {
          title: task.title,
          description: task.description,
          externalId: task.externalId,
          externalUrl: task.externalUrl,
          sourceId: source.id,
          userId: user.id,
          matrixId: source.matrixId,
          status: task.state === "closed" ? "completed" : "active",
        },
        update: {
          title: task.title,
          description: task.description,
          externalUrl: task.externalUrl,
          status: task.state === "closed" ? "completed" : "active",
        },
      });
      if (task.state === "open" && !upserted.quadrant) {
        imported.push({
          id: upserted.id,
          title: upserted.title,
          description: upserted.description,
          labels: task.labels,
        });
      }
    }

    for (const task of result.closed) {
      await prisma.task.updateMany({
        where: { sourceId: source.id, externalId: task.externalId },
        data: { status: "completed" },
      });
    }
  }
  } catch (err: unknown) {
    const status = (err as { status?: number }).status;
    if (status === 401 || status === 403) {
      // Try refreshing the token
      console.log(`[sync] Token expired for ${source.name}, attempting refresh...`);
      const newToken = await refreshGitHubToken(user.id);
      if (newToken) {
        // Update the source's access token too
        await prisma.source.update({
          where: { id: source.id },
          data: { accessToken: newToken },
        });
        return NextResponse.json(
          { error: "Token refreshed. Please retry sync.", imported: 0, classified: 0, failed: 0, total: 0, tokenRefreshed: true },
          { status: 200 }
        );
      }
      console.error(`[sync] Token refresh failed for ${source.name}`);
      return NextResponse.json(
        { error: "GitHub token expired. Please reconnect.", imported: 0, classified: 0, failed: 0, total: 0 },
        { status: 200 }
      );
    }
    throw err;
  }

  // Also pick up any previously unclassified tasks
  const unclassified = await prisma.task.findMany({
    where: {
      sourceId: source.id,
      status: "active",
      quadrant: null,
      id: { notIn: imported.map((t) => t.id) },
    },
    select: { id: true, title: true, description: true },
  });
  if (unclassified.length > 0) {
    console.log(`[sync] Found ${unclassified.length} previously unclassified tasks`);
    imported.push(
      ...unclassified.map((t) => ({
        id: t.id,
        title: t.title,
        description: t.description,
        labels: [] as string[],
      }))
    );
  }

  // Classify unclassified tasks
  let classified = 0;
  const failed: string[] = [];
  if (imported.length > 0) {
    console.log(`[sync] Classifying ${imported.length} tasks...`);
    const results = await classifyTasks(imported, user.id);
    classified = results.filter((r) => r.status === "fulfilled").length;
    results.forEach((r, i) => {
      if (r.status === "rejected") {
        failed.push(imported[i].title);
      }
    });
  }

  const total = await prisma.task.count({ where: { sourceId: source.id, status: "active" } });
  console.log(`[sync] Complete for ${source.name}: ${imported.length} imported, ${classified} classified, ${failed.length} failed, ${total} total active`);

  return NextResponse.json({
    imported: imported.length,
    classified,
    failed: failed.length,
    failedTasks: failed,
    total,
  });
}
