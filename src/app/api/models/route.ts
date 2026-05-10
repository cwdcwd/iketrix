import { NextResponse } from "next/server";

type GatewayModel = {
  id: string;
  name?: string;
  type?: string;
  context_window?: number;
  owned_by?: string;
};

// GET /api/models — fetch available language models from Vercel AI Gateway
export async function GET() {
  try {
    const res = await fetch("https://ai-gateway.vercel.sh/v1/models", {
      next: { revalidate: 3600 }, // cache for 1 hour
    });

    if (!res.ok) {
      return NextResponse.json({ models: [] }, { status: 200 });
    }

    const { data } = (await res.json()) as { data: GatewayModel[] };

    // Filter to language models only and return a slim payload
    const models = data
      .filter((m) => m.type === "language")
      .map((m) => ({
        id: m.id,
        name: m.name || m.id,
        provider: m.owned_by || m.id.split("/")[0],
        contextWindow: m.context_window,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    return NextResponse.json({ models });
  } catch {
    return NextResponse.json({ models: [] }, { status: 200 });
  }
}
