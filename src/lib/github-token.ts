import { prisma } from "./prisma";

/**
 * Store GitHub token data from an OAuth token exchange response.
 */
export async function storeGitHubTokens(
  userId: string,
  tokenData: {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
    refresh_token_expires_in?: number;
  },
  installationId?: string
) {
  const data: Record<string, unknown> = {
    githubToken: tokenData.access_token,
  };

  if (tokenData.refresh_token) {
    data.githubRefreshToken = tokenData.refresh_token;
  }

  if (tokenData.expires_in) {
    data.githubTokenExpiresAt = new Date(
      Date.now() + tokenData.expires_in * 1000
    );
  }

  if (installationId) {
    data.githubInstallationId = installationId;
  }

  await prisma.user.update({
    where: { id: userId },
    data,
  });
}

/**
 * Refresh an expired GitHub App user access token.
 * Returns the new access token, or null if refresh failed.
 */
export async function refreshGitHubToken(
  userId: string
): Promise<string | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { githubRefreshToken: true },
  });

  if (!user?.githubRefreshToken) {
    console.error("[github] No refresh token available for user", userId);
    return null;
  }

  const clientId = process.env.GITHUB_APP_CLIENT_ID;
  const clientSecret = process.env.GITHUB_APP_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    console.error("[github] Missing GitHub App credentials");
    return null;
  }

  const res = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
      refresh_token: user.githubRefreshToken,
    }),
  });

  const tokenData = await res.json();

  if (tokenData.error || !tokenData.access_token) {
    console.error("[github] Token refresh failed:", tokenData.error || tokenData);
    // Refresh token itself may be expired — clear everything
    await prisma.user.update({
      where: { id: userId },
      data: {
        githubToken: null,
        githubRefreshToken: null,
        githubTokenExpiresAt: null,
        githubInstallationId: null,
      },
    });
    return null;
  }

  // Store the new tokens
  await storeGitHubTokens(userId, tokenData);
  console.log("[github] ✓ Token refreshed successfully");
  return tokenData.access_token;
}

/**
 * Get a valid GitHub token for a user, refreshing if expired.
 * Returns the token string, or null if no valid token available.
 */
export async function getValidGitHubToken(
  userId: string
): Promise<string | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      githubToken: true,
      githubRefreshToken: true,
      githubTokenExpiresAt: true,
    },
  });

  if (!user?.githubToken) return null;

  // If we have an expiry and it's within 5 minutes, refresh proactively
  if (
    user.githubTokenExpiresAt &&
    user.githubTokenExpiresAt.getTime() < Date.now() + 5 * 60 * 1000
  ) {
    console.log("[github] Token expiring soon, refreshing proactively");
    const newToken = await refreshGitHubToken(userId);
    return newToken;
  }

  return user.githubToken;
}
