import CNADLayout from "@/components/CNADLayout";
import {
  EnvironmentActionMenu,
  MetricTile,
  StatusBadge,
} from "@/components/EnvironmentUI";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  CircleAlert,
  Clipboard,
  ExternalLink,
  Loader2,
  RefreshCw,
  TerminalSquare,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Link, useRoute } from "wouter";

function readableBytes(value: number | null) {
  if (value === null) return "—";
  if (value >= 1024 ** 3) return `${(value / 1024 ** 3).toFixed(2)} GiB`;
  if (value >= 1024 ** 2) return `${(value / 1024 ** 2).toFixed(1)} MiB`;
  return `${value} B`;
}
function eventTime(value: Date | string) {
  return new Date(value).toLocaleString();
}

export default function EnvironmentDetailPage() {
  const [, params] = useRoute("/environments/:environmentId");
  const environmentId = Number(params?.environmentId);
  const [poll, setPoll] = useState(true);
  const [logsEnabled, setLogsEnabled] = useState(false);
  const [activeTab, setActiveTab] = useState<"logs" | "events" | "audit">(
    "logs"
  );
  const detail = trpc.environment.detail.useQuery(
    { environmentId },
    {
      enabled: Number.isInteger(environmentId),
      refetchInterval: poll ? 5000 : false,
    }
  );
  const metrics = trpc.environment.metrics.useQuery(
    { environmentId },
    {
      enabled: Boolean(detail.data?.environment.status === "running"),
      refetchInterval:
        detail.data?.environment.status === "running" ? 10_000 : false,
    }
  );
  const logs = trpc.environment.logs.useQuery(
    { environmentId, tailLines: 250 },
    {
      enabled: logsEnabled && detail.data?.environment.status === "running",
      refetchInterval:
        logsEnabled && detail.data?.environment.status === "running"
          ? 5000
          : false,
    }
  );
  const events = trpc.environment.events.useQuery(
    { environmentId },
    { enabled: Boolean(detail.data) }
  );
  const audit = trpc.environment.audit.useQuery(
    { environmentId },
    { enabled: activeTab === "audit" && Boolean(detail.data) }
  );
  const kubernetesEvents = trpc.environment.kubernetesEvents.useQuery(
    { environmentId },
    { enabled: activeTab === "events" && Boolean(detail.data) }
  );

  useEffect(() => {
    const status =
      detail.data?.kubernetes?.status ?? detail.data?.environment.status;
    setPoll(status === "provisioning");
  }, [detail.data?.environment.status, detail.data?.kubernetes?.status]);
  if (!Number.isInteger(environmentId))
    return (
      <CNADLayout>
        <p className="text-sm text-rose-200">Invalid environment identifier.</p>
      </CNADLayout>
    );
  if (detail.isLoading)
    return (
      <CNADLayout>
        <div className="space-y-4">
          <Skeleton className="h-8 w-64 bg-white/[0.05]" />
          <Skeleton className="h-52 bg-white/[0.05]" />
        </div>
      </CNADLayout>
    );
  if (detail.error || !detail.data)
    return (
      <CNADLayout>
        <Link href="/environments" className="text-sm text-cyan-300">
          ← Return to environments
        </Link>
        <div className="mt-6 rounded-3xl border border-rose-300/15 bg-rose-300/[0.07] p-6">
          <p className="font-medium text-rose-100">Environment unavailable</p>
          <p className="mt-2 text-sm text-rose-200">
            {detail.error?.message ?? "This environment could not be loaded."}
          </p>
        </div>
      </CNADLayout>
    );
  const { environment, template, kubernetes } = detail.data;
  const kubernetesError =
    "kubernetesError" in detail.data ? detail.data.kubernetesError : undefined;
  const openUrl = environment.accessUrl ?? kubernetes?.accessUrl;
  const healthLabel = kubernetes?.health.deploymentAvailable
    ? "Ready"
    : environment.status === "provisioning"
      ? "Waiting"
      : "Unavailable";

  return (
    <CNADLayout>
      <section>
        <div className="mb-7">
          <Link
            href="/environments"
            className="mb-4 inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-300"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            All environments
          </Link>
          <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
            <div>
              <div className="mb-3 flex flex-wrap items-center gap-3">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300">
                  {template.name}
                </p>
                <StatusBadge status={environment.status} />
              </div>
              <h1 className="text-3xl font-semibold tracking-[-0.045em] text-white">
                {environment.name}
              </h1>
              <p className="mt-2 text-sm text-slate-400">
                {environment.description ||
                  "No environment description provided."}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {openUrl ? (
                <a href={openUrl} target="_blank" rel="noreferrer">
                  <Button className="bg-indigo-400 text-indigo-950 hover:bg-indigo-300">
                    <ExternalLink className="mr-2 h-4 w-4" />
                    Open environment
                  </Button>
                </a>
              ) : null}
              <EnvironmentActionMenu
                environmentId={environment.id}
                status={environment.status}
                onChange={() => void detail.refetch()}
              />
            </div>
          </div>
        </div>
        {environment.status === "provisioning" ? (
          <div className="mb-5 rounded-2xl border border-amber-300/15 bg-amber-300/[0.07] p-4">
            <div className="flex items-start gap-3">
              <Loader2 className="mt-0.5 h-4 w-4 animate-spin text-amber-200" />
              <div>
                <p className="text-sm font-medium text-amber-100">
                  Kubernetes provisioning in progress
                </p>
                <p className="mt-1 text-xs leading-5 text-amber-200/70">
                  CNAD32 polls the actual deployment and pod readiness state.
                  This page refreshes automatically while the environment is
                  provisioning.
                </p>
              </div>
            </div>
          </div>
        ) : null}
        {kubernetesError ? (
          <div className="mb-5 flex items-start gap-3 rounded-2xl border border-amber-300/15 bg-amber-300/[0.07] p-4 text-sm text-amber-100">
            <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
            <p>
              <span className="font-medium">
                Kubernetes status is unavailable.
              </span>{" "}
              {kubernetesError}
            </p>
          </div>
        ) : null}
        {environment.failureReason ? (
          <div className="mb-5 flex items-start gap-3 rounded-2xl border border-rose-300/15 bg-rose-300/[0.07] p-4 text-sm text-rose-100">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <p>
              <span className="font-medium">Last operation failed.</span>{" "}
              {environment.failureReason}
            </p>
          </div>
        ) : null}
        <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MetricTile
            label="Deployment health"
            value={healthLabel}
            detail={
              kubernetes
                ? `${kubernetes.health.readyReplicas}/${kubernetes.health.desiredReplicas} replicas ready`
                : "Provider unavailable"
            }
          />
          <MetricTile
            label="Pod phase"
            value={kubernetes?.health.podPhase ?? "—"}
            detail={kubernetes?.podName ?? "No pod observed"}
          />
          <MetricTile
            label="CPU usage"
            value={
              metrics.data?.source === "metrics-api"
                ? `${metrics.data.cpuMilliCores ?? 0}m`
                : "Unavailable"
            }
            detail={
              metrics.data?.source === "metrics-api"
                ? "Kubernetes Metrics API"
                : "Metrics server is not available"
            }
          />
          <MetricTile
            label="Memory usage"
            value={
              metrics.data?.source === "metrics-api"
                ? readableBytes(metrics.data.memoryBytes)
                : "Unavailable"
            }
            detail={
              metrics.data?.collectedAt
                ? `Collected ${eventTime(metrics.data.collectedAt)}`
                : "No live sample"
            }
          />
        </div>
        <div className="grid gap-5 xl:grid-cols-[1.25fr_.75fr]">
          <section className="overflow-hidden rounded-3xl border border-white/[0.07] bg-[#11141f]">
            <div className="flex items-center justify-between border-b border-white/[0.07] px-5 py-4">
              <div>
                <h2 className="text-sm font-semibold text-white">
                  Observability
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  Logs and events come directly from Kubernetes. Audit entries
                  are persisted by CNAD32.
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  if (activeTab === "logs") void logs.refetch();
                  if (activeTab === "events") void kubernetesEvents.refetch();
                  if (activeTab === "audit") void audit.refetch();
                }}
                className="text-slate-400 hover:bg-white/[0.06] hover:text-white"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex gap-1 border-b border-white/[0.07] px-4 pt-3">
              {(["logs", "events", "audit"] as const).map(tab => (
                <button
                  type="button"
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`rounded-t-lg px-3 py-2 text-xs font-medium capitalize ${activeTab === tab ? "bg-white/[0.07] text-white" : "text-slate-500 hover:text-slate-300"}`}
                >
                  {tab}
                </button>
              ))}
            </div>
            <div className="min-h-[330px] p-5">
              {activeTab === "logs" ? (
                <div>
                  <div className="mb-3 flex items-center justify-between">
                    <p className="text-xs text-slate-500">
                      {logsEnabled
                        ? logs.data?.source === "kubernetes"
                          ? "Refreshing every 5 seconds while running"
                          : (logs.data?.message ?? "Waiting for pod logs")
                        : "Log retrieval is paused"}
                    </p>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setLogsEnabled(current => !current)}
                      disabled={environment.status !== "running"}
                      className="border-white/10 text-xs text-slate-300 hover:bg-white/[0.06] hover:text-white"
                    >
                      {logsEnabled ? "Pause" : "Load logs"}
                    </Button>
                  </div>
                  {logs.error ? (
                    <p className="rounded-xl border border-rose-300/15 bg-rose-300/[0.07] p-3 text-xs text-rose-100">
                      {logs.error.message}
                    </p>
                  ) : (
                    <pre className="max-h-[330px] overflow-auto rounded-2xl bg-[#090b12] p-4 font-mono text-[11px] leading-5 text-slate-300">
                      {logs.isFetching ? "Loading live pod logs…\n" : ""}
                      {logs.data?.lines.join("\n") ||
                        "No log lines are available yet."}
                    </pre>
                  )}
                </div>
              ) : null}
              {activeTab === "events" ? (
                <div className="space-y-3">
                  {kubernetesEvents.isLoading ? (
                    <Skeleton className="h-20 bg-white/[0.05]" />
                  ) : kubernetesEvents.error ? (
                    <p className="rounded-xl border border-amber-300/15 bg-amber-300/[0.07] p-3 text-xs text-amber-100">
                      {kubernetesEvents.error.message}
                    </p>
                  ) : kubernetesEvents.data?.length ? (
                    kubernetesEvents.data.map((event, index) => (
                      <div
                        key={`${event.createdAt}-${index}`}
                        className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-3"
                      >
                        <p className="text-xs font-medium text-slate-200">
                          {event.reason}{" "}
                          <span className="ml-2 text-slate-600">
                            {event.type}
                          </span>
                        </p>
                        <p className="mt-1 text-xs leading-5 text-slate-500">
                          {event.message}
                        </p>
                        <p className="mt-2 text-[10px] text-slate-600">
                          {eventTime(event.createdAt)}
                        </p>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-slate-500">
                      No Kubernetes events are available for this namespace.
                    </p>
                  )}
                </div>
              ) : null}
              {activeTab === "audit" ? (
                <div className="space-y-3">
                  {audit.isLoading ? (
                    <Skeleton className="h-20 bg-white/[0.05]" />
                  ) : audit.data?.length ? (
                    audit.data.map(entry => (
                      <div
                        key={entry.id}
                        className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-3"
                      >
                        <p className="text-xs font-medium text-slate-200">
                          {entry.action.replaceAll(".", " ")}
                        </p>
                        <p className="mt-1 text-[11px] text-slate-600">
                          {eventTime(entry.createdAt)}
                        </p>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-slate-500">
                      No audited actions have been recorded for this
                      environment.
                    </p>
                  )}
                </div>
              ) : null}
            </div>
          </section>
          <aside className="space-y-5">
            <section className="rounded-3xl border border-white/[0.07] bg-[#11141f] p-5">
              <h2 className="text-sm font-semibold text-white">
                Configuration
              </h2>
              <div className="mt-4 space-y-3">
                {[
                  ["Runtime", environment.runtime],
                  ["CPU limit", environment.cpuLimit],
                  ["Memory limit", environment.memoryLimit],
                  ["Storage", environment.storageLimit],
                  ["Port", String(environment.port)],
                  ["Namespace", environment.namespace],
                  ["Service", environment.serviceName],
                ].map(([label, value]) => (
                  <div
                    key={label}
                    className="flex items-start justify-between gap-4 text-xs"
                  >
                    <span className="text-slate-500">{label}</span>
                    <span className="break-all text-right font-medium text-slate-200">
                      {value}
                    </span>
                  </div>
                ))}
              </div>
            </section>
            <section className="rounded-3xl border border-white/[0.07] bg-[#11141f] p-5">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-white">
                  Lifecycle history
                </h2>
                <CheckCircle2 className="h-4 w-4 text-cyan-300" />
              </div>
              <div className="mt-4 space-y-4">
                {events.isLoading ? (
                  <Skeleton className="h-24 bg-white/[0.05]" />
                ) : events.data?.length ? (
                  events.data.slice(0, 6).map(event => (
                    <div
                      key={event.id}
                      className="relative pl-4 before:absolute before:left-0 before:top-1.5 before:h-2 before:w-2 before:rounded-full before:bg-cyan-300"
                    >
                      <p className="text-xs font-medium text-slate-200">
                        {event.message}
                      </p>
                      <p className="mt-1 text-[10px] text-slate-600">
                        {eventTime(event.createdAt)}
                      </p>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-slate-500">
                    No lifecycle events are available.
                  </p>
                )}
              </div>
            </section>
            {environment.repositoryUrl ? (
              <section className="rounded-3xl border border-white/[0.07] bg-[#11141f] p-5">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-white">Source</h2>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      navigator.clipboard.writeText(
                        environment.repositoryUrl ?? ""
                      );
                      toast.success("Repository URL copied.");
                    }}
                    className="h-7 w-7 text-slate-500"
                  >
                    <Clipboard className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <p className="mt-3 break-all text-xs leading-5 text-slate-400">
                  {environment.repositoryUrl}
                </p>
                <p className="mt-2 text-[11px] text-slate-600">
                  Branch: {environment.branch}
                </p>
              </section>
            ) : null}
          </aside>
        </div>
      </section>
    </CNADLayout>
  );
}
