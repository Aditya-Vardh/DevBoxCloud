import CNADLayout from "@/components/CNADLayout";
import { useAuth } from "@/_core/hooks/useAuth";
import { MetricTile } from "@/components/EnvironmentUI";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc";
import { ShieldAlert } from "lucide-react";
export default function PlatformPage() {
  const { user } = useAuth();
  const overview = trpc.admin.overview.useQuery(undefined, {
    enabled: user?.role === "admin",
  });
  if (user?.role !== "admin")
    return (
      <CNADLayout>
        <div className="rounded-3xl border border-amber-300/15 bg-amber-300/[0.07] p-6 text-amber-100">
          <ShieldAlert className="mb-3 h-5 w-5" />
          <p className="font-medium">Platform access required</p>
          <p className="mt-2 text-sm">
            This page is only available to CNAD32 administrators.
          </p>
        </div>
      </CNADLayout>
    );
  return (
    <CNADLayout>
      <section>
        <div className="mb-8">
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300">
            Administrator
          </p>
          <h1 className="text-3xl font-semibold tracking-[-0.045em] text-white">
            Platform monitoring
          </h1>
          <p className="mt-2 text-sm text-slate-400">
            Cross-tenant environment status, audit activity, and Kubernetes API
            availability.
          </p>
        </div>
        {overview.isLoading ? (
          <Skeleton className="h-52 bg-white/[0.05]" />
        ) : overview.error ? (
          <p className="rounded-2xl border border-rose-300/15 bg-rose-300/[0.07] p-4 text-sm text-rose-100">
            {overview.error.message}
          </p>
        ) : overview.data ? (
          <>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <MetricTile
                label="All environments"
                value={String(overview.data.summary.total)}
                detail="All tenants"
              />
              <MetricTile
                label="Running"
                value={String(overview.data.summary.running)}
                detail="Observed resource state"
              />
              <MetricTile
                label="Failed"
                value={String(overview.data.summary.failed)}
                detail="Investigate lifecycle events"
              />
              <MetricTile
                label="Kubernetes API"
                value={
                  overview.data.kubernetes.healthy ? "Reachable" : "Unavailable"
                }
                detail={overview.data.kubernetes.message}
              />
            </div>
            <div className="mt-5 rounded-3xl border border-white/[0.07] bg-[#11141f]">
              <div className="border-b border-white/[0.07] p-5">
                <h2 className="text-sm font-semibold text-white">
                  Recent platform audit events
                </h2>
              </div>
              <div className="divide-y divide-white/[0.07]">
                {overview.data.audits.map(entry => (
                  <div key={entry.id} className="p-4">
                    <p className="text-sm text-slate-200">
                      {entry.action.replaceAll(".", " ")}
                    </p>
                    <p className="mt-1 text-xs text-slate-600">
                      {new Date(entry.createdAt).toLocaleString()} ·{" "}
                      {entry.resourceType} {entry.resourceId ?? ""}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </>
        ) : null}
      </section>
    </CNADLayout>
  );
}
