import CNADLayout from "@/components/CNADLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
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
  Server,
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
    onSuccess: result => {
      toast.success(
        result.ready
          ? "Workspace is ready."
          : "Kubernetes accepted the workspace. Monitoring readiness."
      );
      setLocation(`/environments/${result.environmentId}`);
    },
    onError: error => toast.error(error.message),
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
    template => template.id === draft.templateId
  );
  const set = <Key extends keyof Draft>(key: Key, value: Draft[Key]) =>
    setDraft(current => ({ ...current, [key]: value }));
  const chooseTemplate = (id: number) => {
    const template = templates.data?.find(item => item.id === id);
    if (!template) return;
    setDraft(current => ({
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
    setStep(current => Math.min(current + 1, steps.length - 1));
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
      <section className="mx-auto max-w-4xl">
        <div className="mb-8">
          <Link
            href="/environments"
            className="mb-4 inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-300"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to environments
          </Link>
          <h1 className="text-3xl font-semibold tracking-[-0.045em] text-white">
            Create an environment
          </h1>
          <p className="mt-2 text-sm text-slate-400">
            Configuration is validated server-side before CNAD32 provisions any
            Kubernetes resources.
          </p>
        </div>
        <div className="mb-7 grid grid-cols-5 gap-2">
          {steps.map((label, index) => (
            <div key={label}>
              <div
                className={`mb-2 h-1 rounded-full ${index <= step ? "bg-indigo-300" : "bg-white/[0.08]"}`}
              />
              <p
                className={`text-[10px] font-medium uppercase tracking-[0.12em] ${index === step ? "text-indigo-200" : "text-slate-600"}`}
              >
                {label}
              </p>
            </div>
          ))}
        </div>
        <div className="rounded-3xl border border-white/[0.07] bg-[#11141f] p-5 shadow-xl shadow-black/10 sm:p-7">
          {step === 0 ? (
            <div className="max-w-xl space-y-5">
              <div>
                <h2 className="text-lg font-semibold text-white">
                  Name your workspace
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Use a concise name. It becomes part of the isolated Kubernetes
                  namespace identity.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="name">Environment name</Label>
                <Input
                  id="name"
                  value={draft.name}
                  onChange={event => set("name", event.target.value)}
                  placeholder="e.g. payments-api"
                  className="border-white/10 bg-white/[0.035] text-white placeholder:text-slate-600"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">
                  Description <span className="text-slate-600">optional</span>
                </Label>
                <Textarea
                  id="description"
                  value={draft.description}
                  onChange={event => set("description", event.target.value)}
                  placeholder="What will you build here?"
                  className="min-h-28 border-white/10 bg-white/[0.035] text-white placeholder:text-slate-600"
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
                <p className="mt-1 text-sm text-slate-500">
                  Templates define a controlled runtime image, available ports,
                  and resource boundaries.
                </p>
              </div>
              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                {templates.isLoading ? (
                  <p className="text-sm text-slate-500">
                    Loading available templates…
                  </p>
                ) : (
                  templates.data?.map(template => (
                    <button
                      type="button"
                      key={template.id}
                      onClick={() => chooseTemplate(template.id)}
                      className={`rounded-2xl border p-4 text-left transition-all ${selected?.id === template.id ? "border-indigo-300/50 bg-indigo-300/[0.08] shadow-lg shadow-indigo-500/5" : "border-white/[0.07] bg-white/[0.02] hover:border-white/15 hover:bg-white/[0.04]"}`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/[0.06] text-cyan-200">
                          <Server className="h-4 w-4" />
                        </span>
                        {selected?.id === template.id ? (
                          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-300 text-indigo-950">
                            <Check className="h-3 w-3" />
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-4 text-sm font-semibold text-white">
                        {template.name}
                      </p>
                      <p className="mt-1 min-h-10 text-xs leading-5 text-slate-500">
                        {template.description}
                      </p>
                      <p className="mt-4 text-[11px] text-slate-400">
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
            <div className="max-w-xl space-y-5">
              <div>
                <h2 className="text-lg font-semibold text-white">
                  Source workspace
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  GitHub is optional. A public HTTPS repository is cloned only
                  when you provide one; credentials are never accepted or
                  stored.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="repository">GitHub Repository (Optional)</Label>
                <div className="relative">
                  <GitBranch className="absolute left-3 top-3 h-4 w-4 text-slate-600" />
                  <Input
                    id="repository"
                    value={draft.repositoryUrl}
                    onChange={event => set("repositoryUrl", event.target.value)}
                    placeholder="https://github.com/org/project.git"
                    className="border-white/10 bg-white/[0.035] pl-9 text-white placeholder:text-slate-600"
                  />
                </div>
                <p className="text-xs leading-5 text-slate-500">
                  Optional — leave this empty if you don't want to clone a
                  repository into this environment.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    set("repositoryUrl", "");
                    set("branch", "main");
                    next();
                  }}
                  className="border-white/10 bg-white/[0.03] text-slate-200 hover:bg-white/[0.07]"
                >
                  Skip repository
                </Button>
              </div>
              {draft.repositoryUrl ? (
                <div className="space-y-2">
                  <Label htmlFor="branch">Branch</Label>
                  <Input
                    id="branch"
                    value={draft.branch}
                    onChange={event => set("branch", event.target.value)}
                    placeholder="main"
                    className="border-white/10 bg-white/[0.035] text-white placeholder:text-slate-600"
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
                <p className="mt-1 text-sm text-slate-500">
                  Template limits are enforced again by the API and Kubernetes
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
                    onChange={value => set("cpuLimit", value)}
                  />
                  <ResourceSelect
                    label="Memory limit"
                    icon={<MemoryStick className="h-4 w-4" />}
                    value={draft.memoryLimit}
                    options={[selected.defaultMemory, selected.maxMemory]}
                    onChange={value => set("memoryLimit", value)}
                  />
                  <ResourceSelect
                    label="Persistent storage"
                    icon={<Database className="h-4 w-4" />}
                    value={draft.storageLimit}
                    options={[selected.defaultStorage, selected.maxStorage]}
                    onChange={value => set("storageLimit", value)}
                  />
                  <ResourceSelect
                    label="Application port"
                    icon={<Network className="h-4 w-4" />}
                    value={String(draft.port)}
                    options={selected.allowedPorts.map(String)}
                    onChange={value => set("port", Number(value))}
                  />
                </div>
              ) : (
                <p className="mt-6 rounded-xl border border-amber-300/15 bg-amber-300/[0.08] p-4 text-sm text-amber-100">
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
                <p className="mt-1 text-sm text-slate-500">
                  CNAD32 will create a dedicated namespace, quota, PVC,
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
                    className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4"
                  >
                    <p className="text-[11px] uppercase tracking-[0.12em] text-slate-600">
                      {label}
                    </p>
                    <p className="mt-2 break-all text-sm text-slate-200">
                      {value}
                    </p>
                  </div>
                ))}
              </div>
              <div className="mt-5 flex items-start gap-3 rounded-2xl border border-cyan-300/10 bg-cyan-300/[0.05] p-4 text-xs leading-5 text-cyan-100">
                <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                Provisioning shows confirmed Kubernetes state. If the cluster is
                unavailable, the operation will fail safely and the error will
                be retained in the environment event history.
              </div>
            </div>
          ) : null}
          <div className="mt-8 flex items-center justify-between border-t border-white/[0.07] pt-5">
            <Button
              variant="ghost"
              onClick={() => setStep(current => Math.max(0, current - 1))}
              disabled={step === 0 || create.isPending}
              className="text-slate-300 hover:bg-white/[0.06] hover:text-white"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
            {step < steps.length - 1 ? (
              <Button
                onClick={next}
                className="bg-indigo-400 text-indigo-950 hover:bg-indigo-300"
              >
                Continue
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            ) : (
              <Button
                onClick={submit}
                disabled={create.isPending}
                className="bg-indigo-400 text-indigo-950 hover:bg-indigo-300"
              >
                {create.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="mr-2 h-4 w-4" />
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
    <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4">
      <div className="mb-3 flex items-center gap-2 text-sm font-medium text-slate-200">
        {icon}
        {label}
      </div>
      <select
        value={value}
        onChange={event => onChange(event.target.value)}
        className="h-10 w-full rounded-lg border border-white/10 bg-[#161a26] px-3 text-sm text-white outline-none focus:ring-2 focus:ring-indigo-300"
      >
        {Array.from(new Set(options)).map(option => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </div>
  );
}
