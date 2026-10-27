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
  { label: string; dotClass: string; className: string }
> = {
  provisioning: {
    label: "Provisioning",
    dotClass: "bg-amber-400 animate-pulse",
    className: "border-amber-400/20 bg-amber-400/[0.08] text-amber-300",
  },
  running: {
    label: "Running",
    dotClass: "bg-emerald-400",
    className: "border-emerald-400/20 bg-emerald-400/[0.08] text-emerald-300",
  },
  stopped: {
    label: "Stopped",
    dotClass: "bg-white/30",
    className: "border-white/10 bg-white/[0.04] text-white/50",
  },
  deleted: {
    label: "Deleted",
    dotClass: "bg-white/15",
    className: "border-white/[0.06] bg-white/[0.02] text-white/25",
  },
  failed: {
    label: "Needs attention",
    dotClass: "bg-rose-400 animate-pulse",
    className: "border-rose-400/20 bg-rose-400/[0.08] text-rose-300",
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
      <span className={cn("h-1.5 w-1.5 rounded-full", config.dotClass)} />
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
    onError: (error) => toast.error(error.message),
  });
  const stop = trpc.environment.stop.useMutation({
    onSuccess: async () => {
      toast.success("Stop request accepted by Kubernetes.");
      await refresh();
    },
    onError: (error) => toast.error(error.message),
  });
  const restart = trpc.environment.restart.useMutation({
    onSuccess: async () => {
      toast.success("Restart request accepted by Kubernetes.");
      await refresh();
    },
    onError: (error) => toast.error(error.message),
  });
  const remove = trpc.environment.delete.useMutation({
    onSuccess: async () => {
      toast.success("Kubernetes cleanup confirmed.");
      await refresh();
    },
    onError: (error) => toast.error(error.message),
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
          className="h-8 w-8 rounded-lg text-white/30 hover:bg-white/[0.06] hover:text-white"
          aria-label="Environment actions"
        >
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-48 border-white/[0.08] bg-[#0f0f0f] text-white/70"
      >
        {status === "stopped" ? (
          <DropdownMenuItem
            onClick={() => start.mutate({ environmentId })}
            className="hover:text-white focus:text-white"
          >
            <Play className="mr-2 h-4 w-4 text-emerald-400" />
            Start
          </DropdownMenuItem>
        ) : null}
        {status === "running" ? (
          <DropdownMenuItem
            onClick={() => stop.mutate({ environmentId })}
            className="hover:text-white focus:text-white"
          >
            <Square className="mr-2 h-4 w-4 text-amber-400" />
            Stop
          </DropdownMenuItem>
        ) : null}
        {status === "running" ? (
          <DropdownMenuItem
            onClick={() => restart.mutate({ environmentId })}
            className="hover:text-white focus:text-white"
          >
            <RefreshCw className="mr-2 h-4 w-4 text-sky-400" />
            Restart
          </DropdownMenuItem>
        ) : null}
        {status !== "deleted" ? (
          <>
            <DropdownMenuSeparator className="bg-white/[0.07]" />
            <DropdownMenuItem
              onClick={() => {
                if (
                  window.confirm(
                    "Delete this environment and all Kubernetes resources? This cannot be undone."
                  )
                )
                  remove.mutate({ environmentId });
              }}
              className="text-rose-400 focus:text-rose-300"
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
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
      <p className="text-xs text-white/35">{label}</p>
      <p className="mt-2 text-2xl font-bold tracking-[-0.04em] text-white">
        {value}
      </p>
      <p className="mt-1 text-[11px] text-white/25">{detail}</p>
    </div>
  );
}
