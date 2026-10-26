import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  Plus,
  Search,
  RefreshCw,
  FolderOpen,
  User,
  Clock,
  Send,
  ExternalLink,
  X,
  ChevronRight,
  FileText,
  AlertTriangle,
  CheckCircle2,
  Lock
} from 'lucide-react';
import type { Investigation, InvestigationNote } from '../types';
import { api } from '../services/api';

interface InvestigationsViewProps {
  initialInvestigationId?: string | null;
  onNavigateToEntity: (entityId: string) => void;
}

export const InvestigationsView: React.FC<InvestigationsViewProps> = ({
  initialInvestigationId,
  onNavigateToEntity
}) => {
  const [investigations, setInvestigations] = useState<Investigation[]>([]);
  const [selectedInv, setSelectedInv] = useState<Investigation | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [search, setSearch] = useState('');

  // Note taking state inside opened case
  const [newNoteText, setNewNoteText] = useState('');
  const [newNoteCategory, setNewNoteCategory] = useState<'OBSERVED_FACT' | 'HYPOTHESIS' | 'CORRELATION' | 'CONCLUSION'>('OBSERVED_FACT');
  const [isSubmittingNote, setIsSubmittingNote] = useState(false);

  // Outcome recording state
  const [isOutcomeModalOpen, setIsOutcomeModalOpen] = useState(false);
  const [selectedOutcome, setSelectedOutcome] = useState<'Resolved — Legitimate Activity' | 'Potential Concern — Further Investigation Required' | 'Confirmed Incident — Evidence Reviewed'>('Resolved — Legitimate Activity');
  const [outcomeNotes, setOutcomeNotes] = useState('');
  const [isSubmittingOutcome, setIsSubmittingOutcome] = useState(false);

  // New Case Modal state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newSeverity, setNewSeverity] = useState<any>('HIGH');
  const [newLead, setNewLead] = useState('Analyst Monish (SOC Tier 3)');
  const [newEntities, setNewEntities] = useState('user:elena.rostova');
  const [newSummary, setNewSummary] = useState('');

  useEffect(() => {
    loadInvestigations();
  }, []);

  useEffect(() => {
    if (initialInvestigationId && investigations.length > 0) {
      const match = investigations.find(i => i.id === initialInvestigationId);
      if (match) setSelectedInv(match);
    }
  }, [initialInvestigationId, investigations]);

  async function loadInvestigations() {
    setLoading(true);
    try {
      const list = await api.getInvestigations();
      setInvestigations(list);
    } catch (err) {
      console.error('Failed to load investigations:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleAddNote(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedInv || !newNoteText.trim()) return;

    setIsSubmittingNote(true);
    try {
      const created = await api.addInvestigationNote(selectedInv.id, {
        text: newNoteText.trim(),
        author: 'Lead Investigator (Active Session)',
        category: newNoteCategory
      });
      if (created) {
        const updatedInv = {
          ...selectedInv,
          notes: [created, ...selectedInv.notes]
        };
        setSelectedInv(updatedInv);
        setInvestigations(prev => prev.map(i => i.id === updatedInv.id ? updatedInv : i));
        setNewNoteText('');
      }
    } catch (err) {
      console.error('Failed to add note:', err);
    } finally {
      setIsSubmittingNote(false);
    }
  }

  async function handleUpdateStatus(newStatus: any) {
    if (!selectedInv) return;
    try {
      const updated = await api.updateInvestigationStatus(selectedInv.id, newStatus);
      if (updated) {
        setSelectedInv(updated);
        setInvestigations(prev => prev.map(i => i.id === updated.id ? updated : i));
      }
    } catch (err) {
      console.error('Failed to update status:', err);
    }
  }

  async function handleRecordOutcome(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedInv || !outcomeNotes.trim()) return;
    setIsSubmittingOutcome(true);
    try {
      const updated = await api.recordCaseOutcome(selectedInv.id, {
        outcome: selectedOutcome,
        resolutionNotes: outcomeNotes.trim(),
        adjustScrutiny: true
      });
      if (updated) {
        await loadInvestigations();
        const detail = await api.getInvestigationDetail(selectedInv.id);
        if (detail) setSelectedInv(detail);
        setIsOutcomeModalOpen(false);
        setOutcomeNotes('');
      }
    } catch (err) {
      console.error('Failed to record outcome:', err);
    } finally {
      setIsSubmittingOutcome(false);
    }
  }

  async function handleCreateInvestigation(e: React.FormEvent) {
    e.preventDefault();
    if (!newTitle.trim()) return;

    try {
      const entityList = newEntities.split(',').map(s => s.trim()).filter(Boolean);
      const created = await api.createInvestigation({
        title: newTitle.trim(),
        severity: newSeverity,
        leadAnalyst: newLead.trim(),
        summary: newSummary.trim() || 'Manual investigation triggered following anomalous telemetry observation.',
        involvedEntities: entityList,
        observedFacts: ['Investigation initiated manually by SOC forensic team'],
        hypotheses: ['Potential unauthorized access pending forensic review']
      });

      if (created) {
        setInvestigations([created, ...investigations]);
        setSelectedInv(created);
        setIsCreateModalOpen(false);
        setNewTitle('');
        setNewSummary('');
      }
    } catch (err) {
      console.error('Failed to create investigation:', err);
    }
  }

  const filteredInvs = investigations.filter(inv => {
    if (statusFilter !== 'ALL') {
      const s = String(inv.status).toUpperCase();
      if (statusFilter === 'OPEN' && !(s === 'NEW' || s === 'OPEN')) return false;
      if (statusFilter === 'UNDER_REVIEW' && !(s === 'IN PROGRESS' || s === 'UNDER REVIEW' || s === 'UNDER_REVIEW')) return false;
      if (statusFilter === 'ESCALATED' && !(s === 'NEEDS REVIEW' || s === 'ESCALATED')) return false;
      if (statusFilter === 'RESOLVED' && !s.includes('RESOLV')) return false;
    }
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      inv.id.toLowerCase().includes(q) ||
      inv.title.toLowerCase().includes(q) ||
      inv.involvedEntities.some(e => e.toLowerCase().includes(q))
    );
  });

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6 bg-[#0A0A0A] text-[#D8D8D8] animate-fade-in font-sans">
      {/* Editorial Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between border-b border-[#292929] pb-5 gap-4">
        <div>
          <div className="text-[11px] font-mono tracking-widest text-[#F2D35E] uppercase">
            Investigation Case Management
          </div>
          <h1 className="text-3xl md:text-4xl font-serif font-normal tracking-tight text-white mt-1">
            Security <span className="italic text-[#F2D35E]">Investigations</span>
          </h1>
          <p className="text-xs text-[#A0A0A0] mt-1 font-light max-w-2xl">
            Documented investigation cases, investigator notes, and formal case outcomes.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="px-3.5 py-1.5 bg-[#F2D35E] text-[#0A0A0A] hover:bg-[#FFE58A] transition-colors text-xs font-mono font-medium flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Create Case</span>
          </button>

          <button
            onClick={loadInvestigations}
            className="p-1.5 bg-[#171717] border border-[#292929] text-[#A0A0A0] hover:text-[#F2D35E] hover:border-[#F2D35E] transition-colors"
            title="Refresh Investigations"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 bg-[#111111] border border-[#292929] space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="relative flex-1 min-w-[260px]">
            <Search className="w-3.5 h-3.5 text-[#777777] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search cases by ID, title, or employee..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-1.5 bg-[#171717] border border-[#292929] text-xs font-mono text-white placeholder-[#777777] focus:outline-none focus:border-[#F2D35E]"
            />
          </div>

          <div className="flex items-center gap-2 font-mono text-xs">
            <span className="text-[#777777]">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-[#171717] border border-[#292929] px-2.5 py-1.5 text-white focus:outline-none focus:border-[#F2D35E]"
            >
              <option value="ALL">All Statuses</option>
              <option value="OPEN">Open</option>
              <option value="UNDER_REVIEW">Under Review</option>
              <option value="ESCALATED">Escalated</option>
              <option value="RESOLVED">Resolved</option>
            </select>
          </div>
        </div>
      </div>

      {/* Compact Cases Table */}
      <div className="bg-[#111111] border border-[#292929] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs font-mono">
            <thead>
              <tr className="border-b border-[#292929] bg-[#141414] text-[10px] text-[#777777] uppercase tracking-wider">
                <th className="py-3 px-4">Case ID</th>
                <th className="py-3 px-4">Title / Incident Focus</th>
                <th className="py-3 px-4">Employee / Target</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-center">Severity</th>
                <th className="py-3 px-4">Lead Investigator</th>
                <th className="py-3 px-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#222222]">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-[#777777]">
                    <RefreshCw className="w-4 h-4 text-[#F2D35E] animate-spin mx-auto mb-2" />
                    <span>Loading cases...</span>
                  </td>
                </tr>
              ) : filteredInvs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-[#777777]">
                    {investigations.length === 0 ? 'No active investigations' : 'No cases match the selected status filter.'}
                  </td>
                </tr>
              ) : (
                filteredInvs.map((inv) => {
                  const isCritical = inv.severity === 'CRITICAL';
                  const isHigh = inv.severity === 'HIGH';
                  const emp = inv.involvedEntities?.[0] || 'Unassigned';

                  return (
                    <tr
                      key={inv.id}
                      onClick={() => setSelectedInv(inv)}
                      className="hover:bg-[#161616] cursor-pointer transition-colors"
                    >
                      <td className="py-3 px-4 text-[#F2D35E] font-bold">
                        <div className="flex items-center gap-1.5">
                          <span>{inv.id}</span>
                        </div>
                      </td>

                      <td className="py-3 px-4 text-white font-medium max-w-xs">
                        <div className="truncate">{inv.title}</div>
                      </td>

                      <td className="py-3 px-4 text-[#CCCCCC]">
                        <span className="font-mono text-[11px] text-[#F2D35E]">{emp}</span>
                      </td>

                      <td className="py-3 px-4 text-center">
                        <span className={`px-2 py-0.5 text-[10px] font-bold border ${
                          String(inv.status).toUpperCase().includes('RESOLV')
                            ? 'bg-[#10B981]/10 text-[#10B981] border-[#10B981]/30'
                            : String(inv.status).toUpperCase().includes('ESCALAT')
                            ? 'bg-[#EF4444]/10 text-[#EF4444] border-[#EF4444]/30'
                            : 'bg-[#1E1E1E] text-white border-[#333333]'
                        }`}>
                          {inv.status}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-center">
                        <span className={`px-1.5 py-0.5 text-[9px] font-bold border ${
                          isCritical
                            ? 'bg-[#3D1414] text-[#FF7A7A] border-[#5E1E1E]'
                            : isHigh
                            ? 'bg-[#2E2812] text-[#F2D35E] border-[#52441A]'
                            : 'bg-[#141414] text-[#A0A0A0] border-[#292929]'
                        }`}>
                          {inv.severity}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-[#888888] text-[11px] truncate max-w-[150px]">
                        {inv.leadAnalyst}
                      </td>

                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedInv(inv);
                          }}
                          className="px-2.5 py-1 text-[11px] font-mono text-[#F2D35E] hover:bg-[#F2D35E] hover:text-[#0A0A0A] border border-[#52441A] transition-colors"
                        >
                          Open Case
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

      {/* On-Demand Opened Case Drawer / Modal */}
      {selectedInv && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in font-sans">
          <div className="bg-[#111111] border border-[#292929] max-w-3xl w-full p-6 space-y-5 text-xs text-[#D8D8D8] max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-[#222222] pb-4">
              <div>
                <div className="flex items-center gap-2 font-mono text-xs text-[#F2D35E]">
                  <span className="px-2 py-0.5 bg-[#1F1C12] border border-[#52441A] font-semibold">{selectedInv.id}</span>
                  <span className="text-[#777777]">Severity: {selectedInv.severity}</span>
                </div>
                <h2 className="text-xl font-serif text-white tracking-tight mt-1">
                  {selectedInv.title}
                </h2>
                <div className="text-[11px] text-[#A0A0A0] mt-1 font-mono">
                  Lead: <strong className="text-white">{selectedInv.leadAnalyst}</strong> • Target:{' '}
                  {selectedInv.involvedEntities.map((e, idx) => (
                    <button
                      key={e}
                      onClick={() => onNavigateToEntity(e)}
                      className="text-[#F2D35E] hover:underline underline-offset-2 ml-1"
                      title="Open employee investigation dossier"
                    >
                      {e}{idx < selectedInv.involvedEntities.length - 1 ? ',' : ''}
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={() => setSelectedInv(null)}
                className="p-1 text-[#777777] hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Case Summary */}
            <div className="p-3 bg-[#161616] border border-[#222222] space-y-1">
              <div className="text-[10px] uppercase font-mono text-[#777777]">Case Summary</div>
              <p className="text-xs text-[#CCCCCC] leading-relaxed">
                {selectedInv.summary}
              </p>
            </div>

            {/* Case Status & Workflow Update */}
            <div className="p-3 bg-[#141414] border border-[#222222] flex flex-wrap items-center justify-between gap-3 font-mono">
              <span className="text-[11px] text-[#A0A0A0]">Current Status: <strong className="text-white">{selectedInv.status}</strong></span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleUpdateStatus('Needs Review')}
                  className="px-2 py-1 bg-[#1C1C1C] border border-[#333333] text-[10px] text-white hover:border-[#F2D35E]"
                >
                  Needs Review
                </button>
                <button
                  onClick={() => handleUpdateStatus('In Progress')}
                  className="px-2 py-1 bg-[#2E2812] border border-[#52441A] text-[10px] text-[#F2D35E]"
                >
                  In Progress
                </button>
                <button
                  onClick={() => handleUpdateStatus('Resolved')}
                  className="px-2 py-1 bg-[#10B981]/10 border border-[#10B981]/30 text-[10px] text-[#10B981]"
                >
                  Resolve Case
                </button>
                <button
                  onClick={() => setIsOutcomeModalOpen(true)}
                  className="px-2.5 py-1 bg-[#F2D35E] text-[#0A0A0A] font-semibold text-[10px] hover:bg-[#FFE58A] transition-colors ml-1"
                >
                  Record Outcome
                </button>
              </div>
            </div>

            {/* Chronological Case Notes */}
            <div className="space-y-3">
              <div className="text-[10px] uppercase font-mono text-[#777777] font-bold">
                Case Notes & Timeline ({selectedInv.notes?.length || 0})
              </div>

              <div className="space-y-2 max-h-48 overflow-y-auto">
                {selectedInv.notes && selectedInv.notes.length > 0 ? (
                  selectedInv.notes.map((note) => (
                    <div key={note.id} className="p-2.5 bg-[#141414] border border-[#222222] space-y-1">
                      <div className="flex items-center justify-between text-[10px] font-mono text-[#777777]">
                        <span className="text-[#F2D35E] font-medium">{note.category}</span>
                        <span>{new Date(note.timestamp).toUTCString().slice(5, 22)}</span>
                      </div>
                      <p className="text-xs text-[#CCCCCC]">{note.text}</p>
                      <div className="text-[9px] text-[#555555] font-mono">— {note.author}</div>
                    </div>
                  ))
                ) : (
                  <div className="p-4 bg-[#141414] border border-[#222222] text-[#777777] text-center font-mono">
                    No notes recorded yet.
                  </div>
                )}
              </div>

              {/* Add Note Form */}
              <form onSubmit={handleAddNote} className="space-y-2 pt-2 border-t border-[#222222]">
                <div className="flex items-center justify-between text-[11px] font-mono">
                  <span className="text-[#A0A0A0]">Add Investigator Note:</span>
                  <select
                    value={newNoteCategory}
                    onChange={(e) => setNewNoteCategory(e.target.value as any)}
                    className="bg-[#171717] border border-[#2E2E2E] px-2 py-0.5 text-white text-[10px]"
                  >
                    <option value="OBSERVED_FACT">Observed Fact</option>
                    <option value="HYPOTHESIS">Hypothesis</option>
                    <option value="CORRELATION">Correlation</option>
                    <option value="CONCLUSION">Conclusion</option>
                  </select>
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Enter observation, finding, or case note..."
                    value={newNoteText}
                    onChange={(e) => setNewNoteText(e.target.value)}
                    className="flex-1 px-3 py-1.5 bg-[#171717] border border-[#2E2E2E] text-xs text-white placeholder-[#666666] focus:outline-none focus:border-[#F2D35E]"
                  />
                  <button
                    type="submit"
                    disabled={isSubmittingNote || !newNoteText.trim()}
                    className="px-3 py-1.5 bg-[#F2D35E] text-[#0A0A0A] font-mono font-medium text-xs hover:bg-[#FFE58A] transition-colors disabled:opacity-50"
                  >
                    Add
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Create New Case Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in font-sans">
          <div className="bg-[#111111] border border-[#292929] max-w-lg w-full p-6 space-y-4 text-xs text-[#D8D8D8]">
            <div className="flex items-center justify-between border-b border-[#222222] pb-3">
              <h2 className="text-base font-serif text-white">Create Investigation Case</h2>
              <button onClick={() => setIsCreateModalOpen(false)} className="text-[#777777] hover:text-white">✕</button>
            </div>

            <form onSubmit={handleCreateInvestigation} className="space-y-3 font-mono">
              <div>
                <label className="block text-[#A0A0A0] text-[11px] mb-1">Case Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Unusual USB Exfiltration During Off-Hours"
                  value={newTitle}
                  onChange={e => setNewTitle(e.target.value)}
                  className="w-full p-2 bg-[#171717] border border-[#292929] text-white focus:outline-none focus:border-[#F2D35E]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#A0A0A0] text-[11px] mb-1">Target Employee</label>
                  <input
                    type="text"
                    value={newEntities}
                    onChange={e => setNewEntities(e.target.value)}
                    className="w-full p-2 bg-[#171717] border border-[#292929] text-white focus:outline-none focus:border-[#F2D35E]"
                  />
                </div>
                <div>
                  <label className="block text-[#A0A0A0] text-[11px] mb-1">Priority</label>
                  <select
                    value={newSeverity}
                    onChange={e => setNewSeverity(e.target.value)}
                    className="w-full p-2 bg-[#171717] border border-[#292929] text-white focus:outline-none focus:border-[#F2D35E]"
                  >
                    <option value="CRITICAL">Critical</option>
                    <option value="HIGH">High</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="LOW">Low</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[#A0A0A0] text-[11px] mb-1">Summary Note</label>
                <textarea
                  rows={3}
                  value={newSummary}
                  onChange={e => setNewSummary(e.target.value)}
                  placeholder="Reason for opening this case..."
                  className="w-full p-2 bg-[#171717] border border-[#292929] text-white focus:outline-none focus:border-[#F2D35E]"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-3 py-1.5 bg-[#171717] border border-[#292929] text-[#A0A0A0] hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-[#F2D35E] text-[#0A0A0A] font-bold hover:bg-[#FFE58A]"
                >
                  Open Case
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Record Formal Outcome Modal */}
      {isOutcomeModalOpen && selectedInv && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in font-sans">
          <div className="bg-[#111111] border border-[#292929] max-w-lg w-full p-6 space-y-4 text-xs text-[#D8D8D8]">
            <div className="flex items-center justify-between border-b border-[#222222] pb-3">
              <div>
                <h2 className="text-base font-serif text-white">Record Formal Case Outcome</h2>
                <p className="text-[11px] text-[#888888] font-mono mt-0.5">Case: <span className="text-[#F2D35E]">{selectedInv.id}</span> — {selectedInv.title}</p>
              </div>
              <button onClick={() => setIsOutcomeModalOpen(false)} className="text-[#777777] hover:text-white">✕</button>
            </div>

            <form onSubmit={handleRecordOutcome} className="space-y-4 font-mono">
              <div>
                <label className="block text-[#A0A0A0] text-[11px] mb-1">Standard Investigation Outcome</label>
                <select
                  value={selectedOutcome}
                  onChange={e => setSelectedOutcome(e.target.value as any)}
                  className="w-full p-2 bg-[#171717] border border-[#292929] text-white focus:outline-none focus:border-[#F2D35E] text-xs"
                >
                  <option value="Resolved — Legitimate Activity">Resolved — Legitimate Activity (Verified Authorized / Benign)</option>
                  <option value="Potential Concern — Further Investigation Required">Potential Concern — Further Investigation Required (Retain Monitoring)</option>
                  <option value="Confirmed Incident — Evidence Reviewed">Confirmed Incident — Evidence Reviewed (Authorized Formal Finding)</option>
                </select>
                <p className="text-[10px] text-[#666666] mt-1">
                  Note: Legitimate Activity lowers scrutiny; Confirmed Incident elevates scrutiny to HIGH and marks linked alerts as CONFIRMED.
                </p>
              </div>

              <div>
                <label className="block text-[#A0A0A0] text-[11px] mb-1">Formal Resolution / Investigation Notes</label>
                <textarea
                  rows={4}
                  required
                  value={outcomeNotes}
                  onChange={e => setOutcomeNotes(e.target.value)}
                  placeholder="Document specific forensic rationale, management authorization reference, or evidentiary findings..."
                  className="w-full p-2.5 bg-[#171717] border border-[#292929] text-white focus:outline-none focus:border-[#F2D35E] text-xs leading-relaxed"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsOutcomeModalOpen(false)}
                  className="px-3 py-1.5 bg-[#171717] border border-[#292929] text-[#A0A0A0] hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingOutcome || !outcomeNotes.trim()}
                  className="px-4 py-1.5 bg-[#F2D35E] text-[#0A0A0A] font-bold hover:bg-[#FFE58A] disabled:opacity-50"
                >
                  {isSubmittingOutcome ? 'Saving Outcome...' : 'Commit Formal Outcome'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
