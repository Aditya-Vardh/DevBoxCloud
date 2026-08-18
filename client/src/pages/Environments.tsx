import CNADLayout from "@/components/CNADLayout";
import { EnvironmentActionMenu, StatusBadge } from "@/components/EnvironmentUI";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc";
import { Boxes, Plus, Search, TerminalSquare } from "lucide-react";
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
const runtimes = ["all", "node", "python", "go", "ubuntu"] as const;

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
        <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300">
              Fleet
            </p>
            <h1 className="text-3xl font-semibold tracking-[-0.045em] text-white">
              Environments
            </h1>
            <p className="mt-2 text-sm text-slate-400">
              Search, inspect, and operate Kubernetes-backed development
              workspaces.
            </p>
          </div>
          <Link href="/environments/new">
            <Button className="bg-indigo-400 text-indigo-950 hover:bg-indigo-300">
              <Plus className="mr-2 h-4 w-4" />
              New environment
            </Button>
          </Link>
        </div>
        <div className="mb-5 flex flex-col gap-3 rounded-2xl border border-white/[0.07] bg-[#11141f] p-3 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3 h-4 w-4 text-slate-600" />
            <Input
              value={search}
              onChange={event => setSearch(event.target.value)}
              placeholder="Search environments"
              className="border-white/10 bg-white/[0.035] pl-9 text-white placeholder:text-slate-600"
            />
          </div>
          <select
            value={status}
            onChange={event => setStatus(event.target.value as typeof status)}
            className="h-10 rounded-lg border border-white/10 bg-[#161a26] px-3 text-sm text-slate-300"
          >
            <option value="all">All states</option>
            {statuses.slice(1).map(value => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
          <select
            value={runtime}
            onChange={event => setRuntime(event.target.value as typeof runtime)}
            className="h-10 rounded-lg border border-white/10 bg-[#161a26] px-3 text-sm text-slate-300"
          >
            <option value="all">All runtimes</option>
            {runtimes.slice(1).map(value => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </div>
        <div className="overflow-hidden rounded-3xl border border-white/[0.07] bg-[#11141f]">
          {environments.isLoading ? (
            <div className="space-y-3 p-5">
              {[1, 2, 3].map(item => (
                <Skeleton key={item} className="h-16 bg-white/[0.05]" />
              ))}
            </div>
          ) : environments.error ? (
            <p className="p-6 text-sm text-rose-200">
              {environments.error.message}
            </p>
          ) : environments.data?.length ? (
            <div className="divide-y divide-white/[0.06]">
              {environments.data.map(({ environment, template }) => (
                <div
                  key={environment.id}
                  className="flex flex-col gap-3 p-4 transition-colors hover:bg-white/[0.025] sm:flex-row sm:items-center"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-300/10 text-indigo-200">
                    <TerminalSquare className="h-4 w-4" />
                  </span>
                  <Link
                    href={`/environments/${environment.id}`}
                    className="min-w-0 flex-1"
                  >
                    <p className="text-sm font-medium text-white">
                      {environment.name}
                    </p>
                    <p className="mt-1 truncate text-xs text-slate-500">
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
            <div className="p-12 text-center">
              <Boxes className="mx-auto h-7 w-7 text-slate-600" />
              <p className="mt-4 text-sm font-medium text-slate-200">
                No matching environments
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Change your filters or create a new workspace.
              </p>
              <Link href="/environments/new">
                <Button
                  size="sm"
                  className="mt-5 bg-indigo-400 text-indigo-950 hover:bg-indigo-300"
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
