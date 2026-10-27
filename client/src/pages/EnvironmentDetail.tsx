import CNADLayout from "@/components/CNADLayout";
import {
  EnvironmentActionMenu,
  MetricTile,
  StatusBadge,
} from "@/components/EnvironmentUI";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc";
import type { EnvironmentRuntime } from "@shared/cnad";
import { runtimeIcons, runtimeLabels, templateQuickStart } from "@shared/cnad";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  CircleAlert,
  Clipboard,
  Clock,
  ExternalLink,
  Link2,
  Loader2,
  Monitor,
  RefreshCw,
  Share2,
  Terminal,
  UserMinus,
  Users,
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

function SharePanel({ environmentId }: { environmentId: number }) {
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const invites = trpc.invite.list.useQuery({ environmentId });
  const members = trpc.invite.members.useQuery({ environmentId });
  const createInvite = trpc.invite.create.useMutation({
    onSuccess: async (result) => {
      await invites.refetch();
      const url = `${window.location.origin}/invite/${result.code}`;
      navigator.clipboard.writeText(url).catch(() => undefined);
      setCopiedCode(result.code);
      toast.success("Invite link copied to clipboard.");
      setTimeout(() => setCopiedCode(null), 4000);
    },
    onError: (err) => toast.error(err.message),
  });
  const revokeInvite = trpc.invite.revoke.useMutation({
    onSuccess: async () => {
      await invites.refetch();
      toast.success("Invitation revoked.");
    },
    onError: (err) => toast.error(err.message),
  });

  return (
    <section className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
      <div className="mb-4 flex items-center gap-2">
        <Share2 className="h-4 w-4 text-white/40" />
        <h2 className="text-sm font-semibold text-white">Share workspace</h2>
      </div>
      <Button
        size="sm"
        disabled={createInvite.isPending}
        onClick={() =>
          createInvite.mutate({ environmentId, expiresInHours: 72 })
        }
        className="mb-4 w-full rounded-full bg-white text-xs font-semibold text-black hover:bg-white/90"
        id="share-create-invite"
      >
        {createInvite.isPending ? (
          <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
        ) : (
          <Link2 className="mr-1.5 h-3.5 w-3.5" />
        )}
        Create invite link (72h)
      </Button>
      {invites.data?.length ? (
        <div className="mb-4">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/25">
            Active invites
          </p>
          <div className="space-y-2">
            {invites.data.filter((i) => i.revoked === "false").map((inv) => {
              const url = `${window.location.origin}/invite/${inv.code}`;
              const expired =
                inv.expiresAt && new Date(inv.expiresAt) < new Date();
              return (
                <div
                  key={inv.id}
                  className="flex items-center gap-2 rounded-xl border border-white/[0.05] bg-white/[0.02] p-2.5 text-xs"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-mono text-white/60">
                      {inv.code}
                    </p>
                    <p className="mt-0.5 text-white/30">
                      {inv.useCount} use{inv.useCount !== 1 ? "s" : ""}
                      {inv.expiresAt
                        ? ` · expires ${new Date(inv.expiresAt).toLocaleDateString()}`
                        : " · no expiry"}
                      {expired ? " · EXPIRED" : ""}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(url).catch(() => undefined);
                      setCopiedCode(inv.code);
                      toast.success("Copied!");
                      setTimeout(() => setCopiedCode(null), 2000);
                    }}
                    className="shrink-0 rounded-lg p-1.5 text-white/30 hover:bg-white/[0.06] hover:text-white transition-colors"
                    title="Copy link"
                    aria-label="Copy invite link"
                  >
                    {copiedCode === inv.code ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                    ) : (
                      <Clipboard className="h-3.5 w-3.5" />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      revokeInvite.mutate({ invitationId: inv.id })
                    }
                    className="shrink-0 rounded-lg p-1.5 text-white/25 hover:bg-white/[0.06] hover:text-rose-300 transition-colors"
                    title="Revoke"
                    aria-label="Revoke invite"
                  >
                    <UserMinus className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
      {members.data?.length ? (
        <div>
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/25">
            Members with access
          </p>
          <div className="space-y-1.5">
            {members.data.map((m) => (
              <div
                key={m.userId}
                className="flex items-center gap-2 rounded-xl border border-white/[0.05] bg-white/[0.02] p-2.5 text-xs"
              >
                <Users className="h-3.5 w-3.5 shrink-0 text-white/25" />
                <span className="flex-1 text-white/60">
                  {m.name ?? m.email ?? `User #${m.userId}`}
                </span>
                <span className="text-white/25">
                  {new Date(m.redeemedAt).toLocaleDateString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        !members.isLoading && (
          <p className="text-xs text-white/25">
            No members have joined yet.
          </p>
        )
      )}
    </section>
  );
}

function QuickStartPanel({ runtime }: { runtime: EnvironmentRuntime }) {
  const cmds = templateQuickStart[runtime] ?? [];
  const icon = runtimeIcons[runtime] ?? "🖥";
  const label = runtimeLabels[runtime] ?? runtime;
  if (!cmds.length) return null;
  return (
    <section className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
      <div className="mb-4 flex items-center gap-2">
        <span className="text-base">{icon}</span>
        <h2 className="text-sm font-semibold text-white">
          {label} quick start
        </h2>
      </div>
      <div className="rounded-xl bg-[#050505] border border-white/[0.05] p-4">
        {cmds.map((cmd, i) => (
          <div
            key={i}
            className="flex items-baseline gap-2 font-mono text-[11px] leading-6"
          >
            <span className="select-none text-emerald-400/60">$</span>
            <span className="text-white/60">{cmd}</span>
          </div>
        ))}
      </div>
      <p className="mt-3 text-[11px] leading-5 text-white/25">
        Run these in the browser terminal. Files in{" "}
        <code className="text-white/40">/workspace</code> persist across
        restarts.
      </p>
    </section>
  );
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
        <p className="text-sm text-rose-300">Invalid environment identifier.</p>
      </CNADLayout>
    );
  if (detail.isLoading)
    return (
      <CNADLayout>
        <div className="space-y-4">
          <Skeleton className="h-8 w-64 bg-white/[0.04]" />
          <Skeleton className="h-52 bg-white/[0.04]" />
        </div>
      </CNADLayout>
    );
  if (detail.error || !detail.data)
    return (
      <CNADLayout>
        <Link
          href="/app/environments"
          className="text-sm text-white/40 hover:text-white transition-colors"
        >
          ← Return to environments
        </Link>
        <div className="mt-6 rounded-2xl border border-rose-400/15 bg-rose-400/[0.06] p-6">
          <p className="font-medium text-rose-200">Environment unavailable</p>
          <p className="mt-2 text-sm text-rose-300/70">
            {detail.error?.message ?? "This environment could not be loaded."}
          </p>
        </div>
      </CNADLayout>
    );

  const { environment, template, kubernetes } = detail.data;
  const kubernetesError =
    "kubernetesError" in detail.data ? detail.data.kubernetesError : undefined;

  const accessUrl = environment.accessUrl ?? kubernetes?.accessUrl;
  const desktopUrl = environment.desktopUrl ?? kubernetes?.desktopUrl;
  const terminalUrl = environment.terminalUrl ?? kubernetes?.terminalUrl;

  const healthLabel = kubernetes?.health.deploymentAvailable
    ? "Ready"
    : environment.status === "provisioning"
      ? "Waiting"
      : "Unavailable";

  return (
    <CNADLayout>
      <section>
        <div className="animate-fade-up mb-7">
          <Link
            href="/app/environments"
            className="mb-4 inline-flex items-center gap-1.5 text-xs text-white/30 hover:text-white/60 transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            All environments
          </Link>
          <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
            <div>
              <div className="mb-3 flex flex-wrap items-center gap-3">
                <span className="text-lg">
                  {runtimeIcons[environment.runtime as EnvironmentRuntime] ??
                    "🖥"}
                </span>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/30">
                  {template.name}
                </p>
                <StatusBadge status={environment.status} />
              </div>
              <h1 className="text-3xl font-bold tracking-[-0.04em] text-white">
                {environment.name}
              </h1>
              <p className="mt-2 text-sm text-white/40">
                {environment.description ||
                  "No environment description provided."}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {terminalUrl ? (
                <a href={terminalUrl} target="_blank" rel="noreferrer">
                  <Button
                    id="open-terminal"
                    className="rounded-full bg-white text-sm font-semibold text-black hover:bg-white/90"
                  >
                    <Terminal className="mr-1.5 h-4 w-4" />
                    Open Terminal
                  </Button>
                </a>
              ) : null}
              {desktopUrl ? (
                <a href={desktopUrl} target="_blank" rel="noreferrer">
                  <Button
                    id="open-desktop"
                    variant="ghost"
                    className="rounded-full border border-white/[0.08] bg-transparent text-sm text-white/60 hover:border-white/20 hover:bg-white/[0.04] hover:text-white"
                  >
                    <Monitor className="mr-1.5 h-4 w-4" />
                    Open Desktop
                  </Button>
                </a>
              ) : null}
              {accessUrl && !terminalUrl ? (
                <a href={accessUrl} target="_blank" rel="noreferrer">
                  <Button
                    id="open-env"
                    className="rounded-full bg-white text-sm font-semibold text-black hover:bg-white/90"
                  >
                    <ExternalLink className="mr-1.5 h-4 w-4" />
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
          <div className="animate-fade-up mb-5 rounded-xl border border-amber-400/15 bg-amber-400/[0.06] p-4">
            <div className="flex items-start gap-3">
              <Loader2 className="mt-0.5 h-4 w-4 animate-spin text-amber-300/70" />
              <div>
                <p className="text-sm font-medium text-amber-200">
                  Kubernetes provisioning in progress
                </p>
                <p className="mt-1 text-xs leading-5 text-amber-200/60">
                  The workspace pod is starting. VNC, XFCE, and nginx
                  initialise in 30–75 seconds. This page refreshes
                  automatically.
                </p>
              </div>
            </div>
          </div>
        ) : null}

        {kubernetesError ? (
          <div className="animate-fade-up mb-5 flex items-start gap-3 rounded-xl border border-amber-400/15 bg-amber-400/[0.06] p-4 text-sm text-amber-200">
            <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
            <p>
              <span className="font-medium">Kubernetes status is unavailable.</span>{" "}
              {kubernetesError}
            </p>
          </div>
        ) : null}

        {environment.failureReason ? (
          <div className="animate-fade-up mb-5 flex items-start gap-3 rounded-xl border border-rose-400/15 bg-rose-400/[0.06] p-4 text-sm text-rose-200">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <p>
              <span className="font-medium">Last operation failed.</span>{" "}
              {environment.failureReason}
            </p>
          </div>
        ) : null}

        <div className="animate-fade-up delay-100 mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
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
                : "Metrics server not available"
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

        <div className="animate-fade-up delay-150 grid gap-5 xl:grid-cols-[1.3fr_.75fr]">
          <section className="overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.02]">
            <div className="flex items-center justify-between border-b border-white/[0.05] px-5 py-4">
              <div>
                <h2 className="text-sm font-semibold text-white">
                  Observability
                </h2>
                <p className="mt-0.5 text-xs text-white/30">
                  Logs from Kubernetes · Events from the cluster · Audit entries
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
                className="h-8 w-8 rounded-lg text-white/30 hover:bg-white/[0.05] hover:text-white"
                aria-label="Refresh"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex gap-0.5 border-b border-white/[0.04] px-4 pt-3">
              {(["logs", "events", "audit"] as const).map((tab) => (
                <button
                  type="button"
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`rounded-t-lg px-4 py-2 text-xs font-medium capitalize transition-colors ${
                    activeTab === tab
                      ? "bg-white/[0.06] text-white"
                      : "text-white/30 hover:text-white/60"
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
            <div className="min-h-[330px] p-5">
              {activeTab === "logs" ? (
                <div>
                  <div className="mb-3 flex items-center justify-between">
                    <p className="text-xs text-white/30">
                      {logsEnabled
                        ? logs.data?.source === "kubernetes"
                          ? "Refreshing every 5 seconds while running"
                          : (logs.data?.message ?? "Waiting for pod logs")
                        : "Log retrieval is paused"}
                    </p>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        setLogsEnabled((current) => !current)
                      }
                      disabled={environment.status !== "running"}
                      className="h-7 rounded-full border border-white/[0.07] text-xs text-white/40 hover:border-white/15 hover:bg-white/[0.04] hover:text-white/70"
                    >
                      {logsEnabled ? "Pause" : "Load logs"}
                    </Button>
                  </div>
                  {logs.error ? (
                    <p className="rounded-xl border border-rose-400/15 bg-rose-400/[0.06] p-3 text-xs text-rose-200">
                      {logs.error.message}
                    </p>
                  ) : (
                    <pre className="max-h-[330px] overflow-auto rounded-xl border border-white/[0.05] bg-[#050505] p-4 font-mono text-[11px] leading-5 text-white/50">
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
                    <Skeleton className="h-20 bg-white/[0.04]" />
                  ) : kubernetesEvents.error ? (
                    <p className="rounded-xl border border-amber-400/15 bg-amber-400/[0.06] p-3 text-xs text-amber-200">
                      {kubernetesEvents.error.message}
                    </p>
                  ) : kubernetesEvents.data?.length ? (
                    kubernetesEvents.data.map((event, index) => (
                      <div
                        key={`${event.createdAt}-${index}`}
                        className="rounded-xl border border-white/[0.05] bg-white/[0.02] p-3"
                      >
                        <p className="text-xs font-medium text-white/70">
                          {event.reason}{" "}
                          <span className="ml-2 text-white/25">
                            {event.type}
                          </span>
                        </p>
                        <p className="mt-1 text-xs leading-5 text-white/40">
                          {event.message}
                        </p>
                        <p className="mt-1.5 text-[10px] text-white/20">
                          {eventTime(event.createdAt)}
                        </p>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-white/30">
                      No Kubernetes events are available for this namespace.
                    </p>
                  )}
                </div>
              ) : null}
              {activeTab === "audit" ? (
                <div className="space-y-3">
                  {audit.isLoading ? (
                    <Skeleton className="h-20 bg-white/[0.04]" />
                  ) : audit.data?.length ? (
                    audit.data.map((entry) => (
                      <div
                        key={entry.id}
                        className="rounded-xl border border-white/[0.05] bg-white/[0.02] p-3"
                      >
                        <p className="text-xs font-medium text-white/70">
                          {entry.action.replaceAll(".", " ")}
                        </p>
                        <p className="mt-1 text-[10px] text-white/25">
                          {eventTime(entry.createdAt)}
                        </p>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-white/30">
                      No audited actions have been recorded for this
                      environment.
                    </p>
                  )}
                </div>
              ) : null}
            </div>
          </section>

          <aside className="space-y-4">
            <QuickStartPanel
              runtime={environment.runtime as EnvironmentRuntime}
            />

            <SharePanel environmentId={environment.id} />

            <section className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
              <h2 className="mb-4 text-sm font-semibold text-white">
                Configuration
              </h2>
              <div className="space-y-3">
                {[
                  [
                    "Runtime",
                    `${runtimeIcons[environment.runtime as EnvironmentRuntime] ?? ""} ${runtimeLabels[environment.runtime as EnvironmentRuntime] ?? environment.runtime}`,
                  ],
                  ["Template", template.name],
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
                    <span className="text-white/30">{label}</span>
                    <span className="break-all text-right font-medium text-white/70">
                      {value}
                    </span>
                  </div>
                ))}
                {accessUrl ? (
                  <div className="flex items-start justify-between gap-4 text-xs">
                    <span className="text-white/30">Access URL</span>
                    <a
                      href={accessUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="break-all text-right font-medium text-white/60 hover:text-white transition-colors"
                    >
                      {accessUrl}
                    </a>
                  </div>
                ) : null}
              </div>
            </section>

            <section className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-white">
                  Lifecycle history
                </h2>
                <Clock className="h-4 w-4 text-white/25" />
              </div>
              <div className="space-y-4">
                {events.isLoading ? (
                  <Skeleton className="h-24 bg-white/[0.04]" />
                ) : events.data?.length ? (
                  events.data.slice(0, 6).map((event) => (
                    <div
                      key={event.id}
                      className="relative pl-4 before:absolute before:left-0 before:top-1.5 before:h-1.5 before:w-1.5 before:rounded-full before:bg-white/20"
                    >
                      <p className="text-xs font-medium text-white/60">
                        {event.message}
                      </p>
                      <p className="mt-0.5 text-[10px] text-white/25">
                        {eventTime(event.createdAt)}
                      </p>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-white/25">
                    No lifecycle events are available.
                  </p>
                )}
              </div>
            </section>

            {environment.repositoryUrl ? (
              <section className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
                <div className="mb-3 flex items-center justify-between">
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
                    className="h-7 w-7 rounded-lg text-white/25 hover:bg-white/[0.05] hover:text-white/60"
                    aria-label="Copy repository URL"
                  >
                    <Clipboard className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <p className="break-all text-xs leading-5 text-white/50">
                  {environment.repositoryUrl}
                </p>
                <p className="mt-2 text-[11px] text-white/25">
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
