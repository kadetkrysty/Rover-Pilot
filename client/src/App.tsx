import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/Dashboard";
import Setup from "@/pages/Setup";
import Documentation from "@/pages/Documentation";
import Navigation from "@/pages/Navigation";
import GamepadControl from "@/pages/GamepadControl";
import FlyBabyControl from "@/pages/FlyBabyControl";
import SystemDiagnostics from "@/pages/SystemDiagnostics";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/setup" component={Setup} />
      <Route path="/docs" component={Documentation} />
      <Route path="/navigation" component={Navigation} />
      <Route path="/gamepad" component={GamepadControl} />
      <Route path="/flybaby" component={FlyBabyControl} />
      <Route path="/diagnostics" component={SystemDiagnostics} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
