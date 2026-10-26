import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  Fingerprint,
  Activity,
  AlertTriangle,
  CheckCircle2,
  Users,
  Clock,
  ArrowUpRight,
  Database,
  RefreshCw,
  FolderOpen
} from 'lucide-react';
import { api } from '../services/api';

interface OverviewViewProps {
  stats: any;
  onNavigateToEntity: (entityId: string) => void;
  onNavigateToInvestigation: (invId: string) => void;
  onNavigateToView: (view: any) => void;
}

export const OverviewView: React.FC<OverviewViewProps> = ({
  stats,
  onNavigateToEntity,
  onNavigateToInvestigation,
  onNavigateToView
}) => {
  const [scrutinySummary, setScrutinySummary] = useState<any>({
    totalEmployees: 0,
    highScrutiny: 0,
    mediumScrutiny: 0,
    lowScrutiny: 0,
    openCases: 0,
    unresolvedAlerts: 0
  });
  const [recentAlerts, setRecentAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadDashboardData();
  }, []);

  async function loadDashboardData() {
    try {
      setLoading(true);
      const [dirRes, alertsRes] = await Promise.all([
        api.getScrutinyDirectory({ pageSize: 6, sortBy: 'alerts', sortOrder: 'desc' }),
        api.getScrutinyAlerts(5).catch(() => ({ success: false, data: [] }))
      ]);
      if (dirRes.summary) {
        setScrutinySummary(dirRes.summary);
      }
      if (alertsRes && alertsRes.data && alertsRes.data.length > 0) {
        setRecentAlerts(alertsRes.data);
      } else if (dirRes.data && dirRes.data.length > 0) {
        const topEmp = await api.getScrutinyEmployee(dirRes.data[0].employeeId);
        if (topEmp?.alerts) {
          setRecentAlerts(topEmp.alerts.slice(0, 5));
        }
      }
    } catch (err) {
      console.error('Failed to load dashboard scrutiny data:', err);
    } finally {
      setLoading(false);
    }
  }

  const totalEmployees = scrutinySummary.totalEmployees ?? stats?.totalEmployees ?? 0;
  const highScrutiny = scrutinySummary.highScrutiny ?? stats?.highScrutiny ?? 0;
  const activeAlerts = scrutinySummary.unresolvedAlerts ?? stats?.activeAlerts ?? 0;
  const openCases = scrutinySummary.openCases ?? stats?.openInvestigationsCount ?? 0;
  const totalEvents = stats?.totalEventsProcessed ?? 0;
  const pendingReview = stats?.pendingFindingsReviewCount ?? 0;

  const statCards = [
    {
      label: 'Monitored Employees',
      value: totalEmployees.toLocaleString(),
      subtext: 'CERT r4.2 Profiled Cohort',
      icon: Users,
      color: 'text-white'
    },
    {
      label: 'Telemetry Events',
      value: totalEvents.toLocaleString(),
      subtext: 'Cleaned & Parsed Records',
      icon: Activity,
      color: 'text-white'
    },
    {
      label: 'High Scrutiny',
      value: highScrutiny.toString(),
      subtext: 'Investigation Priority Tier',
      icon: AlertTriangle,
      color: 'text-[#EF4444]',
      highlight: true
    },
    {
      label: 'Active Alerts',
      value: activeAlerts.toString(),
      subtext: 'Heuristic Rule Flags',
      icon: ShieldAlert,
      color: 'text-[#F2D35E]'
    },
    {
      label: 'Pending Review',
      value: pendingReview.toString(),
      subtext: 'Awaiting Triage Decision',
      icon: Clock,
      color: 'text-[#F2D35E]'
    },
    {
      label: 'Active Cases',
      value: openCases.toString(),
      subtext: 'Open Investigations',
      icon: FolderOpen,
      color: 'text-white'
    }
  ];

  const recentInvestigations: any[] = stats?.recentInvestigations || [];

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6 bg-[#0A0A0A] text-[#D8D8D8] animate-fade-in font-sans">
      {/* Header & Small Pipeline Status Chip */}
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-[#292929] pb-5 gap-4">
        <div>
          <div className="text-[11px] font-mono tracking-widest text-[#F2D35E] uppercase">
            Security Operations Center
          </div>
          <h1 className="text-3xl md:text-4xl font-serif font-normal tracking-tight text-white mt-1">
            Activity & Triage <span className="italic text-[#F2D35E]">Dashboard</span>
          </h1>
          <p className="text-xs text-[#A0A0A0] mt-1 font-light">
            Real-time employee telemetry monitoring, heuristic alert generation, and investigation triage.
          </p>
        </div>

        {/* Small Pipeline Status Chip */}
        <div className="flex items-center gap-3 self-start md:self-auto font-mono text-xs">
          <div className="px-3 py-1.5 bg-[#111111] border border-[#292929] flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#10B981] animate-pulse" />
            <span className="text-[#10B981] font-medium">PySpark Engine</span>
            <span className="text-[#555555]">|</span>
            <span className="text-[#777777]">Parquet Storage</span>
          </div>

          <button
            onClick={loadDashboardData}
            className="p-1.5 bg-[#141414] border border-[#292929] text-[#A0A0A0] hover:text-[#F2D35E] hover:border-[#F2D35E] transition-colors"
            title="Refresh Dashboard"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* 6 Essential KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {statCards.map((card, idx) => {
          const Icon = card.icon;
          return (
            <div
              key={idx}
              className={`p-3.5 bg-[#111111] border transition-all ${
                card.highlight
                  ? 'border-[#52441A] bg-[#14120A]'
                  : 'border-[#222222] hover:border-[#333333]'
              }`}
            >
              <div className="flex items-center justify-between text-[11px] text-[#777777] mb-1.5 font-mono">
                <span className="truncate">{card.label}</span>
                <Icon className={`w-3.5 h-3.5 ${card.color}`} />
              </div>
              <div className={`text-2xl font-mono font-medium ${card.color}`}>
                {card.value}
              </div>
              <div className="text-[10px] text-[#777777] mt-1 truncate font-mono">
                {card.subtext}
              </div>
            </div>
          );
        })}
      </div>

      {/* Two-Column Operational Section: Recent Alerts + Active Cases & Rules */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Recent Security Alerts (Compact List) */}
        <div className="lg:col-span-7 bg-[#111111] border border-[#292929] p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-[#222222] pb-3">
            <div>
              <h2 className="text-xs font-mono font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <AlertTriangle className="w-3.5 h-3.5 text-[#F2D35E]" />
                Recent Security Alerts
              </h2>
              <p className="text-[11px] text-[#777777] font-light">
                Unusual activities flagged for human triage (an alert is an indicator, not proof of wrongdoing).
              </p>
            </div>
            <button
              onClick={() => onNavigateToView('findings')}
              className="text-xs text-[#F2D35E] hover:underline flex items-center gap-1 font-mono"
            >
              All Alerts <ArrowUpRight className="w-3 h-3" />
            </button>
          </div>

          <div className="space-y-2.5">
            {recentAlerts.length > 0 ? (
              recentAlerts.map((alert: any) => (
                <div
                  key={alert.alertId}
                  onClick={() => onNavigateToEntity(alert.employeeId)}
                  className="p-3 bg-[#141414] border border-[#222222] hover:border-[#F2D35E] cursor-pointer transition-colors flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-white">{alert.employeeId}</span>
                      <span className={`text-[9px] px-1.5 py-0.2 font-mono font-bold border ${
                        alert.severity === 'HIGH'
                          ? 'border-[#EF4444]/40 bg-[#EF4444]/10 text-[#EF4444]'
                          : 'border-[#F2D35E]/40 bg-[#F2D35E]/10 text-[#F2D35E]'
                      }`}>
                        {alert.severity}
                      </span>
                      <span className="text-[10px] font-mono text-[#777777]">{alert.ruleId}</span>
                    </div>
                    <div className="text-[11px] text-[#A0A0A0] mt-1 truncate">
                      {alert.explanation || alert.triggerExplanation}
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="text-[10px] font-mono text-[#F2D35E] border border-[#52441A] px-2 py-0.5 bg-[#1F1C12]">
                      Review
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-8 text-center text-xs font-mono text-[#777777] border border-dashed border-[#222222]">
                No active security alerts recorded.
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Active Investigations & Heuristic Engine Summary */}
        <div className="lg:col-span-5 space-y-4">
          {/* Active Cases Card */}
          <div className="bg-[#111111] border border-[#292929] p-5 space-y-3">
            <div className="flex items-center justify-between border-b border-[#222222] pb-3">
              <div>
                <h2 className="text-xs font-mono font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <ShieldAlert className="w-3.5 h-3.5 text-[#F2D35E]" />
                  Active Investigations
                </h2>
                <p className="text-[11px] text-[#777777] font-light">
                  Cases currently under human review.
                </p>
              </div>
              <button
                onClick={() => onNavigateToView('investigations')}
                className="text-xs text-[#F2D35E] hover:underline flex items-center gap-1 font-mono"
              >
                Cases <ArrowUpRight className="w-3 h-3" />
              </button>
            </div>

            <div className="space-y-2">
              {recentInvestigations.length > 0 ? (
                recentInvestigations.slice(0, 3).map((inv: any) => (
                  <div
                    key={inv.id}
                    onClick={() => onNavigateToInvestigation(inv.id)}
                    className="p-3 bg-[#141414] border border-[#222222] hover:border-[#333333] cursor-pointer transition-colors"
                  >
                    <div className="flex items-center justify-between text-xs font-mono">
                      <span className="text-[#F2D35E] font-medium">{inv.id}</span>
                      <span className="text-[10px] px-1.5 py-0.5 bg-[#1E1E1E] text-white border border-[#2E2E2E]">
                        {inv.status}
                      </span>
                    </div>
                    <div className="text-xs text-white mt-1 font-medium truncate">
                      {inv.title}
                    </div>
                    <div className="text-[10px] text-[#777777] font-mono mt-1">
                      Entity: {inv.subjectEmployee || inv.employee || inv.involvedEntities?.[0] || 'Employee'}
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-6 text-center text-xs font-mono text-[#777777] border border-dashed border-[#222222]">
                  No active investigations
                </div>
              )}
            </div>
          </div>

          {/* Quick Engine Telemetry Specs */}
          <div className="bg-[#111111] border border-[#292929] p-4 text-xs font-mono space-y-2.5">
            <div className="text-[10px] uppercase text-[#777777] tracking-wider font-bold">
              Detection Engine Specifications
            </div>
            <div className="space-y-1.5 text-[11px] text-[#A0A0A0]">
              <div className="flex justify-between">
                <span>Working Hours Window:</span>
                <span className="text-white">07:00 – 19:00 Mon–Fri</span>
              </div>
              <div className="flex justify-between">
                <span>Off-Hours Threshold:</span>
                <span className="text-white">&ge; 50 Logons (18-mo macro)</span>
              </div>
              <div className="flex justify-between">
                <span>Removable USB Threshold:</span>
                <span className="text-white">&ge; 2,000 Connects (18-mo)</span>
              </div>
              <div className="flex justify-between">
                <span>High-Volume File Threshold:</span>
                <span className="text-white">&ge; 3,000 Copies (18-mo)</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
