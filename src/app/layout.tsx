import type { Metadata } from "next";
import {
  ClerkProvider,
  SignInButton,
  SignUpButton,
  UserButton,
  SignedIn,
  SignedOut,
} from "@clerk/nextjs";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Iketrix",
  description: "LLM-powered Eisenhower Matrix",
  manifest: "/manifest.json",
  icons: {
    icon: "/icons/logo-light.png",
    apple: "/icons/logo-light.png",
  },
};

// Inline script to apply theme before paint (prevents flash)
const themeScript = `
(function() {
  try {
    var t = localStorage.getItem('iketrix-theme');
    if (t === 'dark' || (!t || t === 'system') && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      document.documentElement.classList.add('dark');
    }
  } catch(e) {}
})();
`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="antialiased bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 transition-colors">
        <ClerkProvider>
          <header className="flex items-center p-4 gap-4 h-16 border-b border-gray-200 dark:border-gray-700">
            <Link href="/" className="flex items-center gap-2 mr-auto">
              <img
                src="/icons/logo-light.png"
                alt="Iketrix"
                className="w-8 h-8 rounded dark:hidden"
              />
              <img
                src="/icons/logo-dark.png"
                alt="Iketrix"
                className="w-8 h-8 rounded hidden dark:block"
              />
              <span className="font-bold text-lg">Iketrix</span>
            </Link>
            <SignedOut>
              <SignInButton mode="modal">
                <button className="text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white cursor-pointer">
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
              <Link
                href="/settings"
                className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
              >
                ⚙️ Settings
              </Link>
              <UserButton />
            </SignedIn>
          </header>
          {children}
        </ClerkProvider>
      </body>
    </html>
  );
}
