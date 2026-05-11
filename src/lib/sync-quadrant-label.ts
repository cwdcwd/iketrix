import { prisma } from "./prisma";
import { GitHubAdapter } from "./adapters/github";
import { getValidGitHubToken } from "./github-token";

const adapter = new GitHubAdapter();

/**
 * Sync the quadrant label to the external source (e.g. GitHub issue).
 * Fire-and-forget — logs errors but never throws.
 */
export async function syncQuadrantLabel(
  taskId: string,
  quadrant: string,
  userId: string
): Promise<void> {
  try {
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      select: {
        externalId: true,
        source: { select: { id: true, type: true, name: true, accessToken: true } },
      },
    });

    if (!task?.source || !task.externalId) return;
    if (task.source.type !== "github") return;

    // Use a fresh token if possible
    const token = await getValidGitHubToken(userId) || task.source.accessToken;

    const connection = {
      id: task.source.id,
      type: task.source.type,
      name: task.source.name,
      accessToken: token,
    };

    const ok = await adapter.updateQuadrantLabel(connection, task.externalId, quadrant);
    if (ok) {
      console.log(`[label] ✓ #${task.externalId} → ${quadrant}`);
    }
  } catch (err) {
    console.error(`[label] Failed to sync label for task ${taskId}:`, err);
  }
}
