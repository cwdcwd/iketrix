import { generateObject } from "ai";
import { z } from "zod";
import { prisma } from "./prisma";
import { gateway } from "./ai-gateway";

const memorySchema = z.object({
  memory: z.string(),
  useful: z.boolean(),
});

/**
 * Extract a reusable classification preference from a user override.
 * Called async (fire-and-forget) after a user manually moves a task.
 */
export async function extractMemory(
  overrideId: string,
  taskTitle: string,
  taskDescription: string | null,
  fromQuadrant: string,
  toQuadrant: string,
  userId: string
) {
  // Get user's model preference
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { classifierModel: true },
  });
  const modelId = user?.classifierModel || "openai/gpt-4o-mini";

  // Get recent overrides for pattern context (last 10, excluding this one)
  const recentOverrides = await prisma.classificationOverride.findMany({
    where: { userId, id: { not: overrideId } },
    include: { task: { select: { title: true } } },
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  // Get existing memories to avoid duplicates
  const existingMemories = await prisma.classifierMemory.findMany({
    where: { userId },
    select: { content: true },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  const recentCorrections = recentOverrides
    .map((o) => `- "${o.task.title}": ${o.fromQuadrant} → ${o.toQuadrant}`)
    .join("\n");

  const existingMemoryList = existingMemories
    .map((m) => `- ${m.content}`)
    .join("\n");

  const prompt = `A user corrected an Eisenhower Matrix classification:

Task: "${taskTitle}"${taskDescription ? `\nDescription: ${taskDescription}` : ""}
AI classified as: "${fromQuadrant}"
User moved to: "${toQuadrant}"

${recentCorrections ? `Recent corrections by this user:\n${recentCorrections}\n` : ""}
${existingMemoryList ? `Already known preferences:\n${existingMemoryList}\n` : ""}

Extract ONE concise, reusable classification preference from this correction. The memory should be a general rule the classifier can apply to future tasks — not specific to this exact task.

Good examples:
- "Phone calls and errands are Delegate tasks, not Do tasks"
- "Home maintenance tasks are Schedule, not Delete"
- "Tasks mentioning clients or customers are always Important (Do or Schedule)"

Bad examples (too specific):
- "The task 'Call volkswagen' should be Delegate"
- "cheese is Do"

Set "useful" to false if this correction seems like a one-off that doesn't reveal a general preference (e.g., the task is too ambiguous to extract a pattern, or the existing memories already cover this pattern).`;

  try {
    const result = await generateObject({
      model: gateway(modelId),
      schema: memorySchema,
      prompt,
    });

    if (!result.object.useful) {
      console.log(`[memory] Skipped — not a useful pattern for "${taskTitle}"`);
      return null;
    }

    const memory = await prisma.classifierMemory.create({
      data: {
        userId,
        content: result.object.memory,
        sourceOverrideId: overrideId,
      },
    });

    console.log(`[memory] ✓ Learned: "${result.object.memory}"`);
    return memory;
  } catch (err) {
    console.error(`[memory] Failed to extract memory for "${taskTitle}":`, err);
    return null;
  }
}
