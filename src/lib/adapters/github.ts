import { Octokit } from "octokit";
import type {
  InputAdapter,
  SourceConnection,
  TaskInput,
  SyncResult,
} from "@/types/input-adapter";

export class GitHubAdapter implements InputAdapter {
  readonly type = "github";

  async validateConnection(connection: SourceConnection): Promise<boolean> {
    try {
      const octokit = new Octokit({ auth: connection.accessToken });
      await octokit.rest.users.getAuthenticated();
      return true;
    } catch {
      return false;
    }
  }

  async fetchAll(connection: SourceConnection): Promise<TaskInput[]> {
    const octokit = new Octokit({ auth: connection.accessToken });
    const [owner, repo] = connection.name.split("/");

    const issues = await octokit.paginate(
      octokit.rest.issues.listForRepo,
      {
        owner,
        repo,
        state: "all",
        per_page: 100,
      },
      (response) =>
        response.data.filter((issue) => !issue.pull_request)
    );

    return issues.map((issue) => this.toTaskInput(issue, connection.name));
  }

  async sync(
    connection: SourceConnection,
    since: Date
  ): Promise<SyncResult> {
    const octokit = new Octokit({ auth: connection.accessToken });
    const [owner, repo] = connection.name.split("/");

    const issues = await octokit.paginate(
      octokit.rest.issues.listForRepo,
      {
        owner,
        repo,
        state: "all",
        since: since.toISOString(),
        per_page: 100,
      },
      (response) =>
        response.data.filter((issue) => !issue.pull_request)
    );

    const added: TaskInput[] = [];
    const updated: TaskInput[] = [];
    const closed: TaskInput[] = [];

    for (const issue of issues) {
      const task = this.toTaskInput(issue, connection.name);
      const createdAt = new Date(issue.created_at);
      if (createdAt > since) {
        added.push(task);
      } else if (issue.state === "closed") {
        closed.push(task);
      } else {
        updated.push(task);
      }
    }

    return { added, updated, closed, errors: [] };
  }

  async assignTask(
    connection: SourceConnection,
    externalId: string,
    assignee: string
  ): Promise<boolean> {
    try {
      const octokit = new Octokit({ auth: connection.accessToken });
      const [owner, repo] = connection.name.split("/");
      await octokit.rest.issues.addAssignees({
        owner,
        repo,
        issue_number: parseInt(externalId, 10),
        assignees: [assignee],
      });
      return true;
    } catch {
      return false;
    }
  }

  private toTaskInput(
    issue: Record<string, unknown>,
    repoName: string
  ): TaskInput {
    const i = issue as {
      number: number;
      title: string;
      body: string | null;
      html_url: string;
      labels: Array<{ name: string } | string>;
      assignees: Array<{ login: string }> | null;
      state: string;
      created_at: string;
      updated_at: string;
    };
    return {
      externalId: String(i.number),
      title: i.title,
      description: i.body,
      externalUrl: i.html_url,
      labels: (i.labels || []).map((l) =>
        typeof l === "string" ? l : l.name
      ),
      assignees: (i.assignees || []).map((a) => a.login),
      state: i.state === "open" ? "open" : "closed",
      createdAt: new Date(i.created_at),
      updatedAt: new Date(i.updated_at),
      metadata: { repo: repoName },
    };
  }
}
