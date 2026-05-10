"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

// Catches GitHub App installation redirects (/?installation_id=...&code=...)
// and forwards them to the API install handler
export default function GitHubInstallRedirect() {
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    const installationId = searchParams.get("installation_id");
    const code = searchParams.get("code");
    const setupAction = searchParams.get("setup_action");

    if (installationId && code && setupAction === "install") {
      // Redirect to our API handler to exchange code for token
      window.location.href = `/api/auth/github/install?installation_id=${installationId}&code=${code}&setup_action=${setupAction}`;
    }
  }, [searchParams, router]);

  return null;
}
