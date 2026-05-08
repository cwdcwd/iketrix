import type { Metadata } from "next";
import {
  ClerkProvider,
  SignInButton,
  SignUpButton,
  UserButton,
  SignedIn,
  SignedOut,
} from "@clerk/nextjs";
import "./globals.css";

export const metadata: Metadata = {
  title: "Iketrix",
  description: "LLM-powered Eisenhower Matrix",
  manifest: "/manifest.json",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased">
        <ClerkProvider>
          <header className="flex justify-end items-center p-4 gap-4 h-16 border-b border-gray-200">
            <SignedOut>
              <SignInButton mode="modal">
                <button className="text-sm font-medium text-gray-700 hover:text-gray-900 cursor-pointer">
                  Sign In
                </button>
              </SignInButton>
              <SignUpButton mode="modal">
                <button className="bg-blue-600 hover:bg-blue-700 text-white rounded-full font-medium text-sm h-10 px-5 cursor-pointer">
                  Sign Up
                </button>
              </SignUpButton>
            </SignedOut>
            <SignedIn>
              <UserButton />
            </SignedIn>
          </header>
          {children}
        </ClerkProvider>
      </body>
    </html>
  );
}
