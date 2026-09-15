"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useState, useEffect, useRef } from "react";

interface AgentChatProps {
  conversationId: string;
  taskId: string;
  taskTitle: string;
  onClose: () => void;
}

export default function AgentChat({ conversationId, taskId, taskTitle, onClose }: AgentChatProps) {
  const [input, setInput] = useState("");
  const [initialLoaded, setInitialLoaded] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { messages, sendMessage, status, setMessages } = useChat({
    transport: new DefaultChatTransport({
      api: "/api/agent/chat",
      body: { conversationId, taskId },
    }),
  });

  // Load existing messages on mount for resumed conversations
  useEffect(() => {
    if (initialLoaded) return;
    (async () => {
      try {
        const res = await fetch(`/api/agent/conversations/${conversationId}`);
        if (res.ok) {
          const data = await res.json();
          if (data.conversation.messages.length > 0) {
            // Convert persisted messages to UIMessage format
            const uiMessages = data.conversation.messages
              .filter((m: { role: string }) => m.role !== "tool")
              .map((m: { id: string; role: string; content: string; createdAt: string }) => ({
                id: m.id,
                role: m.role as "user" | "assistant",
                parts: [{ type: "text" as const, text: m.content }],
                createdAt: new Date(m.createdAt),
              }));
            if (uiMessages.length > 0) {
              setMessages(uiMessages);
            }
          }
        }
      } catch {
        // Non-critical — start fresh if load fails
      }
      setInitialLoaded(true);
    })();
  }, [conversationId, initialLoaded, setMessages]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Send initial message if conversation is fresh
  useEffect(() => {
    if (initialLoaded && messages.length === 0) {
      sendMessage({
        text: `I need help with this task: "${taskTitle}". What do you need to know to help me get this done?`,
      });
    }
  }, [initialLoaded, messages.length, taskTitle, sendMessage]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && status === "ready") {
      sendMessage({ text: input });
      setInput("");
    }
  };

  const handleComplete = async () => {
    await fetch(`/api/agent/conversations/${conversationId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "completed", summary: "Completed by user" }),
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-lg h-[600px] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b dark:border-gray-700">
          <div>
            <h3 className="font-semibold text-sm dark:text-white">🤖 Agent Assistant</h3>
            <p className="text-xs text-gray-500 truncate max-w-[300px]">{taskTitle}</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleComplete}
              className="px-3 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 cursor-pointer"
            >
              Done
            </button>
            <button
              onClick={onClose}
              className="px-3 py-1 text-xs text-gray-600 dark:text-gray-400 hover:text-gray-800 cursor-pointer"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                  message.role === "user"
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 dark:bg-gray-700 dark:text-white"
                }`}
              >
                {message.parts.map((part, index) => {
                  if (part.type === "text") {
                    return <span key={index}>{part.text}</span>;
                  }
                  if (part.type.startsWith("tool-")) {
                    const toolPart = part as { type: string; toolName?: string; state?: string };
                    const name = toolPart.toolName || "tool";
                    const state = toolPart.state || "";
                    return (
                      <div key={index} className="text-xs italic text-gray-500 dark:text-gray-400 mt-1">
                        {state === "output-available"
                          ? `✓ ${name}`
                          : `⏳ ${name}...`}
                      </div>
                    );
                  }
                  return null;
                })}
              </div>
            </div>
          ))}
          {(status === "submitted" || status === "streaming") && (
            <div className="flex justify-start">
              <div className="bg-gray-100 dark:bg-gray-700 rounded-lg px-3 py-2 text-sm text-gray-500">
                {status === "submitted" ? "Thinking..." : "●●●"}
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <form onSubmit={handleSubmit} className="border-t dark:border-gray-700 px-4 py-3">
          <div className="flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={status !== "ready"}
              placeholder="Type a message..."
              className="flex-1 border dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded px-3 py-2 text-sm"
            />
            <button
              type="submit"
              disabled={status !== "ready" || !input.trim()}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 cursor-pointer disabled:opacity-50"
            >
              Send
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
