"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

type GitHubStatus = {
  connected: boolean;
  username?: string;
  avatarUrl?: string;
};

export default function SettingsPage() {
  const router = useRouter();
  const [githubStatus, setGithubStatus] = useState<GitHubStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [disconnecting, setDisconnecting] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark" | "system">("system");

  useEffect(() => {
    // Load saved theme
    const saved = localStorage.getItem("iketrix-theme") as "light" | "dark" | "system" | null;
    if (saved) {
      setTheme(saved);
    }
    applyTheme(saved || "system");

    // Fetch GitHub status
    fetch("/api/auth/github/status")
      .then((res) => res.json())
      .then((data) => setGithubStatus(data))
      .finally(() => setLoading(false));
  }, []);

  const applyTheme = (t: "light" | "dark" | "system") => {
    const root = document.documentElement;
    if (t === "dark") {
      root.classList.add("dark");
    } else if (t === "light") {
      root.classList.remove("dark");
    } else {
      // System preference
      if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
        root.classList.add("dark");
      } else {
        root.classList.remove("dark");
      }
    }
  };

  const handleThemeChange = (t: "light" | "dark" | "system") => {
    setTheme(t);
    localStorage.setItem("iketrix-theme", t);
    applyTheme(t);
  };

  const connectGitHub = () => {
    window.location.href = "/api/auth/github";
  };

  const disconnectGitHub = async () => {
    if (!confirm("Disconnect GitHub? This will remove all connected repos and their synced tasks will become orphaned.")) return;
    setDisconnecting(true);
    const res = await fetch("/api/auth/github/disconnect", { method: "POST" });
    if (res.ok) {
      setGithubStatus({ connected: false });
    }
    setDisconnecting(false);
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="flex items-center gap-3 mb-8">
        <button
          onClick={() => router.push("/")}
          className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 cursor-pointer"
        >
          ← Back
        </button>
        <h1 className="text-2xl font-bold dark:text-white">Settings</h1>
      </div>

      {/* GitHub Connection */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-4 dark:text-white">GitHub Connection</h2>
        <div className="border dark:border-gray-700 rounded-lg p-5 bg-white dark:bg-gray-800">
          {loading ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">Checking connection...</p>
          ) : githubStatus?.connected ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {githubStatus.avatarUrl && (
                  <img
                    src={githubStatus.avatarUrl}
                    alt=""
                    className="w-10 h-10 rounded-full"
                  />
                )}
                <div>
                  <p className="font-medium dark:text-white">
                    Connected as <span className="text-green-600 dark:text-green-400">@{githubStatus.username}</span>
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Repo access via GitHub OAuth
                  </p>
                </div>
              </div>
              <button
                onClick={disconnectGitHub}
                disabled={disconnecting}
                className="px-4 py-2 text-sm font-medium text-red-600 dark:text-red-400 border border-red-300 dark:border-red-700 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/30 cursor-pointer disabled:opacity-50"
              >
                {disconnecting ? "Disconnecting..." : "Disconnect"}
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium dark:text-white">Not connected</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Connect GitHub to import issues as tasks
                </p>
              </div>
              <button
                onClick={connectGitHub}
                className="px-4 py-2 text-sm font-medium text-white bg-gray-900 dark:bg-white dark:text-gray-900 rounded-lg hover:bg-gray-700 dark:hover:bg-gray-200 cursor-pointer"
              >
                Connect GitHub
              </button>
            </div>
          )}
        </div>
      </section>

      {/* Appearance */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-4 dark:text-white">Appearance</h2>
        <div className="border dark:border-gray-700 rounded-lg p-5 bg-white dark:bg-gray-800">
          <div className="flex gap-3">
            {(["light", "dark", "system"] as const).map((t) => (
              <button
                key={t}
                onClick={() => handleThemeChange(t)}
                className={`flex-1 px-4 py-3 rounded-lg border text-sm font-medium cursor-pointer transition-colors ${
                  theme === t
                    ? "border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
                    : "border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                }`}
              >
                <span className="block text-lg mb-1">
                  {t === "light" ? "☀️" : t === "dark" ? "🌙" : "💻"}
                </span>
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
