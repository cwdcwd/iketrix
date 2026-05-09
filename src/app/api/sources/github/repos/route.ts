import { NextResponse } from "next/server";
import { getOrCreateUser } from "@/lib/user";
import { prisma } from "@/lib/prisma";
import { Octokit } from "octokit";

// GET /api/sources/github/repos — list repos accessible via user's GitHub OAuth token
export async function GET() {
  const user = await getOrCreateUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { githubToken: true },
  });

  if (!dbUser?.githubToken) {
    return NextResponse.json(
      { error: "GitHub not connected", repos: [] },
      { status: 200 }
    );
  }

  const octokit = new Octokit({ auth: dbUser.githubToken });
  const repos = await octokit.paginate(
    octokit.rest.repos.listForAuthenticatedUser,
    { per_page: 100, sort: "updated" },
    (response) =>
      response.data.map((r) => ({
        fullName: r.full_name,
        name: r.name,
        owner: r.owner.login,
        private: r.private,
        hasIssues: r.has_issues,
        openIssuesCount: r.open_issues_count,
      }))
  );

  return NextResponse.json({ repos });
}
