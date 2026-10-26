import React, { useState, useEffect } from 'react';
import {
  Search,
  Fingerprint,
  AlertTriangle,
  ShieldAlert,
  ArrowUpRight,
  Filter,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Sliders,
  FileText
} from 'lucide-react';
import { api } from '../services/api';
import { EmployeeInvestigationPanel } from '../components/EmployeeInvestigationPanel';

interface EntityDNAViewProps {
  initialEntityId?: string | null;
  onNavigateToInvestigation?: (invId: string) => void;
  onCreateInvestigationFromEntity?: (entityId: string) => void;
}

export const EntityDNAView: React.FC<EntityDNAViewProps> = ({
  initialEntityId
}) => {
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Summary counts
  const [summary, setSummary] = useState({
    totalEmployees: 1000,
    highScrutiny: 76,
    mediumScrutiny: 110,
    lowScrutiny: 814,
    openCases: 0,
    unresolvedAlerts: 282
  });

  // Filter & Pagination state
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(15);
  const [totalPages, setTotalPages] = useState<number>(67);
  const [totalRecords, setTotalRecords] = useState<number>(1000);

  const [activeFilter, setActiveFilter] = useState<'ALL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'OPEN_CASES' | 'UNRESOLVED_ALERTS'>('ALL');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [debouncedSearch, setDebouncedSearch] = useState<string>('');
  const [sortBy, setSortBy] = useState<'alerts' | 'scrutiny' | 'events' | 'user'>('alerts');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');

  // Investigation Panel (Side Drawer / Modal on Demand)
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(initialEntityId || null);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setPage(1); // Reset to page 1 on new search
    }, 250);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  useEffect(() => {
    loadDirectory();
  }, [page, pageSize, activeFilter, debouncedSearch, sortBy, sortOrder]);

  async function loadDirectory() {
    setLoading(true);
    setError(null);
    try {
      const scrutinyParam =
        activeFilter === 'HIGH' || activeFilter === 'MEDIUM' || activeFilter === 'LOW'
          ? activeFilter
          : 'ALL';

      const res = await api.getScrutinyDirectory({
        page,
        pageSize,
        scrutiny: scrutinyParam,
        hasOpenCases: activeFilter === 'OPEN_CASES' ? true : undefined,
        hasAlerts: activeFilter === 'UNRESOLVED_ALERTS' ? true : undefined,
        search: debouncedSearch,
        sortBy,
        sortOrder
      });

      if (res && (res.success || Array.isArray(res.data) || Array.isArray(res))) {
        const empList = Array.isArray(res.data) ? res.data : (Array.isArray(res) ? res : []);
        setEmployees(empList);
        setTotalPages(res.totalPages || 1);
        setTotalRecords(res.total || empList.length);
        if (res.summary) {
          setSummary(res.summary);
        }
      } else {
        setError(res?.error || 'Failed to load employee records');
      }
    } catch (err: any) {
      setError(err.message || 'Network error loading employee directory');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6 bg-[#0A0A0A] text-[#D8D8D8] animate-fade-in font-sans">
      {/* Editorial Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between border-b border-[#292929] pb-6 gap-4">
        <div>
          <div className="text-[11px] font-mono tracking-widest text-[#F2D35E] uppercase">
            Employee Directory & Scrutiny Engine
          </div>
          <h1 className="text-3xl md:text-4xl font-serif font-normal tracking-tight text-white mt-1">
            Employee <span className="italic text-[#F2D35E]">Directory</span>
          </h1>
          <p className="text-xs text-[#A0A0A0] mt-1 font-light max-w-2xl">
            Behavioral scrutiny levels across 1,000 monitored employees. Scrutiny assigns investigation priority without declaring guilt.
          </p>
        </div>

        <button
          onClick={loadDirectory}
          className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-mono bg-[#141414] hover:bg-[#1E1E1E] text-[#EEEEEE] border border-[#2E2E2E] self-start md:self-auto transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-[#F2D35E] ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Directory</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 font-mono text-xs">
        <div className="p-3 bg-[#111111] border border-[#222222]">
          <div className="text-[10px] text-[#777777] uppercase">Profiled Population</div>
          <div className="text-xl font-bold text-white mt-1">{summary.totalEmployees.toLocaleString()}</div>
        </div>
        <div className="p-3 bg-[#111111] border border-[#EF4444]/30 bg-[#EF4444]/5">
          <div className="text-[10px] text-[#EF4444] uppercase font-bold">High Scrutiny</div>
          <div className="text-xl font-bold text-[#EF4444] mt-1">{summary.highScrutiny}</div>
        </div>
        <div className="p-3 bg-[#111111] border border-[#F2D35E]/30 bg-[#F2D35E]/5">
          <div className="text-[10px] text-[#F2D35E] uppercase font-bold">Medium Scrutiny</div>
          <div className="text-xl font-bold text-[#F2D35E] mt-1">{summary.mediumScrutiny}</div>
        </div>
        <div className="p-3 bg-[#111111] border border-[#10B981]/30 bg-[#10B981]/5">
          <div className="text-[10px] text-[#10B981] uppercase font-bold">Low Scrutiny</div>
          <div className="text-xl font-bold text-[#10B981] mt-1">{summary.lowScrutiny}</div>
        </div>
        <div className="p-3 bg-[#111111] border border-[#222222]">
          <div className="text-[10px] text-[#777777] uppercase">Active Cases</div>
          <div className="text-xl font-bold text-white mt-1">{summary.openCases}</div>
        </div>
        <div className="p-3 bg-[#111111] border border-[#222222]">
          <div className="text-[10px] text-[#777777] uppercase">Unresolved Alerts</div>
          <div className="text-xl font-bold text-[#F2D35E] mt-1">{summary.unresolvedAlerts}</div>
        </div>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="p-4 bg-[#111111] border border-[#292929] space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Filter Pills */}
          <div className="flex flex-wrap items-center gap-1.5 text-xs font-mono">
            <button
              onClick={() => { setActiveFilter('ALL'); setPage(1); }}
              className={`px-3 py-1 border transition-colors ${
                activeFilter === 'ALL'
                  ? 'bg-[#F2D35E] text-[#0A0A0A] border-[#F2D35E] font-bold'
                  : 'bg-[#161616] text-[#A0A0A0] border-[#2E2E2E] hover:text-white'
              }`}
            >
              All Employees ({summary.totalEmployees})
            </button>
            <button
              onClick={() => { setActiveFilter('HIGH'); setPage(1); }}
              className={`px-3 py-1 border transition-colors ${
                activeFilter === 'HIGH'
                  ? 'bg-[#EF4444] text-white border-[#EF4444] font-bold'
                  : 'bg-[#161616] text-[#A0A0A0] border-[#2E2E2E] hover:text-[#EF4444]'
              }`}
            >
              High Scrutiny ({summary.highScrutiny})
            </button>
            <button
              onClick={() => { setActiveFilter('MEDIUM'); setPage(1); }}
              className={`px-3 py-1 border transition-colors ${
                activeFilter === 'MEDIUM'
                  ? 'bg-[#F2D35E] text-[#0A0A0A] border-[#F2D35E] font-bold'
                  : 'bg-[#161616] text-[#A0A0A0] border-[#2E2E2E] hover:text-[#F2D35E]'
              }`}
            >
              Medium Scrutiny ({summary.mediumScrutiny})
            </button>
            <button
              onClick={() => { setActiveFilter('LOW'); setPage(1); }}
              className={`px-3 py-1 border transition-colors ${
                activeFilter === 'LOW'
                  ? 'bg-[#10B981] text-white border-[#10B981] font-bold'
                  : 'bg-[#161616] text-[#A0A0A0] border-[#2E2E2E] hover:text-[#10B981]'
              }`}
            >
              Low Scrutiny ({summary.lowScrutiny})
            </button>
            <button
              onClick={() => { setActiveFilter('OPEN_CASES'); setPage(1); }}
              className={`px-3 py-1 border transition-colors ${
                activeFilter === 'OPEN_CASES'
                  ? 'bg-[#F2D35E] text-[#0A0A0A] border-[#F2D35E] font-bold'
                  : 'bg-[#161616] text-[#A0A0A0] border-[#2E2E2E] hover:text-white'
              }`}
            >
              Open Cases ({summary.openCases})
            </button>
            <button
              onClick={() => { setActiveFilter('UNRESOLVED_ALERTS'); setPage(1); }}
              className={`px-3 py-1 border transition-colors ${
                activeFilter === 'UNRESOLVED_ALERTS'
                  ? 'bg-[#F2D35E] text-[#0A0A0A] border-[#F2D35E] font-bold'
                  : 'bg-[#161616] text-[#A0A0A0] border-[#2E2E2E] hover:text-white'
              }`}
            >
              With Alerts
            </button>
          </div>

          {/* Sort selector */}
          <div className="flex items-center space-x-2 text-xs font-mono text-[#888888]">
            <span>Sort:</span>
            <select
              value={sortBy}
              onChange={e => { setSortBy(e.target.value as any); setPage(1); }}
              className="bg-[#171717] border border-[#2E2E2E] px-2 py-1 text-xs text-white focus:outline-none focus:border-[#F2D35E]"
            >
              <option value="alerts">Total Alerts</option>
              <option value="scrutiny">Scrutiny Level</option>
              <option value="events">Activity Volume</option>
              <option value="user">Employee ID</option>
            </select>
            <button
              onClick={() => setSortOrder(prev => (prev === 'desc' ? 'asc' : 'desc'))}
              className="px-2 py-1 bg-[#171717] border border-[#2E2E2E] text-xs text-white hover:border-[#F2D35E]"
              title="Toggle sort direction"
            >
              {sortOrder === 'desc' ? '↓' : '↑'}
            </button>
          </div>
        </div>

        {/* Search Input Bar */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#666666]" />
          <input
            type="text"
            placeholder="Search employee by ID (e.g. AJF0370, ABC0174, MAR0955)..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-[#171717] text-white border border-[#292929] text-xs font-mono focus:outline-none focus:border-[#F2D35E]"
          />
        </div>
      </div>

      {/* Main Compact Table */}
      <div className="bg-[#111111] border border-[#292929] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs font-mono">
            <thead>
              <tr className="border-b border-[#292929] bg-[#141414] text-[11px] text-[#777777] uppercase tracking-wider">
                <th className="py-3 px-4">Employee ID</th>
                <th className="py-3 px-4">Current Scrutiny</th>
                <th className="py-3 px-4 text-center">Alerts</th>
                <th className="py-3 px-4 text-center">Open Cases</th>
                <th className="py-3 px-4 text-right">Activity Events</th>
                <th className="py-3 px-4 text-right">Off-Hours Logons</th>
                <th className="py-3 px-4 text-right">USB Connects</th>
                <th className="py-3 px-4 text-right">File Copies</th>
                <th className="py-3 px-4">Case Status</th>
                <th className="py-3 px-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#222222]">
              {loading ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-[#777777]">
                    <RefreshCw className="w-5 h-5 text-[#F2D35E] animate-spin mx-auto mb-2" />
                    <span>Loading directory records...</span>
                  </td>
                </tr>
              ) : employees.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-[#777777]">
                    No employees matching the selected criteria.
                  </td>
                </tr>
              ) : (
                employees.map(emp => {
                  return (
                    <tr
                      key={emp.employeeId}
                      onClick={() => setSelectedEmployeeId(emp.employeeId)}
                      className="cursor-pointer hover:bg-[#161616] transition-colors"
                    >
                      <td className="py-3 px-4 font-bold text-white flex items-center space-x-2">
                        <Fingerprint className="w-3.5 h-3.5 text-[#F2D35E] shrink-0" />
                        <span>{emp.employeeId}</span>
                      </td>

                      <td className="py-3 px-4">
                        <span
                          className={`text-[10px] px-2 py-0.5 border font-medium ${
                            emp.scrutinyLevel === 'HIGH'
                              ? 'border-[#EF4444]/40 bg-[#EF4444]/10 text-[#EF4444]'
                              : emp.scrutinyLevel === 'MEDIUM'
                              ? 'border-[#F2D35E]/40 bg-[#F2D35E]/10 text-[#F2D35E]'
                              : 'border-[#10B981]/40 bg-[#10B981]/10 text-[#10B981]'
                          }`}
                        >
                          {emp.scrutinyLevel}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-center">
                        {emp.totalAlerts > 0 ? (
                          <span className="px-2 py-0.5 bg-[#F2D35E]/20 text-[#F2D35E] font-bold border border-[#F2D35E]/40 text-[10px]">
                            {emp.totalAlerts}
                          </span>
                        ) : (
                          <span className="text-[#555555]">0</span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-center">
                        {emp.openCasesCount > 0 ? (
                          <span className="px-2 py-0.5 bg-[#EF4444]/20 text-[#EF4444] font-bold border border-[#EF4444]/40 text-[10px]">
                            {emp.openCasesCount}
                          </span>
                        ) : (
                          <span className="text-[#555555]">0</span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-right text-white">
                        {emp.activityTotals.totalEvents.toLocaleString()}
                      </td>

                      <td className="py-3 px-4 text-right">
                        <span className={emp.activityTotals.offHoursLogons >= 50 ? 'text-[#F2D35E] font-bold' : 'text-[#888888]'}>
                          {emp.activityTotals.offHoursLogons}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-right">
                        <span className={emp.activityTotals.usbConnects >= 2000 ? 'text-[#F2D35E] font-bold' : 'text-[#888888]'}>
                          {emp.activityTotals.usbConnects}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-right">
                        <span className={emp.activityTotals.fileCopies >= 3000 ? 'text-[#F2D35E] font-bold' : 'text-[#888888]'}>
                          {emp.activityTotals.fileCopies}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-[11px] text-[#A0A0A0]">
                        {emp.mostRecentCaseStatus}
                      </td>

                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={e => {
                            e.stopPropagation();
                            setSelectedEmployeeId(emp.employeeId);
                          }}
                          className="px-2.5 py-1 text-[11px] border border-[#2E2E2E] bg-[#161616] hover:border-[#F2D35E] text-[#EEEEEE] inline-flex items-center space-x-1"
                        >
                          <span>Investigate</span>
                          <ArrowUpRight className="w-3 h-3 text-[#F2D35E]" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="p-4 bg-[#141414] border-t border-[#292929] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs font-mono text-[#888888]">
          <div>
            Showing <strong className="text-white">{Math.min(totalRecords, (page - 1) * pageSize + 1)}</strong> to{' '}
            <strong className="text-white">{Math.min(totalRecords, page * pageSize)}</strong> of{' '}
            <strong className="text-white">{totalRecords.toLocaleString()}</strong> employees
          </div>

          <div className="flex items-center space-x-2">
            <span className="text-[11px]">Rows per page:</span>
            <select
              value={pageSize}
              onChange={e => { setPageSize(parseInt(e.target.value, 10)); setPage(1); }}
              className="bg-[#171717] border border-[#2E2E2E] px-2 py-1 text-xs text-white focus:outline-none"
            >
              <option value={15}>15</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
            </select>

            <div className="flex items-center space-x-1 ml-3">
              <button
                onClick={() => setPage(prev => Math.max(1, prev - 1))}
                disabled={page <= 1}
                className="px-2.5 py-1 bg-[#171717] border border-[#2E2E2E] text-white hover:border-[#F2D35E] disabled:opacity-30 disabled:hover:border-[#2E2E2E]"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <span className="px-2 text-white">
                {page} / {totalPages}
              </span>
              <button
                onClick={() => setPage(prev => Math.min(totalPages, prev + 1))}
                disabled={page >= totalPages}
                className="px-2.5 py-1 bg-[#171717] border border-[#2E2E2E] text-white hover:border-[#F2D35E] disabled:opacity-30 disabled:hover:border-[#2E2E2E]"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* On-Demand Investigation Panel */}
      <EmployeeInvestigationPanel
        employeeId={selectedEmployeeId}
        onClose={() => setSelectedEmployeeId(null)}
        onUpdate={loadDirectory}
      />
    </div>
  );
};
