import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import { CheckCircle2, Command, Loader2, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { useRoute, useLocation } from "wouter";

export default function InvitePage() {
  const [, params] = useRoute("/invite/:code");
  const code = params?.code ?? "";
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();
  const [redeemed, setRedeemed] = useState(false);

  const loginMode = trpc.auth.loginMode.useQuery();
  const isLocal = loginMode.data?.mode === "local";

  const localLogin = trpc.auth.localLogin.useMutation({
    onSuccess: () => window.location.reload(),
  });

  const redeemInvite = trpc.invite.redeem.useMutation({
    onSuccess: result => {
      setRedeemed(true);
      setTimeout(() => setLocation(`/app/environments/${result.environmentId}`), 2000);
    },
  });

  const inviteInfo = trpc.invite.info.useQuery(
    { code },
    { enabled: Boolean(code), retry: false }
  );

  useEffect(() => {
    if (user && !loading && code && inviteInfo.data && !redeemed) {
      // Auto-redeem when logged in
    }
  }, [user, loading, code, inviteInfo.data, redeemed]);

  if (!code) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#090b12] p-6 text-white">
        <div className="max-w-md rounded-3xl border border-white/10 bg-[#11141f] p-8 text-center">
          <XCircle className="mx-auto mb-4 h-10 w-10 text-rose-400" />
          <h1 className="text-xl font-semibold">Invalid invite</h1>
          <p className="mt-2 text-sm text-slate-400">This invitation link is missing a code.</p>
        </div>
      </div>
    );
  }

  if (inviteInfo.isLoading || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#090b12] text-slate-300">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (inviteInfo.error || !inviteInfo.data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#090b12] p-6 text-white">
        <div className="max-w-md rounded-3xl border border-rose-300/15 bg-rose-300/[0.07] p-8 text-center">
          <XCircle className="mx-auto mb-4 h-10 w-10 text-rose-400" />
          <h1 className="text-xl font-semibold text-rose-100">Invite not found</h1>
          <p className="mt-2 text-sm text-rose-200">
            {inviteInfo.error?.message ?? "This invitation has expired or does not exist."}
          </p>
        </div>
      </div>
    );
  }

  const info = inviteInfo.data;

  if (redeemed) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#090b12] p-6 text-white">
        <div className="max-w-md rounded-3xl border border-emerald-300/15 bg-emerald-300/[0.07] p-8 text-center">
          <CheckCircle2 className="mx-auto mb-4 h-10 w-10 text-emerald-400" />
          <h1 className="text-xl font-semibold text-emerald-100">Access granted!</h1>
          <p className="mt-2 text-sm text-emerald-200">Redirecting to your workspace…</p>
          <Loader2 className="mx-auto mt-4 h-5 w-5 animate-spin text-emerald-400" />
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#090b12] p-6 text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_25%,rgba(86,95,255,.16),transparent_32%),radial-gradient(circle_at_80%_80%,rgba(11,212,166,.10),transparent_26%)]" />
      <section className="relative w-full max-w-md rounded-3xl border border-white/10 bg-[#11141f]/90 p-8 shadow-2xl shadow-black/30 backdrop-blur-xl sm:p-10">
        <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-400 to-cyan-300 text-[#0b0d15] shadow-lg shadow-indigo-500/25">
          <Command className="h-6 w-6" />
        </div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300">
          Workspace invitation
        </p>
        <h1 className="text-2xl font-semibold tracking-[-0.04em]">
          You've been invited to a workspace
        </h1>
        <div className="mt-6 rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4 text-sm">
          <div className="flex justify-between gap-2">
            <span className="text-slate-500">Environment</span>
            <span className="font-medium text-white">{info.environmentName}</span>
          </div>
          <div className="mt-2 flex justify-between gap-2">
            <span className="text-slate-500">Template</span>
            <span className="font-medium text-white">{info.templateName}</span>
          </div>
          <div className="mt-2 flex justify-between gap-2">
            <span className="text-slate-500">Owner</span>
            <span className="font-medium text-white">{info.ownerName ?? "DevBox user"}</span>
          </div>
          {info.expiresAt ? (
            <div className="mt-2 flex justify-between gap-2">
              <span className="text-slate-500">Expires</span>
              <span className="font-medium text-amber-200">
                {new Date(info.expiresAt).toLocaleString()}
              </span>
            </div>
          ) : null}
        </div>
        <p className="mt-4 text-sm leading-6 text-slate-400">
          {user
            ? "Click below to accept this invitation and access the shared workspace."
            : "Sign in to accept this invitation and access the shared workspace."}
        </p>
        {redeemInvite.error ? (
          <p className="mt-3 rounded-xl border border-rose-300/20 bg-rose-300/10 p-3 text-sm text-rose-100">
            {redeemInvite.error.message}
          </p>
        ) : null}
        {user ? (
          <Button
            onClick={() => redeemInvite.mutate({ code })}
            disabled={redeemInvite.isPending}
            className="mt-6 h-11 w-full bg-indigo-400 text-indigo-950 hover:bg-indigo-300"
          >
            {redeemInvite.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : null}
            Accept invitation
          </Button>
        ) : (
          <Button
            onClick={() => isLocal ? localLogin.mutate() : startLogin()}
            disabled={localLogin.isPending}
            className="mt-6 h-11 w-full bg-white text-slate-950 hover:bg-slate-200"
          >
            {localLogin.isPending ? "Starting…" : "Sign in to accept"}
          </Button>
        )}
      </section>
    </div>
  );
}
