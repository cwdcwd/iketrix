import { NextRequest, NextResponse } from "next/server";
import { getOrCreateUser } from "@/lib/user";
import { prisma } from "@/lib/prisma";

function getBaseUrl(req: NextRequest): string {
  const host = req.headers.get("host") || "localhost:3000";
  const proto = req.headers.get("x-forwarded-proto") || "http";
  return `${proto}://${host}`;
}

// GET /api/auth/github/callback — handle GitHub OAuth callback
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const storedState = req.cookies.get("github_oauth_state")?.value;
  const installationId = req.nextUrl.searchParams.get("installation_id");
  const baseUrl = getBaseUrl(req);

  // If this is an installation callback (no state cookie), handle it
  if (installationId && code && !storedState) {
    return handleInstallation(req, code, installationId, baseUrl);
  }

  // CSRF check for normal OAuth flow
  if (!state || !storedState || state !== storedState) {
    return NextResponse.redirect(
      `${baseUrl}?error=invalid_state`
    );
  }

  if (!code) {
    return NextResponse.redirect(
      `${baseUrl}?error=missing_code`
    );
  }

  const clientId = process.env.GITHUB_APP_CLIENT_ID;
  const clientSecret = process.env.GITHUB_APP_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return NextResponse.redirect(
      `${baseUrl}?error=github_not_configured`
    );
  }

  // Exchange code for access token
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
        redirect_uri: `${baseUrl}/api/auth/github/callback`,
      }),
    }
  );

  const tokenData = await tokenRes.json();
  if (tokenData.error || !tokenData.access_token) {
    return NextResponse.redirect(
      `${baseUrl}?error=token_exchange_failed`
    );
  }

  // Store the token on the user record
  const user = await getOrCreateUser();
  if (!user) {
    return NextResponse.redirect(
      `${baseUrl}?error=unauthorized`
    );
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      githubToken: tokenData.access_token,
      ...(installationId ? { githubInstallationId: installationId } : {}),
    },
  });

  const response = NextResponse.redirect(
    `${baseUrl}?github=connected`
  );
  // Clear the state cookie
  response.cookies.delete("github_oauth_state");

  return response;
}

async function handleInstallation(
  req: NextRequest,
  code: string,
  installationId: string,
  baseUrl: string,
) {
  const clientId = process.env.GITHUB_APP_CLIENT_ID;
  const clientSecret = process.env.GITHUB_APP_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return NextResponse.redirect(`${baseUrl}?error=github_not_configured`);
  }

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
    console.error("[github/callback] Installation token exchange failed:", tokenData);
    return NextResponse.redirect(`${baseUrl}?error=token_exchange_failed`);
  }

  const user = await getOrCreateUser();
  if (!user) {
    return NextResponse.redirect(`${baseUrl}?error=unauthorized`);
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      githubToken: tokenData.access_token,
      githubInstallationId: installationId,
    },
  });

  return NextResponse.redirect(`${baseUrl}?github=connected`);
}
