import React, { useState, useEffect } from 'react';
import {
  Search,
  FileDown,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  X,
  Filter,
  User,
  HardDrive,
  Clock,
  Shield,
  Layers,
  Info
} from 'lucide-react';
import type { ActivityEvent } from '../types';
import { api } from '../services/api';

interface SecurityEventsViewProps {
  onNavigateToEntity: (entityId: string) => void;
}

export const SecurityEventsView: React.FC<SecurityEventsViewProps> = ({
  onNavigateToEntity
}) => {
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);

  // Pagination & Filtering state
  const [page, setPage] = useState(0);
  const pageSize = 40;
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [selectedSeverity, setSelectedSeverity] = useState('ALL');
  const [selectedEmployee, setSelectedEmployee] = useState('ALL');
  const [activeEvent, setActiveEvent] = useState<ActivityEvent | null>(null);

  useEffect(() => {
    loadEvents();
  }, [page, selectedCategory, selectedSeverity, selectedEmployee]);

  async function loadEvents() {
    setLoading(true);
    try {
      const res = await api.getEvents({
        limit: pageSize,
        offset: page * pageSize,
        category: selectedCategory !== 'ALL' ? selectedCategory : undefined,
        severity: selectedSeverity !== 'ALL' ? selectedSeverity : undefined,
        employeeId: selectedEmployee !== 'ALL' ? selectedEmployee : undefined,
        search: searchTerm || undefined
      });
      setEvents(res.events);
      setTotalCount(res.total);
    } catch (err) {
      console.error('Failed to load events:', err);
    } finally {
      setLoading(false);
    }
  }

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPage(0);
    loadEvents();
  }

  function handleExportCsv() {
    if (events.length === 0) return;
    const headers = Object.keys(events[0]).join(',');
    const rows = events.map(e => Object.values(e).map(val => `"${val}"`).join(','));
    const csvContent = [headers, ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `cyberdna_activity_log_page_${page + 1}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  const totalPages = Math.ceil(totalCount / pageSize);

  const employeesList = [
    { id: 'ALL', name: 'All Employees' },
    { id: 'user:elena.rostova', name: 'Elena Rostova (Finance)' },
    { id: 'user:marcus.wright', name: 'Marcus Wright (IT Ops)' },
    { id: 'user:david.clark', name: 'David Clark (Engineering)' },
    { id: 'user:alex.vance', name: 'Alex Vance (Finance)' },
    { id: 'user:sarah.connor', name: 'Sarah Connor (Engineering)' },
    { id: 'user:rachel.kim', name: 'Rachel Kim (HR)' },
    { id: 'user:jonathan.hayes', name: 'Jonathan Hayes (Legal)' },
    { id: 'user:lisa.tanaka', name: 'Lisa Tanaka (Sales)' }
  ];

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6 bg-[#0A0A0A] text-[#D8D8D8] animate-fade-in">
      {/* Editorial Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between border-b border-[#292929] pb-5 gap-4">
        <div>
          <div className="text-[11px] font-mono tracking-widest text-[#F2D35E] uppercase">
            Activity Explorer
          </div>
          <h1 className="text-3xl md:text-4xl font-serif font-normal tracking-tight text-white mt-1">
            Activity <span className="italic text-[#F2D35E]">Explorer</span>
          </h1>
          <p className="text-xs text-[#A0A0A0] mt-1 font-light max-w-2xl">
            Searchable employee telemetry events across logon, file access, and USB device activity.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleExportCsv}
            className="px-3 py-1.5 bg-[#171717] border border-[#292929] text-[#D8D8D8] hover:text-[#F2D35E] hover:border-[#F2D35E] text-xs font-mono flex items-center gap-1.5 transition-colors"
          >
            <FileDown className="w-3.5 h-3.5 text-[#F2D35E]" />
            Export Page CSV
          </button>
        </div>
      </div>

      {/* Granular Filtering Control Bar */}
      <div className="p-4 bg-[#111111] border border-[#292929] space-y-3">
        <form onSubmit={handleSearchSubmit} className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 flex-1 min-w-[280px]">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#777777]" />
              <input
                type="text"
                placeholder="Search by employee, activity, process, or resource..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 bg-[#171717] text-[#D8D8D8] border border-[#292929] text-xs font-mono focus:outline-none focus:border-[#F2D35E]"
              />
            </div>
            <button
              type="submit"
              className="px-3 py-1.5 bg-[#171717] border border-[#292929] text-xs font-mono text-white hover:border-[#F2D35E] transition-colors"
            >
              Search
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-3 font-mono text-xs">
            {/* Employee Selector */}
            <select
              value={selectedEmployee}
              onChange={(e) => { setSelectedEmployee(e.target.value); setPage(0); }}
              className="bg-[#171717] border border-[#292929] px-2.5 py-1.5 text-white focus:outline-none focus:border-[#F2D35E]"
            >
              {employeesList.map(e => (
                <option key={e.id} value={e.id}>{e.name}</option>
              ))}
            </select>

            {/* Category Filter */}
            <select
              value={selectedCategory}
              onChange={(e) => { setSelectedCategory(e.target.value); setPage(0); }}
              className="bg-[#171717] border border-[#292929] px-2.5 py-1.5 text-white focus:outline-none focus:border-[#F2D35E]"
            >
              <option value="ALL">All Activity Types</option>
              <option value="LOGON">Login Activity</option>
              <option value="FILE">File Access</option>
              <option value="REMOVABLE">USB Device Usage</option>
              <option value="WEB_CLOUD">Web & Cloud Activity</option>
              <option value="EMAIL">Email Activity</option>
            </select>

            {/* Severity Filter */}
            <select
              value={selectedSeverity}
              onChange={(e) => { setSelectedSeverity(e.target.value); setPage(0); }}
              className="bg-[#171717] border border-[#292929] px-2.5 py-1.5 text-white focus:outline-none focus:border-[#F2D35E]"
            >
              <option value="ALL">All Severities</option>
              <option value="CRITICAL">Critical</option>
              <option value="HIGH">High</option>
              <option value="MEDIUM">Medium</option>
              <option value="LOW">Low</option>
              <option value="INFO">Info</option>
            </select>
          </div>
        </form>
      </div>

      {/* Events Table */}
      <div className="bg-[#111111] border border-[#292929] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#292929] bg-[#171717] text-[10px] font-mono text-[#777777] uppercase tracking-wider">
                <th className="py-2.5 px-3">Time (UTC)</th>
                <th className="py-2.5 px-3">Employee</th>
                <th className="py-2.5 px-3">Activity Type</th>
                <th className="py-2.5 px-3">Resource / Details</th>
                <th className="py-2.5 px-3 text-right">Data Volume</th>
                <th className="py-2.5 px-3 text-center">Alert Level</th>
                <th className="py-2.5 px-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#292929] text-xs font-mono">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-[#777777]">
                    Loading verified telemetry records...
                  </td>
                </tr>
              ) : events.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-[#777777]">
                    No security events match the current filter criteria.
                  </td>
                </tr>
              ) : (
                events.map((evt) => {
                  const isCritical = evt.severity === 'CRITICAL';
                  const isHigh = evt.severity === 'HIGH';
                  const isUsb = evt.event_type.includes('REMOVABLE') || evt.event_type.includes('USB');

                  return (
                    <tr
                      key={evt.event_id}
                      onClick={() => setActiveEvent(evt)}
                      className={`hover:bg-[#171717] cursor-pointer transition-colors ${
                        isUsb ? 'bg-[#1C180E]' : ''
                      }`}
                    >
                      <td className="py-2.5 px-3 text-[11px] text-[#A0A0A0]">
                        {new Date(evt.timestamp).toUTCString().slice(5, 25)}
                      </td>
                      <td className="py-2.5 px-3">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onNavigateToEntity(evt.employee_id || evt.entity_id);
                          }}
                          className="hover:text-[#F2D35E] text-white flex items-center gap-1.5 transition-colors font-sans"
                        >
                          <span>{evt.employee_name || evt.employee_id}</span>
                          <ExternalLink className="w-2.5 h-2.5 text-[#777777]" />
                        </button>
                      </td>
                      <td className="py-2.5 px-3">
                        <span className={`px-1.5 py-0.5 border text-[10px] ${
                          isUsb
                            ? 'border-[#52441A] bg-[#2E2812] text-[#F2D35E] font-semibold'
                            : 'border-[#292929] bg-[#141414] text-[#D8D8D8]'
                        }`}>
                          {evt.event_type}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-white truncate max-w-[240px]" title={evt.process_name || evt.target_resource}>
                        {evt.process_name || evt.target_resource}
                      </td>
                      <td className="py-2.5 px-3 text-right text-white">
                        {evt.bytes_transferred > 1_000_000
                          ? `${(evt.bytes_transferred / (1024*1024)).toFixed(1)} MB`
                          : `${evt.bytes_transferred.toLocaleString()} B`}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span className={`px-2 py-0.5 text-[10px] font-mono border ${
                          isCritical
                            ? 'bg-[#3D1414] text-[#FF7A7A] border-[#5E1E1E]'
                            : isHigh
                            ? 'bg-[#2E2812] text-[#F2D35E] border-[#52441A]'
                            : 'bg-[#141414] text-[#777777] border-[#292929]'
                        }`}>
                          {evt.severity}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveEvent(evt);
                          }}
                          className="text-[10px] text-[#777777] hover:text-[#F2D35E] border border-[#292929] px-2 py-0.5 bg-[#141414]"
                        >
                          Inspect
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
        <div className="p-3 bg-[#171717] border-t border-[#292929] flex items-center justify-between font-mono text-xs text-[#A0A0A0]">
          <div>
            Showing {events.length > 0 ? page * pageSize + 1 : 0} to {Math.min((page + 1) * pageSize, totalCount)} of {totalCount} records
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(Math.max(0, page - 1))}
              disabled={page === 0}
              className="p-1.5 border border-[#292929] bg-[#111111] hover:border-[#F2D35E] disabled:opacity-30 disabled:hover:border-[#292929]"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <span>
              Page {page + 1} of {Math.max(totalPages, 1)}
            </span>
            <button
              onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
              disabled={page >= totalPages - 1}
              className="p-1.5 border border-[#292929] bg-[#111111] hover:border-[#F2D35E] disabled:opacity-30 disabled:hover:border-[#292929]"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Raw Event Traceability Modal */}
      {activeEvent && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#111111] border border-[#F2D35E] w-full max-w-2xl p-6 space-y-4 shadow-2xl animate-fade-in">
            <div className="flex items-center justify-between border-b border-[#292929] pb-3">
              <div className="flex items-center gap-2 font-mono text-xs text-[#F2D35E]">
                <span>TELEMETRY TRACEABILITY</span>
                <span>•</span>
                <span>{activeEvent.event_id}</span>
              </div>
              <button
                onClick={() => setActiveEvent(null)}
                className="text-[#777777] hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 font-mono text-xs">
              <div className="grid grid-cols-2 gap-3 p-3 bg-[#171717] border border-[#292929]">
                <div>
                  <span className="text-[#777777] block text-[10px]">EMPLOYEE / SUBJECT</span>
                  <span className="text-white font-medium">{activeEvent.employee_name || activeEvent.employee_id}</span>
                </div>
                <div>
                  <span className="text-[#777777] block text-[10px]">EVENT CLASSIFICATION</span>
                  <span className="text-[#F2D35E] font-medium">{activeEvent.event_type}</span>
                </div>
                <div>
                  <span className="text-[#777777] block text-[10px]">DEVICE / WORKSTATION</span>
                  <span className="text-white">{activeEvent.device_id || 'WS-FIN-01'}</span>
                </div>
                <div>
                  <span className="text-[#777777] block text-[10px]">TIMESTAMP (UTC)</span>
                  <span className="text-white">{new Date(activeEvent.timestamp).toUTCString()}</span>
                </div>
                <div>
                  <span className="text-[#777777] block text-[10px]">SOURCE SOCKET</span>
                  <span className="text-white">{activeEvent.source_ip}</span>
                </div>
                <div>
                  <span className="text-[#777777] block text-[10px]">DESTINATION SOCKET</span>
                  <span className="text-white">{activeEvent.destination_ip}:{activeEvent.destination_port}</span>
                </div>
                <div>
                  <span className="text-[#777777] block text-[10px]">PAYLOAD VOLUME</span>
                  <span className="text-white">{activeEvent.bytes_transferred.toLocaleString()} bytes</span>
                </div>
                <div>
                  <span className="text-[#777777] block text-[10px]">DIURNAL CONTEXT</span>
                  <span className={activeEvent.is_off_hours ? 'text-[#FF7A7A]' : 'text-[#10B981]'}>
                    {activeEvent.is_off_hours ? 'OFF-HOURS TIMING' : 'NORMAL BUSINESS HOURS'}
                  </span>
                </div>
              </div>

              <div>
                <span className="text-[#777777] block text-[10px] mb-1">BINARY PROCESS / RESOURCE TARGET</span>
                <div className="p-2.5 bg-[#0A0A0A] border border-[#292929] text-white break-all">
                  {activeEvent.process_name || activeEvent.target_resource}
                </div>
              </div>

              <div>
                <span className="text-[#777777] block text-[10px] mb-1">CORRELATION RULE TRIGGERED</span>
                <div className="p-2.5 bg-[#0A0A0A] border border-[#292929] text-[#F2D35E]">
                  {activeEvent.rule_triggered}
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-[#292929] flex justify-end gap-3 font-mono text-xs">
              <button
                onClick={() => {
                  onNavigateToEntity(activeEvent.employee_id || activeEvent.entity_id);
                  setActiveEvent(null);
                }}
                className="px-3 py-1.5 bg-[#171717] border border-[#292929] text-white hover:border-[#F2D35E]"
              >
                Inspect Employee Profile
              </button>
              <button
                onClick={() => setActiveEvent(null)}
                className="px-3 py-1.5 bg-[#F2D35E] text-[#0A0A0A] font-medium hover:bg-[#FFE58A]"
              >
                Close Trace
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
