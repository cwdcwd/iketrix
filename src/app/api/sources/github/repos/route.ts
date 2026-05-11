import { NextRequest, NextResponse } from "next/server";
import { getOrCreateUser } from "@/lib/user";
import { prisma } from "@/lib/prisma";
import { getValidGitHubToken, refreshGitHubToken } from "@/lib/github-token";
import { Octokit } from "octokit";

// GET /api/sources/github/repos — fetch ALL repos the user has access to
export async function GET(req: NextRequest) {
  const user = await getOrCreateUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { githubToken: true, githubInstallationId: true },
  });

  if (!dbUser?.githubToken) {
    return NextResponse.json(
      { error: "GitHub not connected", repos: [] },
      { status: 200 }
    );
  }

  // Get a valid token (proactively refreshes if expiring soon)
  let token = await getValidGitHubToken(user.id);
  if (!token) {
    return NextResponse.json(
      { error: "GitHub token expired. Please reconnect.", repos: [] },
      { status: 200 }
    );
  }

  let octokit = new Octokit({ auth: token });

  let allRepos;

  try {
    if (dbUser.githubInstallationId) {
      allRepos = await octokit.paginate(
        octokit.rest.apps.listInstallationReposForAuthenticatedUser,
        {
          installation_id: parseInt(dbUser.githubInstallationId, 10),
          per_page: 100,
        },
        (response) => response.data
      );
    } else {
      allRepos = await octokit.paginate(
        octokit.rest.repos.listForAuthenticatedUser,
        { per_page: 100, sort: "updated" }
      );
    }
  } catch (err: unknown) {
    const status = (err as { status?: number }).status;
    if (status === 401 || status === 403) {
      // Try refreshing the token once
      const newToken = await refreshGitHubToken(user.id);
      if (newToken) {
        octokit = new Octokit({ auth: newToken });
        try {
          if (dbUser.githubInstallationId) {
            allRepos = await octokit.paginate(
              octokit.rest.apps.listInstallationReposForAuthenticatedUser,
              {
                installation_id: parseInt(dbUser.githubInstallationId, 10),
                per_page: 100,
              },
              (response) => response.data
            );
          } else {
            allRepos = await octokit.paginate(
              octokit.rest.repos.listForAuthenticatedUser,
              { per_page: 100, sort: "updated" }
            );
          }
        } catch {
          return NextResponse.json(
            { error: "GitHub token expired. Please reconnect.", repos: [] },
            { status: 200 }
          );
        }
      } else {
        return NextResponse.json(
          { error: "GitHub token expired. Please reconnect.", repos: [] },
          { status: 200 }
        );
      }
    } else {
      throw err;
    }
  }

  const repos = allRepos.map((r: { full_name: string; name: string; owner: { login: string }; private: boolean; has_issues: boolean; open_issues_count: number }) => ({
    fullName: r.full_name,
    name: r.name,
    owner: r.owner.login,
    private: r.private,
    hasIssues: r.has_issues,
    openIssuesCount: r.open_issues_count,
  }));

  return NextResponse.json({ repos });
}
