import { generateObject } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { z } from "zod";
import { prisma } from "./prisma";

const gateway = createOpenAI({
  baseURL: "https://ai-gateway.vercel.sh/v1",
  apiKey: process.env.AI_GATEWAY_API_KEY,
});

const classifySchema = z.object({
  action: z.enum(["classify", "clarify"]),
  quadrant: z.enum(["do", "schedule", "delegate", "delete"]).nullable(),
  reasoning: z.string(),
  confidence: z.number().min(0).max(1),
  question: z.string().nullable(),
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

  // Get existing clarifications for this task
  const clarifications = await prisma.clarification.findMany({
    where: { taskId },
    orderBy: { createdAt: "asc" },
  });

  // Get user's past overrides to learn from corrections (last 5 for recency)
  const overrides = await prisma.classificationOverride.findMany({
    where: { userId },
    include: { task: { select: { title: true, description: true } } },
    orderBy: { createdAt: "desc" },
    take: 5,
  });

  // Get distilled memories from past corrections
  const memories = await prisma.classifierMemory.findMany({
    where: { userId },
    select: { content: true },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  const correctionHistory = overrides
    .map(
      (o) =>
        `- "${o.task.title}" was classified as "${o.fromQuadrant}" but user moved it to "${o.toQuadrant}"`
    )
    .join("\n");

  const learnedPreferences = memories
    .map((m) => `- ${m.content}`)
    .join("\n");

  const clarificationHistory = clarifications
    .map((c) => `Q: ${c.question}\nA: ${c.answer}`)
    .join("\n\n");

  const systemPrompt = user?.classifierPrompt || `You are an Eisenhower Matrix classifier. Classify this task into one of four quadrants:

- "do": Important AND Urgent — must be done immediately and personally
- "schedule": Important AND NOT Urgent — set a deadline, do personally later  
- "delegate": NOT Important AND Urgent — assign to someone else
- "delete": NOT Important AND NOT Urgent — drop it entirely

Consider urgency signals (deadlines, bugs, blockers, "ASAP") and importance signals (business value, user impact, strategic goals). Provide your reasoning.`;

  const prompt = `${systemPrompt}

IMPORTANT: If the task description is too vague or ambiguous to confidently determine its urgency or importance, you SHOULD set action to "clarify" and ask ONE specific clarifying question in the "question" field. Only ask when you genuinely cannot determine the quadrant — do not ask for tasks with clear signals.

If you can classify confidently (confidence >= 0.6), set action to "classify" and provide the quadrant.
If you need clarification, set action to "clarify", set confidence to your current best guess confidence, provide your best-guess quadrant, reasoning explaining your uncertainty, and a single focused question.

Task: ${title}
${description ? `Description: ${description}` : ""}
${labels.length > 0 ? `Labels: ${labels.join(", ")}` : ""}
${clarificationHistory ? `\nPrevious clarifications:\n${clarificationHistory}\n` : ""}
${
  learnedPreferences
    ? `LEARNED USER PREFERENCES (apply these rules when classifying):\n${learnedPreferences}\n`
    : ""
}
${
  correctionHistory
    ? `Recent corrections by this user:\n${correctionHistory}\n`
    : ""
}`;

  let object;
  try {
    const result = await generateObject({
      model: gateway(modelId),
      schema: classifySchema,
      prompt,
    });
    object = result.object;
  } catch (err) {
    console.error(`[classify] Failed to classify task "${title}" (${taskId}):`, err);
    throw err;
  }

  if (object.action === "clarify" && object.question) {
    // LLM needs more info — park the task as needing clarification
    await prisma.task.update({
      where: { id: taskId },
      data: {
        needsClarification: true,
        pendingQuestion: object.question,
        quadrant: null, // keep unclassified
      },
    });

    // Still store the tentative classification for reference
    await prisma.taskClassification.upsert({
      where: { taskId },
      create: {
        taskId,
        quadrant: object.quadrant || "schedule",
        reasoning: object.reasoning,
        confidence: object.confidence,
        model: modelId,
      },
      update: {
        quadrant: object.quadrant || "schedule",
        reasoning: object.reasoning,
        confidence: object.confidence,
        model: modelId,
      },
    });

    console.log(`[classify] ? "${title}" — needs clarification: ${object.question}`);
    return { needsClarification: true, question: object.question };
  }

  // Confident classification
  const quadrant = object.quadrant || "schedule";

  // Store classification
  const classification = await prisma.taskClassification.upsert({
    where: { taskId },
    create: {
      taskId,
      quadrant,
      reasoning: object.reasoning,
      confidence: object.confidence,
      model: modelId,
    },
    update: {
      quadrant,
      reasoning: object.reasoning,
      confidence: object.confidence,
      model: modelId,
    },
  });

  // Update task quadrant and clear any clarification state
  await prisma.task.update({
    where: { id: taskId },
    data: {
      quadrant,
      needsClarification: false,
      pendingQuestion: null,
    },
  });

  console.log(`[classify] ✓ "${title}" → ${quadrant} (${Math.round(object.confidence * 100)}%)`);
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
