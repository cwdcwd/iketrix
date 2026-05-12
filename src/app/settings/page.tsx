"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

type GitHubStatus = {
  connected: boolean;
  username?: string;
  avatarUrl?: string;
};

type GatewayModel = {
  id: string;
  name: string;
  provider: string;
  contextWindow?: number;
};

const DEFAULT_PROMPT = `You are an Eisenhower Matrix classifier. Classify this task into one of four quadrants:

- "do": Important AND Urgent — must be done immediately and personally
- "schedule": Important AND NOT Urgent — set a deadline, do personally later
- "delegate": NOT Important AND Urgent — assign to someone else
- "delete": NOT Important AND NOT Urgent — drop it entirely

Consider urgency signals (deadlines, bugs, blockers, "ASAP") and importance signals (business value, user impact, strategic goals). Provide your reasoning.`;

export default function SettingsPage() {
  const router = useRouter();
  const [githubStatus, setGithubStatus] = useState<GitHubStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [disconnecting, setDisconnecting] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark" | "system">("system");

  // Classifier settings
  const [classifierModel, setClassifierModel] = useState("openai/gpt-4o-mini");
  const [classifierPrompt, setClassifierPrompt] = useState("");
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsSaved, setSettingsSaved] = useState(false);
  const [availableModels, setAvailableModels] = useState<GatewayModel[]>([]);
  const [modelFilter, setModelFilter] = useState("");
  const [loadingModels, setLoadingModels] = useState(true);

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

    // Fetch classifier settings
    fetch("/api/settings")
      .then((res) => res.json())
      .then((data) => {
        if (data.classifierModel) setClassifierModel(data.classifierModel);
        if (data.classifierPrompt) setClassifierPrompt(data.classifierPrompt);
      });

    // Fetch available models from AI Gateway
    fetch("/api/models")
      .then((res) => res.json())
      .then((data) => setAvailableModels(data.models || []))
      .finally(() => setLoadingModels(false));
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

  const saveClassifierSettings = async () => {
    setSavingSettings(true);
    setSettingsSaved(false);
    await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        classifierModel,
        classifierPrompt: classifierPrompt || "",
      }),
    });
    setSavingSettings(false);
    setSettingsSaved(true);
    setTimeout(() => setSettingsSaved(false), 2000);
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

      {/* Classifier Model */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-4 dark:text-white">Classifier Model</h2>
        <div className="border dark:border-gray-700 rounded-lg p-5 bg-white dark:bg-gray-800">
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
            Choose which AI model classifies your tasks into the Eisenhower Matrix.
          </p>
          {classifierModel && (
            <div className="mb-3 px-3 py-2 rounded-lg bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800">
              <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
                Current: {availableModels.find((m) => m.id === classifierModel)?.name || classifierModel}
              </span>
              <span className="text-xs text-blue-500 dark:text-blue-400 ml-2">{classifierModel}</span>
            </div>
          )}
          <input
            type="text"
            placeholder="Search models..."
            value={modelFilter}
            onChange={(e) => setModelFilter(e.target.value)}
            className="w-full border dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg px-3 py-2 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {loadingModels ? (
            <p className="text-sm text-gray-400 dark:text-gray-500">Loading models...</p>
          ) : (
            <div className="max-h-[300px] overflow-y-auto space-y-1">
              {availableModels
                .filter((m) =>
                  !modelFilter ||
                  m.name.toLowerCase().includes(modelFilter.toLowerCase()) ||
                  m.id.toLowerCase().includes(modelFilter.toLowerCase()) ||
                  m.provider.toLowerCase().includes(modelFilter.toLowerCase())
                )
                .map((m) => (
                  <button
                    key={m.id}
                    onClick={() => setClassifierModel(m.id)}
                    className={`w-full px-3 py-2 rounded-lg border text-left text-sm cursor-pointer transition-colors ${
                      classifierModel === m.id
                        ? "border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
                        : "border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                    }`}
                  >
                    <span className="font-medium">{m.name}</span>
                    <span className="text-xs text-gray-400 dark:text-gray-500 ml-2">{m.provider}</span>
                    {m.contextWindow && (
                      <span className="text-xs text-gray-400 dark:text-gray-500 float-right">
                        {Math.round(m.contextWindow / 1000)}k ctx
                      </span>
                    )}
                  </button>
                ))}
              {availableModels.filter((m) =>
                !modelFilter ||
                m.name.toLowerCase().includes(modelFilter.toLowerCase()) ||
                m.id.toLowerCase().includes(modelFilter.toLowerCase()) ||
                m.provider.toLowerCase().includes(modelFilter.toLowerCase())
              ).length === 0 && (
                <p className="text-sm text-gray-400 dark:text-gray-500 italic py-2">
                  No models match &ldquo;{modelFilter}&rdquo;
                </p>
              )}
            </div>
          )}
        </div>
      </section>

      {/* Classifier Prompt */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-4 dark:text-white">Classifier Prompt</h2>
        <div className="border dark:border-gray-700 rounded-lg p-5 bg-white dark:bg-gray-800">
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
            Customize the system prompt used when classifying tasks. Leave blank to use the default. The task title, description, and labels are appended automatically.
          </p>
          <textarea
            value={classifierPrompt}
            onChange={(e) => setClassifierPrompt(e.target.value)}
            placeholder={DEFAULT_PROMPT}
            rows={8}
            maxLength={4000}
            className="w-full border dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
          />
          <div className="flex items-center justify-between mt-3">
            <span className="text-xs text-gray-400 dark:text-gray-500">
              {classifierPrompt.length}/4000 chars
            </span>
            <div className="flex items-center gap-2">
              {classifierPrompt && (
                <button
                  onClick={() => setClassifierPrompt("")}
                  className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 cursor-pointer"
                >
                  Reset to default
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Save */}
      <div className="flex justify-end mb-8">
        <button
          onClick={saveClassifierSettings}
          disabled={savingSettings}
          className="px-5 py-2.5 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 cursor-pointer disabled:opacity-50"
        >
          {savingSettings ? "Saving…" : settingsSaved ? "✓ Saved" : "Save Settings"}
        </button>
      </div>

      {/* Contacts */}
      <ContactsSection />
    </div>
  );
}

function ContactsSection() {
  const [contacts, setContacts] = useState<Array<{
    id: string;
    email: string;
    name: string | null;
    linkedUserId: string | null;
    inviteStatus: string | null;
    linkedUser: { id: string; name: string | null; email: string } | null;
  }>>([]);
  const [loading, setLoading] = useState(true);
  const [newEmail, setNewEmail] = useState("");
  const [newName, setNewName] = useState("");
  const [adding, setAdding] = useState(false);

  const fetchContacts = async () => {
    try {
      const res = await fetch("/api/contacts");
      if (res.ok) {
        const data = await res.json();
        setContacts(data.contacts);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchContacts(); }, []);

  const addContact = async () => {
    if (!newEmail.trim()) return;
    setAdding(true);
    try {
      const res = await fetch("/api/contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: newEmail.trim(), name: newName.trim() || null }),
      });
      if (res.ok || res.status === 409) {
        setNewEmail("");
        setNewName("");
        fetchContacts();
      }
    } finally {
      setAdding(false);
    }
  };

  const deleteContact = async (id: string) => {
    await fetch(`/api/contacts/${id}`, { method: "DELETE" });
    fetchContacts();
  };

  const inviteContact = async (id: string) => {
    await fetch(`/api/contacts/${id}/invite`, { method: "POST" });
    fetchContacts();
  };

  return (
    <section className="mb-8">
      <h2 className="text-lg font-semibold mb-3 dark:text-white">Contacts</h2>
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
        Manage contacts you can delegate tasks to. Linked contacts (existing users) will see delegated tasks on their board automatically.
      </p>

      {/* Add contact form */}
      <div className="flex gap-2 mb-4">
        <input
          type="text"
          placeholder="Name"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          className="border dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded px-3 py-2 text-sm w-36"
        />
        <input
          type="email"
          placeholder="Email"
          value={newEmail}
          onChange={(e) => setNewEmail(e.target.value)}
          className="flex-1 border dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded px-3 py-2 text-sm"
        />
        <button
          onClick={addContact}
          disabled={!newEmail.trim() || adding}
          className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 cursor-pointer disabled:opacity-50"
        >
          {adding ? "Adding..." : "Add"}
        </button>
      </div>

      {/* Contact list */}
      {loading ? (
        <p className="text-sm text-gray-400">Loading contacts...</p>
      ) : contacts.length === 0 ? (
        <p className="text-sm text-gray-400">No contacts yet. Add one above to start delegating.</p>
      ) : (
        <div className="border dark:border-gray-700 rounded-lg overflow-hidden">
          {contacts.map((contact) => (
            <div key={contact.id} className="flex items-center justify-between px-4 py-3 border-b dark:border-gray-700 last:border-b-0">
              <div>
                <span className="text-sm font-medium dark:text-white">
                  {contact.name || contact.email}
                </span>
                {contact.name && (
                  <span className="text-xs text-gray-500 ml-2">{contact.email}</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {contact.linkedUser ? (
                  <span className="text-xs text-green-600">✓ User</span>
                ) : contact.inviteStatus === "pending" ? (
                  <span className="text-xs text-yellow-600">⏳ Invited</span>
                ) : (
                  <button
                    onClick={() => inviteContact(contact.id)}
                    className="text-xs text-blue-600 hover:text-blue-700 cursor-pointer"
                  >
                    Invite
                  </button>
                )}
                <button
                  onClick={() => deleteContact(contact.id)}
                  className="text-xs text-red-500 hover:text-red-700 cursor-pointer"
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
