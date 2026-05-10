import { generateObject } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { z } from "zod";
import { prisma } from "./prisma";

const gateway = createOpenAI({
  baseURL: "https://ai-gateway.vercel.sh/v1",
  apiKey: process.env.AI_GATEWAY_API_KEY,
});

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
  // Get user settings for model and prompt
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { classifierModel: true, classifierPrompt: true },
  });
  const modelId = user?.classifierModel || "openai/gpt-4o-mini";

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

  const systemPrompt = user?.classifierPrompt || `You are an Eisenhower Matrix classifier. Classify this task into one of four quadrants:

- "do": Important AND Urgent — must be done immediately and personally
- "schedule": Important AND NOT Urgent — set a deadline, do personally later  
- "delegate": NOT Important AND Urgent — assign to someone else
- "delete": NOT Important AND NOT Urgent — drop it entirely

Consider urgency signals (deadlines, bugs, blockers, "ASAP") and importance signals (business value, user impact, strategic goals). Provide your reasoning.`;

  const prompt = `${systemPrompt}

Task: ${title}
${description ? `Description: ${description}` : ""}
${labels.length > 0 ? `Labels: ${labels.join(", ")}` : ""}

${
  correctionHistory
    ? `The user has previously corrected these classifications — learn from their preferences:\n${correctionHistory}\n`
    : ""
}`;

  let object;
  try {
    const result = await generateObject({
      model: gateway(modelId),
      schema: quadrantSchema,
      prompt,
    });
    object = result.object;
  } catch (err) {
    console.error(`[classify] Failed to classify task "${title}" (${taskId}):`, err);
    throw err;
  }

  // Store classification
  const classification = await prisma.taskClassification.upsert({
    where: { taskId },
    create: {
      taskId,
      quadrant: object.quadrant,
      reasoning: object.reasoning,
      confidence: object.confidence,
      model: modelId,
    },
    update: {
      quadrant: object.quadrant,
      reasoning: object.reasoning,
      confidence: object.confidence,
      model: modelId,
    },
  });

  // Update task quadrant
  await prisma.task.update({
    where: { id: taskId },
    data: { quadrant: object.quadrant },
  });

  console.log(`[classify] ✓ "${title}" → ${object.quadrant} (${Math.round(object.confidence * 100)}%)`);
  return classification;
}

export async function classifyTasks(
  tasks: Array<{ id: string; title: string; description: string | null; labels: string[] }>,
  userId: string
) {
  console.log(`[classify] Classifying ${tasks.length} tasks...`);
  const results = await Promise.allSettled(
    tasks.map((task) =>
      classifyTask(task.id, task.title, task.description, task.labels, userId)
    )
  );
  const fulfilled = results.filter((r) => r.status === "fulfilled").length;
  const rejected = results.filter((r) => r.status === "rejected");
  if (rejected.length > 0) {
    console.error(`[classify] ${rejected.length}/${tasks.length} tasks failed classification:`);
    rejected.forEach((r, i) => {
      if (r.status === "rejected") {
        console.error(`  [${i}] ${r.reason?.message || r.reason}`);
      }
    });
  }
  console.log(`[classify] Done: ${fulfilled} classified, ${rejected.length} failed`);
  return results;
}
