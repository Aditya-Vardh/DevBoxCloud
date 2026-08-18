import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import type { EnvironmentStatus } from "@shared/cnad";
import { MoreHorizontal, Play, RefreshCw, Square, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";

const statusConfig: Record<
  EnvironmentStatus,
  { label: string; className: string }
> = {
  provisioning: {
    label: "Provisioning",
    className: "border-amber-300/15 bg-amber-300/10 text-amber-200",
  },
  running: {
    label: "Running",
    className: "border-emerald-300/15 bg-emerald-300/10 text-emerald-200",
  },
  stopped: {
    label: "Stopped",
    className: "border-slate-300/15 bg-slate-300/10 text-slate-300",
  },
  deleted: {
    label: "Deleted",
    className: "border-slate-500/15 bg-slate-500/10 text-slate-500",
  },
  failed: {
    label: "Needs attention",
    className: "border-rose-300/15 bg-rose-300/10 text-rose-200",
  },
};

export function StatusBadge({ status }: { status: EnvironmentStatus }) {
  const config = statusConfig[status];
  return (
    <Badge
      variant="outline"
      className={cn(
        "gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium",
        config.className
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {config.label}
    </Badge>
  );
}

type EnvironmentActionMenuProps = {
  environmentId: number;
  status: EnvironmentStatus;
  onChange?: () => void;
};

export function EnvironmentActionMenu({
  environmentId,
  status,
  onChange,
}: EnvironmentActionMenuProps) {
  const utils = trpc.useUtils();
  const refresh = async () => {
    await Promise.all([
      utils.environment.list.invalidate(),
      utils.environment.dashboard.invalidate(),
      utils.environment.detail.invalidate({ environmentId }),
    ]);
    onChange?.();
  };
  const start = trpc.environment.start.useMutation({
    onSuccess: async () => {
      toast.success("Start request accepted by Kubernetes.");
      await refresh();
    },
    onError: error => toast.error(error.message),
  });
  const stop = trpc.environment.stop.useMutation({
    onSuccess: async () => {
      toast.success("Stop request accepted by Kubernetes.");
      await refresh();
    },
    onError: error => toast.error(error.message),
  });
  const restart = trpc.environment.restart.useMutation({
    onSuccess: async () => {
      toast.success("Restart request accepted by Kubernetes.");
      await refresh();
    },
    onError: error => toast.error(error.message),
  });
  const remove = trpc.environment.delete.useMutation({
    onSuccess: async () => {
      toast.success("Kubernetes cleanup confirmed.");
      await refresh();
    },
    onError: error => toast.error(error.message),
  });
  const busy =
    start.isPending || stop.isPending || restart.isPending || remove.isPending;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          disabled={busy}
          className="h-8 w-8 text-slate-400 hover:bg-white/[0.08] hover:text-white"
        >
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-48 border-white/10 bg-[#181b27] text-slate-200"
      >
        {status === "stopped" ? (
          <DropdownMenuItem onClick={() => start.mutate({ environmentId })}>
            <Play className="mr-2 h-4 w-4 text-emerald-300" />
            Start
          </DropdownMenuItem>
        ) : null}
        {status === "running" ? (
          <DropdownMenuItem onClick={() => stop.mutate({ environmentId })}>
            <Square className="mr-2 h-4 w-4 text-amber-300" />
            Stop
          </DropdownMenuItem>
        ) : null}
        {status === "running" ? (
          <DropdownMenuItem onClick={() => restart.mutate({ environmentId })}>
            <RefreshCw className="mr-2 h-4 w-4 text-cyan-300" />
            Restart
          </DropdownMenuItem>
        ) : null}
        {status !== "deleted" ? (
          <>
            <DropdownMenuSeparator className="bg-white/10" />
            <DropdownMenuItem
              onClick={() => {
                if (
                  window.confirm(
                    "Delete this environment and all Kubernetes resources? This cannot be undone."
                  )
                )
                  remove.mutate({ environmentId });
              }}
              className="text-rose-300 focus:text-rose-200"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete environment
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function MetricTile({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-white">
        {value}
      </p>
      <p className="mt-1 text-[11px] text-slate-500">{detail}</p>
    </div>
  );
}
