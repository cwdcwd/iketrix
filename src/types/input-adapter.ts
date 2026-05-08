/**
 * Normalized task input from any external source.
 * All adapters must transform their source data into this shape.
 */
export interface TaskInput {
  externalId: string;
  title: string;
  description: string | null;
  externalUrl: string | null;
  labels: string[];
  assignees: string[];
  state: "open" | "closed";
  createdAt: Date;
  updatedAt: Date;
  metadata: Record<string, unknown>;
}

/**
 * Connection configuration for an input source.
 */
export interface SourceConnection {
  id: string;
  type: string;
  name: string;
  accessToken: string;
}

/**
 * Result of a sync operation.
 */
export interface SyncResult {
  added: TaskInput[];
  updated: TaskInput[];
  closed: TaskInput[];
  errors: Array<{ externalId: string; error: string }>;
}

/**
 * Pluggable input adapter interface.
 * Implement this for each external task source (GitHub, Jira, Linear, etc.).
 */
export interface InputAdapter {
  readonly type: string;

  validateConnection(connection: SourceConnection): Promise<boolean>;
  fetchAll(connection: SourceConnection): Promise<TaskInput[]>;
  sync(connection: SourceConnection, since: Date): Promise<SyncResult>;
  assignTask?(
    connection: SourceConnection,
    externalId: string,
    assignee: string
  ): Promise<boolean>;
}
