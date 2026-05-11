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
      const [owner, repo] = connection.name.split("/");
      await octokit.rest.repos.get({ owner, repo });
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

  async setIssueState(
    connection: SourceConnection,
    externalId: string,
    state: "open" | "closed"
  ): Promise<boolean> {
    try {
      const octokit = new Octokit({ auth: connection.accessToken });
      const [owner, repo] = connection.name.split("/");
      await octokit.rest.issues.update({
        owner,
        repo,
        issue_number: parseInt(externalId, 10),
        state,
        ...(state === "closed" ? { state_reason: "completed" } : {}),
      });
      return true;
    } catch (err) {
      console.error(`[github] Failed to ${state} issue #${externalId}:`, err);
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

  private static readonly QUADRANT_LABELS: Record<string, string> = {
    do: "iketrix:do",
    schedule: "iketrix:schedule",
    delegate: "iketrix:delegate",
    delete: "iketrix:delete",
  };

  private static readonly LABEL_COLORS: Record<string, string> = {
    "iketrix:do": "d73a4a",        // red — urgent+important
    "iketrix:schedule": "0075ca",  // blue — important, not urgent
    "iketrix:delegate": "e4e669",  // yellow — urgent, not important
    "iketrix:delete": "cfd3d7",    // grey — neither
  };

  /**
   * Set the quadrant label on a GitHub issue, removing any previous iketrix:* labels.
   */
  async updateQuadrantLabel(
    connection: SourceConnection,
    externalId: string,
    quadrant: string
  ): Promise<boolean> {
    try {
      const octokit = new Octokit({ auth: connection.accessToken });
      const [owner, repo] = connection.name.split("/");
      const issueNumber = parseInt(externalId, 10);

      const newLabel = GitHubAdapter.QUADRANT_LABELS[quadrant];
      if (!newLabel) return false;

      // Ensure the label exists in the repo (create if needed)
      try {
        await octokit.rest.issues.getLabel({ owner, repo, name: newLabel });
      } catch {
        await octokit.rest.issues.createLabel({
          owner,
          repo,
          name: newLabel,
          color: GitHubAdapter.LABEL_COLORS[newLabel] || "ededed",
          description: `Iketrix: ${quadrant} quadrant`,
        });
      }

      // Get current labels on the issue
      const { data: currentLabels } = await octokit.rest.issues.listLabelsOnIssue({
        owner,
        repo,
        issue_number: issueNumber,
      });

      // Remove old iketrix:* labels
      const oldLabels = currentLabels.filter(
        (l) => l.name.startsWith("iketrix:") && l.name !== newLabel
      );
      for (const label of oldLabels) {
        await octokit.rest.issues.removeLabel({
          owner,
          repo,
          issue_number: issueNumber,
          name: label.name,
        }).catch(() => {}); // ignore if already removed
      }

      // Add the new label (if not already present)
      const alreadyHas = currentLabels.some((l) => l.name === newLabel);
      if (!alreadyHas) {
        await octokit.rest.issues.addLabels({
          owner,
          repo,
          issue_number: issueNumber,
          labels: [newLabel],
        });
      }

      return true;
    } catch (err) {
      console.error(`[github] Failed to update quadrant label on #${externalId}:`, err);
      return false;
    }
  }
}
