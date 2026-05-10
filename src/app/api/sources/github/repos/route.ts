import { NextRequest, NextResponse } from "next/server";
import { getOrCreateUser } from "@/lib/user";
import { prisma } from "@/lib/prisma";
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

  const octokit = new Octokit({ auth: dbUser.githubToken });

  let allRepos;

  try {
    if (dbUser.githubInstallationId) {
      // GitHub App — list repos accessible through the installation
      allRepos = await octokit.paginate(
        octokit.rest.apps.listInstallationReposForAuthenticatedUser,
        {
          installation_id: parseInt(dbUser.githubInstallationId, 10),
          per_page: 100,
        },
        (response) => response.data
      );
    } else {
      // Fallback: classic token — list all user repos
      allRepos = await octokit.paginate(
        octokit.rest.repos.listForAuthenticatedUser,
        { per_page: 100, sort: "updated" }
      );
    }
  } catch (err: unknown) {
    const status = (err as { status?: number }).status;
    if (status === 401 || status === 403) {
      // Token expired or revoked — clear it and return empty
      await prisma.user.update({
        where: { id: user.id },
        data: { githubToken: null, githubInstallationId: null },
      });
      return NextResponse.json(
        { error: "GitHub token expired. Please reconnect.", repos: [] },
        { status: 200 }
      );
    }
    throw err;
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
