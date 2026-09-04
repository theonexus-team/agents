"use client";

import { useParams } from "next/navigation";
import { Dashboard } from "@/components/Dashboard";

export default function AccountPage() {
  const params = useParams<{ token: string }>();
  return <Dashboard accountToken={params.token} />;
}
