import CNADLayout from "@/components/CNADLayout";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc";
import { Activity } from "lucide-react";
function time(value: Date | string) {
  return new Date(value).toLocaleString();
}
export default function ActivityPage() {
  const dashboard = trpc.environment.dashboard.useQuery();
  return (
    <CNADLayout>
      <section>
        <div className="mb-8">
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300">
            Audit trail
          </p>
          <h1 className="text-3xl font-semibold tracking-[-0.045em] text-white">
            Account activity
          </h1>
          <p className="mt-2 text-sm text-slate-400">
            Authentication and environment operations are recorded in the
            persisted audit log.
          </p>
        </div>
        <div className="rounded-3xl border border-white/[0.07] bg-[#11141f]">
          {dashboard.isLoading ? (
            <div className="space-y-3 p-5">
              {[1, 2, 3].map(item => (
                <Skeleton key={item} className="h-14 bg-white/[0.05]" />
              ))}
            </div>
          ) : dashboard.data?.recentActivity.length ? (
            <div className="divide-y divide-white/[0.07]">
              {dashboard.data.recentActivity.map(entry => (
                <div key={entry.id} className="flex gap-4 p-5">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-cyan-300/10 text-cyan-200">
                    <Activity className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="text-sm font-medium text-slate-200">
                      {entry.action.replaceAll(".", " ")}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {time(entry.createdAt)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-12 text-center">
              <Activity className="mx-auto h-6 w-6 text-slate-600" />
              <p className="mt-4 text-sm text-slate-300">
                No activity recorded yet
              </p>
            </div>
          )}
        </div>
      </section>
    </CNADLayout>
  );
}
