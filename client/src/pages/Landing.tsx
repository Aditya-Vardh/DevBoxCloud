import { Button } from "@/components/ui/button";
import { startLogin } from "@/const";
import { trpc } from "@/lib/trpc";
import {
  ArrowRight,
  Box,
  ChevronRight,
  Code2,
  Command,
  Container,
  Cpu,
  Github,
  Globe,
  Layers,
  Lock,
  Monitor,
  ShieldCheck,
  Terminal,
  Zap,
} from "lucide-react";
import { useState } from "react";
import { Link } from "wouter";

const templates = [
  {
    icon: "🐧",
    name: "Ubuntu",
    tag: "ubuntu",
    color: "#ea580c",
    colorClass: "text-orange-400",
    bgClass: "bg-orange-400/10",
    borderClass: "border-orange-400/20",
    desc: "Ubuntu 24.04 LTS with XFCE desktop, bash, git, curl, vim, build-essential.",
    tools: ["bash", "git", "curl", "vim", "htop"],
  },
  {
    icon: "🐍",
    name: "Python",
    tag: "python",
    color: "#3b82f6",
    colorClass: "text-blue-400",
    bgClass: "bg-blue-400/10",
    borderClass: "border-blue-400/20",
    desc: "Python 3.12 with pip, venv, virtualenv. Both python/python3 available.",
    tools: ["python3", "pip3", "venv", "git"],
  },
  {
    icon: "🟩",
    name: "Node.js",
    tag: "nodejs",
    color: "#22c55e",
    colorClass: "text-green-400",
    bgClass: "bg-green-400/10",
    borderClass: "border-green-400/20",
    desc: "Node.js 20 LTS with npm and npx. Ready for any JavaScript project.",
    tools: ["node", "npm", "npx", "git"],
  },
  {
    icon: "☕",
    name: "Java",
    tag: "java",
    color: "#ef4444",
    colorClass: "text-red-400",
    bgClass: "bg-red-400/10",
    borderClass: "border-red-400/20",
    desc: "OpenJDK 21 with javac, Maven, and Gradle for enterprise development.",
    tools: ["java", "javac", "mvn", "gradle"],
  },
  {
    icon: "⚛️",
    name: "React",
    tag: "react",
    color: "#06b6d4",
    colorClass: "text-cyan-400",
    bgClass: "bg-cyan-400/10",
    borderClass: "border-cyan-400/20",
    desc: "Node 20 + Vite ready. Scaffold React apps with npx create-vite.",
    tools: ["node", "npm", "npx", "vite"],
  },
  {
    icon: "🚀",
    name: "Full Stack",
    tag: "fullstack",
    color: "#a855f7",
    colorClass: "text-purple-400",
    bgClass: "bg-purple-400/10",
    borderClass: "border-purple-400/20",
    desc: "Node.js + Python + Java + Maven + PostgreSQL client + Docker CLI.",
    tools: ["node", "python3", "java", "psql", "docker"],
  },
];

const features = [
  {
    icon: Terminal,
    title: "Browser Terminal",
    desc: "Full ttyd terminal accessible directly in your browser. No SSH keys, no local setup required.",
  },
  {
    icon: Monitor,
    title: "Desktop GUI",
    desc: "XFCE4 desktop via noVNC. Run graphical tools, browsers, and IDEs inside your workspace.",
  },
  {
    icon: Box,
    title: "Kubernetes-backed",
    desc: "Every workspace runs as an isolated Kubernetes deployment with its own namespace, quota, and PVC.",
  },
  {
    icon: ShieldCheck,
    title: "Resource isolation",
    desc: "NetworkPolicies, resource quotas, and LimitRanges prevent workspace interference.",
  },
  {
    icon: Cpu,
    title: "Configurable resources",
    desc: "Choose CPU, memory, and storage per workspace within your plan's limits.",
  },
  {
    icon: Zap,
    title: "Persistent storage",
    desc: "Your files in /workspace survive container restarts and OS upgrades.",
  },
];

function NavBar({ onLogin }: { onLogin: () => void }) {
  return (
    <nav className="fixed inset-x-0 top-0 z-50 border-b border-white/[0.07] bg-[#090b12]/80 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-400 to-cyan-300 text-[#0a0c13] shadow-lg shadow-indigo-500/25">
            <Command className="h-4 w-4" />
          </span>
          <span className="text-sm font-semibold tracking-tight text-white">
            DevBox Cloud
          </span>
        </Link>
        <div className="flex items-center gap-3">
          <Link href="/app" className="hidden text-sm text-slate-400 hover:text-white sm:block">
            Dashboard
          </Link>
          <Button
            onClick={onLogin}
            size="sm"
            className="bg-indigo-400 text-indigo-950 hover:bg-indigo-300"
          >
            Sign in
            <ChevronRight className="ml-1 h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </nav>
  );
}

export default function LandingPage() {
  const loginMode = trpc.auth.loginMode.useQuery();
  const isLocal = loginMode.data?.mode === "local";

  const [localLogin] = useState(() => trpc.auth.localLogin);
  const localLoginMutation = trpc.auth.localLogin.useMutation({
    onSuccess: () => {
      window.location.assign("/app");
    },
  });

  const handleLogin = () => {
    if (isLocal) {
      localLoginMutation.mutate();
    } else {
      startLogin();
    }
  };

  return (
    <div className="min-h-screen bg-[#090b12] text-slate-100">
      <NavBar onLogin={handleLogin} />

      {/* Ambient gradients */}
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute left-[-15%] top-[-10%] h-[600px] w-[600px] rounded-full bg-indigo-600/[0.12] blur-3xl" />
        <div className="absolute right-[-10%] top-[20%] h-[500px] w-[500px] rounded-full bg-cyan-500/[0.08] blur-3xl" />
        <div className="absolute bottom-[5%] left-[30%] h-[400px] w-[400px] rounded-full bg-purple-600/[0.07] blur-3xl" />
      </div>

      {/* Hero */}
      <section className="relative mx-auto flex max-w-5xl flex-col items-center px-4 pt-36 text-center sm:px-6 sm:pt-44">
        <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-indigo-300/20 bg-indigo-300/[0.08] px-3.5 py-1.5 text-xs font-medium text-indigo-200">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
          Six specialized dev environments, running now
        </div>
        <h1 className="mx-auto max-w-3xl bg-gradient-to-br from-white via-slate-200 to-slate-400 bg-clip-text text-5xl font-bold tracking-[-0.045em] text-transparent sm:text-6xl lg:text-7xl">
          Your dev environment, <br className="hidden sm:block" />
          in the cloud.
        </h1>
        <p className="mt-6 max-w-2xl text-base leading-7 text-slate-400 sm:text-lg">
          DevBox Cloud gives you instant, isolated, Kubernetes-backed development workspaces — with a full Linux desktop and browser terminal — for six popular runtimes.
        </p>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          <Button
            onClick={handleLogin}
            disabled={localLoginMutation.isPending}
            className="h-11 bg-indigo-400 px-6 text-sm font-semibold text-indigo-950 hover:bg-indigo-300"
          >
            {localLoginMutation.isPending ? "Starting…" : "Get started free"}
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
          <Link href="#environments">
            <Button
              variant="outline"
              className="h-11 border-white/10 bg-white/[0.04] px-6 text-sm text-slate-300 hover:bg-white/[0.08] hover:text-white"
            >
              View environments
            </Button>
          </Link>
        </div>

        {/* Hero preview card */}
        <div className="relative mt-20 w-full max-w-3xl">
          <div className="rounded-2xl border border-white/10 bg-[#0e1117] shadow-2xl shadow-black/50">
            {/* Terminal header */}
            <div className="flex items-center gap-2 rounded-t-2xl border-b border-white/[0.07] bg-white/[0.03] px-4 py-3">
              <span className="h-3 w-3 rounded-full bg-rose-400/70" />
              <span className="h-3 w-3 rounded-full bg-amber-400/70" />
              <span className="h-3 w-3 rounded-full bg-emerald-400/70" />
              <span className="ml-3 text-[11px] text-slate-500">DevBox — Python 3.12</span>
            </div>
            <div className="p-5 font-mono text-[12px] leading-6 text-slate-300">
              <div className="flex gap-2">
                <span className="text-emerald-400">devuser@python</span>
                <span className="text-slate-500">:</span>
                <span className="text-cyan-300">/workspace</span>
                <span className="text-slate-500">$</span>
                <span className="text-white"> python3 --version</span>
              </div>
              <div className="mt-1 text-slate-400">Python 3.12.3</div>
              <div className="mt-2 flex gap-2">
                <span className="text-emerald-400">devuser@python</span>
                <span className="text-slate-500">:</span>
                <span className="text-cyan-300">/workspace</span>
                <span className="text-slate-500">$</span>
                <span className="text-white"> python3 -m venv .venv && source .venv/bin/activate</span>
              </div>
              <div className="mt-2 flex gap-2">
                <span className="text-amber-300">(.venv)</span>
                <span className="text-emerald-400">devuser@python</span>
                <span className="text-slate-500">:</span>
                <span className="text-cyan-300">/workspace</span>
                <span className="text-slate-500">$</span>
                <span className="text-white"> pip install flask</span>
              </div>
              <div className="mt-1 text-slate-400">
                Collecting flask<br />
                <span className="text-emerald-400">Successfully installed flask-3.0.3</span>
              </div>
              <div className="mt-2 flex gap-2">
                <span className="text-amber-300">(.venv)</span>
                <span className="text-emerald-400">devuser@python</span>
                <span className="text-slate-500">:</span>
                <span className="text-cyan-300">/workspace</span>
                <span className="text-slate-500">$</span>
                <span className="animate-pulse text-slate-500">▋</span>
              </div>
            </div>
          </div>
          {/* Glow */}
          <div className="absolute inset-0 -z-10 rounded-2xl bg-indigo-500/10 blur-xl" />
        </div>
      </section>

      {/* Environments section */}
      <section id="environments" className="relative mx-auto max-w-6xl px-4 py-28 sm:px-6">
        <div className="mb-14 text-center">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300">
            Six environments
          </p>
          <h2 className="text-3xl font-bold tracking-[-0.03em] text-white sm:text-4xl">
            Pick the right stack, instantly.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-sm leading-7 text-slate-400">
            Every environment ships with the full toolchain pre-installed. No waiting for packages. Open the terminal and start coding.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {templates.map(t => (
            <div
              key={t.tag}
              className={`group relative rounded-2xl border ${t.borderClass} bg-white/[0.025] p-5 transition-all hover:bg-white/[0.04]`}
            >
              <div className={`mb-3 flex h-11 w-11 items-center justify-center rounded-xl ${t.bgClass} text-xl`}>
                {t.icon}
              </div>
              <h3 className={`text-base font-semibold ${t.colorClass}`}>{t.name}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-400">{t.desc}</p>
              <div className="mt-4 flex flex-wrap gap-1.5">
                {t.tools.map(tool => (
                  <span
                    key={tool}
                    className="rounded-md border border-white/[0.07] bg-white/[0.04] px-2 py-0.5 font-mono text-[10px] text-slate-400"
                  >
                    {tool}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="relative border-t border-white/[0.07] bg-white/[0.015]">
        <div className="mx-auto max-w-6xl px-4 py-28 sm:px-6">
          <div className="mb-14 text-center">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300">
              Platform
            </p>
            <h2 className="text-3xl font-bold tracking-[-0.03em] text-white sm:text-4xl">
              Built for real work.
            </h2>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {features.map(f => (
              <div key={f.title} className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-5">
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-300/10 text-indigo-200">
                  <f.icon className="h-5 w-5" />
                </div>
                <h3 className="text-sm font-semibold text-white">{f.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-400">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative mx-auto max-w-3xl px-4 py-32 text-center sm:px-6">
        <div className="rounded-3xl border border-indigo-300/15 bg-indigo-300/[0.06] p-12">
          <div className="mb-4 flex justify-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-400 to-cyan-300 text-[#0a0c13] shadow-lg shadow-indigo-500/25">
              <Command className="h-6 w-6" />
            </span>
          </div>
          <h2 className="text-3xl font-bold tracking-[-0.03em] text-white">
            Ready to code?
          </h2>
          <p className="mx-auto mt-4 max-w-md text-sm leading-7 text-slate-400">
            Sign in to create your first workspace. It provisions in under a minute.
          </p>
          <Button
            onClick={handleLogin}
            disabled={localLoginMutation.isPending}
            className="mt-8 h-11 bg-indigo-400 px-8 text-sm font-semibold text-indigo-950 hover:bg-indigo-300"
          >
            {localLoginMutation.isPending ? "Starting…" : "Start your workspace"}
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/[0.07] py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 text-xs text-slate-600 sm:flex-row sm:px-6">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-400 to-cyan-300 text-[#0a0c13]">
              <Command className="h-3 w-3" />
            </span>
            <span>DevBox Cloud · CNAD32 Project</span>
          </div>
          <p>Kubernetes-backed developer environments for college demonstrations</p>
        </div>
      </footer>
    </div>
  );
}
