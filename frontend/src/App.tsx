import React, { useState, useEffect } from 'react';
import { Sidebar, NavItem } from './components/Sidebar';
import { TopBar } from './components/TopBar';
import { PublicHomeView } from './views/PublicHomeView';
import { LoginView } from './views/LoginView';
import { OverviewView } from './views/OverviewView';
import { EntityDNAView } from './views/EntityDNAView';
import { FindingsView } from './views/FindingsView';
import { InvestigationsView } from './views/InvestigationsView';
import { AttackGraphView } from './views/AttackGraphView';
import { SecurityEventsView } from './views/SecurityEventsView';
import { AnalyticsView } from './views/AnalyticsView';
import { DataSourcesView } from './views/DataSourcesView';
import { MethodologyView } from './views/MethodologyView';
import { CompareView } from './views/CompareView';
import { SettingsView } from './views/SettingsView';
import { FirstAlertNotificationBanner } from './components/FirstAlertNotificationBanner';
import { EmployeeInvestigationPanel } from './components/EmployeeInvestigationPanel';
import { api } from './services/api';

type AppRoute = 'home' | 'login' | 'dashboard';

export function App() {
  // Navigation / Route state
  const [currentRoute, setCurrentRoute] = useState<AppRoute>(() => {
    const path = window.location.pathname.toLowerCase();
    if (path === '/login') return 'login';
    if (path === '/dashboard') {
      const hasAuth = localStorage.getItem('cyberdna_auth_token') === 'true';
      return hasAuth ? 'dashboard' : 'login';
    }
    return 'home';
  });

  // Auth state
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return localStorage.getItem('cyberdna_auth_token') === 'true';
  });
  const [userEmail, setUserEmail] = useState<string>(() => {
    return localStorage.getItem('cyberdna_user_email') || 'analyst.demo@cyberdna.research';
  });

  // Dashboard state
  const [currentDashboardView, setCurrentDashboardView] = useState<NavItem>('overview');
  const [stats, setStats] = useState<any>(null);
  const [scrutinySummary, setScrutinySummary] = useState<any>(null);
  const [isPipelineRunning, setIsPipelineRunning] = useState(false);

  // Cross-view selection state
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null);
  const [selectedInvestigationId, setSelectedInvestigationId] = useState<string | null>(null);
  const [panelEmployeeId, setPanelEmployeeId] = useState<string | null>(null);
  const [focusAlertId, setFocusAlertId] = useState<string | undefined>(undefined);

  // Sync route with URL history
  useEffect(() => {
    const handlePopState = () => {
      const path = window.location.pathname.toLowerCase();
      if (path === '/login') {
        setCurrentRoute('login');
      } else if (path === '/dashboard') {
        const hasAuth = localStorage.getItem('cyberdna_auth_token') === 'true';
        if (hasAuth) {
          setCurrentRoute('dashboard');
        } else {
          setCurrentRoute('login');
        }
      } else {
        setCurrentRoute('home');
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    if (currentRoute === 'dashboard') {
      loadOverviewStats();
    }
  }, [currentRoute]);

  function navigateTo(route: AppRoute) {
    setCurrentRoute(route);
    const path = route === 'home' ? '/' : `/${route}`;
    if (window.location.pathname !== path) {
      window.history.pushState(null, '', path);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function handleLoginSuccess(email: string) {
    setIsAuthenticated(true);
    setUserEmail(email);
    localStorage.setItem('cyberdna_auth_token', 'true');
    localStorage.setItem('cyberdna_user_email', email);
    navigateTo('dashboard');
  }

  function handleEnterDemo() {
    setIsAuthenticated(true);
    setUserEmail('analyst.demo@cyberdna.research');
    localStorage.setItem('cyberdna_auth_token', 'true');
    localStorage.setItem('cyberdna_user_email', 'analyst.demo@cyberdna.research');
    navigateTo('dashboard');
  }

  function handleLogout() {
    setIsAuthenticated(false);
    localStorage.removeItem('cyberdna_auth_token');
    localStorage.removeItem('cyberdna_user_email');
    navigateTo('home');
  }

  async function loadOverviewStats() {
    try {
      const [data, dirRes] = await Promise.all([
        api.getOverviewStats().catch(() => null),
        api.getScrutinyDirectory({ pageSize: 1 }).catch(() => null)
      ]);
      if (data) setStats(data);
      if (dirRes?.summary) setScrutinySummary(dirRes.summary);
    } catch (err) {
      console.error('Failed to load overview statistics:', err);
    }
  }

  async function handleRunPipeline() {
    setIsPipelineRunning(true);
    try {
      await api.runPipeline();
      await loadOverviewStats();
    } catch (err) {
      console.error('Failed to run pipeline:', err);
    } finally {
      setIsPipelineRunning(false);
    }
  }

  function handleNavigateToEntity(entityId: string) {
    setSelectedEntityId(entityId);
    setCurrentDashboardView('entities');
  }

  function handleNavigateToInvestigation(invId: string) {
    setSelectedInvestigationId(invId);
    setCurrentDashboardView('investigations');
  }

  function handleCreateInvestigationFromEntity(entityId: string) {
    setSelectedEntityId(entityId);
    setCurrentDashboardView('investigations');
  }

  function handleGlobalSearch(query: string) {
    if (!query) return;
    if (query.startsWith('user:') || query.startsWith('host:') || query.startsWith('srv:') || query.startsWith('ip:') || query.startsWith('domain:')) {
      setSelectedEntityId(query);
      setCurrentDashboardView('entities');
    } else if (query.startsWith('INV-')) {
      setSelectedInvestigationId(query);
      setCurrentDashboardView('investigations');
    } else if (query.startsWith('EVT-')) {
      setCurrentDashboardView('events');
    }
  }

  // =========================================================================
  // STAGE 1: Public Homepage
  // =========================================================================
  if (currentRoute === 'home') {
    return (
      <PublicHomeView
        onNavigateToLogin={() => navigateTo('login')}
        onEnterDemo={handleEnterDemo}
      />
    );
  }

  // =========================================================================
  // STAGE 2: Dedicated Login Page
  // =========================================================================
  if (currentRoute === 'login') {
    return (
      <LoginView
        onLoginSuccess={handleLoginSuccess}
        onNavigateHome={() => navigateTo('home')}
      />
    );
  }

  // =========================================================================
  // STAGE 3: Authenticated Forensic Dashboard
  // =========================================================================
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#0A0A0A] text-[#D8D8D8] font-sans antialiased">
      {/* Persistent institutional sidebar */}
      <Sidebar
        currentView={currentDashboardView}
        onSelectView={(v) => {
          setCurrentDashboardView(v);
        }}
        anomaliesCount={scrutinySummary?.unresolvedAlerts !== undefined ? scrutinySummary.unresolvedAlerts : (stats?.anomaliesIdentified || 282)}
        pendingFindingsCount={stats?.pendingFindingsReviewCount || 3}
        openInvestigationsCount={scrutinySummary?.openCases !== undefined ? scrutinySummary.openCases : (stats?.openInvestigationsCount || 0)}
        onLogout={handleLogout}
        onNavigateHome={() => navigateTo('home')}
        userEmail={userEmail}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        {/* Top telemetry and breadcrumbs bar */}
        <TopBar
          currentView={currentDashboardView}
          subTitle={
            currentDashboardView === 'entities' && selectedEntityId ? selectedEntityId :
            currentDashboardView === 'investigations' && selectedInvestigationId ? selectedInvestigationId : undefined
          }
          onSearch={handleGlobalSearch}
          onRunPipeline={handleRunPipeline}
          isPipelineRunning={isPipelineRunning}
          totalEvents={stats?.totalEventsProcessed || 2173}
          onLogout={handleLogout}
          userEmail={userEmail}
        />

        {/* First-Alert Triage Notification Banner */}
        <FirstAlertNotificationBanner
          onReviewNow={(empId, alertId) => {
            setPanelEmployeeId(empId);
            setFocusAlertId(alertId);
          }}
        />

        {/* Scrollable View Container */}
        <main className="flex-1 overflow-y-auto bg-[#0A0A0A]">
          {currentDashboardView === 'overview' && (
            <OverviewView
              stats={stats}
              onNavigateToEntity={handleNavigateToEntity}
              onNavigateToInvestigation={handleNavigateToInvestigation}
              onNavigateToView={(v) => setCurrentDashboardView(v)}
            />
          )}

          {currentDashboardView === 'entities' && (
            <EntityDNAView
              initialEntityId={selectedEntityId}
              onNavigateToInvestigation={handleNavigateToInvestigation}
              onCreateInvestigationFromEntity={handleCreateInvestigationFromEntity}
            />
          )}

          {currentDashboardView === 'findings' && (
            <FindingsView
              onNavigateToEntity={handleNavigateToEntity}
              onNavigateToInvestigation={handleNavigateToInvestigation}
            />
          )}

          {currentDashboardView === 'investigations' && (
            <InvestigationsView
              initialInvestigationId={selectedInvestigationId}
              onNavigateToEntity={handleNavigateToEntity}
            />
          )}

          {currentDashboardView === 'graph' && (
            <AttackGraphView
              onNavigateToEntity={handleNavigateToEntity}
              onCreateInvestigationFromEntity={handleCreateInvestigationFromEntity}
            />
          )}

          {currentDashboardView === 'events' && (
            <SecurityEventsView
              onNavigateToEntity={handleNavigateToEntity}
            />
          )}

          {currentDashboardView === 'analytics' && (
            <AnalyticsView />
          )}

          {currentDashboardView === 'compare' && (
            <CompareView />
          )}

          {currentDashboardView === 'datasources' && (
            <DataSourcesView />
          )}

          {currentDashboardView === 'methodology' && (
            <MethodologyView />
          )}

          {currentDashboardView === 'settings' && (
            <SettingsView />
          )}
        </main>

        {/* On-Demand Global Employee Investigation Panel */}
        <EmployeeInvestigationPanel
          employeeId={panelEmployeeId}
          focusAlertId={focusAlertId}
          onClose={() => {
            setPanelEmployeeId(null);
            setFocusAlertId(undefined);
          }}
        />
      </div>
    </div>
  );
}

export default App;
