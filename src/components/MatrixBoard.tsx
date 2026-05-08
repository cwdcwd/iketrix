"use client";

import { useState, useEffect, useCallback } from "react";

type Task = {
  id: string;
  title: string;
  description: string | null;
  quadrant: string | null;
  status: string;
  externalUrl: string | null;
  delegatedTo: string | null;
  delegatedAt: string | null;
  classification: { reasoning: string; confidence: number } | null;
  source: { name: string; type: string } | null;
};

type Source = {
  id: string;
  name: string;
};

const QUADRANTS = {
  do: { label: "🔥 Do", subtitle: "Important & Urgent", color: "red", bg: "bg-red-50", border: "border-red-300", text: "text-red-700" },
  schedule: { label: "📅 Schedule", subtitle: "Important & Not Urgent", color: "blue", bg: "bg-blue-50", border: "border-blue-300", text: "text-blue-700" },
  delegate: { label: "👋 Delegate", subtitle: "Not Important & Urgent", color: "yellow", bg: "bg-yellow-50", border: "border-yellow-300", text: "text-yellow-700" },
  delete: { label: "🗑️ Delete", subtitle: "Not Important & Not Urgent", color: "gray", bg: "bg-gray-50", border: "border-gray-300", text: "text-gray-600" },
} as const;

type QuadrantKey = keyof typeof QUADRANTS;

export default function MatrixBoard() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [sources, setSources] = useState<Source[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [expandedQuadrant, setExpandedQuadrant] = useState<QuadrantKey | null>(null);
  const [showConnect, setShowConnect] = useState(false);
  const [connectForm, setConnectForm] = useState({ repo: "", accessToken: "" });
  const [delegateModal, setDelegateModal] = useState<{ task: Task; type: string; identifier: string } | null>(null);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  const fetchTasks = useCallback(async () => {
    const res = await fetch("/api/tasks");
    if (res.ok) {
      const data = await res.json();
      setTasks(data.tasks);
    }
    setLoading(false);
  }, []);

  const fetchSources = useCallback(async () => {
    const res = await fetch("/api/sources/github");
    if (res.ok) {
      const data = await res.json();
      setSources(data.sources);
    }
  }, []);

  useEffect(() => {
    fetchTasks();
    fetchSources();
  }, [fetchTasks, fetchSources]);

  const connectGitHub = async () => {
    const res = await fetch("/api/sources/github", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(connectForm),
    });
    if (res.ok) {
      setShowConnect(false);
      setConnectForm({ repo: "", accessToken: "" });
      fetchSources();
    }
  };

  const syncSource = async (sourceId: string) => {
    setSyncing(true);
    await fetch(`/api/sources/github/${sourceId}/sync`, { method: "POST" });
    await fetchTasks();
    setSyncing(false);
  };

  const moveTask = async (taskId: string, quadrant: QuadrantKey) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, quadrant } : t))
    );
    await fetch(`/api/tasks/${taskId}/move`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ quadrant }),
    });
  };

  const delegateTask = async () => {
    if (!delegateModal) return;
    const res = await fetch(`/api/tasks/${delegateModal.task.id}/delegate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: delegateModal.type,
        identifier: delegateModal.identifier,
      }),
    });
    if (res.ok) {
      setDelegateModal(null);
      fetchTasks();
    }
  };

  const tasksByQuadrant = (q: QuadrantKey) =>
    tasks.filter((t) => t.quadrant === q && t.status !== "completed");

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-gray-500">Loading your matrix...</p>
      </div>
    );
  }

  // Expanded quadrant view
  if (expandedQuadrant) {
    const q = QUADRANTS[expandedQuadrant];
    const qTasks = tasksByQuadrant(expandedQuadrant);
    return (
      <div className="p-4 max-w-2xl mx-auto">
        <button
          onClick={() => setExpandedQuadrant(null)}
          className="mb-4 text-sm text-gray-500 hover:text-gray-700 cursor-pointer"
        >
          ← Back to matrix
        </button>
        <h2 className={`text-2xl font-bold ${q.text} mb-1`}>{q.label}</h2>
        <p className="text-sm text-gray-500 mb-4">{q.subtitle}</p>
        <div className="space-y-3">
          {qTasks.length === 0 && (
            <p className="text-gray-400 italic">No tasks in this quadrant</p>
          )}
          {qTasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              onMove={moveTask}
              currentQuadrant={expandedQuadrant}
              onDelegate={(t) =>
                setDelegateModal({ task: t, type: "email", identifier: "" })
              }
              onSelect={setSelectedTask}
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 max-w-4xl mx-auto">
      {/* Toolbar */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h1 className="text-xl font-bold">Your Matrix</h1>
        <div className="flex gap-2 flex-wrap">
          {sources.map((s) => (
            <button
              key={s.id}
              onClick={() => syncSource(s.id)}
              disabled={syncing}
              className="text-xs bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-full cursor-pointer disabled:opacity-50"
            >
              {syncing ? "Syncing..." : `⟳ ${s.name}`}
            </button>
          ))}
          <button
            onClick={() => setShowConnect(true)}
            className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-full cursor-pointer"
          >
            + Connect GitHub
          </button>
        </div>
      </div>

      {/* Connect Modal */}
      {showConnect && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="font-semibold mb-4">Connect GitHub Repository</h3>
            <input
              placeholder="owner/repo"
              value={connectForm.repo}
              onChange={(e) =>
                setConnectForm((f) => ({ ...f, repo: e.target.value }))
              }
              className="w-full border rounded px-3 py-2 mb-3 text-sm"
            />
            <input
              placeholder="GitHub Personal Access Token"
              type="password"
              value={connectForm.accessToken}
              onChange={(e) =>
                setConnectForm((f) => ({ ...f, accessToken: e.target.value }))
              }
              className="w-full border rounded px-3 py-2 mb-4 text-sm"
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowConnect(false)}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={connectGitHub}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 cursor-pointer"
              >
                Connect
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delegate Modal */}
      {delegateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="font-semibold mb-2">Delegate Task</h3>
            <p className="text-sm text-gray-500 mb-4 truncate">
              {delegateModal.task.title}
            </p>
            <div className="flex gap-2 mb-3">
              <button
                onClick={() =>
                  setDelegateModal((m) => m && { ...m, type: "email" })
                }
                className={`text-xs px-3 py-1 rounded-full cursor-pointer ${
                  delegateModal.type === "email"
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100"
                }`}
              >
                Email
              </button>
              <button
                onClick={() =>
                  setDelegateModal((m) => m && { ...m, type: "github" })
                }
                className={`text-xs px-3 py-1 rounded-full cursor-pointer ${
                  delegateModal.type === "github"
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100"
                }`}
              >
                GitHub
              </button>
            </div>
            <input
              placeholder={
                delegateModal.type === "email"
                  ? "email@example.com"
                  : "github-username"
              }
              value={delegateModal.identifier}
              onChange={(e) =>
                setDelegateModal((m) =>
                  m && { ...m, identifier: e.target.value }
                )
              }
              className="w-full border rounded px-3 py-2 mb-4 text-sm"
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setDelegateModal(null)}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={delegateTask}
                disabled={!delegateModal.identifier}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 cursor-pointer disabled:opacity-50"
              >
                Delegate
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Task Detail Modal */}
      {selectedTask && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-md max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-start mb-3">
              <h3 className="font-semibold pr-4">{selectedTask.title}</h3>
              <button
                onClick={() => setSelectedTask(null)}
                className="text-gray-400 hover:text-gray-600 cursor-pointer text-lg"
              >
                ✕
              </button>
            </div>
            {selectedTask.description && (
              <p className="text-sm text-gray-600 mb-3 whitespace-pre-wrap">
                {selectedTask.description}
              </p>
            )}
            {selectedTask.classification && (
              <div className="bg-gray-50 rounded p-3 mb-3">
                <p className="text-xs font-medium text-gray-500 mb-1">
                  AI Reasoning ({Math.round(selectedTask.classification.confidence * 100)}% confident)
                </p>
                <p className="text-sm text-gray-700">
                  {selectedTask.classification.reasoning}
                </p>
              </div>
            )}
            {selectedTask.externalUrl && (
              <a
                href={selectedTask.externalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-blue-600 hover:underline"
              >
                View original →
              </a>
            )}
            {selectedTask.delegatedTo && (
              <p className="text-xs text-yellow-700 mt-2">
                Delegated to {selectedTask.delegatedTo}
              </p>
            )}
          </div>
        </div>
      )}

      {/* 2x2 Grid */}
      <div className="grid grid-cols-2 gap-3">
        {(Object.entries(QUADRANTS) as [QuadrantKey, (typeof QUADRANTS)[QuadrantKey]][]).map(
          ([key, q]) => {
            const qTasks = tasksByQuadrant(key);
            return (
              <div
                key={key}
                className={`border-2 ${q.border} ${q.bg} rounded-lg p-3 min-h-[180px] flex flex-col`}
              >
                <div
                  className="flex justify-between items-center mb-2 cursor-pointer"
                  onClick={() => setExpandedQuadrant(key)}
                >
                  <div>
                    <h2 className={`font-semibold ${q.text} text-sm`}>
                      {q.label}
                    </h2>
                    <p className="text-xs text-gray-400">{q.subtitle}</p>
                  </div>
                  <span className="text-xs text-gray-400">
                    {qTasks.length} {qTasks.length === 1 ? "task" : "tasks"} →
                  </span>
                </div>
                <div className="flex-1 space-y-1.5 overflow-y-auto max-h-[200px]">
                  {qTasks.slice(0, 5).map((task) => (
                    <div
                      key={task.id}
                      className="bg-white rounded p-2 shadow-sm text-xs cursor-pointer hover:shadow-md transition-shadow"
                      onClick={() => setSelectedTask(task)}
                    >
                      <p className="font-medium truncate">{task.title}</p>
                      {task.status === "delegated" && (
                        <p className="text-yellow-600 text-[10px] mt-0.5">
                          → {task.delegatedTo}
                        </p>
                      )}
                    </div>
                  ))}
                  {qTasks.length > 5 && (
                    <p
                      className="text-xs text-gray-400 cursor-pointer hover:text-gray-600"
                      onClick={() => setExpandedQuadrant(key)}
                    >
                      +{qTasks.length - 5} more
                    </p>
                  )}
                </div>
              </div>
            );
          }
        )}
      </div>

      {tasks.length === 0 && (
        <div className="text-center mt-8 text-gray-400">
          <p className="mb-2">No tasks yet</p>
          <p className="text-sm">
            Connect a GitHub repo to import issues into your Eisenhower Matrix
          </p>
        </div>
      )}
    </div>
  );
}

function TaskCard({
  task,
  onMove,
  currentQuadrant,
  onDelegate,
  onSelect,
}: {
  task: Task;
  onMove: (id: string, q: QuadrantKey) => void;
  currentQuadrant: QuadrantKey;
  onDelegate: (t: Task) => void;
  onSelect: (t: Task) => void;
}) {
  const otherQuadrants = (
    Object.keys(QUADRANTS) as QuadrantKey[]
  ).filter((q) => q !== currentQuadrant);

  return (
    <div className="bg-white border rounded-lg p-3 shadow-sm">
      <div className="flex justify-between items-start gap-2">
        <div className="flex-1 min-w-0 cursor-pointer" onClick={() => onSelect(task)}>
          <p className="font-medium text-sm">{task.title}</p>
          {task.description && (
            <p className="text-xs text-gray-500 mt-1 line-clamp-2">
              {task.description}
            </p>
          )}
          {task.classification && (
            <p className="text-xs text-gray-400 mt-1 italic">
              {task.classification.reasoning}
            </p>
          )}
          {task.source && (
            <p className="text-[10px] text-gray-400 mt-1">
              {task.source.name}
            </p>
          )}
          {task.delegatedTo && (
            <p className="text-xs text-yellow-600 mt-1">
              Delegated to {task.delegatedTo}
            </p>
          )}
        </div>
        {task.externalUrl && (
          <a
            href={task.externalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-gray-400 hover:text-gray-600 text-xs shrink-0"
          >
            ↗
          </a>
        )}
      </div>
      <div className="flex gap-1 mt-2 flex-wrap">
        {otherQuadrants.map((q) => (
          <button
            key={q}
            onClick={() => onMove(task.id, q)}
            className="text-[10px] px-2 py-0.5 rounded bg-gray-100 hover:bg-gray-200 cursor-pointer"
          >
            → {QUADRANTS[q].label}
          </button>
        ))}
        {currentQuadrant === "delegate" && task.status !== "delegated" && (
          <button
            onClick={() => onDelegate(task)}
            className="text-[10px] px-2 py-0.5 rounded bg-yellow-100 hover:bg-yellow-200 text-yellow-800 cursor-pointer"
          >
            Assign →
          </button>
        )}
      </div>
    </div>
  );
}
