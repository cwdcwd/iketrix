import { NextRequest, NextResponse } from "next/server";
import { getOrCreateUser } from "@/lib/user";
import { prisma } from "@/lib/prisma";
import { TOOL_CATALOG, getDefaultToolIds } from "@/lib/agents/tool-registry";

// GET /api/settings — get user settings
export async function GET() {
  const user = await getOrCreateUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let enabledTools: string[];
  try {
    enabledTools = user.enabledTools ? JSON.parse(user.enabledTools) : getDefaultToolIds();
  } catch {
    enabledTools = getDefaultToolIds();
  }

  return NextResponse.json({
    classifierModel: user.classifierModel || "openai/gpt-4o-mini",
    classifierPrompt: user.classifierPrompt || "",
    agentModel: user.agentModel || "openai/gpt-4o",
    enabledTools,
    toolCatalog: TOOL_CATALOG,
  });
}

// PATCH /api/settings — update user classifier settings
export async function PATCH(req: NextRequest) {
  const user = await getOrCreateUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const data: Record<string, string | null> = {};

  if ("classifierModel" in body && typeof body.classifierModel === "string") {
    // Accept any provider/model ID from the AI Gateway (e.g. "openai/gpt-4o-mini")
    const model = body.classifierModel.trim();
    if (!model || model.length > 200) {
      return NextResponse.json({ error: "Invalid model" }, { status: 400 });
    }
    data.classifierModel = model;
  }

  if ("classifierPrompt" in body) {
    // Allow empty string to reset to default, cap at 4000 chars
    const prompt = typeof body.classifierPrompt === "string" ? body.classifierPrompt.slice(0, 4000) : "";
    data.classifierPrompt = prompt || null;
  }

  if ("agentModel" in body && typeof body.agentModel === "string") {
    const model = body.agentModel.trim();
    if (!model || model.length > 200) {
      return NextResponse.json({ error: "Invalid agent model" }, { status: 400 });
    }
    data.agentModel = model;
  }

  if ("enabledTools" in body && Array.isArray(body.enabledTools)) {
    const validIds = new Set(TOOL_CATALOG.map((t) => t.id));
    const filtered = (body.enabledTools as string[]).filter((id) => validIds.has(id));
    data.enabledTools = JSON.stringify(filtered);
  }

  await prisma.user.update({
    where: { id: user.id },
    data,
  });

  return NextResponse.json({ ok: true });
}
