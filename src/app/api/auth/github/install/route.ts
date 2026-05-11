import { NextRequest, NextResponse } from "next/server";
import { getOrCreateUser } from "@/lib/user";
import { storeGitHubTokens } from "@/lib/github-token";

function getBaseUrl(req: NextRequest): string {
  const host = req.headers.get("host") || "localhost:3000";
  const proto = req.headers.get("x-forwarded-proto") || "http";
  return `${proto}://${host}`;
}

// GET /api/auth/github/install — handle GitHub App installation callback
// GitHub redirects here with ?installation_id=...&setup_action=install&code=...
export async function GET(req: NextRequest) {
  const installationId = req.nextUrl.searchParams.get("installation_id");
  const code = req.nextUrl.searchParams.get("code");
  const setupAction = req.nextUrl.searchParams.get("setup_action");
  const baseUrl = getBaseUrl(req);

  if (!installationId || !code) {
    return NextResponse.redirect(`${baseUrl}?error=missing_installation_params`);
  }

  const clientId = process.env.GITHUB_APP_CLIENT_ID;
  const clientSecret = process.env.GITHUB_APP_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return NextResponse.redirect(`${baseUrl}?error=github_not_configured`);
  }

  // Exchange code for user access token
  const tokenRes = await fetch(
    "https://github.com/login/oauth/access_token",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
      }),
    }
  );

  const tokenData = await tokenRes.json();
  if (tokenData.error || !tokenData.access_token) {
    console.error("[github/install] Token exchange failed:", tokenData);
    return NextResponse.redirect(`${baseUrl}?error=token_exchange_failed`);
  }

  const user = await getOrCreateUser();
  if (!user) {
    return NextResponse.redirect(`${baseUrl}?error=unauthorized`);
  }

  // Store both token and installation ID
  await storeGitHubTokens(user.id, tokenData, installationId);

  return NextResponse.redirect(`${baseUrl}?github=connected`);
}
