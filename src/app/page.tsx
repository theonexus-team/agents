import { Dashboard } from "@/components/Dashboard";

export default function Home() {
  return <Dashboard apiPath="/api/dashboard" deskKeyStorageKey="theonexus_desk_key" />;
}
