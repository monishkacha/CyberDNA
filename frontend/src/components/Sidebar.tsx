import React from 'react';
import {
  LayoutDashboard,
  Fingerprint,
  ShieldAlert,
  Terminal,
  Database,
  ChevronRight,
  LogOut,
  Globe,
  AlertTriangle,
  Scale
} from 'lucide-react';
import { CyberDNALogo } from './CyberDNALogo';

export type NavItem = 
  | 'overview'
  | 'entities'
  | 'findings'
  | 'investigations'
  | 'graph'
  | 'events'
  | 'analytics'
  | 'compare'
  | 'datasources'
  | 'methodology'
  | 'settings';

interface SidebarProps {
  currentView: NavItem;
  onSelectView: (view: NavItem) => void;
  anomaliesCount: number;
  pendingFindingsCount?: number;
  openInvestigationsCount: number;
  onLogout: () => void;
  onNavigateHome: () => void;
  userEmail?: string;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentView,
  onSelectView,
  anomaliesCount,
  pendingFindingsCount = 3,
  openInvestigationsCount,
  onLogout,
  onNavigateHome,
  userEmail = 'analyst.demo@cyberdna.research'
}) => {
  const navItems = [
    { id: 'overview' as NavItem, label: 'Dashboard', icon: LayoutDashboard },
    { id: 'entities' as NavItem, label: 'Employees', icon: Fingerprint, badge: anomaliesCount > 0 ? `${anomaliesCount} alerts` : undefined },
    { id: 'events' as NavItem, label: 'Activity Explorer', icon: Terminal },
    { id: 'findings' as NavItem, label: 'Security Alerts', icon: AlertTriangle, badge: pendingFindingsCount > 0 ? `${pendingFindingsCount} review` : undefined },
    { id: 'investigations' as NavItem, label: 'Investigations', icon: ShieldAlert, badge: openInvestigationsCount > 0 ? `${openInvestigationsCount} active` : undefined },
    { id: 'compare' as NavItem, label: 'Compare', icon: Scale, badge: '70 GT' },
    { id: 'datasources' as NavItem, label: 'Data Sources', icon: Database },
  ];

  return (
    <aside className="w-64 border-r border-[#292929] bg-[#0A0A0A] h-screen flex flex-col justify-between shrink-0 select-none">
      {/* Brand & Identity */}
      <div>
        <div className="p-6 border-b border-[#292929]">
          <div className="flex items-center justify-between">
            <CyberDNALogo size="md" />

            <button
              onClick={onNavigateHome}
              className="p-1.5 text-[#777777] hover:text-[#F2D35E] hover:bg-[#171717] border border-[#292929] transition-colors"
              title="Return to Public Homepage"
            >
              <Globe className="w-3.5 h-3.5" />
            </button>
          </div>
          <p className="mt-3 text-[11px] text-[#A0A0A0] leading-relaxed font-light italic">
            "Understand behavior. Uncover what changed."
          </p>
        </div>

        {/* Navigation items */}
        <nav className="p-3 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onSelectView(item.id)}
                className={`w-full flex items-center justify-between px-3 py-2.5 text-xs font-normal tracking-tight transition-colors duration-150 ${
                  isActive
                    ? 'bg-[#F2D35E] text-[#0A0A0A] font-medium shadow-[0_0_12px_rgba(242,211,94,0.18)]'
                    : 'text-[#A0A0A0] hover:text-white hover:bg-[#171717]'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-4 h-4 ${isActive ? 'text-[#0A0A0A]' : 'text-[#777777]'}`} strokeWidth={1.75} />
                  <span>{item.label}</span>
                </div>
                {item.badge ? (
                  <span className={`text-[10px] px-1.5 py-0.5 font-mono ${
                    isActive ? 'bg-[#0A0A0A] text-[#F2D35E]' : 'bg-[#171717] text-[#F2D35E] border border-[#292929]'
                  }`}>
                    {item.badge}
                  </span>
                ) : isActive ? (
                  <ChevronRight className="w-3.5 h-3.5 text-[#0A0A0A]/70" />
                ) : null}
              </button>
            );
          })}
        </nav>
      </div>

      {/* User Session & Logout Footer */}
      <div className="border-t border-[#292929] bg-[#111111]">
        {/* User Card */}
        <div className="p-4 border-b border-[#292929]">
          <div className="flex items-center justify-between text-[11px] text-[#A0A0A0] mb-1">
            <span className="font-mono text-[10px] text-[#777777] uppercase tracking-wider">Active Analyst</span>
            <span className="inline-block w-2 h-2 rounded-full bg-[#10B981] shadow-[0_0_8px_#10B981]" title="Session Authenticated" />
          </div>
          <div className="font-mono text-xs text-white font-medium truncate">
            {userEmail}
          </div>
          <div className="text-[10px] text-[#777777] font-light mt-0.5 font-mono">
            Role: SOC Tier 3 Lead
          </div>
        </div>

        {/* Action Buttons */}
        <div className="p-3 grid grid-cols-2 gap-2 text-xs">
          <button
            onClick={onNavigateHome}
            className="px-2 py-1.5 bg-[#171717] border border-[#292929] text-[#A0A0A0] hover:text-white hover:bg-[#222222] text-[11px] flex items-center justify-center gap-1.5 transition-colors font-mono"
            title="Public Homepage"
          >
            <Globe className="w-3 h-3" />
            <span>Public Site</span>
          </button>
          <button
            onClick={onLogout}
            className="px-2 py-1.5 bg-[#171717] border border-[#292929] text-[#EF4444] hover:bg-rose-950/40 hover:border-[#EF4444]/40 text-[11px] flex items-center justify-center gap-1.5 font-medium transition-colors font-mono"
            title="Sign Out of CyberDNA"
          >
            <LogOut className="w-3 h-3" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>
    </aside>
  );
};
