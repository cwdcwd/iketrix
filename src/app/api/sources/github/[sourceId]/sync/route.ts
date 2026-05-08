import { NextRequest, NextResponse } from "next/server";
import { getOrCreateUser } from "@/lib/user";
import { prisma } from "@/lib/prisma";
import { GitHubAdapter } from "@/lib/adapters/github";
import { classifyTasks } from "@/lib/classify";

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

  if (existingCount === 0) {
    // First import — fetch all
    const tasks = await adapter.fetchAll(connection);
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

  // Classify unclassified tasks
  let classified = 0;
  if (imported.length > 0) {
    const results = await classifyTasks(imported, user.id);
    classified = results.filter((r) => r.status === "fulfilled").length;
  }

  return NextResponse.json({
    imported: imported.length,
    classified,
    total: await prisma.task.count({ where: { sourceId: source.id, status: "active" } }),
  });
}
