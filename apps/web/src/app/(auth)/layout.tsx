import { Megaphone } from "lucide-react";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <div className="flex flex-1 flex-col justify-center py-12 px-4 sm:px-6 lg:flex-none lg:px-20 xl:px-24">
        <div className="mx-auto w-full max-w-sm lg:w-96">
          {children}
        </div>
      </div>
      <div className="relative hidden w-0 flex-1 lg:block bg-muted overflow-hidden">
        <div className="absolute inset-0 bg-primary/10 flex flex-col items-center justify-center p-12">
          <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center mb-8 shadow-xl shadow-primary/20">
            <Megaphone className="w-8 h-8 text-primary-foreground" />
          </div>
          <h2 className="text-4xl font-bold tracking-tight text-foreground text-center mb-4">
            ColdStack
          </h2>
          <p className="text-xl text-muted-foreground text-center max-w-md">
            Cold email infrastructure for modern sales teams. Scale your outreach safely and efficiently.
          </p>
        </div>
      </div>
    </div>
  );
}
