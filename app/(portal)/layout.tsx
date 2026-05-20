import { AppShell } from "@/components/app-shell";
import { requireSession } from "@/lib/auth/guards";
import { getNavigationForRole } from "@/lib/navigation";

export default async function PortalLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await requireSession();
  const navigation = getNavigationForRole(session.user.role);

  return (
    <AppShell navigation={navigation} session={session}>
      {children}
    </AppShell>
  );
}
