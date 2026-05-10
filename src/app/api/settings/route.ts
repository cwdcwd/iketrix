import { NextRequest, NextResponse } from "next/server";
import { getOrCreateUser } from "@/lib/user";
import { prisma } from "@/lib/prisma";

// GET /api/settings — get user classifier settings
export async function GET() {
  const user = await getOrCreateUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  return NextResponse.json({
    classifierModel: user.classifierModel || "openai/gpt-4o-mini",
    classifierPrompt: user.classifierPrompt || "",
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

  await prisma.user.update({
    where: { id: user.id },
    data,
  });

  return NextResponse.json({ ok: true });
}
