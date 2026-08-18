import CNADLayout from "@/components/CNADLayout";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { Loader2, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
export default function SettingsPage() {
  const { user } = useAuth();
  const [name, setName] = useState(user?.name ?? "");
  const utils = trpc.useUtils();
  useEffect(() => setName(user?.name ?? ""), [user?.name]);
  const update = trpc.profile.updateName.useMutation({
    onSuccess: async () => {
      toast.success("Profile name updated.");
      await utils.auth.me.invalidate();
    },
    onError: error => toast.error(error.message),
  });
  return (
    <CNADLayout>
      <section className="max-w-2xl">
        <div className="mb-8">
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300">
            Account
          </p>
          <h1 className="text-3xl font-semibold tracking-[-0.045em] text-white">
            Settings
          </h1>
          <p className="mt-2 text-sm text-slate-400">
            Manage the display information attached to your authenticated Manus
            identity.
          </p>
        </div>
        <div className="rounded-3xl border border-white/[0.07] bg-[#11141f] p-5 sm:p-6">
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-300/10 text-cyan-200">
              <ShieldCheck className="h-4 w-4" />
            </span>
            <div>
              <h2 className="text-sm font-semibold text-white">
                Manus account
              </h2>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                Authentication is managed through Manus OAuth. CNAD32 does not
                store a password or OAuth token.
              </p>
            </div>
          </div>
          <div className="mt-7 space-y-5">
            <div className="space-y-2">
              <Label htmlFor="display-name">Display name</Label>
              <Input
                id="display-name"
                value={name}
                onChange={event => setName(event.target.value)}
                className="border-white/10 bg-white/[0.035] text-white"
              />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                value={user?.email ?? "Not supplied by provider"}
                readOnly
                className="border-white/10 bg-white/[0.025] text-slate-500"
              />
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Input
                value={user?.role ?? "user"}
                readOnly
                className="border-white/10 bg-white/[0.025] capitalize text-slate-500"
              />
            </div>
          </div>
          <Button
            onClick={() => update.mutate({ name })}
            disabled={update.isPending || name.trim().length < 2}
            className="mt-7 bg-indigo-400 text-indigo-950 hover:bg-indigo-300"
          >
            {update.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : null}
            Save profile
          </Button>
        </div>
      </section>
    </CNADLayout>
  );
}
