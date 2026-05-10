import { SignedIn, SignedOut } from "@clerk/nextjs";
import { Suspense } from "react";
import MatrixBoard from "@/components/MatrixBoard";
import GitHubInstallRedirect from "@/components/GitHubInstallRedirect";

export default function Home() {
  return (
    <main className="min-h-[calc(100vh-4rem)]">
      <Suspense>
        <GitHubInstallRedirect />
      </Suspense>
      <SignedOut>
        <div className="flex flex-col items-center justify-center min-h-[calc(100vh-4rem)] p-4">
          <h1 className="text-4xl font-bold mb-4 dark:text-white">Iketrix</h1>
          <p className="text-lg text-gray-600 dark:text-gray-400 mb-8 text-center max-w-md">
            LLM-powered Eisenhower Matrix — turn chaos into clarity
          </p>
          <p className="text-gray-500 dark:text-gray-500">Sign in to get started</p>
        </div>
      </SignedOut>
      <SignedIn>
        <MatrixBoard />
      </SignedIn>
    </main>
  );
}
