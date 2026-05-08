import { SignedIn, SignedOut } from "@clerk/nextjs";

export default function Home() {
  return (
    <main className="flex flex-col items-center justify-center min-h-[calc(100vh-4rem)] p-4">
      <h1 className="text-4xl font-bold mb-4">Iketrix</h1>
      <p className="text-lg text-gray-600 mb-8 text-center max-w-md">
        LLM-powered Eisenhower Matrix — turn chaos into clarity
      </p>
      <SignedOut>
        <p className="text-gray-500">Sign in to get started</p>
      </SignedOut>
      <SignedIn>
        <div className="grid grid-cols-2 gap-4 w-full max-w-2xl">
          <div className="border-2 border-red-300 rounded-lg p-4 min-h-[150px]">
            <h2 className="font-semibold text-red-700 mb-2">🔥 Do</h2>
            <p className="text-sm text-gray-500">Important &amp; Urgent</p>
          </div>
          <div className="border-2 border-blue-300 rounded-lg p-4 min-h-[150px]">
            <h2 className="font-semibold text-blue-700 mb-2">📅 Schedule</h2>
            <p className="text-sm text-gray-500">Important &amp; Not Urgent</p>
          </div>
          <div className="border-2 border-yellow-300 rounded-lg p-4 min-h-[150px]">
            <h2 className="font-semibold text-yellow-700 mb-2">👋 Delegate</h2>
            <p className="text-sm text-gray-500">Not Important &amp; Urgent</p>
          </div>
          <div className="border-2 border-gray-300 rounded-lg p-4 min-h-[150px]">
            <h2 className="font-semibold text-gray-700 mb-2">🗑️ Delete</h2>
            <p className="text-sm text-gray-500">Not Important &amp; Not Urgent</p>
          </div>
        </div>
      </SignedIn>
    </main>
  );
}
