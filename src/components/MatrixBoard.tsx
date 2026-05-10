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
  needsClarification: boolean;
  pendingQuestion: string | null;
  classification: { reasoning: string; confidence: number } | null;
  clarifications: { question: string; answer: string; createdAt: string }[];
  source: { name: string; type: string } | null;
};

type Source = {
  id: string;
  name: string;
};

type Matrix = {
  id: string;
  name: string;
  description: string | null;
  _count: { tasks: number; sources: number };
};

const QUADRANTS = {
  do: { label: "🔥 Do", subtitle: "Important & Urgent", color: "red", bg: "bg-red-50 dark:bg-red-950/40", border: "border-red-300 dark:border-red-800", text: "text-red-700 dark:text-red-400" },
  schedule: { label: "📅 Schedule", subtitle: "Important & Not Urgent", color: "blue", bg: "bg-blue-50 dark:bg-blue-950/40", border: "border-blue-300 dark:border-blue-800", text: "text-blue-700 dark:text-blue-400" },
  delegate: { label: "👋 Delegate", subtitle: "Not Important & Urgent", color: "yellow", bg: "bg-yellow-50 dark:bg-yellow-950/40", border: "border-yellow-300 dark:border-yellow-800", text: "text-yellow-700 dark:text-yellow-400" },
  delete: { label: "🗑️ Delete", subtitle: "Not Important & Not Urgent", color: "gray", bg: "bg-gray-50 dark:bg-gray-800/60", border: "border-gray-300 dark:border-gray-700", text: "text-gray-600 dark:text-gray-400" },
} as const;

type QuadrantKey = keyof typeof QUADRANTS;

export default function MatrixBoard() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [sources, setSources] = useState<Source[]>([]);
  const [matrices, setMatrices] = useState<Matrix[]>([]);
  const [activeMatrixId, setActiveMatrixId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [expandedQuadrant, setExpandedQuadrant] = useState<QuadrantKey | null>(null);
  const [showRepoPicker, setShowRepoPicker] = useState(false);
  const [availableRepos, setAvailableRepos] = useState<Array<{ fullName: string; openIssuesCount: number }>>([])
  const [loadingRepos, setLoadingRepos] = useState(false);
  const [repoFilter, setRepoFilter] = useState("");
  const [githubConnected, setGithubConnected] = useState(false);
  const [delegateModal, setDelegateModal] = useState<{ task: Task; type: string; identifier: string } | null>(null);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [dragOverQuadrant, setDragOverQuadrant] = useState<QuadrantKey | null>(null);
  const [showMatrixModal, setShowMatrixModal] = useState<{ mode: "create" | "edit"; name: string; description: string; id?: string } | null>(null);
  const [showMatrixMenu, setShowMatrixMenu] = useState(false);
  const [quickTaskInput, setQuickTaskInput] = useState("");
  const [quickTaskAdding, setQuickTaskAdding] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; task: Task } | null>(null);
  const [moveToMatrixModal, setMoveToMatrixModal] = useState<Task | null>(null);
  const [completedTasks, setCompletedTasks] = useState<Task[]>([]);
  const [showCompleted, setShowCompleted] = useState(false);
  const [clarifyingTaskId, setClarifyingTaskId] = useState<string | null>(null);
  const [clarifyAnswer, setClarifyAnswer] = useState("");
  const [clarifySubmitting, setClarifySubmitting] = useState(false);
  const [reclassifyingTaskId, setReclassifyingTaskId] = useState<string | null>(null);

  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    e.dataTransfer.setData("text/plain", taskId);
    e.dataTransfer.effectAllowed = "move";
    setDraggedTaskId(taskId);
  };

  const handleDragOver = (e: React.DragEvent, quadrant: QuadrantKey) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverQuadrant(quadrant);
  };

  const handleDragLeave = () => {
    setDragOverQuadrant(null);
  };

  const handleDrop = (e: React.DragEvent, quadrant: QuadrantKey) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData("text/plain");
    if (taskId) {
      moveTask(taskId, quadrant);
    }
    setDraggedTaskId(null);
    setDragOverQuadrant(null);
  };

  const handleDragEnd = () => {
    setDraggedTaskId(null);
    setDragOverQuadrant(null);
  };

  // --- Matrix CRUD ---
  const fetchMatrices = useCallback(async () => {
    const res = await fetch("/api/matrices");
    if (res.ok) {
      const data = await res.json();
      setMatrices(data.matrices);
      // Auto-select first matrix if none selected
      if (!activeMatrixId && data.matrices.length > 0) {
        setActiveMatrixId(data.matrices[0].id);
      }
    }
  }, [activeMatrixId]);

  const createMatrix = async (name: string, description: string) => {
    const res = await fetch("/api/matrices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, description: description || null }),
    });
    if (res.ok) {
      const data = await res.json();
      setActiveMatrixId(data.matrix.id);
      await fetchMatrices();
    }
    setShowMatrixModal(null);
  };

  const updateMatrix = async (id: string, name: string, description: string) => {
    await fetch(`/api/matrices/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, description: description || null }),
    });
    await fetchMatrices();
    setShowMatrixModal(null);
  };

  const deleteMatrix = async (id: string) => {
    await fetch(`/api/matrices/${id}`, { method: "DELETE" });
    if (activeMatrixId === id) {
      setActiveMatrixId(null);
    }
    await fetchMatrices();
  };

  const fetchTasks = useCallback(async () => {
    const params = activeMatrixId ? `?matrixId=${activeMatrixId}` : "";
    const res = await fetch(`/api/tasks${params}`);
    if (res.ok) {
      const data = await res.json();
      setTasks(data.tasks);
    }
    setLoading(false);
  }, [activeMatrixId]);

  const fetchSources = useCallback(async () => {
    const params = activeMatrixId ? `?matrixId=${activeMatrixId}` : "";
    const res = await fetch(`/api/sources/github${params}`);
    if (res.ok) {
      const data = await res.json();
      setSources(data.sources);
    }
  }, [activeMatrixId]);

  const checkGitHubConnection = useCallback(async () => {
    const res = await fetch("/api/sources/github/repos?page=1");
    if (res.ok) {
      const data = await res.json();
      setGithubConnected(data.repos && data.repos.length > 0);
    }
  }, []);

  useEffect(() => {
    fetchMatrices();
  }, [fetchMatrices]);

  useEffect(() => {
    fetchTasks();
    fetchSources();
    checkGitHubConnection();
  }, [fetchTasks, fetchSources, checkGitHubConnection, activeMatrixId]);

  const fetchAllRepos = async () => {
    setLoadingRepos(true);
    const res = await fetch("/api/sources/github/repos");
    if (res.ok) {
      const data = await res.json();
      if (!data.repos || data.repos.length === 0) {
        // Not connected — redirect to GitHub OAuth
        setShowRepoPicker(false);
        setLoadingRepos(false);
        window.location.href = "/api/auth/github";
        return;
      }
      setAvailableRepos(data.repos);
      setGithubConnected(true);
    }
    setLoadingRepos(false);
  };

  const openRepoPicker = () => {
    setShowRepoPicker(true);
    setAvailableRepos([]);
    setRepoFilter("");
    fetchAllRepos();
  };

  const connectRepo = async (fullName: string) => {
    const res = await fetch("/api/sources/github", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ repo: fullName, matrixId: activeMatrixId }),
    });
    if (res.ok) {
      setShowRepoPicker(false);
      fetchSources();
    }
  };

  const syncSource = async (sourceId: string) => {
    setSyncing(true);
    try {
      const res = await fetch(`/api/sources/github/${sourceId}/sync`, { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        console.log(`[sync] Imported: ${data.imported}, Classified: ${data.classified}, Failed: ${data.failed}, Total: ${data.total}`);
        if (data.failed > 0) {
          console.warn(`[sync] Failed to classify:`, data.failedTasks);
        }
      } else {
        const err = await res.json().catch(() => ({}));
        console.error(`[sync] Sync failed:`, res.status, err);
      }
    } catch (err) {
      console.error(`[sync] Network error:`, err);
    }
    await fetchTasks();
    setSyncing(false);
  };

  const quickAddTask = async () => {
    const title = quickTaskInput.trim();
    if (!title) return;
    setQuickTaskAdding(true);
    setQuickTaskInput("");
    try {
      const res = await fetch("/api/tasks/quick", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, matrixId: activeMatrixId }),
      });
      if (res.ok) {
        // Add immediately as unclassified, then poll for classification
        const { task } = await res.json();
        setTasks((prev) => [...prev, task]);
        // Poll briefly for classification result
        let attempts = 0;
        const poll = setInterval(async () => {
          attempts++;
          await fetchTasks();
          if (attempts >= 6) clearInterval(poll);
        }, 1500);
      }
    } catch (err) {
      console.error("[quick] Failed to add task:", err);
    }
    setQuickTaskAdding(false);
  };

  const moveToMatrix = async (taskId: string, matrixId: string) => {
    await fetch(`/api/tasks/${taskId}/matrix`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ matrixId }),
    });
    setMoveToMatrixModal(null);
    setContextMenu(null);
    await fetchTasks();
  };

  const completeTask = async (taskId: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
    await fetch(`/api/tasks/${taskId}/complete`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ completed: true }),
    });
    if (showCompleted) fetchCompletedTasks();
  };

  const uncompleteTask = async (taskId: string) => {
    setCompletedTasks((prev) => prev.filter((t) => t.id !== taskId));
    await fetch(`/api/tasks/${taskId}/complete`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ completed: false }),
    });
    await fetchTasks();
  };

  const reclassifyTask = async (taskId: string) => {
    setReclassifyingTaskId(taskId);
    try {
      const res = await fetch(`/api/tasks/${taskId}/reclassify`, { method: "POST" });
      await fetchTasks();
      if (res.ok) {
        const data = await res.json();
        if (data.task?.needsClarification) {
          setClarifyingTaskId(taskId);
          setClarifyAnswer("");
        }
      }
    } catch (err) {
      console.error("[reclassify] Failed:", err);
    }
    setReclassifyingTaskId(null);
  };

  const submitClarification = async (taskId: string) => {
    if (!clarifyAnswer.trim()) return;
    setClarifySubmitting(true);
    try {
      await fetch(`/api/tasks/${taskId}/clarify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answer: clarifyAnswer.trim() }),
      });
      setClarifyAnswer("");
      setClarifyingTaskId(null);
      await fetchTasks();
    } catch (err) {
      console.error("[clarify] Failed:", err);
    }
    setClarifySubmitting(false);
  };

  const fetchCompletedTasks = useCallback(async () => {
    const params = activeMatrixId
      ? `?matrixId=${activeMatrixId}&status=completed`
      : "?status=completed";
    const res = await fetch(`/api/tasks${params}`);
    if (res.ok) {
      const data = await res.json();
      setCompletedTasks(data.tasks);
    }
  }, [activeMatrixId]);

  const handleContextMenu = (e: React.MouseEvent, task: Task) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, task });
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
        <p className="text-gray-500 dark:text-gray-400">Loading your matrix...</p>
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
          className="mb-4 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 cursor-pointer"
        >
          ← Back to matrix
        </button>
        <h2 className={`text-2xl font-bold ${q.text} mb-1`}>{q.label}</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">{q.subtitle}</p>
        <div className="space-y-3">
          {qTasks.length === 0 && (
            <p className="text-gray-400 dark:text-gray-500 italic">No tasks in this quadrant</p>
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
      {/* Matrix Selector */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <div className="relative">
          <button
            onClick={() => setShowMatrixMenu(!showMatrixMenu)}
            className="flex items-center gap-1.5 text-lg font-bold dark:text-white hover:text-blue-600 dark:hover:text-blue-400 cursor-pointer"
          >
            {matrices.find((m) => m.id === activeMatrixId)?.name || "All Tasks"}
            <span className="text-xs text-gray-400">▼</span>
          </button>
          {showMatrixMenu && (
            <div className="absolute top-full left-0 mt-1 bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg shadow-lg z-40 min-w-[220px]">
              {matrices.map((m) => (
                <div
                  key={m.id}
                  className={`flex items-center justify-between px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer text-sm ${m.id === activeMatrixId ? "bg-blue-50 dark:bg-blue-900/30" : ""}`}
                >
                  <span
                    className="flex-1 dark:text-white truncate"
                    onClick={() => { setActiveMatrixId(m.id); setShowMatrixMenu(false); }}
                  >
                    {m.name}
                    <span className="text-xs text-gray-400 ml-1">({m._count.tasks})</span>
                  </span>
                  <div className="flex gap-1 ml-2 shrink-0">
                    <button
                      onClick={(e) => { e.stopPropagation(); setShowMatrixModal({ mode: "edit", name: m.name, description: m.description || "", id: m.id }); setShowMatrixMenu(false); }}
                      className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xs cursor-pointer"
                      title="Edit"
                    >✏️</button>
                    <button
                      onClick={(e) => { e.stopPropagation(); if (confirm(`Delete "${m.name}"? Tasks will become unscoped.`)) deleteMatrix(m.id); setShowMatrixMenu(false); }}
                      className="text-gray-400 hover:text-red-500 text-xs cursor-pointer"
                      title="Delete"
                    >🗑</button>
                  </div>
                </div>
              ))}
              <div className="border-t dark:border-gray-700">
                <button
                  onClick={() => { setShowMatrixModal({ mode: "create", name: "", description: "" }); setShowMatrixMenu(false); }}
                  className="w-full text-left px-3 py-2 text-sm text-blue-600 dark:text-blue-400 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
                >
                  + New Matrix
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Matrix Create/Edit Modal */}
      {showMatrixModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-sm">
            <h3 className="font-semibold mb-3 dark:text-white">
              {showMatrixModal.mode === "create" ? "New Matrix" : "Edit Matrix"}
            </h3>
            <input
              placeholder="Matrix name"
              value={showMatrixModal.name}
              onChange={(e) => setShowMatrixModal((m) => m && { ...m, name: e.target.value })}
              autoFocus
              className="w-full border dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded px-3 py-2 mb-3 text-sm"
            />
            <input
              placeholder="Description (optional)"
              value={showMatrixModal.description}
              onChange={(e) => setShowMatrixModal((m) => m && { ...m, description: e.target.value })}
              className="w-full border dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded px-3 py-2 mb-4 text-sm"
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowMatrixModal(null)}
                className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 cursor-pointer"
              >Cancel</button>
              <button
                onClick={() => {
                  if (!showMatrixModal.name.trim()) return;
                  if (showMatrixModal.mode === "create") {
                    createMatrix(showMatrixModal.name, showMatrixModal.description);
                  } else if (showMatrixModal.id) {
                    updateMatrix(showMatrixModal.id, showMatrixModal.name, showMatrixModal.description);
                  }
                }}
                disabled={!showMatrixModal.name.trim()}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 cursor-pointer disabled:opacity-50"
              >
                {showMatrixModal.mode === "create" ? "Create" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* No Matrix Prompt */}
      {matrices.length === 0 && !loading && tasks.length === 0 && (
        <div className="text-center py-12 text-gray-400 dark:text-gray-500">
          <p className="mb-3 text-lg">No matrices yet</p>
          <button
            onClick={() => setShowMatrixModal({ mode: "create", name: "", description: "" })}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 cursor-pointer text-sm"
          >
            Create Your First Matrix
          </button>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex gap-2 flex-wrap">
          {sources.map((s) => (
            <button
              key={s.id}
              onClick={() => syncSource(s.id)}
              disabled={syncing}
              className="text-xs bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 dark:text-gray-300 px-3 py-1.5 rounded-full cursor-pointer disabled:opacity-50"
            >
              {syncing ? "Syncing..." : `⟳ ${s.name}`}
            </button>
          ))}
          <button
            onClick={openRepoPicker}
            className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-full cursor-pointer"
          >
            {githubConnected ? "+ Add Repo" : "Connect GitHub"}
          </button>
        </div>
      </div>

      {/* Quick Task Input */}
      <div className="mb-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            quickAddTask();
          }}
          className="flex gap-2"
        >
          <input
            type="text"
            value={quickTaskInput}
            onChange={(e) => setQuickTaskInput(e.target.value)}
            placeholder="Jot a quick task… (auto-classified)"
            disabled={quickTaskAdding}
            className="flex-1 px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={quickTaskAdding || !quickTaskInput.trim()}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 cursor-pointer disabled:opacity-50 whitespace-nowrap"
          >
            {quickTaskAdding ? "Adding…" : "+ Add"}
          </button>
        </form>
      </div>

      {/* Repo Picker Modal */}
      {showRepoPicker && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md max-h-[80vh] flex flex-col">
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-semibold dark:text-white">Select a Repository</h3>
              <button
                onClick={() => setShowRepoPicker(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 cursor-pointer text-lg"
              >
                ✕
              </button>
            </div>
            <input
              type="text"
              placeholder="Filter repos..."
              value={repoFilter}
              onChange={(e) => setRepoFilter(e.target.value)}
              autoFocus
              className="border dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded px-3 py-2 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            {loadingRepos && availableRepos.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">Loading repositories...</p>
            ) : (
              <div className="overflow-y-auto flex-1 space-y-1">
                {availableRepos
                  .filter((r) => !sources.some((s) => s.name === r.fullName))
                  .filter((r) => !repoFilter || r.fullName.toLowerCase().includes(repoFilter.toLowerCase()))
                  .sort((a, b) => a.fullName.localeCompare(b.fullName))
                  .map((repo) => (
                    <button
                      key={repo.fullName}
                      onClick={() => connectRepo(repo.fullName)}
                      className="w-full text-left px-3 py-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-sm cursor-pointer flex justify-between items-center"
                    >
                      <span className="font-medium dark:text-white">{repo.fullName}</span>
                      <span className="text-xs text-gray-400 dark:text-gray-500">
                        {repo.openIssuesCount} issues
                      </span>
                    </button>
                  ))}
                {availableRepos
                  .filter((r) => !sources.some((s) => s.name === r.fullName))
                  .filter((r) => !repoFilter || r.fullName.toLowerCase().includes(repoFilter.toLowerCase()))
                  .length === 0 && !loadingRepos && (
                  <p className="text-sm text-gray-400 dark:text-gray-500 italic">
                    {repoFilter ? "No matching repos" : "All accessible repos already connected"}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Delegate Modal */}
      {delegateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md">
            <h3 className="font-semibold mb-3 dark:text-white">Delegate Task</h3>
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
              className="w-full border dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded px-3 py-2 mb-4 text-sm"
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setDelegateModal(null)}
                className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 cursor-pointer"
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
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-start mb-3">
              <h3 className="font-semibold pr-4 dark:text-white">{selectedTask.title}</h3>
              <button
                onClick={() => setSelectedTask(null)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 cursor-pointer text-lg"
              >
                ✕
              </button>
            </div>
            {selectedTask.description && (
              <p className="text-sm text-gray-600 dark:text-gray-300 mb-3 whitespace-pre-wrap">
                {selectedTask.description}
              </p>
            )}
            {selectedTask.classification && (
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded p-3 mb-3">
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                  AI Reasoning ({Math.round(selectedTask.classification.confidence * 100)}% confident)
                </p>
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  {selectedTask.classification.reasoning}
                </p>
              </div>
            )}
            {selectedTask.clarifications?.length > 0 && (
              <div className="bg-purple-50 dark:bg-purple-950/30 rounded p-3 mb-3">
                <p className="text-xs font-medium text-purple-600 dark:text-purple-400 mb-1.5">
                  Clarifications
                </p>
                <div className="space-y-1.5">
                  {selectedTask.clarifications.map((c, i) => (
                    <div key={i} className="text-xs">
                      <p className="text-purple-700 dark:text-purple-300">Q: {c.question}</p>
                      <p className="text-gray-700 dark:text-gray-300">A: {c.answer}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {selectedTask.needsClarification && selectedTask.pendingQuestion && (
              <div className="bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800 rounded p-3 mb-3">
                <p className="text-xs text-purple-700 dark:text-purple-300 mb-2">
                  🤖 {selectedTask.pendingQuestion}
                </p>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    submitClarification(selectedTask.id);
                  }}
                  className="flex gap-1.5"
                >
                  <input
                    type="text"
                    value={clarifyAnswer}
                    onChange={(e) => setClarifyAnswer(e.target.value)}
                    placeholder="Type your answer…"
                    disabled={clarifySubmitting}
                    autoFocus
                    className="flex-1 px-2 py-1.5 text-xs rounded border border-purple-200 dark:border-purple-700 bg-white dark:bg-gray-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-purple-500 disabled:opacity-50"
                  />
                  <button
                    type="submit"
                    disabled={clarifySubmitting || !clarifyAnswer.trim()}
                    className="px-3 py-1.5 text-xs bg-purple-600 text-white rounded hover:bg-purple-700 cursor-pointer disabled:opacity-50"
                  >
                    {clarifySubmitting ? "…" : "Send"}
                  </button>
                </form>
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
            {matrices.length > 1 && (
              <button
                onClick={() => {
                  setMoveToMatrixModal(selectedTask);
                  setSelectedTask(null);
                }}
                className="mt-3 text-sm text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 cursor-pointer"
              >
                📦 Move to another matrix…
              </button>
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
                className={`border-2 ${q.border} ${q.bg} rounded-lg p-3 min-h-[180px] flex flex-col transition-all ${dragOverQuadrant === key ? "ring-2 ring-offset-2 ring-blue-500 dark:ring-offset-gray-900 scale-[1.02]" : ""}`}
                onDragOver={(e) => handleDragOver(e, key)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, key)}
              >
                <div
                  className="flex justify-between items-center mb-2 cursor-pointer"
                  onClick={() => setExpandedQuadrant(key)}
                >
                  <div>
                    <h2 className={`font-semibold ${q.text} text-sm`}>
                      {q.label}
                    </h2>
                    <p className="text-xs text-gray-400 dark:text-gray-500">{q.subtitle}</p>
                  </div>
                    <span className="text-xs text-gray-400 dark:text-gray-500">
                    {qTasks.length} {qTasks.length === 1 ? "task" : "tasks"} →
                  </span>
                </div>
                <div className="flex-1 space-y-1.5 overflow-y-auto max-h-[200px]">
                  {qTasks.slice(0, 5).map((task) => (
                    <div
                      key={task.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, task.id)}
                      onDragEnd={handleDragEnd}
                      onContextMenu={(e) => handleContextMenu(e, task)}
                      title={task.classification?.reasoning || undefined}
                      className={`bg-white dark:bg-gray-800 rounded p-2 shadow-sm dark:shadow-gray-900/30 text-xs cursor-grab hover:shadow-md transition-all dark:text-gray-200 active:cursor-grabbing ${draggedTaskId === task.id ? "opacity-40 scale-95" : ""}`}
                      onClick={() => setSelectedTask(task)}
                    >
                      <div className="flex items-center gap-1.5">
                        <input
                          type="checkbox"
                          checked={false}
                          onChange={(e) => { e.stopPropagation(); completeTask(task.id); }}
                          onClick={(e) => e.stopPropagation()}
                          className="shrink-0 w-3.5 h-3.5 rounded cursor-pointer accent-green-600"
                        />
                        <p className="font-medium truncate">{task.title}</p>
                      </div>
                      {task.status === "delegated" && (
                        <p className="text-yellow-600 text-[10px] mt-0.5">
                          → {task.delegatedTo}
                        </p>
                      )}
                    </div>
                  ))}
                  {qTasks.length > 5 && (
                    <p
                      className="text-xs text-gray-400 dark:text-gray-500 cursor-pointer hover:text-gray-600 dark:hover:text-gray-300"
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
        <div className="text-center mt-8 text-gray-400 dark:text-gray-500">
          <p className="mb-2">No tasks yet</p>
          <p className="text-sm">
            Connect a GitHub repo to import issues into your Eisenhower Matrix
          </p>
        </div>
      )}

      {/* Unclassified Tasks */}
      {tasks.filter((t) => !t.quadrant && t.status !== "completed").length > 0 && (
        <div className="mt-4 border-2 border-dashed border-orange-300 dark:border-orange-700 bg-orange-50 dark:bg-orange-950/30 rounded-lg p-3">
          <h2 className="font-semibold text-orange-700 dark:text-orange-400 text-sm mb-2">
            ⚠️ Needs Classification
          </h2>
          <p className="text-xs text-orange-500 dark:text-orange-500 mb-2">
            These tasks couldn&apos;t be classified automatically. Drag them to a quadrant or answer the AI&apos;s questions.
          </p>
          <div className="space-y-2">
            {tasks
              .filter((t) => !t.quadrant && t.status !== "completed")
              .map((task) => (
                <div key={task.id} className="space-y-1">
                  <div
                    draggable
                    onDragStart={(e) => handleDragStart(e, task.id)}
                    onDragEnd={handleDragEnd}
                    onContextMenu={(e) => handleContextMenu(e, task)}
                    title={task.classification?.reasoning || undefined}
                    className={`bg-white dark:bg-gray-800 rounded p-2 shadow-sm dark:shadow-gray-900/30 text-xs dark:text-gray-200 flex items-center justify-between gap-2 cursor-grab active:cursor-grabbing ${draggedTaskId === task.id ? "opacity-40 scale-95" : ""}`}
                  >
                    <div className="flex items-center gap-1.5 flex-1 min-w-0">
                      {task.needsClarification && (
                        <span
                          className="shrink-0 cursor-pointer"
                          title="AI needs clarification"
                          onClick={(e) => {
                            e.stopPropagation();
                            setClarifyingTaskId(clarifyingTaskId === task.id ? null : task.id);
                            setClarifyAnswer("");
                          }}
                        >
                          💬
                        </span>
                      )}
                      <p
                        className="font-medium truncate flex-1 cursor-pointer hover:text-orange-700 dark:hover:text-orange-400"
                        onClick={() => setSelectedTask(task)}
                      >
                        {task.title}
                      </p>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      {task.needsClarification && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setClarifyingTaskId(clarifyingTaskId === task.id ? null : task.id);
                            setClarifyAnswer("");
                          }}
                          className="px-1.5 py-0.5 rounded text-[10px] bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 hover:bg-purple-200 dark:hover:bg-purple-800/40 cursor-pointer"
                        >
                          Answer
                        </button>
                      )}
                      {!task.needsClarification && (
                        <>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setClarifyingTaskId(clarifyingTaskId === task.id ? null : task.id);
                              setClarifyAnswer("");
                            }}
                            className="px-1.5 py-0.5 rounded text-[10px] bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 hover:bg-purple-200 dark:hover:bg-purple-800/40 cursor-pointer"
                            title="Add context to help classify"
                          >
                            💬
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              reclassifyTask(task.id);
                            }}
                            disabled={reclassifyingTaskId === task.id}
                            className="px-1.5 py-0.5 rounded text-[10px] bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-800/40 cursor-pointer disabled:opacity-50"
                            title="Retry classification"
                          >
                            {reclassifyingTaskId === task.id ? "…" : "🔄"}
                          </button>
                        </>
                      )}
                      {(Object.keys(QUADRANTS) as QuadrantKey[]).map((q) => (
                        <button
                          key={q}
                          onClick={() => moveTask(task.id, q)}
                          className="px-1.5 py-0.5 rounded text-[10px] bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 cursor-pointer"
                          title={QUADRANTS[q].label}
                        >
                          {QUADRANTS[q].label.split(" ")[0]}
                        </button>
                      ))}
                    </div>
                  </div>
                  {/* Clarification Q&A */}
                  {clarifyingTaskId === task.id && (
                    <div className="ml-6 bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800 rounded-lg p-2.5">
                      {/* Past clarifications */}
                      {task.clarifications?.length > 0 && (
                        <div className="mb-2 space-y-1">
                          {task.clarifications.map((c, i) => (
                            <div key={i} className="text-[11px]">
                              <p className="text-purple-600 dark:text-purple-400">Q: {c.question}</p>
                              <p className="text-gray-600 dark:text-gray-300">A: {c.answer}</p>
                            </div>
                          ))}
                        </div>
                      )}
                      <p className="text-xs text-purple-700 dark:text-purple-300 mb-2">
                        🤖 {task.pendingQuestion || "What additional context can you provide to help classify this task?"}
                      </p>
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          submitClarification(task.id);
                        }}
                        className="flex gap-1.5"
                      >
                        <input
                          type="text"
                          value={clarifyAnswer}
                          onChange={(e) => setClarifyAnswer(e.target.value)}
                          placeholder="Type your answer…"
                          disabled={clarifySubmitting}
                          autoFocus
                          className="flex-1 px-2 py-1 text-xs rounded border border-purple-200 dark:border-purple-700 bg-white dark:bg-gray-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-purple-500 disabled:opacity-50"
                        />
                        <button
                          type="submit"
                          disabled={clarifySubmitting || !clarifyAnswer.trim()}
                          className="px-2.5 py-1 text-xs bg-purple-600 text-white rounded hover:bg-purple-700 cursor-pointer disabled:opacity-50 whitespace-nowrap"
                        >
                          {clarifySubmitting ? "…" : "Send"}
                        </button>
                      </form>
                    </div>
                  )}
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Completed Tasks */}
      <div className="mt-4">
        <button
          onClick={() => {
            const next = !showCompleted;
            setShowCompleted(next);
            if (next) fetchCompletedTasks();
          }}
          className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 cursor-pointer flex items-center gap-1"
        >
          <span className="text-xs">{showCompleted ? "▼" : "▶"}</span>
          ✓ Completed {completedTasks.length > 0 && `(${completedTasks.length})`}
        </button>
        {showCompleted && (
          <div className="mt-2 space-y-1">
            {completedTasks.length === 0 ? (
              <p className="text-xs text-gray-400 dark:text-gray-500 italic pl-4">No completed tasks yet</p>
            ) : (
              completedTasks.map((task) => (
                <div
                  key={task.id}
                  className="flex items-center gap-2 px-3 py-1.5 rounded bg-gray-50 dark:bg-gray-800/50 text-xs"
                >
                  <input
                    type="checkbox"
                    checked={true}
                    onChange={() => uncompleteTask(task.id)}
                    className="shrink-0 w-3.5 h-3.5 rounded cursor-pointer accent-green-600"
                  />
                  <span className="line-through text-gray-400 dark:text-gray-500 truncate flex-1">
                    {task.title}
                  </span>
                  {task.quadrant && (
                    <span className="text-[10px] text-gray-400 dark:text-gray-600 shrink-0">
                      {QUADRANTS[task.quadrant as QuadrantKey]?.label.split(" ")[0]}
                    </span>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <div
          className="fixed inset-0 z-50"
          onClick={() => setContextMenu(null)}
          onContextMenu={(e) => { e.preventDefault(); setContextMenu(null); }}
        >
          <div
            className="absolute bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg shadow-xl py-1 min-w-[160px]"
            style={{ left: contextMenu.x, top: contextMenu.y }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-3 py-1.5 text-xs text-gray-400 dark:text-gray-500 truncate max-w-[200px]">
              {contextMenu.task.title}
            </div>
            <hr className="dark:border-gray-700" />
            <button
              className="w-full text-left px-3 py-2 text-sm text-green-700 dark:text-green-400 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer"
              onClick={() => {
                completeTask(contextMenu.task.id);
                setContextMenu(null);
              }}
            >
              ✓ Mark complete
            </button>
            {matrices.length > 1 && (
              <button
                className="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer"
                onClick={() => {
                  setMoveToMatrixModal(contextMenu.task);
                  setContextMenu(null);
                }}
              >
                📦 Move to matrix…
              </button>
            )}
            {(Object.keys(QUADRANTS) as QuadrantKey[])
              .filter((q) => q !== contextMenu.task.quadrant)
              .map((q) => (
                <button
                  key={q}
                  className="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer"
                  onClick={() => {
                    moveTask(contextMenu.task.id, q);
                    setContextMenu(null);
                  }}
                >
                  → {QUADRANTS[q].label}
                </button>
              ))}
          </div>
        </div>
      )}

      {/* Move to Matrix Modal */}
      {moveToMatrixModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-sm">
            <h3 className="font-semibold mb-1 dark:text-white">Move to Matrix</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4 truncate">
              {moveToMatrixModal.title}
            </p>
            <div className="space-y-2">
              {matrices
                .filter((m) => m.id !== activeMatrixId)
                .map((m) => (
                  <button
                    key={m.id}
                    onClick={() => moveToMatrix(moveToMatrixModal.id, m.id)}
                    className="w-full text-left px-3 py-2.5 rounded-lg border dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-colors"
                  >
                    <span className="font-medium text-sm dark:text-white">{m.name}</span>
                    {m.description && (
                      <span className="block text-xs text-gray-400 dark:text-gray-500 truncate">{m.description}</span>
                    )}
                  </button>
                ))}
            </div>
            <button
              onClick={() => setMoveToMatrixModal(null)}
              className="mt-4 w-full text-center text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 cursor-pointer"
            >
              Cancel
            </button>
          </div>
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
    <div className="bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg p-3 shadow-sm dark:shadow-gray-900/30">
      <div className="flex justify-between items-start gap-2">
        <div className="flex-1 min-w-0 cursor-pointer" onClick={() => onSelect(task)}>
          <p className="font-medium text-sm dark:text-white">{task.title}</p>
          {task.description && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">
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
            className="text-[10px] px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 dark:text-gray-300 cursor-pointer"
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
