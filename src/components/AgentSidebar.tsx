"use client";

import { useState, useEffect, useCallback } from "react";

type ActiveConversation = {
  id: string;
  status: string;
  summary: string | null;
  updatedAt: string;
  task: { id: string; title: string; quadrant: string };
};

type ArtifactSummary = {
  id: string;
  title: string;
  mimeType: string;
  language: string | null;
  toolName: string | null;
  createdAt: string;
  task: { id: string; title: string };
};

interface AgentSidebarProps {
  open: boolean;
  onToggle: () => void;
  onViewArtifact: (artifactId: string) => void;
  onOpenChat: (taskId: string) => void;
}

export default function AgentSidebar({ open, onToggle, onViewArtifact, onOpenChat }: AgentSidebarProps) {
  const [conversations, setConversations] = useState<ActiveConversation[]>([]);
  const [artifacts, setArtifacts] = useState<ArtifactSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"agents" | "artifacts">("agents");

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/agent/active");
      if (res.ok) {
        const data = await res.json();
        setConversations(data.conversations || []);
        setArtifacts(data.artifacts || []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) fetchData();
  }, [open, fetchData]);

  // Poll for updates every 10s while open
  useEffect(() => {
    if (!open) return;
    const interval = setInterval(fetchData, 10_000);
    return () => clearInterval(interval);
  }, [open, fetchData]);

  const quadrantColor = (q: string) => {
    switch (q) {
      case "do": return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";
      case "schedule": return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400";
      case "delegate": return "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400";
      case "delete": return "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400";
      default: return "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400";
    }
  };

  const mimeIcon = (mime: string) => {
    if (mime.includes("json")) return "{ }";
    if (mime.includes("markdown")) return "📝";
    if (mime.includes("python") || mime.includes("typescript") || mime.includes("javascript")) return "💻";
    if (mime.includes("csv")) return "📊";
    return "📄";
  };

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  return (
    <>
      {/* Toggle button when closed */}
      {!open && (
        <button
          onClick={onToggle}
          className="fixed right-0 top-1/2 -translate-y-1/2 z-30 bg-white dark:bg-gray-800 border border-r-0 dark:border-gray-700 rounded-l-lg px-2 py-4 shadow-lg hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-colors"
          title="Show agent activity"
        >
          <span className="text-sm writing-mode-vertical">🤖 Agents</span>
          {conversations.length > 0 && (
            <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-green-500 rounded-full animate-pulse" />
          )}
        </button>
      )}

      {/* Sidebar panel */}
      <div
        className={`fixed right-0 top-0 h-full z-40 bg-white dark:bg-gray-900 border-l dark:border-gray-700 shadow-2xl transition-transform duration-300 ease-in-out ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
        style={{ width: "360px" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b dark:border-gray-700">
          <h2 className="text-sm font-semibold dark:text-white">Agent Activity</h2>
          <button
            onClick={onToggle}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 cursor-pointer text-lg"
          >
            ✕
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b dark:border-gray-700">
          <button
            onClick={() => setTab("agents")}
            className={`flex-1 text-xs font-medium py-2.5 cursor-pointer transition-colors ${
              tab === "agents"
                ? "border-b-2 border-blue-500 text-blue-600 dark:text-blue-400"
                : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
            }`}
          >
            🤖 Active Agents {conversations.length > 0 && `(${conversations.length})`}
          </button>
          <button
            onClick={() => setTab("artifacts")}
            className={`flex-1 text-xs font-medium py-2.5 cursor-pointer transition-colors ${
              tab === "artifacts"
                ? "border-b-2 border-blue-500 text-blue-600 dark:text-blue-400"
                : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
            }`}
          >
            📄 Artifacts {artifacts.length > 0 && `(${artifacts.length})`}
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto" style={{ height: "calc(100% - 90px)" }}>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <span className="text-sm text-gray-400 dark:text-gray-500">Loading...</span>
            </div>
          ) : tab === "agents" ? (
            conversations.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                <span className="text-3xl mb-3">🤖</span>
                <p className="text-sm text-gray-500 dark:text-gray-400">No active agents</p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                  Delegate a task to start an agent conversation
                </p>
              </div>
            ) : (
              <div className="divide-y dark:divide-gray-800">
                {conversations.map((conv) => (
                  <button
                    key={conv.id}
                    onClick={() => onOpenChat(conv.task.id)}
                    className="w-full px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition-colors"
                  >
                    <div className="flex items-start gap-2">
                      <span className="text-green-500 mt-0.5 animate-pulse">●</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium dark:text-white truncate">{conv.task.title}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${quadrantColor(conv.task.quadrant)}`}>
                            {conv.task.quadrant}
                          </span>
                          <span className="text-[10px] text-gray-400 dark:text-gray-500">
                            {timeAgo(conv.updatedAt)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )
          ) : artifacts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
              <span className="text-3xl mb-3">📄</span>
              <p className="text-sm text-gray-500 dark:text-gray-400">No artifacts yet</p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                Agents will create artifacts as they work on tasks
              </p>
            </div>
          ) : (
            <div className="divide-y dark:divide-gray-800">
              {artifacts.map((art) => (
                <button
                  key={art.id}
                  onClick={() => onViewArtifact(art.id)}
                  className="w-full px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition-colors"
                >
                  <div className="flex items-start gap-2.5">
                    <span className="text-base mt-0.5">{mimeIcon(art.mimeType)}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium dark:text-white truncate">{art.title}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">
                        {art.task.title}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        {art.language && (
                          <span className="text-[10px] px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded">
                            {art.language}
                          </span>
                        )}
                        <span className="text-[10px] text-gray-400 dark:text-gray-500">
                          {timeAgo(art.createdAt)}
                        </span>
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Backdrop overlay when open on mobile */}
      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/20 md:hidden"
          onClick={onToggle}
        />
      )}
    </>
  );
}
