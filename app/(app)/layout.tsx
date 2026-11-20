import { StateProvider } from "@/lib/client/useAppState";
import { AppShell } from "@/components/AppShell";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <StateProvider>
      <AppShell>{children}</AppShell>
    </StateProvider>
  );
}
