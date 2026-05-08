import { SignedIn, SignedOut } from "@clerk/nextjs";
import MatrixBoard from "@/components/MatrixBoard";

export default function Home() {
  return (
    <main className="min-h-[calc(100vh-4rem)]">
      <SignedOut>
        <div className="flex flex-col items-center justify-center min-h-[calc(100vh-4rem)] p-4">
          <h1 className="text-4xl font-bold mb-4">Iketrix</h1>
          <p className="text-lg text-gray-600 mb-8 text-center max-w-md">
            LLM-powered Eisenhower Matrix — turn chaos into clarity
          </p>
          <p className="text-gray-500">Sign in to get started</p>
        </div>
      </SignedOut>
      <SignedIn>
        <MatrixBoard />
      </SignedIn>
    </main>
  );
}
