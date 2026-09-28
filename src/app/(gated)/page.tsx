import { auth } from "@/lib/authjs";
import { Dashboard } from "@/components/Dashboard";
import { getOrCreateMemberAccount } from "@/lib/memberAccount";

/**
 * The owner (this app's original builder/trader) keeps seeing their real
 * primary dashboard here, same as before this membership system existed —
 * see it instead at /live, same as every other member. Every other entitled
 * member gets their own auto-provisioned Account (own webhook/dashboard).
 */
export default async function Home() {
  const session = await auth();
  const email = session?.user?.email?.toLowerCase();

  if (email && email === process.env.OWNER_EMAIL?.toLowerCase()) {
    return <Dashboard apiPath="/api/dashboard" deskKeyStorageKey="theonexus_desk_key" />;
  }

  const account = await getOrCreateMemberAccount(session!.user!.id!, session!.user!.name ?? "Member");

  return (
    <Dashboard
      apiPath={`/api/dashboard?account=${encodeURIComponent(account.accessToken)}`}
      deskKeyStorageKey={`theonexus_desk_key_${account.accessToken}`}
      accessToken={account.accessToken}
    />
  );
}
