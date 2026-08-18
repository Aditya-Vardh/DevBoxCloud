import CNADLayout from "@/components/CNADLayout";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc";
import { Cpu, Database, Network, Server } from "lucide-react";

export default function TemplatesPage() {
  const templates = trpc.environment.templates.useQuery();
  return (
    <CNADLayout>
      <section>
        <div className="mb-8">
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300">
            Curated runtimes
          </p>
          <h1 className="text-3xl font-semibold tracking-[-0.045em] text-white">
            Environment templates
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-400">
            Templates are active, versioned platform defaults. Their resource
            boundaries and allowed ports are enforced by the API and Kubernetes.
          </p>
        </div>
        {templates.isLoading ? (
          <div className="grid gap-4 md:grid-cols-2">
            {[1, 2, 3, 4].map(item => (
              <Skeleton key={item} className="h-52 bg-white/[0.05]" />
            ))}
          </div>
        ) : templates.error ? (
          <p className="rounded-2xl border border-rose-300/15 bg-rose-300/[0.07] p-4 text-sm text-rose-100">
            {templates.error.message}
          </p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {templates.data?.map(template => (
              <article
                key={template.id}
                className="rounded-3xl border border-white/[0.07] bg-[#11141f] p-5 shadow-xl shadow-black/10"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-300/10 text-indigo-200">
                  <Server className="h-4 w-4" />
                </div>
                <h2 className="mt-5 text-lg font-semibold text-white">
                  {template.name}
                </h2>
                <p className="mt-2 min-h-10 text-sm leading-6 text-slate-500">
                  {template.description}
                </p>
                <div className="mt-5 grid grid-cols-3 gap-2 border-t border-white/[0.07] pt-4 text-[11px]">
                  <div>
                    <Cpu className="mb-1 h-3.5 w-3.5 text-slate-500" />
                    <p className="text-slate-500">CPU</p>
                    <p className="mt-1 text-slate-200">
                      {template.defaultCpu}–{template.maxCpu}
                    </p>
                  </div>
                  <div>
                    <Database className="mb-1 h-3.5 w-3.5 text-slate-500" />
                    <p className="text-slate-500">Storage</p>
                    <p className="mt-1 text-slate-200">
                      {template.defaultStorage}–{template.maxStorage}
                    </p>
                  </div>
                  <div>
                    <Network className="mb-1 h-3.5 w-3.5 text-slate-500" />
                    <p className="text-slate-500">Ports</p>
                    <p className="mt-1 text-slate-200">
                      {template.allowedPorts.join(", ")}
                    </p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </CNADLayout>
  );
}
