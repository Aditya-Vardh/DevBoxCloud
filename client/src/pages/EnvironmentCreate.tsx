import CNADLayout from "@/components/CNADLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { runtimeIcons } from "@shared/cnad";
import type { EnvironmentRuntime } from "@shared/cnad";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CircleAlert,
  Cpu,
  Database,
  GitBranch,
  Loader2,
  MemoryStick,
  Network,
  Plus,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Link, useLocation } from "wouter";

type Draft = {
  name: string;
  description: string;
  templateId: number | null;
  cpuLimit: string;
  memoryLimit: string;
  storageLimit: string;
  port: number;
  repositoryUrl: string;
  branch: string;
};

const steps = ["Details", "Template", "Source", "Resources", "Review"];

export default function EnvironmentCreate() {
  const [, setLocation] = useLocation();
  const templates = trpc.environment.templates.useQuery();
  const create = trpc.environment.create.useMutation({
    onSuccess: (result) => {
      toast.success(
        result.ready
          ? "Workspace is ready."
          : "Kubernetes accepted the workspace. Monitoring readiness."
      );
      setLocation(`/app/environments/${result.environmentId}`);
    },
    onError: (error) => toast.error(error.message),
  });
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<Draft>({
    name: "",
    description: "",
    templateId: null,
    cpuLimit: "",
    memoryLimit: "",
    storageLimit: "",
    port: 0,
    repositoryUrl: "",
    branch: "main",
  });
  const selected = templates.data?.find(
    (template) => template.id === draft.templateId
  );
  const set = <Key extends keyof Draft>(key: Key, value: Draft[Key]) =>
    setDraft((current) => ({ ...current, [key]: value }));
  const chooseTemplate = (id: number) => {
    const template = templates.data?.find((item) => item.id === id);
    if (!template) return;
    setDraft((current) => ({
      ...current,
      templateId: id,
      cpuLimit: template.defaultCpu,
      memoryLimit: template.defaultMemory,
      storageLimit: template.defaultStorage,
      port: template.allowedPorts[0] ?? 8080,
    }));
  };
  const next = () => {
    if (step === 0 && draft.name.trim().length < 3)
      return toast.error(
        "Enter an environment name with at least 3 characters."
      );
    if (step === 1 && !selected)
      return toast.error("Select a workspace template.");
    setStep((current) => Math.min(current + 1, steps.length - 1));
  };
  const submit = () => {
    if (!selected) return toast.error("Select a workspace template.");
    create.mutate({
      name: draft.name.trim(),
      description: draft.description.trim() || undefined,
      templateId: selected.id,
      cpuLimit: draft.cpuLimit,
      memoryLimit: draft.memoryLimit,
      storageLimit: draft.storageLimit,
      port: draft.port,
      repositoryUrl: draft.repositoryUrl.trim() || undefined,
      branch: draft.repositoryUrl.trim()
        ? draft.branch.trim() || "main"
        : undefined,
    });
  };

  return (
    <CNADLayout>
      <section className="mx-auto max-w-3xl">
        <div className="animate-fade-up mb-8">
          <Link
            href="/app/environments"
            className="mb-4 inline-flex items-center gap-1.5 text-xs text-white/35 hover:text-white/70 transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to environments
          </Link>
          <h1 className="text-3xl font-bold tracking-[-0.04em] text-white">
            Create an environment
          </h1>
          <p className="mt-2 text-sm text-white/40">
            Configuration is validated server-side before provisioning any
            Kubernetes resources.
          </p>
        </div>

        <div className="animate-fade-up delay-100 mb-7 flex items-center gap-2">
          {steps.map((label, index) => (
            <div key={label} className="flex-1">
              <div
                className={`mb-1.5 h-0.5 rounded-full transition-colors duration-300 ${
                  index <= step ? "bg-white" : "bg-white/[0.08]"
                }`}
              />
              <p
                className={`text-[10px] font-semibold uppercase tracking-[0.12em] transition-colors ${
                  index === step ? "text-white/70" : "text-white/20"
                }`}
              >
                {label}
              </p>
            </div>
          ))}
        </div>

        <div className="animate-fade-up delay-150 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 sm:p-7">
          {step === 0 ? (
            <div className="max-w-lg space-y-5">
              <div>
                <h2 className="text-lg font-semibold text-white">
                  Name your workspace
                </h2>
                <p className="mt-1 text-sm text-white/40">
                  Use a concise name. It becomes part of the isolated Kubernetes
                  namespace identity.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="name" className="text-white/60">
                  Environment name
                </Label>
                <Input
                  id="name"
                  value={draft.name}
                  onChange={(event) => set("name", event.target.value)}
                  placeholder="e.g. payments-api"
                  className="rounded-xl border-white/[0.07] bg-white/[0.03] text-white placeholder:text-white/20 focus:border-white/15"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description" className="text-white/60">
                  Description{" "}
                  <span className="text-white/25">optional</span>
                </Label>
                <Textarea
                  id="description"
                  value={draft.description}
                  onChange={(event) => set("description", event.target.value)}
                  placeholder="What will you build here?"
                  className="min-h-28 rounded-xl border-white/[0.07] bg-white/[0.03] text-white placeholder:text-white/20 focus:border-white/15"
                />
              </div>
            </div>
          ) : null}

          {step === 1 ? (
            <div>
              <div>
                <h2 className="text-lg font-semibold text-white">
                  Choose a template
                </h2>
                <p className="mt-1 text-sm text-white/40">
                  Templates define a controlled runtime image, available ports,
                  and resource boundaries.
                </p>
              </div>
              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                {templates.isLoading ? (
                  <p className="text-sm text-white/40">
                    Loading available templates…
                  </p>
                ) : (
                  templates.data?.map((template) => (
                    <button
                      type="button"
                      key={template.id}
                      onClick={() => chooseTemplate(template.id)}
                      className={`rounded-xl border p-4 text-left transition-all ${
                        selected?.id === template.id
                          ? "border-white/25 bg-white/[0.06]"
                          : "border-white/[0.06] bg-white/[0.02] hover:border-white/15 hover:bg-white/[0.04]"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/[0.06] text-lg">
                          {runtimeIcons[template.runtime as EnvironmentRuntime] ?? "🖥"}
                        </span>
                        {selected?.id === template.id ? (
                          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white text-black">
                            <Check className="h-3 w-3" />
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-3 text-sm font-semibold text-white">
                        {template.name}
                      </p>
                      <p className="mt-1 min-h-10 text-xs leading-5 text-white/40">
                        {template.description}
                      </p>
                      <p className="mt-3 text-[11px] text-white/30">
                        Default: {template.defaultCpu} ·{" "}
                        {template.defaultMemory} · {template.defaultStorage}
                      </p>
                    </button>
                  ))
                )}
              </div>
            </div>
          ) : null}

          {step === 2 ? (
            <div className="max-w-lg space-y-5">
              <div>
                <h2 className="text-lg font-semibold text-white">
                  Source workspace
                </h2>
                <p className="mt-1 text-sm text-white/40">
                  GitHub is optional. A public HTTPS repository is cloned only
                  when you provide one; credentials are never accepted or
                  stored.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="repository" className="text-white/60">
                  GitHub Repository (Optional)
                </Label>
                <div className="relative">
                  <GitBranch className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/25" />
                  <Input
                    id="repository"
                    value={draft.repositoryUrl}
                    onChange={(event) =>
                      set("repositoryUrl", event.target.value)
                    }
                    placeholder="https://github.com/org/project.git"
                    className="rounded-xl border-white/[0.07] bg-white/[0.03] pl-10 text-white placeholder:text-white/20 focus:border-white/15"
                  />
                </div>
                <p className="text-xs leading-5 text-white/30">
                  Optional — leave empty to start with an empty workspace.
                </p>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    set("repositoryUrl", "");
                    set("branch", "main");
                    next();
                  }}
                  className="rounded-full border border-white/[0.07] bg-transparent text-sm text-white/50 hover:border-white/15 hover:bg-white/[0.04] hover:text-white/80"
                >
                  Skip repository
                </Button>
              </div>
              {draft.repositoryUrl ? (
                <div className="space-y-2">
                  <Label htmlFor="branch" className="text-white/60">
                    Branch
                  </Label>
                  <Input
                    id="branch"
                    value={draft.branch}
                    onChange={(event) => set("branch", event.target.value)}
                    placeholder="main"
                    className="rounded-xl border-white/[0.07] bg-white/[0.03] text-white placeholder:text-white/20 focus:border-white/15"
                  />
                </div>
              ) : null}
            </div>
          ) : null}

          {step === 3 ? (
            <div>
              <div>
                <h2 className="text-lg font-semibold text-white">
                  Size the workspace
                </h2>
                <p className="mt-1 text-sm text-white/40">
                  Template limits are enforced by the API and Kubernetes
                  resource controls.
                </p>
              </div>
              {selected ? (
                <div className="mt-6 grid gap-4 sm:grid-cols-2">
                  <ResourceSelect
                    label="CPU limit"
                    icon={<Cpu className="h-4 w-4" />}
                    value={draft.cpuLimit}
                    options={[selected.defaultCpu, selected.maxCpu]}
                    onChange={(value) => set("cpuLimit", value)}
                  />
                  <ResourceSelect
                    label="Memory limit"
                    icon={<MemoryStick className="h-4 w-4" />}
                    value={draft.memoryLimit}
                    options={[selected.defaultMemory, selected.maxMemory]}
                    onChange={(value) => set("memoryLimit", value)}
                  />
                  <ResourceSelect
                    label="Persistent storage"
                    icon={<Database className="h-4 w-4" />}
                    value={draft.storageLimit}
                    options={[selected.defaultStorage, selected.maxStorage]}
                    onChange={(value) => set("storageLimit", value)}
                  />
                  <ResourceSelect
                    label="Application port"
                    icon={<Network className="h-4 w-4" />}
                    value={String(draft.port)}
                    options={selected.allowedPorts.map(String)}
                    onChange={(value) => set("port", Number(value))}
                  />
                </div>
              ) : (
                <p className="mt-6 rounded-xl border border-amber-400/15 bg-amber-400/[0.06] p-4 text-sm text-amber-200">
                  Select a template before configuring resources.
                </p>
              )}
            </div>
          ) : null}

          {step === 4 ? (
            <div>
              <div>
                <h2 className="text-lg font-semibold text-white">
                  Review before provisioning
                </h2>
                <p className="mt-1 text-sm text-white/40">
                  DevBox Cloud will create a dedicated namespace, quota, PVC,
                  Deployment, Service, ConfigMap, and NetworkPolicy.
                </p>
              </div>
              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                {[
                  ["Name", draft.name],
                  ["Template", selected?.name ?? "Not selected"],
                  [
                    "Resources",
                    `${draft.cpuLimit} · ${draft.memoryLimit} · ${draft.storageLimit}`,
                  ],
                  ["Port", String(draft.port)],
                  [
                    "Repository",
                    draft.repositoryUrl ||
                      "None — starting with an empty workspace",
                  ],
                  [
                    "Branch",
                    draft.repositoryUrl ? draft.branch : "Not applicable",
                  ],
                ].map(([label, value]) => (
                  <div
                    key={label}
                    className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4"
                  >
                    <p className="text-[10px] uppercase tracking-[0.12em] text-white/30">
                      {label}
                    </p>
                    <p className="mt-2 break-all text-sm text-white/80">
                      {value}
                    </p>
                  </div>
                ))}
              </div>
              <div className="mt-5 flex items-start gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 text-xs leading-5 text-white/40">
                <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-white/30" />
                Provisioning shows confirmed Kubernetes state. If the cluster is
                unavailable, the operation will fail safely and the error will
                be retained in the environment event history.
              </div>
            </div>
          ) : null}

          <div className="mt-8 flex items-center justify-between border-t border-white/[0.05] pt-5">
            <Button
              variant="ghost"
              onClick={() => setStep((current) => Math.max(0, current - 1))}
              disabled={step === 0 || create.isPending}
              className="rounded-full text-white/40 hover:bg-white/[0.04] hover:text-white/70"
            >
              <ArrowLeft className="mr-1.5 h-4 w-4" />
              Back
            </Button>
            {step < steps.length - 1 ? (
              <Button
                onClick={next}
                id="create-next"
                className="rounded-full bg-white text-sm font-semibold text-black hover:bg-white/90"
              >
                Continue
                <ArrowRight className="ml-1.5 h-4 w-4" />
              </Button>
            ) : (
              <Button
                onClick={submit}
                disabled={create.isPending}
                id="create-submit"
                className="rounded-full bg-white text-sm font-semibold text-black hover:bg-white/90"
              >
                {create.isPending ? (
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="mr-1.5 h-4 w-4" />
                )}
                Provision environment
              </Button>
            )}
          </div>
        </div>
      </section>
    </CNADLayout>
  );
}

function ResourceSelect({
  label,
  icon,
  value,
  options,
  onChange,
}: {
  label: string;
  icon: React.ReactNode;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
      <div className="mb-3 flex items-center gap-2 text-sm font-medium text-white/60">
        {icon}
        {label}
      </div>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 w-full rounded-lg border border-white/[0.07] bg-[#0a0a0a] px-3 text-sm text-white outline-none transition-colors focus:border-white/20"
      >
        {Array.from(new Set(options)).map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </div>
  );
}
