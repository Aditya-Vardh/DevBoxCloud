import CNADLayout from "@/components/CNADLayout";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc";
import { runtimeIcons } from "@shared/cnad";
import type { EnvironmentRuntime } from "@shared/cnad";
import { Cpu, Database, Network, Plus } from "lucide-react";
import { Link } from "wouter";

export default function TemplatesPage() {
  const templates = trpc.environment.templates.useQuery();
  return (
    <CNADLayout>
      <section>
        <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300">
              Curated runtimes
            </p>
            <h1 className="text-3xl font-semibold tracking-[-0.045em] text-white">
              Environment templates
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-400">
              Each template ships with its full toolchain pre-installed. Resource boundaries and allowed ports are enforced server-side.
            </p>
          </div>
          <Link href="/app/environments/new">
            <Button className="bg-indigo-400 text-indigo-950 hover:bg-indigo-300">
              <Plus className="mr-2 h-4 w-4" />
              New environment
            </Button>
          </Link>
        </div>
        {templates.isLoading ? (
          <div className="grid gap-4 md:grid-cols-2">
            {[1, 2, 3, 4, 5, 6].map(item => (
              <Skeleton key={item} className="h-52 bg-white/[0.05]" />
            ))}
          </div>
        ) : templates.error ? (
          <p className="rounded-2xl border border-rose-300/15 bg-rose-300/[0.07] p-4 text-sm text-rose-100">
            {templates.error.message}
          </p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {templates.data?.map(template => {
              const icon = runtimeIcons[template.runtime as EnvironmentRuntime] ?? "🖥";
              const tools = (template.configurationSchema as { tools?: string[] })?.tools ?? [];
              return (
                <article
                  key={template.id}
                  className="rounded-3xl border border-white/[0.07] bg-[#11141f] p-5 shadow-xl shadow-black/10 transition-colors hover:border-white/[0.12]"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/[0.06] text-2xl">
                      {icon}
                    </div>
                    <Link href="/app/environments/new">
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-white/10 bg-white/[0.03] text-xs text-slate-300 hover:bg-white/[0.07]"
                      >
                        Use template
                      </Button>
                    </Link>
                  </div>
                  <h2 className="mt-4 text-lg font-semibold text-white">
                    {template.name}
                  </h2>
                  <p className="mt-2 min-h-10 text-sm leading-6 text-slate-500">
                    {template.description}
                  </p>
                  {tools.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {tools.map(tool => (
                        <span
                          key={tool}
                          className="rounded-md border border-white/[0.07] bg-white/[0.04] px-2 py-0.5 font-mono text-[10px] text-slate-400"
                        >
                          {tool}
                        </span>
                      ))}
                    </div>
                  )}
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
                      <p className="text-slate-500">Port</p>
                      <p className="mt-1 text-slate-200">
                        {template.allowedPorts.join(", ")}
                      </p>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </CNADLayout>
  );
}
