"use client";

import { use } from "react";
import { Dashboard } from "@/components/Dashboard";

export default function ClientAccountDashboard({ params }: PageProps<"/a/[token]">) {
  const { token } = use(params);
  return (
    <Dashboard
      apiPath={`/api/dashboard?account=${encodeURIComponent(token)}`}
      deskKeyStorageKey={`theonexus_desk_key_${token}`}
      accessToken={token}
    />
  );
}
