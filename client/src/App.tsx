import { Switch, Route } from "wouter";
import { lazy, Suspense, useMemo } from "react";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import AppLayout from "@/components/AppLayout";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/Dashboard";
import { PerformanceContext, getPerformanceSettings, detectPerformanceProfile } from "@/lib/performanceSettings";

const Setup = lazy(() => import("@/pages/Setup"));
const Documentation = lazy(() => import("@/pages/Documentation"));
const Navigation = lazy(() => import("@/pages/Navigation"));
const GamepadControl = lazy(() => import("@/pages/GamepadControl"));
const FlySkyControl = lazy(() => import("@/pages/FlySkyControl"));
const SystemDiagnostics = lazy(() => import("@/pages/SystemDiagnostics"));
const Mapping = lazy(() => import("@/pages/Mapping"));
const VideoRecordings = lazy(() => import("@/pages/VideoRecordings"));
const CloudSync = lazy(() => import("@/pages/CloudSync"));

function LoadingFallback() {
  return (
    <div className="flex items-center justify-center h-full min-h-[200px]">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        <span className="text-sm text-muted-foreground font-mono">LOADING MODULE...</span>
      </div>
    </div>
  );
}

function Router() {
  return (
    <AppLayout>
      <Suspense fallback={<LoadingFallback />}>
        <Switch>
          <Route path="/" component={Dashboard} />
          <Route path="/setup" component={Setup} />
          <Route path="/docs" component={Documentation} />
          <Route path="/navigation" component={Navigation} />
          <Route path="/gamepad" component={GamepadControl} />
          <Route path="/flysky" component={FlySkyControl} />
          <Route path="/diagnostics" component={SystemDiagnostics} />
          <Route path="/mapping" component={Mapping} />
          <Route path="/recordings" component={VideoRecordings} />
          <Route path="/sync" component={CloudSync} />
          <Route component={NotFound} />
        </Switch>
      </Suspense>
    </AppLayout>
  );
}

function App() {
  const performanceSettings = useMemo(() => {
    const profile = detectPerformanceProfile();
    console.log(`[PERFORMANCE] Detected profile: ${profile}`);
    return getPerformanceSettings(profile);
  }, []);

  return (
    <PerformanceContext.Provider value={performanceSettings}>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </QueryClientProvider>
    </PerformanceContext.Provider>
  );
}

export default App;
