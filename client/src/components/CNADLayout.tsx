import { useAuth } from "@/_core/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { startLogin } from "@/const";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import {
  Activity,
  Boxes,
  ChevronRight,
  CircleUserRound,
  Command,
  LayoutDashboard,
  Loader2,
  LogOut,
  Menu,
  Plus,
  ServerCog,
  Settings,
  ShieldCheck,
} from "lucide-react";
import { useState } from "react";
import { Link, useLocation } from "wouter";

type CNADLayoutProps = { children: React.ReactNode };

const primaryNavigation = [
  { label: "Overview", href: "/", icon: LayoutDashboard },
  { label: "Environments", href: "/environments", icon: Boxes },
  { label: "Templates", href: "/templates", icon: ServerCog },
  { label: "Activity", href: "/activity", icon: Activity },
];

function initials(name?: string | null) {
  return (name ?? "CN")
    .split(" ")
    .map(part => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function LoginScreen() {
  const utils = trpc.useUtils();
  const loginMode = trpc.auth.loginMode.useQuery();
  const [loginError, setLoginError] = useState<string | null>(null);
  const localLogin = trpc.auth.localLogin.useMutation({
    onSuccess: async result => {
      setLoginError(null);
      utils.auth.me.setData(undefined, result.user);
      await utils.auth.me.invalidate();
      window.location.assign("/");
    },
    onError: error => {
      setLoginError(error.message || "The local session could not be created.");
    },
  });
  const isLocal = loginMode.data?.mode === "local";
  const hostedOAuthConfigured = loginMode.data?.hostedOAuthConfigured ?? false;
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#090b12] p-6 text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_25%,rgba(86,95,255,.16),transparent_32%),radial-gradient(circle_at_80%_80%,rgba(11,212,166,.10),transparent_26%)]" />
      <section className="relative w-full max-w-md rounded-3xl border border-white/10 bg-[#11141f]/90 p-8 shadow-2xl shadow-black/30 backdrop-blur-xl sm:p-10">
        <div className="mb-9 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-400 to-cyan-300 text-[#0b0d15] shadow-lg shadow-indigo-500/25">
          <Command className="h-6 w-6" />
        </div>
        <p className="mb-3 text-sm font-medium text-cyan-200">
          CNAD32 · Cloud-native workspaces
        </p>
        <h1 className="text-3xl font-semibold tracking-[-0.04em]">
          A focused control plane for developer environments.
        </h1>
        <p className="mt-4 text-sm leading-6 text-slate-400">
          {isLocal
            ? "This localhost development instance creates a signed session for the local operator. Hosted deployments continue to use Manus OAuth."
            : hostedOAuthConfigured
              ? "Authenticate with your Manus account to create and operate isolated Kubernetes-backed workspaces."
              : "Hosted Manus OAuth is not configured for this deployment. Run the development server on localhost to use the local development session."}
        </p>
        <Button
          onClick={() => (isLocal ? localLogin.mutate() : startLogin())}
          disabled={
            loginMode.isLoading ||
            localLogin.isPending ||
            (!isLocal && !hostedOAuthConfigured)
          }
          className="mt-9 h-11 w-full bg-white text-slate-950 hover:bg-slate-200"
        >
          {localLogin.isPending
            ? "Starting local session…"
            : isLocal
              ? "Continue on this computer"
              : hostedOAuthConfigured
                ? "Continue with Manus"
                : "Hosted OAuth unavailable"}
          <ChevronRight className="ml-1 h-4 w-4" />
        </Button>
        {loginError ? (
          <p
            role="alert"
            className="mt-4 rounded-xl border border-rose-300/20 bg-rose-300/10 p-3 text-sm leading-5 text-rose-100"
          >
            {loginError}
          </p>
        ) : null}
      </section>
    </main>
  );
}

export default function CNADLayout({ children }: CNADLayoutProps) {
  const { user, loading, logout } = useAuth();
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#090b12] text-slate-300">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  if (!user) return <LoginScreen />;

  const navigation = [
    ...primaryNavigation,
    ...(user.role === "admin"
      ? [{ label: "Platform", href: "/platform", icon: ShieldCheck }]
      : []),
    { label: "Settings", href: "/settings", icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-[#090b12] text-slate-100">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_72%_-10%,rgba(85,94,255,.12),transparent_28%)]" />
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-[264px] flex-col border-r border-white/[0.07] bg-[#0e1019]/95 p-4 backdrop-blur-xl transition-transform lg:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <Link href="/" className="mb-8 flex items-center gap-3 px-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-400 to-cyan-300 text-[#0a0c13] shadow-lg shadow-indigo-500/20">
            <Command className="h-4 w-4" />
          </span>
          <span>
            <span className="block text-sm font-semibold tracking-[0.16em] text-white">
              CNAD32
            </span>
            <span className="block text-[10px] uppercase tracking-[0.18em] text-slate-500">
              Workspace control
            </span>
          </span>
        </Link>
        <Link
          href="/environments/new"
          onClick={() => setMobileOpen(false)}
          className="mb-7"
        >
          <Button className="h-10 w-full bg-indigo-400 text-indigo-950 hover:bg-indigo-300">
            <Plus className="mr-2 h-4 w-4" />
            New environment
          </Button>
        </Link>
        <nav className="space-y-1">
          <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            Workspace
          </p>
          {navigation.map(item => {
            const active =
              item.href === "/"
                ? location === "/"
                : location === item.href ||
                  location.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  "group flex h-10 items-center gap-3 rounded-xl px-3 text-sm transition-colors",
                  active
                    ? "bg-white/[0.09] text-white shadow-sm"
                    : "text-slate-400 hover:bg-white/[0.05] hover:text-slate-100"
                )}
              >
                <item.icon
                  className={cn(
                    "h-4 w-4",
                    active
                      ? "text-cyan-300"
                      : "text-slate-500 group-hover:text-slate-300"
                  )}
                />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto rounded-2xl border border-white/[0.07] bg-white/[0.025] p-3">
          <p className="text-xs font-medium text-slate-300">
            Environment isolation
          </p>
          <p className="mt-1 text-[11px] leading-4 text-slate-500">
            Namespaces, quotas, probes, and audit events are enforced
            server-side.
          </p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="mt-3 flex w-full items-center gap-3 rounded-xl p-2 text-left hover:bg-white/[0.05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300">
              <Avatar className="h-8 w-8 border border-white/10">
                <AvatarFallback className="bg-indigo-400/15 text-xs text-indigo-200">
                  {initials(user.name)}
                </AvatarFallback>
              </Avatar>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs font-medium text-slate-200">
                  {user.name || "Workspace user"}
                </span>
                <span className="block truncate text-[11px] text-slate-500">
                  {user.role}
                </span>
              </span>
              <ChevronRight className="h-3.5 w-3.5 text-slate-600" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-52 border-white/10 bg-[#181b27] text-slate-200"
            align="start"
          >
            <DropdownMenuItem asChild>
              <Link href="/settings">
                <CircleUserRound className="mr-2 h-4 w-4" />
                Profile settings
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-white/10" />
            <DropdownMenuItem
              onClick={() => void logout()}
              className="text-rose-300 focus:text-rose-200"
            >
              <LogOut className="mr-2 h-4 w-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </aside>
      <div className="relative min-h-screen lg:pl-[264px]">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-white/[0.06] bg-[#090b12]/80 px-4 backdrop-blur-xl lg:px-8">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setMobileOpen(true)}
            className="text-slate-300 lg:hidden"
          >
            <Menu className="h-5 w-5" />
          </Button>
          <div className="hidden text-xs text-slate-500 lg:block">
            Kubernetes-backed developer environments
          </div>
          <Link href="/environments/new">
            <Button
              size="sm"
              className="bg-indigo-400 text-indigo-950 hover:bg-indigo-300"
            >
              <Plus className="mr-1.5 h-4 w-4" />
              Create
            </Button>
          </Link>
        </header>
        <main className="mx-auto w-full max-w-[1600px] p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>
      {mobileOpen ? (
        <button
          aria-label="Close navigation"
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 z-30 bg-black/55 lg:hidden"
        />
      ) : null}
    </div>
  );
}
