import { generateObject } from "ai";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";
import { prisma } from "./prisma";

const quadrantSchema = z.object({
  quadrant: z.enum(["do", "schedule", "delegate", "delete"]),
  reasoning: z.string(),
  confidence: z.number().min(0).max(1),
});

export async function classifyTask(
  taskId: string,
  title: string,
  description: string | null,
  labels: string[],
  userId: string
) {
  // Get user's past overrides to learn from corrections
  const overrides = await prisma.classificationOverride.findMany({
    where: { userId },
    include: { task: { select: { title: true, description: true } } },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  const correctionHistory = overrides
    .map(
      (o) =>
        `- "${o.task.title}" was classified as "${o.fromQuadrant}" but user moved it to "${o.toQuadrant}"`
    )
    .join("\n");

  const prompt = `You are an Eisenhower Matrix classifier. Classify this task into one of four quadrants:

- "do": Important AND Urgent — must be done immediately and personally
- "schedule": Important AND NOT Urgent — set a deadline, do personally later  
- "delegate": NOT Important AND Urgent — assign to someone else
- "delete": NOT Important AND NOT Urgent — drop it entirely

Task: ${title}
${description ? `Description: ${description}` : ""}
${labels.length > 0 ? `Labels: ${labels.join(", ")}` : ""}

${
  correctionHistory
    ? `The user has previously corrected these classifications — learn from their preferences:\n${correctionHistory}\n`
    : ""
}

Consider urgency signals (deadlines, bugs, blockers, "ASAP") and importance signals (business value, user impact, strategic goals). Provide your reasoning.`;

  const { object } = await generateObject({
    model: openai("gpt-4o-mini"),
    schema: quadrantSchema,
    prompt,
  });

  // Store classification
  const classification = await prisma.taskClassification.upsert({
    where: { taskId },
    create: {
      taskId,
      quadrant: object.quadrant,
      reasoning: object.reasoning,
      confidence: object.confidence,
      model: "gpt-4o-mini",
    },
    update: {
      quadrant: object.quadrant,
      reasoning: object.reasoning,
      confidence: object.confidence,
      model: "gpt-4o-mini",
    },
  });

  // Update task quadrant
  await prisma.task.update({
    where: { id: taskId },
    data: { quadrant: object.quadrant },
  });

  return classification;
}

export async function classifyTasks(
  tasks: Array<{ id: string; title: string; description: string | null; labels: string[] }>,
  userId: string
) {
  const results = await Promise.allSettled(
    tasks.map((task) =>
      classifyTask(task.id, task.title, task.description, task.labels, userId)
    )
  );
  return results;
}
