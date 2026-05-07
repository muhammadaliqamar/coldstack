import { Sidebar } from "@/components/sidebar";
import { Topbar } from "@/components/topbar";
import { AuthGuard } from "@/components/auth-guard";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <div className="flex h-screen overflow-hidden bg-background">
        <Sidebar />
        <div className="flex flex-col flex-1 overflow-hidden">
          <Topbar />
          <main className="flex-1 overflow-y-auto p-6 bg-muted/20">
            {children}
          </main>
        </div>
      </div>
    </AuthGuard>
  );
}
