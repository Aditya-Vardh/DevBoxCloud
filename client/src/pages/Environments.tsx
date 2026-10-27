import CNADLayout from "@/components/CNADLayout";
import { EnvironmentActionMenu, StatusBadge } from "@/components/EnvironmentUI";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc";
import { runtimeLabels, runtimeIcons } from "@shared/cnad";
import type { EnvironmentRuntime } from "@shared/cnad";
import { Boxes, Plus, Search } from "lucide-react";
import { useDeferredValue, useMemo, useState } from "react";
import { Link } from "wouter";

const statuses = [
  "all",
  "provisioning",
  "running",
  "stopped",
  "failed",
  "deleted",
] as const;
const runtimes = ["all", "ubuntu", "python", "nodejs", "java", "react", "fullstack", "node", "go"] as const;

export default function EnvironmentsPage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<(typeof statuses)[number]>("all");
  const [runtime, setRuntime] = useState<(typeof runtimes)[number]>("all");
  const deferredSearch = useDeferredValue(search);
  const input = useMemo(
    () => ({
      limit: 100,
      ...(deferredSearch ? { query: deferredSearch } : {}),
      ...(status !== "all" ? { status } : {}),
      ...(runtime !== "all" ? { runtime } : {}),
    }),
    [deferredSearch, runtime, status]
  );
  const environments = trpc.environment.list.useQuery(input);

  return (
    <CNADLayout>
      <section>
        <div className="animate-fade-up mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-white/25">
              Fleet
            </p>
            <h1 className="text-3xl font-bold tracking-[-0.04em] text-white">
              Environments
            </h1>
            <p className="mt-2 text-sm text-white/40">
              Search, inspect, and operate Kubernetes-backed development
              workspaces.
            </p>
          </div>
          <Link href="/app/environments/new">
            <Button
              id="environments-new"
              className="rounded-full bg-white text-sm font-semibold text-black hover:bg-white/90"
            >
              <Plus className="mr-1.5 h-4 w-4" />
              New environment
            </Button>
          </Link>
        </div>

        <div className="animate-fade-up delay-100 mb-5 flex flex-col gap-2.5 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/25" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search environments…"
              className="h-10 rounded-xl border-white/[0.07] bg-white/[0.03] pl-10 text-white placeholder:text-white/20 focus:border-white/15 focus:bg-white/[0.04]"
              aria-label="Search environments"
            />
          </div>
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value as typeof status)}
            className="h-10 rounded-xl border border-white/[0.07] bg-[#0a0a0a] px-3 text-sm text-white/60 outline-none transition-colors hover:border-white/15 focus:border-white/15"
            aria-label="Filter by status"
          >
            <option value="all">All states</option>
            {statuses.slice(1).map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
          <select
            value={runtime}
            onChange={(event) => setRuntime(event.target.value as typeof runtime)}
            className="h-10 rounded-xl border border-white/[0.07] bg-[#0a0a0a] px-3 text-sm text-white/60 outline-none transition-colors hover:border-white/15 focus:border-white/15"
            aria-label="Filter by runtime"
          >
            <option value="all">All runtimes</option>
            {runtimes.slice(1).map((value) => (
              <option key={value} value={value}>
                {runtimeLabels[value as EnvironmentRuntime] ?? value}
              </option>
            ))}
          </select>
        </div>

        <div className="animate-fade-up delay-150 overflow-hidden rounded-2xl border border-white/[0.06]">
          {environments.isLoading ? (
            <div className="space-y-px p-1">
              {[1, 2, 3].map((item) => (
                <Skeleton key={item} className="h-16 bg-white/[0.03]" />
              ))}
            </div>
          ) : environments.error ? (
            <p className="p-6 text-sm text-rose-300">
              {environments.error.message}
            </p>
          ) : environments.data?.length ? (
            <div className="divide-y divide-white/[0.04]">
              {environments.data.map(({ environment, template }) => (
                <div
                  key={environment.id}
                  className="flex flex-col gap-3 px-4 py-3.5 transition-colors hover:bg-white/[0.025] sm:flex-row sm:items-center"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/[0.04] text-base">
                    {runtimeIcons[environment.runtime as EnvironmentRuntime] ?? "🖥"}
                  </span>
                  <Link
                    href={`/app/environments/${environment.id}`}
                    className="min-w-0 flex-1"
                  >
                    <p className="text-sm font-medium text-white">
                      {environment.name}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-white/30">
                      {template.name} · {environment.cpuLimit} CPU ·{" "}
                      {environment.memoryLimit} memory ·{" "}
                      {environment.storageLimit} storage
                    </p>
                  </Link>
                  <div className="flex items-center justify-between gap-3 sm:justify-end">
                    <StatusBadge status={environment.status} />
                    <EnvironmentActionMenu
                      environmentId={environment.id}
                      status={environment.status}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-14 text-center">
              <Boxes className="mx-auto h-7 w-7 text-white/10" />
              <p className="mt-4 text-sm font-medium text-white/50">
                No matching environments
              </p>
              <p className="mt-1 text-xs text-white/25">
                Change your filters or create a new workspace.
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
        </div>
      </section>
    </CNADLayout>
  );
}
