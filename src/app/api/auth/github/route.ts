import { NextRequest, NextResponse } from "next/server";

function getBaseUrl(req: NextRequest): string {
  const host = req.headers.get("host") || "localhost:3000";
  const proto = req.headers.get("x-forwarded-proto") || "http";
  return `${proto}://${host}`;
}

// GET /api/auth/github — redirect user to GitHub App installation page
export async function GET(req: NextRequest) {
  const appSlug = process.env.GITHUB_APP_SLUG;
  if (!appSlug) {
    return NextResponse.json(
      { error: "GitHub App not configured (missing GITHUB_APP_SLUG)" },
      { status: 500 }
    );
  }

  const baseUrl = getBaseUrl(req);
  // Redirect to GitHub App install page — GitHub will redirect back with
  // installation_id + code to our setup URL configured in the App settings
  const url = `https://github.com/apps/${appSlug}/installations/new`;

  return NextResponse.redirect(url);
}
