import React, { useState, useEffect } from 'react';
import {
  AlertTriangle,
  Search,
  Filter,
  CheckCircle,
  Eye,
  ShieldAlert,
  Clock,
  User,
  Info,
  RefreshCw,
  ExternalLink,
  X,
  ChevronRight,
  Fingerprint
} from 'lucide-react';
import { ThreatFinding, ActivityEvent } from '../types';
import { api } from '../services/api';
import { EmployeeInvestigationPanel } from '../components/EmployeeInvestigationPanel';

interface FindingsViewProps {
  onNavigateToEntity?: (entityId: string) => void;
  onNavigateToInvestigation?: (invId: string) => void;
}

export const FindingsView: React.FC<FindingsViewProps> = ({
  onNavigateToEntity,
  onNavigateToInvestigation
}) => {
  const [findings, setFindings] = useState<ThreatFinding[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [severityFilter, setSeverityFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Selected finding for modal inspection
  const [inspectedFinding, setInspectedFinding] = useState<ThreatFinding | null>(null);
  const [supportingEvents, setSupportingEvents] = useState<ActivityEvent[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  // Global employee drawer trigger
  const [panelEmployeeId, setPanelEmployeeId] = useState<string | null>(null);

  useEffect(() => {
    loadFindings();
  }, [severityFilter, statusFilter]);

  async function loadFindings() {
    setLoading(true);
    try {
      const data = await api.getFindings({
        reviewStatus: statusFilter !== 'ALL' ? statusFilter : undefined
      });
      setFindings(data);
    } catch (err) {
      console.error('Failed to load findings:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleInspectFinding(finding: ThreatFinding) {
    setInspectedFinding(finding);
    setLoadingDetail(true);
    try {
      const detail = await api.getFindingDetail(finding.id);
      setSupportingEvents(detail.supportingEvents || []);
    } catch (err) {
      console.error('Failed to load finding detail:', err);
    } finally {
      setLoadingDetail(false);
    }
  }

  async function handleStatusChange(newStatus: 'NEW' | 'UNDER_REVIEW' | 'ESCALATED' | 'BENIGN' | 'RESOLVED') {
    if (!inspectedFinding) return;
    setIsUpdatingStatus(true);
    try {
      const updated = await api.updateFindingStatus(inspectedFinding.id, newStatus);
      setInspectedFinding(updated);
      setFindings(prev => prev.map(f => f.id === updated.id ? updated : f));
    } catch (err) {
      console.error('Failed to update status:', err);
    } finally {
      setIsUpdatingStatus(false);
    }
  }

  const filtered = findings.filter(f => {
    if (severityFilter !== 'ALL') {
      if (severityFilter === 'HIGH' && f.anomalyScore < 80) return false;
      if (severityFilter === 'MEDIUM' && (f.anomalyScore < 50 || f.anomalyScore >= 80)) return false;
      if (severityFilter === 'LOW' && f.anomalyScore >= 50) return false;
    }
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      f.id.toLowerCase().includes(q) ||
      f.employeeName.toLowerCase().includes(q) ||
      f.department.toLowerCase().includes(q) ||
      f.explanation.toLowerCase().includes(q)
    );
  });

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6 animate-fade-in font-sans">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between border-b border-[#292929] pb-5 gap-4">
        <div>
          <div className="flex items-center gap-2 text-[11px] font-mono uppercase tracking-widest text-[#F2D35E]">
            <AlertTriangle className="w-3.5 h-3.5 text-[#F2D35E]" />
            <span>Alert Triage & Review</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-serif text-white tracking-tight mt-1">
            Security <span className="italic font-normal text-[#F2D35E]">Alerts</span>
          </h1>
          <p className="mt-1 text-xs text-[#A0A0A0] max-w-2xl font-light">
            Rule-based alerts requiring human review. An alert is an operational indicator, not proof of wrongdoing.
          </p>
        </div>

        <button
          onClick={loadFindings}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-[#171717] border border-[#292929] text-xs font-mono text-[#D8D8D8] hover:text-white hover:border-[#F2D35E] transition-colors self-start md:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-[#F2D35E] ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Alerts</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 bg-[#111111] border border-[#292929] space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="relative flex-1 min-w-[260px]">
            <Search className="w-3.5 h-3.5 text-[#777777] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search alerts by employee ID, rule, or explanation..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-1.5 bg-[#171717] border border-[#292929] text-xs font-mono text-white placeholder-[#777777] focus:outline-none focus:border-[#F2D35E]"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3 font-mono text-xs">
            {/* Severity Filter */}
            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
              className="bg-[#171717] border border-[#292929] px-2.5 py-1.5 text-white focus:outline-none focus:border-[#F2D35E]"
            >
              <option value="ALL">All Severities</option>
              <option value="HIGH">High Severity (Score &ge; 80)</option>
              <option value="MEDIUM">Medium Severity (Score 50-79)</option>
              <option value="LOW">Low Severity (Score &lt; 50)</option>
            </select>

            {/* Review Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-[#171717] border border-[#292929] px-2.5 py-1.5 text-white focus:outline-none focus:border-[#F2D35E]"
            >
              <option value="ALL">All Review Statuses</option>
              <option value="NEW">New</option>
              <option value="UNDER_REVIEW">Under Review</option>
              <option value="RESOLVED">Resolved</option>
            </select>
          </div>
        </div>
      </div>

      {/* Compact Alerts Table */}
      <div className="bg-[#111111] border border-[#292929] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs font-mono">
            <thead>
              <tr className="border-b border-[#292929] bg-[#141414] text-[10px] text-[#777777] uppercase tracking-wider">
                <th className="py-3 px-4">Severity</th>
                <th className="py-3 px-4">Employee</th>
                <th className="py-3 px-4">Observation Window</th>
                <th className="py-3 px-4">Triggered Rule & Short Reason</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#222222]">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-[#777777]">
                    <RefreshCw className="w-4 h-4 text-[#F2D35E] animate-spin mx-auto mb-2" />
                    <span>Loading alerts...</span>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-[#777777]">
                    No security alerts match the current filter criteria.
                  </td>
                </tr>
              ) : (
                filtered.map((finding) => {
                  const isHigh = finding.anomalyScore >= 80;
                  const isMedium = finding.anomalyScore >= 50 && finding.anomalyScore < 80;

                  return (
                    <tr
                      key={finding.id}
                      className="hover:bg-[#161616] transition-colors"
                    >
                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 text-[10px] font-bold border ${
                          isHigh
                            ? 'bg-[#3D1414] text-[#FF7A7A] border-[#5E1E1E]'
                            : isMedium
                            ? 'bg-[#2E2812] text-[#F2D35E] border-[#52441A]'
                            : 'bg-[#141414] text-[#A0A0A0] border-[#292929]'
                        }`}>
                          {isHigh ? 'HIGH' : isMedium ? 'MEDIUM' : 'LOW'} ({finding.anomalyScore})
                        </span>
                      </td>

                      <td className="py-3 px-4 text-white font-medium">
                        <button
                          onClick={() => {
                            if (onNavigateToEntity) {
                              onNavigateToEntity(finding.employeeId || finding.employeeName);
                            } else {
                              setPanelEmployeeId(finding.employeeId || finding.employeeName);
                            }
                          }}
                          className="hover:text-[#F2D35E] flex items-center gap-1.5 transition-colors font-sans"
                        >
                          <Fingerprint className="w-3.5 h-3.5 text-[#F2D35E] shrink-0" />
                          <span>{finding.employeeName}</span>
                        </button>
                      </td>

                      <td className="py-3 px-4 text-[#A0A0A0] text-[11px]">
                        {finding.observationWindow}
                      </td>

                      <td className="py-3 px-4 text-[#D8D8D8] max-w-md">
                        <div className="font-semibold text-white">{finding.categoryLabel}</div>
                        <div className="text-[11px] text-[#888888] truncate mt-0.5 font-sans">
                          {finding.explanation}
                        </div>
                      </td>

                      <td className="py-3 px-4 text-center">
                        <span className="text-[10px] px-2 py-0.5 bg-[#1A1A1A] text-[#A0A0A0] border border-[#2E2E2E]">
                          {finding.reviewStatus}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() => handleInspectFinding(finding)}
                          className="px-2.5 py-1 text-[11px] font-mono text-[#F2D35E] hover:bg-[#F2D35E] hover:text-[#0A0A0A] border border-[#52441A] transition-colors"
                        >
                          Inspect Details
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* On-Demand Alert Details Modal */}
      {inspectedFinding && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in font-sans">
          <div className="bg-[#111111] border border-[#292929] max-w-2xl w-full p-6 space-y-5 text-xs text-[#D8D8D8] max-h-[85vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-[#222222] pb-4">
              <div>
                <div className="flex items-center gap-2 font-mono text-xs text-[#F2D35E]">
                  <span className="px-2 py-0.5 bg-[#1F1C12] border border-[#52441A] font-semibold">
                    {inspectedFinding.id}
                  </span>
                  <span>MITRE: {inspectedFinding.mitreTactic}</span>
                </div>
                <h2 className="text-xl font-serif text-white tracking-tight mt-1">
                  {inspectedFinding.categoryLabel}
                </h2>
                <div className="text-[11px] text-[#A0A0A0] mt-1 font-mono">
                  Employee: <strong className="text-white">{inspectedFinding.employeeName}</strong> ({inspectedFinding.department})
                </div>
              </div>

              <button
                onClick={() => setInspectedFinding(null)}
                className="p-1 text-[#777777] hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Explanation & Deviation */}
            <div className="space-y-3">
              <div className="p-3 bg-[#161616] border border-[#222222] space-y-1">
                <div className="text-[10px] uppercase font-mono text-[#777777]">Trigger Explanation</div>
                <p className="text-xs text-[#CCCCCC] leading-relaxed">
                  {inspectedFinding.explanation}
                </p>
              </div>

              <div className="grid grid-cols-3 gap-3 font-mono text-center">
                <div className="p-2.5 bg-[#161616] border border-[#222222]">
                  <div className="text-[10px] text-[#777777]">Anomaly Score</div>
                  <div className="text-lg font-bold text-[#F2D35E] mt-0.5">{inspectedFinding.anomalyScore} / 100</div>
                </div>
                <div className="p-2.5 bg-[#161616] border border-[#222222]">
                  <div className="text-[10px] text-[#777777]">Window</div>
                  <div className="text-xs font-bold text-white mt-1 truncate">{inspectedFinding.observationWindow}</div>
                </div>
                <div className="p-2.5 bg-[#161616] border border-[#222222]">
                  <div className="text-[10px] text-[#777777]">Evidence Records</div>
                  <div className="text-lg font-bold text-white mt-0.5">{inspectedFinding.supportingEventIds.length}</div>
                </div>
              </div>

              {/* Supporting Evidence List (On-Demand) */}
              <div className="space-y-2">
                <div className="text-[10px] uppercase font-mono text-[#777777] font-bold">
                  Supporting Telemetry Events ({supportingEvents.length})
                </div>
                {loadingDetail ? (
                  <div className="p-4 text-center text-[#777777] font-mono">Loading supporting events...</div>
                ) : supportingEvents.length > 0 ? (
                  <div className="space-y-1.5 max-h-40 overflow-y-auto">
                    {supportingEvents.map((evt, idx) => (
                      <div key={idx} className="p-2 bg-[#141414] border border-[#222222] font-mono text-[11px] flex justify-between items-center">
                        <span className="text-[#F2D35E]">{evt.event_type}</span>
                        <span className="text-white truncate max-w-[200px]">{evt.target_resource || evt.process_name}</span>
                        <span className="text-[#777777]">{new Date(evt.timestamp).toUTCString().slice(5, 22)}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-3 bg-[#141414] border border-[#222222] text-[#777777] font-mono text-center">
                    Referenced event records verified in analytical storage.
                  </div>
                )}
              </div>
            </div>

            {/* Triage Decision Actions */}
            <div className="pt-4 border-t border-[#222222] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-mono text-[11px] text-[#777777]">Update Status:</span>
                <select
                  value={inspectedFinding.reviewStatus}
                  onChange={(e) => handleStatusChange(e.target.value as any)}
                  disabled={isUpdatingStatus}
                  className="bg-[#1A1A1A] border border-[#333333] px-2 py-1 text-xs text-white focus:outline-none focus:border-[#F2D35E]"
                >
                  <option value="NEW">New</option>
                  <option value="UNDER_REVIEW">Under Review</option>
                  <option value="RESOLVED">Resolved</option>
                </select>
              </div>

              <button
                onClick={() => {
                  setInspectedFinding(null);
                  if (onNavigateToEntity) {
                    onNavigateToEntity(inspectedFinding.employeeId || inspectedFinding.employeeName);
                  } else {
                    setPanelEmployeeId(inspectedFinding.employeeId || inspectedFinding.employeeName);
                  }
                }}
                className="px-3 py-1.5 bg-[#F2D35E] text-[#0A0A0A] font-mono font-medium hover:bg-[#FFE58A] transition-colors flex items-center gap-1.5"
              >
                <span>Open Employee Drawer</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Global Employee Drawer */}
      <EmployeeInvestigationPanel
        employeeId={panelEmployeeId}
        onClose={() => setPanelEmployeeId(null)}
      />
    </div>
  );
};
