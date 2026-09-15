"use client";

import { useState, useEffect } from "react";

type Artifact = {
  id: string;
  title: string;
  content: string;
  mimeType: string;
  language: string | null;
  toolName: string | null;
  createdAt: string;
};

interface ArtifactViewerProps {
  artifactId: string | null;
  onClose: () => void;
}

export default function ArtifactViewer({ artifactId, onClose }: ArtifactViewerProps) {
  const [artifact, setArtifact] = useState<Artifact | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!artifactId) {
      setArtifact(null);
      return;
    }
    setLoading(true);
    fetch(`/api/artifacts/${artifactId}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setArtifact(data))
      .finally(() => setLoading(false));
  }, [artifactId]);

  if (!artifactId) return null;

  const copyContent = async () => {
    if (!artifact) return;
    await navigator.clipboard.writeText(artifact.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isCode = artifact?.language || artifact?.mimeType.startsWith("text/x-");
  const displayLang = artifact?.language || artifact?.mimeType.split("/").pop()?.replace("x-", "") || "";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b dark:border-gray-700">
          {loading ? (
            <span className="text-sm text-gray-400">Loading...</span>
          ) : artifact ? (
            <div className="flex-1 min-w-0 mr-4">
              <h3 className="text-sm font-semibold dark:text-white truncate">{artifact.title}</h3>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[10px] px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 rounded">
                  {artifact.mimeType}
                </span>
                {artifact.language && (
                  <span className="text-[10px] px-1.5 py-0.5 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded">
                    {artifact.language}
                  </span>
                )}
                <span className="text-[10px] text-gray-400">
                  {new Date(artifact.createdAt).toLocaleString()}
                </span>
              </div>
            </div>
          ) : (
            <span className="text-sm text-gray-400">Not found</span>
          )}
          <div className="flex items-center gap-2">
            {artifact && (
              <button
                onClick={copyContent}
                className="text-xs px-2.5 py-1.5 rounded border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition-colors"
              >
                {copied ? "✓ Copied" : "Copy"}
              </button>
            )}
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 cursor-pointer text-lg"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-5">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <span className="text-gray-400">Loading artifact...</span>
            </div>
          ) : artifact ? (
            isCode ? (
              <div className="relative">
                {displayLang && (
                  <span className="absolute top-2 right-2 text-[10px] text-gray-400 dark:text-gray-500 font-mono">
                    {displayLang}
                  </span>
                )}
                <pre className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 text-sm font-mono overflow-x-auto whitespace-pre-wrap break-words text-gray-800 dark:text-gray-200 leading-relaxed">
                  {artifact.content}
                </pre>
              </div>
            ) : artifact.mimeType === "application/json" ? (
              <pre className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 text-sm font-mono overflow-x-auto whitespace-pre-wrap break-words text-gray-800 dark:text-gray-200 leading-relaxed">
                {(() => {
                  try { return JSON.stringify(JSON.parse(artifact.content), null, 2); } catch { return artifact.content; }
                })()}
              </pre>
            ) : (
              <div className="prose dark:prose-invert max-w-none text-sm whitespace-pre-wrap">
                {artifact.content}
              </div>
            )
          ) : (
            <div className="text-center py-12 text-gray-400">
              Artifact not found or access denied.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
