import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/_core/hooks/useAuth";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import { LoginScreen } from "./components/CNADLayout";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import { lazy, Suspense } from "react";

const ActivityPage = lazy(() => import("./pages/Activity"));
const EnvironmentCreate = lazy(() => import("./pages/EnvironmentCreate"));
const EnvironmentDetailPage = lazy(() => import("./pages/EnvironmentDetail"));
const EnvironmentsPage = lazy(() => import("./pages/Environments"));
const PlatformPage = lazy(() => import("./pages/Platform"));
const SettingsPage = lazy(() => import("./pages/Settings"));
const TemplatesPage = lazy(() => import("./pages/Templates"));

type GuardedRouteProps = {
  children: React.ReactNode;
  requireAdmin?: boolean;
};

function RouteLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#090b12] text-sm text-slate-400">
      Loading workspace…
    </div>
  );
}

function GuardedRoute({ children, requireAdmin = false }: GuardedRouteProps) {
  const { user, loading } = useAuth();
  if (loading) return <RouteLoading />;
  if (!user) return <LoginScreen />;
  if (requireAdmin && user.role !== "admin") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#090b12] p-6 text-slate-200">
        <section className="w-full max-w-md rounded-3xl border border-amber-300/15 bg-amber-300/[0.07] p-7">
          <p className="text-sm font-semibold text-amber-100">
            Administrator access required
          </p>
          <p className="mt-2 text-sm leading-6 text-amber-100/70">
            This route is restricted to CNAD32 administrators.
          </p>
        </section>
      </div>
    );
  }
  return <>{children}</>;
}

function protect(Component: React.ComponentType, requireAdmin = false) {
  return function ProtectedRoute() {
    return (
      <GuardedRoute requireAdmin={requireAdmin}>
        <Component />
      </GuardedRoute>
    );
  };
}

const ProtectedHome = protect(Home);
const ProtectedActivityPage = protect(ActivityPage);
const ProtectedEnvironmentCreate = protect(EnvironmentCreate);
const ProtectedEnvironmentDetailPage = protect(EnvironmentDetailPage);
const ProtectedEnvironmentsPage = protect(EnvironmentsPage);
const ProtectedPlatformPage = protect(PlatformPage, true);
const ProtectedSettingsPage = protect(SettingsPage);
const ProtectedTemplatesPage = protect(TemplatesPage);

function Router() {
  // make sure to consider if you need authentication for certain routes
  return (
    <Suspense fallback={<RouteLoading />}>
      <Switch>
        <Route path={"/"} component={ProtectedHome} />
        <Route path={"/environments"} component={ProtectedEnvironmentsPage} />
        <Route
          path={"/environments/new"}
          component={ProtectedEnvironmentCreate}
        />
        <Route
          path={"/environments/:environmentId"}
          component={ProtectedEnvironmentDetailPage}
        />
        <Route path={"/templates"} component={ProtectedTemplatesPage} />
        <Route path={"/activity"} component={ProtectedActivityPage} />
        <Route path={"/platform"} component={ProtectedPlatformPage} />
        <Route path={"/settings"} component={ProtectedSettingsPage} />
        <Route path={"/404"} component={NotFound} />
        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}

// NOTE: About Theme
// - First choose a default theme according to your design style (dark or light bg), than change color palette in index.css
//   to keep consistent foreground/background color across components
// - If you want to make theme switchable, pass `switchable` ThemeProvider and use `useTheme` hook

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider
        defaultTheme="dark"
        // switchable
      >
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
