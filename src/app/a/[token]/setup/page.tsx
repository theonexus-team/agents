"use client";

import { use } from "react";
import { AccountSetup } from "@/components/AccountSetup";

export default function ClientAccountSetup({ params }: PageProps<"/a/[token]/setup">) {
  const { token } = use(params);
  return <AccountSetup token={token} />;
}
