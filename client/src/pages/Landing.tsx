import { Button } from "@/components/ui/button";
import { startLogin } from "@/const";
import { trpc } from "@/lib/trpc";
import {
  ArrowRight,
  Box,
  Cpu,
  Monitor,
  ShieldCheck,
  Terminal,
  Zap,
} from "lucide-react";
import { useState } from "react";
import { Link } from "wouter";

const templates = [
  {
    name: "Ubuntu",
    tag: "ubuntu",
    accent: "#e8703a",
    desc: "Ubuntu 24.04 LTS with XFCE desktop, bash, git, curl, vim, build-essential.",
    tools: ["bash", "git", "curl", "vim", "htop"],
    label: "Linux",
  },
  {
    name: "Python",
    tag: "python",
    accent: "#4b9eff",
    desc: "Python 3.12 with pip, venv, virtualenv. Both python/python3 available.",
    tools: ["python3", "pip3", "venv", "git"],
    label: "Python 3.12",
  },
  {
    name: "Node.js",
    tag: "nodejs",
    accent: "#4ade80",
    desc: "Node.js 20 LTS with npm and npx. Ready for any JavaScript project.",
    tools: ["node", "npm", "npx", "git"],
    label: "Node 20 LTS",
  },
  {
    name: "Java",
    tag: "java",
    accent: "#f87171",
    desc: "OpenJDK 21 with javac, Maven, and Gradle for enterprise development.",
    tools: ["java", "javac", "mvn", "gradle"],
    label: "OpenJDK 21",
  },
  {
    name: "React",
    tag: "react",
    accent: "#22d3ee",
    desc: "Node 20 + Vite ready. Scaffold React apps with npx create-vite.",
    tools: ["node", "npm", "npx", "vite"],
    label: "Vite + React",
  },
  {
    name: "Full Stack",
    tag: "fullstack",
    accent: "#c084fc",
    desc: "Node.js + Python + Java + Maven + PostgreSQL client + Docker CLI.",
    tools: ["node", "python3", "java", "psql", "docker"],
    label: "Multi-runtime",
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

function DevBoxMark({ size = 32 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
    >
      <rect width="32" height="32" rx="8" fill="white" />
      <rect x="7" y="7" width="8" height="8" rx="1.5" fill="#050505" />
      <rect x="17" y="7" width="8" height="8" rx="1.5" fill="#050505" />
      <rect x="7" y="17" width="8" height="8" rx="1.5" fill="#050505" opacity="0.4" />
      <rect x="17" y="17" width="8" height="8" rx="1.5" fill="#050505" />
    </svg>
  );
}

function NavBar({ onLogin }: { onLogin: () => void }) {
  return (
    <nav
      className="fixed inset-x-0 top-0 z-50 border-b border-white/[0.06] bg-[#050505]/85 backdrop-blur-xl animate-fade-in"
      aria-label="Main navigation"
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 sm:px-8">
        <Link href="/" className="flex items-center gap-3">
          <DevBoxMark size={30} />
          <span className="text-sm font-semibold tracking-tight text-white">
            DevBox Cloud
          </span>
        </Link>
        <div className="flex items-center gap-6">
          <Link
            href="/app"
            className="hidden text-sm text-white/50 transition-colors hover:text-white sm:block"
          >
            Dashboard
          </Link>
          <a
            href="#environments"
            className="hidden text-sm text-white/50 transition-colors hover:text-white sm:block"
          >
            Environments
          </a>
          <Button
            onClick={onLogin}
            className="h-9 rounded-full bg-white px-5 text-sm font-semibold text-black hover:bg-white/90"
          >
            Get started
            <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
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
    <div className="min-h-screen bg-[#050505] text-white">
      <NavBar onLogin={handleLogin} />

      <section
        className="relative mx-auto flex max-w-5xl flex-col items-center px-5 pt-40 pb-24 text-center sm:px-8 sm:pt-52"
        aria-labelledby="hero-heading"
      >
        <div className="animate-fade-up delay-100 mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-1.5 text-xs font-medium text-white/60">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
          Six runtimes. One platform.
        </div>

        <h1
          id="hero-heading"
          className="animate-fade-up delay-200 mx-auto max-w-3xl text-5xl font-extrabold leading-[1.08] tracking-[-0.04em] text-white sm:text-6xl lg:text-7xl"
        >
          Your dev environment,
          <br />
          <span className="text-white/50">in the cloud.</span>
        </h1>

        <p className="animate-fade-up delay-300 mt-7 max-w-xl text-base leading-7 text-white/50 sm:text-lg">
          Instant, isolated, Kubernetes-backed workspaces with a full Linux
          desktop and browser terminal — ready in under a minute.
        </p>

        <div className="animate-fade-up delay-400 mt-10 flex flex-wrap items-center justify-center gap-3">
          <Button
            onClick={handleLogin}
            disabled={localLoginMutation.isPending}
            id="hero-get-started"
            className="h-12 rounded-full bg-white px-8 text-sm font-semibold text-black hover:bg-white/90"
          >
            {localLoginMutation.isPending ? "Starting…" : "Get started"}
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
          <a href="#environments">
            <Button
              variant="ghost"
              className="h-12 rounded-full border border-white/10 bg-transparent px-8 text-sm font-semibold text-white/70 hover:border-white/20 hover:bg-white/[0.04] hover:text-white"
            >
              View environments
            </Button>
          </a>
        </div>

        <div className="animate-fade-up delay-500 relative mt-20 w-full max-w-3xl">
          <div className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0d0d0d] shadow-2xl shadow-black/60">
            <div className="flex items-center gap-2 border-b border-white/[0.06] bg-white/[0.02] px-5 py-3.5">
              <span className="h-2.5 w-2.5 rounded-full bg-rose-400/60" />
              <span className="h-2.5 w-2.5 rounded-full bg-amber-400/60" />
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/60" />
              <span className="ml-4 text-[11px] text-white/30">DevBox — Python 3.12 workspace</span>
            </div>
            <div className="p-6 font-mono text-[12px] leading-[1.8] text-white/60">
              <div className="flex gap-2">
                <span className="text-emerald-400/80">devuser@python</span>
                <span className="text-white/20">:</span>
                <span className="text-sky-400/80">/workspace</span>
                <span className="text-white/20">$</span>
                <span className="text-white/80"> python3 --version</span>
              </div>
              <div className="mt-0.5 text-white/40">Python 3.12.3</div>
              <div className="mt-2 flex gap-2">
                <span className="text-emerald-400/80">devuser@python</span>
                <span className="text-white/20">:</span>
                <span className="text-sky-400/80">/workspace</span>
                <span className="text-white/20">$</span>
                <span className="text-white/80"> python3 -m venv .venv && source .venv/bin/activate</span>
              </div>
              <div className="mt-2 flex gap-2">
                <span className="text-amber-300/70">(.venv)</span>
                <span className="text-emerald-400/80">devuser@python</span>
                <span className="text-white/20">:</span>
                <span className="text-sky-400/80">/workspace</span>
                <span className="text-white/20">$</span>
                <span className="text-white/80"> pip install flask</span>
              </div>
              <div className="mt-0.5 text-white/40">
                Collecting flask
                <br />
                <span className="text-emerald-400/70">Successfully installed flask-3.0.3</span>
              </div>
              <div className="mt-2 flex gap-2">
                <span className="text-amber-300/70">(.venv)</span>
                <span className="text-emerald-400/80">devuser@python</span>
                <span className="text-white/20">:</span>
                <span className="text-sky-400/80">/workspace</span>
                <span className="text-white/20">$</span>
                <span className="animate-pulse text-white/30">▋</span>
              </div>
            </div>
          </div>
          <div className="pointer-events-none absolute inset-0 -z-10 rounded-2xl bg-white/[0.03] blur-2xl" />
        </div>
      </section>

      <section id="environments" className="relative mx-auto max-w-6xl px-5 py-28 sm:px-8">
        <div className="mb-16 text-center">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-white/30">
            Six environments
          </p>
          <h2 className="text-3xl font-bold tracking-[-0.03em] text-white sm:text-4xl">
            Pick the right stack, instantly.
          </h2>
          <p className="mx-auto mt-4 max-w-lg text-sm leading-7 text-white/40">
            Every environment ships with the full toolchain pre-installed. Open
            the terminal and start coding.
          </p>
        </div>
        <div className="grid gap-px border border-white/[0.06] rounded-2xl overflow-hidden bg-white/[0.04] sm:grid-cols-2 lg:grid-cols-3">
          {templates.map((t) => (
            <div
              key={t.tag}
              className="group relative bg-[#050505] p-6 transition-colors hover:bg-white/[0.025]"
            >
              <div className="mb-4 flex items-center justify-between">
                <span
                  className="inline-block rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em]"
                  style={{
                    color: t.accent,
                    background: `${t.accent}18`,
                  }}
                >
                  {t.label}
                </span>
              </div>
              <h3 className="text-base font-semibold text-white">{t.name}</h3>
              <p className="mt-2 text-sm leading-6 text-white/40">{t.desc}</p>
              <div className="mt-5 flex flex-wrap gap-1.5">
                {t.tools.map((tool) => (
                  <span
                    key={tool}
                    className="rounded-md border border-white/[0.07] bg-white/[0.03] px-2 py-0.5 font-mono text-[10px] text-white/40"
                  >
                    {tool}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="relative border-t border-white/[0.06]">
        <div className="mx-auto max-w-6xl px-5 py-28 sm:px-8">
          <div className="mb-16 text-center">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-white/30">
              Platform
            </p>
            <h2 className="text-3xl font-bold tracking-[-0.03em] text-white sm:text-4xl">
              Built for real work.
            </h2>
          </div>
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => (
              <div key={f.title} className="group">
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl border border-white/[0.07] bg-white/[0.04] text-white/60 transition-colors group-hover:border-white/15 group-hover:bg-white/[0.07] group-hover:text-white">
                  <f.icon className="h-4.5 w-4.5" />
                </div>
                <h3 className="text-sm font-semibold text-white">{f.title}</h3>
                <p className="mt-2 text-sm leading-6 text-white/40">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="relative mx-auto max-w-4xl px-5 py-32 text-center sm:px-8">
        <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-14">
          <div className="mb-6 flex justify-center">
            <DevBoxMark size={40} />
          </div>
          <h2 className="text-3xl font-bold tracking-[-0.03em] text-white sm:text-4xl">
            Ready to code?
          </h2>
          <p className="mx-auto mt-4 max-w-md text-sm leading-7 text-white/40">
            Sign in to create your first workspace. It provisions in under a
            minute.
          </p>
          <Button
            onClick={handleLogin}
            disabled={localLoginMutation.isPending}
            id="cta-get-started"
            className="mt-9 h-12 rounded-full bg-white px-10 text-sm font-semibold text-black hover:bg-white/90"
          >
            {localLoginMutation.isPending ? "Starting…" : "Start your workspace"}
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </section>

      <footer className="border-t border-white/[0.06] py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-5 text-xs text-white/20 sm:flex-row sm:px-8">
          <div className="flex items-center gap-2.5">
            <DevBoxMark size={22} />
            <span>DevBox Cloud</span>
          </div>
          <p>Kubernetes-backed developer environments — CNAD32 Project</p>
        </div>
      </footer>
    </div>
  );
}
