import CNADLayout from "@/components/CNADLayout";
import {
  EnvironmentActionMenu,
  MetricTile,
  StatusBadge,
} from "@/components/EnvironmentUI";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc";
import { runtimeIcons } from "@shared/cnad";
import type { EnvironmentRuntime } from "@shared/cnad";
import {
  Activity,
  ArrowUpRight,
  Boxes,
  CircleAlert,
  CloudCog,
  Plus,
} from "lucide-react";
import { useMemo } from "react";
import { Link } from "wouter";

function relativeDate(value: Date | string) {
  const date = new Date(value);
  const minutes = Math.round((Date.now() - date.getTime()) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (minutes < 1440) return `${Math.round(minutes / 60)}h ago`;
  return date.toLocaleDateString();
}

export default function Home() {
  const listInput = useMemo(() => ({ limit: 6 }), []);
  const dashboard = trpc.environment.dashboard.useQuery();
  const environments = trpc.environment.list.useQuery(listInput);
  const health = trpc.environment.platformHealth.useQuery(undefined, {
    refetchInterval: 30_000,
  });
  const summary = dashboard.data?.summary;

  return (
    <CNADLayout>
      <section className="animate-fade-up mb-9 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-white/25">
            Control plane
          </p>
          <h1 className="text-3xl font-bold tracking-[-0.04em] text-white sm:text-4xl">
            Your workspace fleet.
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-white/40">
            Create isolated development environments, observe their Kubernetes
            health, and retain an auditable operating history.
          </p>
        </div>
        <Link href="/app/environments/new">
          <Button
            id="home-new-env"
            className="h-10 rounded-full bg-white text-sm font-semibold text-black hover:bg-white/90"
          >
            <Plus className="mr-1.5 h-4 w-4" />
            New environment
          </Button>
        </Link>
      </section>

      <div className="animate-fade-up delay-100 mb-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricTile
          label="Total environments"
          value={summary ? String(summary.total) : "—"}
          detail="All lifecycle states"
        />
        <MetricTile
          label="Running"
          value={summary ? String(summary.running) : "—"}
          detail="Kubernetes workloads ready"
        />
        <MetricTile
          label="Stopped"
          value={summary ? String(summary.stopped) : "—"}
          detail="Persistent data retained"
        />
        <MetricTile
          label="Needs attention"
          value={summary ? String(summary.failed) : "—"}
          detail="Failed or blocked operations"
        />
      </div>

      <div className="animate-fade-up delay-200 mb-8 grid gap-5 xl:grid-cols-[1.6fr_.9fr]">
        <section className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 sm:p-6">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-white">
                Recent environments
              </h2>
              <p className="mt-0.5 text-xs text-white/30">
                The latest environments in your account.
              </p>
            </div>
            <Link
              href="/app/environments"
              className="flex items-center gap-1 text-xs text-white/40 hover:text-white transition-colors"
            >
              View all <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          {environments.isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((item) => (
                <Skeleton key={item} className="h-14 w-full bg-white/[0.04]" />
              ))}
            </div>
          ) : environments.error ? (
            <p className="rounded-xl border border-rose-400/15 bg-rose-400/[0.06] p-4 text-sm text-rose-300">
              {environments.error.message}
            </p>
          ) : environments.data?.length ? (
            <div className="space-y-1">
              {environments.data.map(({ environment, template }) => (
                <div
                  key={environment.id}
                  className="flex items-center gap-3 rounded-xl border border-transparent px-3 py-2.5 transition-colors hover:border-white/[0.06] hover:bg-white/[0.03]"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/[0.05] text-base">
                    {runtimeIcons[environment.runtime as EnvironmentRuntime] ?? "🖥"}
                  </span>
                  <Link
                    href={`/environments/${environment.id}`}
                    className="min-w-0 flex-1"
                  >
                    <p className="truncate text-sm font-medium text-white">
                      {environment.name}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-white/30">
                      {template.name} · {environment.cpuLimit} /{" "}
                      {environment.memoryLimit}
                    </p>
                  </Link>
                  <div className="hidden sm:block">
                    <StatusBadge status={environment.status} />
                  </div>
                  <EnvironmentActionMenu
                    environmentId={environment.id}
                    status={environment.status}
                  />
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-white/[0.07] p-10 text-center">
              <Boxes className="mx-auto h-6 w-6 text-white/15" />
              <p className="mt-3 text-sm font-medium text-white/60">
                No environments yet
              </p>
              <p className="mt-1 text-xs text-white/30">
                Create your first Kubernetes-backed workspace to begin.
              </p>
              <Link href="/app/environments/new">
                <Button
                  size="sm"
                  className="mt-5 rounded-full bg-white text-xs font-semibold text-black hover:bg-white/90"
                >
                  Create environment
                </Button>
              </Link>
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 sm:p-6">
          <div className="flex items-center gap-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/[0.05] text-white/50">
              <CloudCog className="h-4 w-4" />
            </span>
            <div>
              <h2 className="text-sm font-semibold text-white">
                Platform connection
              </h2>
              <p className="text-xs text-white/30">Live Kubernetes API check</p>
            </div>
          </div>
          <div className="mt-5 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-white/60">Cluster API</span>
              {health.isLoading ? (
                <span className="text-xs text-white/30">Checking…</span>
              ) : health.data?.healthy ? (
                <span className="text-xs font-medium text-emerald-300">
                  Reachable
                </span>
              ) : (
                <span className="text-xs font-medium text-amber-300">
                  Unavailable
                </span>
              )}
            </div>
            <p className="mt-2 text-xs leading-5 text-white/25">
              {health.data?.message ?? "Checking provider configuration…"}
            </p>
          </div>
          <div className="mt-4 space-y-3">
            {(dashboard.data?.recentActivity ?? []).slice(0, 3).map((activity) => (
              <div key={activity.id} className="flex gap-3 text-xs">
                <Activity className="mt-0.5 h-3.5 w-3.5 shrink-0 text-white/25" />
                <div>
                  <p className="text-white/60">
                    {activity.action.replaceAll(".", " ")}
                  </p>
                  <p className="mt-0.5 text-white/25">
                    {relativeDate(activity.createdAt)}
                  </p>
                </div>
              </div>
            ))}
            {!dashboard.data?.recentActivity.length && !dashboard.isLoading ? (
              <p className="text-xs leading-5 text-white/25">
                Operating activity will appear here after your first environment
                action.
              </p>
            ) : null}
          </div>
        </section>
      </div>

      {summary?.failed ? (
        <div className="animate-fade-up delay-300 flex items-start gap-3 rounded-xl border border-amber-400/15 bg-amber-400/[0.06] p-4 text-sm text-amber-200">
          <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            <span className="font-medium">Attention required.</span> One or more
            environments have reported a failure. Open the environment detail to
            inspect Kubernetes events and lifecycle history.
          </p>
        </div>
      ) : null}
    </CNADLayout>
  );
}
