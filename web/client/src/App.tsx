/** Design reminder — Corporate Modern Mobile Operations with Arabic RTL routes and operational blue hierarchy. */
/** Route reminder — keep the mobile finance workspace inside the existing guarded admin experience. */
import { type ComponentType } from 'react';
import { Route, Switch, useLocation } from 'wouter';

import { AdminRouteGuard } from '@/components/AdminRouteGuard';
import { CaptainRouteGuard } from '@/components/CaptainRouteGuard';
import ErrorBoundary from '@/components/ErrorBoundary';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { WebAuthProvider } from '@/contexts/WebAuthContext';
import ActivateAccount from '@/pages/ActivateAccount';
import ActivityLogs from '@/pages/ActivityLogs';
import CaptainHome from '@/pages/CaptainHome';
import { CaptainCustody, CaptainHelp, CaptainOrders, CaptainSettings, CaptainWages } from '@/pages/CaptainSections';
import Captains from '@/pages/Captains';
import CaptainWageDetail from '@/pages/CaptainWageDetail';
import CompanyWages from '@/pages/CompanyWages';
import Custody from '@/pages/Custody';
import Help from '@/pages/Help';
import Home from '@/pages/Home';
import Login from '@/pages/Login';
import More from '@/pages/More';
import NotFound from '@/pages/NotFound';
import OfficeSettings from '@/pages/OfficeSettings';
import Orders from '@/pages/Orders';
import Reports from '@/pages/Reports';
import Users from '@/pages/Users';
import WageOrders from '@/pages/WageOrders';
import Wages from '@/pages/Wages';

function AdminRoute({ component: Component }: { component: ComponentType }) {
  return (
    <AdminRouteGuard>
      <Component />
    </AdminRouteGuard>
  );
}

function CaptainRoute({ component: Component }: { component: ComponentType }) {
  return (
    <CaptainRouteGuard>
      <Component />
    </CaptainRouteGuard>
  );
}

function Router() {
  const [location] = useLocation();

  return (
    <main key={location} className="relative isolate min-h-[100dvh]">
      <Switch>
        <Route path="/login" component={Login} />
        <Route path="/activate-account" component={ActivateAccount} />
        <Route path="/activate" component={ActivateAccount} />
        <Route path="/captain/orders" component={() => <CaptainRoute component={CaptainOrders} />} />
        <Route path="/captain/wages" component={() => <CaptainRoute component={CaptainWages} />} />
        <Route path="/captain/custody" component={() => <CaptainRoute component={CaptainCustody} />} />
        <Route path="/captain/settings" component={() => <CaptainRoute component={CaptainSettings} />} />
        <Route path="/captain/help" component={() => <CaptainRoute component={CaptainHelp} />} />
        <Route path="/captain" component={() => <CaptainRoute component={CaptainHome} />} />
        <Route path="/" component={() => <AdminRoute component={Home} />} />
        <Route path="/users" component={() => <AdminRoute component={Users} />} />
        <Route path="/orders" component={() => <AdminRoute component={Orders} />} />
        <Route path="/captains" component={() => <AdminRoute component={Captains} />} />
        <Route path="/logs" component={() => <AdminRoute component={ActivityLogs} />} />
        <Route path="/wages/captain/:captainId" component={() => <AdminRoute component={CaptainWageDetail} />} />
        <Route path="/wages" component={() => <AdminRoute component={Wages} />} />
        <Route path="/company-wages" component={() => <AdminRoute component={CompanyWages} />} />
        <Route path="/wage-orders" component={() => <AdminRoute component={WageOrders} />} />
        <Route path="/more" component={() => <AdminRoute component={More} />} />
        <Route path="/custody" component={() => <AdminRoute component={Custody} />} />
        <Route path="/reports" component={() => <AdminRoute component={Reports} />} />
        <Route path="/office-settings" component={() => <AdminRoute component={OfficeSettings} />} />
        <Route path="/help" component={() => <AdminRoute component={Help} />} />
        <Route path="/404" component={NotFound} />
        <Route component={NotFound} />
      </Switch>
    </main>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <WebAuthProvider>
            <Toaster />
            <Router />
          </WebAuthProvider>
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
