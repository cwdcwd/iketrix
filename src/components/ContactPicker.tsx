"use client";

import { useState, useEffect, useCallback } from "react";

interface Contact {
  id: string;
  email: string;
  name: string | null;
  linkedUserId: string | null;
  inviteStatus: string | null;
  linkedUser: { id: string; name: string | null; email: string } | null;
}

interface ContactPickerProps {
  onSelect: (contact: Contact) => void;
  onCreateAndSelect: (contact: Contact) => void;
}

export default function ContactPicker({ onSelect, onCreateAndSelect }: ContactPickerProps) {
  const [query, setQuery] = useState("");
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [creating, setCreating] = useState(false);

  const searchContacts = useCallback(async (q: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/contacts?q=${encodeURIComponent(q)}`);
      if (res.ok) {
        const data = await res.json();
        setContacts(data.contacts);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      searchContacts(query);
    }, 300);
    return () => clearTimeout(timer);
  }, [query, searchContacts]);

  const createContact = async () => {
    if (!newEmail.trim()) return;
    setCreating(true);
    try {
      const res = await fetch("/api/contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: newEmail.trim(), name: newName.trim() || null }),
      });
      if (res.ok || res.status === 409) {
        const data = await res.json();
        onCreateAndSelect(data.contact);
        setShowAdd(false);
        setNewName("");
        setNewEmail("");
      }
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-3">
      <input
        type="text"
        placeholder="Search contacts by name or email..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="w-full border dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded px-3 py-2 text-sm"
      />

      {loading && <p className="text-xs text-gray-400">Searching...</p>}

      {contacts.length > 0 && (
        <div className="max-h-40 overflow-y-auto border dark:border-gray-600 rounded">
          {contacts.map((contact) => (
            <button
              key={contact.id}
              onClick={() => onSelect(contact)}
              className="w-full text-left px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 border-b dark:border-gray-600 last:border-b-0 cursor-pointer"
            >
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-sm font-medium dark:text-white">
                    {contact.name || contact.email}
                  </span>
                  {contact.name && (
                    <span className="text-xs text-gray-500 ml-2">{contact.email}</span>
                  )}
                </div>
                <span className="text-xs">
                  {contact.linkedUser ? (
                    <span className="text-green-600">✓ User</span>
                  ) : contact.inviteStatus === "pending" ? (
                    <span className="text-yellow-600">⏳ Invited</span>
                  ) : (
                    <span className="text-gray-400">External</span>
                  )}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}

      {!showAdd ? (
        <button
          onClick={() => setShowAdd(true)}
          className="text-xs text-blue-600 hover:text-blue-700 cursor-pointer"
        >
          + Add new contact
        </button>
      ) : (
        <div className="border dark:border-gray-600 rounded p-3 space-y-2">
          <input
            type="text"
            placeholder="Name (optional)"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="w-full border dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded px-3 py-1.5 text-sm"
          />
          <input
            type="email"
            placeholder="Email (required)"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            className="w-full border dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded px-3 py-1.5 text-sm"
          />
          <div className="flex gap-2">
            <button
              onClick={createContact}
              disabled={!newEmail.trim() || creating}
              className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 cursor-pointer disabled:opacity-50"
            >
              {creating ? "Adding..." : "Add & Select"}
            </button>
            <button
              onClick={() => setShowAdd(false)}
              className="px-3 py-1 text-xs text-gray-600 dark:text-gray-400 cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
