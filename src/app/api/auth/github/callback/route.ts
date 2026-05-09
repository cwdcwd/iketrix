import { NextRequest, NextResponse } from "next/server";
import { getOrCreateUser } from "@/lib/user";
import { prisma } from "@/lib/prisma";

// GET /api/auth/github/callback — handle GitHub OAuth callback
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const storedState = req.cookies.get("github_oauth_state")?.value;
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  // CSRF check
  if (!state || !storedState || state !== storedState) {
    return NextResponse.redirect(
      `${appUrl}?error=invalid_state`
    );
  }

  if (!code) {
    return NextResponse.redirect(
      `${appUrl}?error=missing_code`
    );
  }

  const clientId = process.env.GITHUB_APP_CLIENT_ID;
  const clientSecret = process.env.GITHUB_APP_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return NextResponse.redirect(
      `${appUrl}?error=github_not_configured`
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
        redirect_uri: `${appUrl}/api/auth/github/callback`,
      }),
    }
  );

  const tokenData = await tokenRes.json();
  if (tokenData.error || !tokenData.access_token) {
    return NextResponse.redirect(
      `${appUrl}?error=token_exchange_failed`
    );
  }

  // Store the token on the user record
  const user = await getOrCreateUser();
  if (!user) {
    return NextResponse.redirect(
      `${appUrl}?error=unauthorized`
    );
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { githubToken: tokenData.access_token },
  });

  const response = NextResponse.redirect(
    `${appUrl}?github=connected`
  );
  // Clear the state cookie
  response.cookies.delete("github_oauth_state");

  return response;
}
