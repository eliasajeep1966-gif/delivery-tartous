/** Design reminder — Corporate Modern Mobile Operations with Arabic RTL routes and operational blue hierarchy. */
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch, useLocation } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import Orders from "./pages/Orders";
import Captains from "./pages/Captains";
import Users from "./pages/Users";
import ActivityLogs from "./pages/ActivityLogs";
import Wages from "./pages/Wages";
import WageOrders from "./pages/WageOrders";
import More from "./pages/More";
import Custody from "./pages/Custody";
import Reports from "./pages/Reports";
import OfficeSettings from "./pages/OfficeSettings";
import Help from "./pages/Help";
import Login from "./pages/Login";
import ActivateAccount from "./pages/ActivateAccount";


function Router() {
  const [location] = useLocation();

  return (
    <main key={location} className="relative isolate min-h-[100dvh]">
    <Switch>
      <Route path={"/"} component={Home} />
      <Route path={"/users"} component={Users} />
      <Route path={"/orders"} component={Orders} />
      <Route path={"/captains"} component={Captains} />
      <Route path={"/logs"} component={ActivityLogs} />
      <Route path={"/wages"} component={Wages} />
      <Route path={"/wage-orders"} component={WageOrders} />
      <Route path={"/more"} component={More} />
      <Route path={"/custody"} component={Custody} />
      <Route path={"/reports"} component={Reports} />
      <Route path={"/office-settings"} component={OfficeSettings} />
      <Route path={"/help"} component={Help} />
      <Route path={"/login"} component={Login} />
      <Route path={"/activate"} component={ActivateAccount} />
      <Route path={"/404"} component={NotFound} />
      {/* Final fallback route */}
      <Route component={NotFound} />
    </Switch>
    </main>
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
        defaultTheme="light"
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
