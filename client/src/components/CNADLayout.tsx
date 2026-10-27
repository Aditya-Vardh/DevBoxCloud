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
  ArrowRight,
  Boxes,
  ChevronRight,
  CircleUserRound,
  LayoutDashboard,
  Loader2,
  LogOut,
  Menu,
  Plus,
  ServerCog,
  Settings,
  ShieldCheck,
  X,
} from "lucide-react";
import { useState } from "react";
import { Link, useLocation } from "wouter";

type CNADLayoutProps = { children: React.ReactNode };

const primaryNavigation = [
  { label: "Overview", href: "/app", icon: LayoutDashboard },
  { label: "Environments", href: "/app/environments", icon: Boxes },
  { label: "Templates", href: "/app/templates", icon: ServerCog },
  { label: "Activity", href: "/app/activity", icon: Activity },
];

function initials(name?: string | null) {
  return (name ?? "DV")
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function DevBoxMark({ size = 28 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
    >
      <rect width="32" height="32" rx="7" fill="white" />
      <rect x="7" y="7" width="8" height="8" rx="1.5" fill="#050505" />
      <rect x="17" y="7" width="8" height="8" rx="1.5" fill="#050505" />
      <rect x="7" y="17" width="8" height="8" rx="1.5" fill="#050505" opacity="0.4" />
      <rect x="17" y="17" width="8" height="8" rx="1.5" fill="#050505" />
    </svg>
  );
}

export function LoginScreen() {
  const utils = trpc.useUtils();
  const loginMode = trpc.auth.loginMode.useQuery();
  const [loginError, setLoginError] = useState<string | null>(null);
  const localLogin = trpc.auth.localLogin.useMutation({
    onSuccess: async (result) => {
      setLoginError(null);
      utils.auth.me.setData(undefined, result.user);
      await utils.auth.me.invalidate();
      window.location.assign("/app");
    },
    onError: (error) => {
      setLoginError(error.message || "The local session could not be created.");
    },
  });
  const isLocal = loginMode.data?.mode === "local";
  const hostedOAuthConfigured = loginMode.data?.hostedOAuthConfigured ?? false;
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#050505] p-6 text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_30%_20%,rgba(255,255,255,0.03),transparent_50%)]" />
      <section className="animate-scale-in relative w-full max-w-md rounded-2xl border border-white/[0.08] bg-[#0d0d0d] p-8 sm:p-10">
        <div className="mb-6 flex items-center justify-between">
          <DevBoxMark size={32} />
          <Link href="/" className="text-xs text-white/30 hover:text-white/60 transition-colors">
            ← Back
          </Link>
        </div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-white/30">
          DevBox Cloud
        </p>
        <h1 className="text-2xl font-bold tracking-[-0.03em] text-white">
          Sign in to your account
        </h1>
        <p className="mt-3 text-sm leading-6 text-white/40">
          {isLocal
            ? "Development mode: create a local operator session."
            : hostedOAuthConfigured
              ? "Sign in with your account to access your workspaces."
              : "Configure OAuth or run locally to authenticate."}
        </p>
        <Button
          onClick={() => (isLocal ? localLogin.mutate() : startLogin())}
          disabled={
            loginMode.isLoading ||
            localLogin.isPending ||
            (!isLocal && !hostedOAuthConfigured)
          }
          id="login-submit"
          className="mt-8 h-11 w-full rounded-full bg-white text-sm font-semibold text-black hover:bg-white/90"
        >
          {localLogin.isPending
            ? "Starting local session…"
            : isLocal
              ? "Continue as local operator"
              : hostedOAuthConfigured
                ? "Continue with OAuth"
                : "OAuth not configured"}
          <ChevronRight className="ml-1 h-4 w-4" />
        </Button>
        {loginError ? (
          <p
            role="alert"
            className="mt-4 rounded-xl border border-rose-300/15 bg-rose-300/[0.07] p-3 text-sm leading-5 text-rose-200"
          >
            {loginError}
          </p>
        ) : null}
        <p className="mt-6 text-center text-xs text-white/25">
          New to DevBox?{" "}
          <Link href="/" className="text-white/50 hover:text-white transition-colors">
            Learn more
          </Link>
        </p>
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
      <div className="flex min-h-screen items-center justify-center bg-[#050505] text-white/40">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  if (!user) return <LoginScreen />;

  const navigation = [
    ...primaryNavigation,
    ...(user.role === "admin"
      ? [{ label: "Platform", href: "/app/platform", icon: ShieldCheck }]
      : []),
    { label: "Settings", href: "/app/settings", icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-[#050505] text-white">
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-[248px] flex-col border-r border-white/[0.06] bg-[#050505] p-5 transition-transform duration-300 lg:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <Link href="/app" className="mb-8 flex items-center gap-2.5 px-1">
          <DevBoxMark size={26} />
          <span>
            <span className="block text-sm font-bold tracking-tight text-white">
              DevBox Cloud
            </span>
            <span className="block text-[10px] uppercase tracking-[0.18em] text-white/25">
              Workspace control
            </span>
          </span>
        </Link>

        <Link
          href="/app/environments/new"
          onClick={() => setMobileOpen(false)}
          className="mb-6"
        >
          <Button
            id="sidebar-new-env"
            className="h-9 w-full rounded-full bg-white text-sm font-semibold text-black hover:bg-white/90"
          >
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            New workspace
          </Button>
        </Link>

        <nav className="space-y-0.5" aria-label="Application navigation">
          <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/25">
            Workspace
          </p>
          {navigation.map((item) => {
            const active =
              item.href === "/app"
                ? location === "/app"
                : location === item.href ||
                  location.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "group flex h-9 items-center gap-3 rounded-lg px-3 text-sm transition-colors",
                  active
                    ? "bg-white/[0.07] text-white"
                    : "text-white/40 hover:bg-white/[0.04] hover:text-white/80"
                )}
              >
                <item.icon
                  className={cn(
                    "h-4 w-4 shrink-0 transition-colors",
                    active
                      ? "text-white"
                      : "text-white/30 group-hover:text-white/60"
                  )}
                />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto">
          <div className="mb-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3.5">
            <p className="text-xs font-medium text-white/50">
              Environment isolation
            </p>
            <p className="mt-1 text-[11px] leading-4 text-white/25">
              Namespaces, quotas, probes, and audit events are enforced
              server-side.
            </p>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="flex w-full items-center gap-2.5 rounded-xl p-2.5 text-left transition-colors hover:bg-white/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20"
                aria-label="User menu"
              >
                <Avatar className="h-7 w-7 border border-white/10">
                  <AvatarFallback className="bg-white/10 text-xs font-semibold text-white">
                    {initials(user.name)}
                  </AvatarFallback>
                </Avatar>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-medium text-white/80">
                    {user.name || "Workspace user"}
                  </span>
                  <span className="block truncate text-[10px] text-white/30">
                    {user.role}
                  </span>
                </span>
                <ChevronRight className="h-3.5 w-3.5 text-white/25" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              className="w-52 border-white/10 bg-[#111111] text-white/80"
              align="start"
            >
              <DropdownMenuItem asChild>
                <Link href="/settings">
                  <CircleUserRound className="mr-2 h-4 w-4" />
                  Profile settings
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-white/[0.07]" />
              <DropdownMenuItem
                onClick={() => void logout()}
                className="text-rose-300 focus:text-rose-200"
              >
                <LogOut className="mr-2 h-4 w-4" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>

      <div className="relative min-h-screen lg:pl-[248px]">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-white/[0.05] bg-[#050505]/90 px-4 backdrop-blur-xl lg:px-8">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setMobileOpen(true)}
            className="text-white/40 hover:text-white lg:hidden"
            aria-label="Open navigation"
          >
            <Menu className="h-5 w-5" />
          </Button>
          <div className="hidden text-xs text-white/20 lg:block">
            Kubernetes-backed developer environments
          </div>
          <Link href="/app/environments/new">
            <Button
              size="sm"
              id="header-create"
              className="rounded-full bg-white text-xs font-semibold text-black hover:bg-white/90"
            >
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Create
            </Button>
          </Link>
        </header>
        <main className="mx-auto w-full max-w-[1600px] p-5 sm:p-7 lg:p-9">
          {children}
        </main>
      </div>

      {mobileOpen ? (
        <>
          <button
            aria-label="Close navigation"
            onClick={() => setMobileOpen(false)}
            className="fixed inset-0 z-30 bg-black/70 lg:hidden"
          />
          <button
            aria-label="Close navigation"
            onClick={() => setMobileOpen(false)}
            className="fixed right-4 top-4 z-50 flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-[#111111] text-white/60 hover:text-white lg:hidden"
          >
            <X className="h-4 w-4" />
          </button>
        </>
      ) : null}
    </div>
  );
}
