import React, { useState, useEffect } from 'react';
import {
  X,
  Fingerprint,
  AlertTriangle,
  ShieldAlert,
  Clock,
  FileText,
  Activity,
  CheckCircle2,
  HardDrive,
  User,
  Plus,
  Send,
  Lock,
  ChevronRight,
  RefreshCw,
  Sliders,
  Check
} from 'lucide-react';
import { api } from '../services/api';
import type {
  ScrutinyEmployeeRecord,
  ScrutinyLevel,
  CaseOutcome
} from '../types';

interface EmployeeInvestigationPanelProps {
  employeeId: string | null;
  onClose: () => void;
  onUpdate?: () => void;
  focusAlertId?: string;
}

export const EmployeeInvestigationPanel: React.FC<EmployeeInvestigationPanelProps> = ({
  employeeId,
  onClose,
  onUpdate,
  focusAlertId
}) => {
  const [profile, setProfile] = useState<ScrutinyEmployeeRecord | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'alerts' | 'evidence' | 'cases' | 'actions'>('overview');

  // Form states for Actions
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [actionSuccessMessage, setActionSuccessMessage] = useState<string | null>(null);

  // 1. Create Case Form
  const [newCaseTitle, setNewCaseTitle] = useState('');
  const [newCasePriority, setNewCasePriority] = useState<ScrutinyLevel>('MEDIUM');
  const [newCaseInitialNote, setNewCaseInitialNote] = useState('');
  const [newCaseNoteCategory, setNewCaseNoteCategory] = useState<'OBSERVED_FACT' | 'HYPOTHESIS' | 'CORRELATION' | 'CONCLUSION'>('OBSERVED_FACT');
  const [selectedAlertIds, setSelectedAlertIds] = useState<string[]>([]);

  // 2. Add Note Form
  const [selectedCaseIdForNote, setSelectedCaseIdForNote] = useState<string>('');
  const [noteText, setNoteText] = useState('');
  const [noteCategory, setNoteCategory] = useState<'OBSERVED_FACT' | 'HYPOTHESIS' | 'CORRELATION' | 'CONCLUSION'>('OBSERVED_FACT');

  // 3. Record Outcome Form
  const [selectedCaseIdForOutcome, setSelectedCaseIdForOutcome] = useState<string>('');
  const [selectedOutcome, setSelectedOutcome] = useState<CaseOutcome>('Resolved — Legitimate Activity');
  const [outcomeNotes, setOutcomeNotes] = useState('');
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  // 4. Scrutiny Override Modal/State
  const [showScrutinyModal, setShowScrutinyModal] = useState(false);
  const [overrideLevel, setOverrideLevel] = useState<ScrutinyLevel>('HIGH');
  const [overrideReason, setOverrideReason] = useState('');

  useEffect(() => {
    if (employeeId) {
      loadProfile(employeeId);
    } else {
      setProfile(null);
    }
  }, [employeeId]);

  useEffect(() => {
    if (focusAlertId) {
      setActiveTab('alerts');
    }
  }, [focusAlertId]);

  async function loadProfile(id: string) {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getScrutinyEmployee(id);
      const profileData: ScrutinyEmployeeRecord | null =
        (res && res.employeeId) ? res : (res && res.data && res.data.employeeId ? res.data : null);

      if (profileData) {
        setProfile(profileData);
        if (profileData.cases && profileData.cases.length > 0) {
          const firstOpen = profileData.cases.find((c: any) => c.status !== 'Resolved') || profileData.cases[0];
          setSelectedCaseIdForNote(firstOpen.id);
          setSelectedCaseIdForOutcome(firstOpen.id);
        }
        if (profileData.alerts && profileData.alerts.length > 0) {
          setSelectedAlertIds(profileData.alerts.map((a: any) => a.alert_id));
        }
      } else {
        setError(res?.error || 'Failed to load employee details');
      }
    } catch (err: any) {
      setError(err.message || 'Network error while fetching employee data');
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateCase(e: React.FormEvent) {
    e.preventDefault();
    if (!profile) return;
    setIsSubmitting(true);
    setActionSuccessMessage(null);
    try {
      const res = await api.createScrutinyCase(profile.employeeId, {
        title: newCaseTitle || `Investigation: Flagged Telemetry for ${profile.employeeId}`,
        priority: newCasePriority,
        linkedAlertIds: selectedAlertIds,
        initialNote: newCaseInitialNote,
        initialNoteCategory: newCaseNoteCategory
      });
      if (res.success) {
        setActionSuccessMessage(`Case ${res.data.id} created successfully.`);
        setNewCaseTitle('');
        setNewCaseInitialNote('');
        await loadProfile(profile.employeeId);
        setActiveTab('cases');
        onUpdate?.();
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleAddNote(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedCaseIdForNote || !noteText.trim()) return;
    setIsSubmitting(true);
    setActionSuccessMessage(null);
    try {
      const res = await api.addScrutinyCaseNote(selectedCaseIdForNote, {
        text: noteText,
        category: noteCategory
      });
      if (res.success) {
        setActionSuccessMessage(`Note added to ${selectedCaseIdForNote}.`);
        setNoteText('');
        if (profile) await loadProfile(profile.employeeId);
        setActiveTab('cases');
        onUpdate?.();
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleRecordOutcome() {
    if (!selectedCaseIdForOutcome || !outcomeNotes.trim()) return;
    setIsSubmitting(true);
    setActionSuccessMessage(null);
    setShowConfirmModal(false);
    try {
      const res = await api.recordCaseOutcome(selectedCaseIdForOutcome, {
        outcome: selectedOutcome,
        resolutionNotes: outcomeNotes,
        adjustScrutiny: true
      });
      if (res.success) {
        setActionSuccessMessage(`Outcome recorded for ${selectedCaseIdForOutcome}.`);
        setOutcomeNotes('');
        if (profile) await loadProfile(profile.employeeId);
        setActiveTab('cases');
        onUpdate?.();
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleAdjustScrutiny(e: React.FormEvent) {
    e.preventDefault();
    if (!profile || !overrideReason.trim()) return;
    setIsSubmitting(true);
    setActionSuccessMessage(null);
    try {
      const res = await api.adjustEmployeeScrutiny(profile.employeeId, {
        newLevel: overrideLevel,
        reason: overrideReason
      });
      if (res.success) {
        setActionSuccessMessage(`Scrutiny updated to ${overrideLevel}.`);
        setShowScrutinyModal(false);
        setOverrideReason('');
        await loadProfile(profile.employeeId);
        onUpdate?.();
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!employeeId) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden flex justify-end bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-2xl bg-[#0F0F0F] border-l border-[#292929] flex flex-col h-full shadow-2xl text-[#D8D8D8]">
        {/* Top Header Bar */}
        <div className="p-5 border-b border-[#292929] bg-[#141414] flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 bg-[#1A1A1A] border border-[#2E2E2E] flex items-center justify-center">
              <Fingerprint className="w-5 h-5 text-[#F2D35E]" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-mono text-base font-bold text-white tracking-wide">
                  {employeeId}
                </span>
                {profile && (
                  <span
                    className={`text-[10px] px-2 py-0.5 border font-mono font-medium ${
                      profile.scrutinyLevel === 'HIGH'
                        ? 'border-[#EF4444]/40 bg-[#EF4444]/10 text-[#EF4444]'
                        : profile.scrutinyLevel === 'MEDIUM'
                        ? 'border-[#F2D35E]/40 bg-[#F2D35E]/10 text-[#F2D35E]'
                        : 'border-[#10B981]/40 bg-[#10B981]/10 text-[#10B981]'
                    }`}
                  >
                    {profile.scrutinyLevel} SCRUTINY
                  </span>
                )}
              </div>
              <p className="text-[11px] text-[#777777] font-mono mt-0.5">
                CyberDNA Forensic Dossier & Case Management
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowScrutinyModal(true)}
              className="px-2.5 py-1 text-[11px] font-mono bg-[#1A1A1A] hover:bg-[#242424] text-[#EEEEEE] border border-[#2E2E2E] flex items-center space-x-1"
              title="Manually override scrutiny level"
            >
              <Sliders className="w-3 h-3 text-[#F2D35E]" />
              <span>Adjust Scrutiny</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-[#777777] hover:text-white hover:bg-[#1F1F1F] rounded transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Action / Success Banner */}
        {actionSuccessMessage && (
          <div className="p-3 bg-[#171717] border-b border-[#F2D35E]/30 text-xs text-[#F2D35E] flex items-center justify-between">
            <span className="font-mono">{actionSuccessMessage}</span>
            <button onClick={() => setActionSuccessMessage(null)} className="text-[#888888] hover:text-white">✕</button>
          </div>
        )}

        {/* Error Banner */}
        {error && (
          <div className="p-3 bg-[#2A1515] border-b border-[#EF4444]/40 text-xs text-[#EF4444] flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="text-[#888888] hover:text-white">✕</button>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="flex border-b border-[#292929] bg-[#111111] px-5 text-xs font-mono shrink-0">
          <button
            onClick={() => setActiveTab('overview')}
            className={`py-3 px-3.5 border-b-2 transition-colors ${
              activeTab === 'overview'
                ? 'border-[#F2D35E] text-[#F2D35E] font-medium'
                : 'border-transparent text-[#777777] hover:text-[#D8D8D8]'
            }`}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveTab('alerts')}
            className={`py-3 px-3.5 border-b-2 transition-colors flex items-center space-x-1.5 ${
              activeTab === 'alerts'
                ? 'border-[#F2D35E] text-[#F2D35E] font-medium'
                : 'border-transparent text-[#777777] hover:text-[#D8D8D8]'
            }`}
          >
            <span>Alerts</span>
            {profile && profile.totalAlerts > 0 && (
              <span className="px-1.5 py-0.2 bg-[#F2D35E]/20 text-[#F2D35E] text-[10px] rounded-full">
                {profile.totalAlerts}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('evidence')}
            className={`py-3 px-3.5 border-b-2 transition-colors ${
              activeTab === 'evidence'
                ? 'border-[#F2D35E] text-[#F2D35E] font-medium'
                : 'border-transparent text-[#777777] hover:text-[#D8D8D8]'
            }`}
          >
            Evidence Timeline
          </button>
          <button
            onClick={() => setActiveTab('cases')}
            className={`py-3 px-3.5 border-b-2 transition-colors flex items-center space-x-1.5 ${
              activeTab === 'cases'
                ? 'border-[#F2D35E] text-[#F2D35E] font-medium'
                : 'border-transparent text-[#777777] hover:text-[#D8D8D8]'
            }`}
          >
            <span>Cases</span>
            {profile && profile.cases.length > 0 && (
              <span className="px-1.5 py-0.2 bg-[#292929] text-[#EEEEEE] text-[10px] rounded-full">
                {profile.cases.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('actions')}
            className={`py-3 px-3.5 border-b-2 transition-colors ${
              activeTab === 'actions'
                ? 'border-[#F2D35E] text-[#F2D35E] font-medium'
                : 'border-transparent text-[#777777] hover:text-[#D8D8D8]'
            }`}
          >
            Actions
          </button>
        </div>

        {/* Scrollable Body Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center space-y-3 text-xs font-mono text-[#777777]">
              <RefreshCw className="w-5 h-5 text-[#F2D35E] animate-spin" />
              <span>Loading forensic profile from CERT r4.2 telemetry...</span>
            </div>
          ) : !profile ? (
            <div className="p-8 text-center text-xs font-mono space-y-4 bg-[#141414] border border-[#292929]">
              <div className="text-[#EF4444] font-bold">
                {error || `Employee profile "${employeeId}" not found in processed dataset.`}
              </div>
              <p className="text-[#A0A0A0] text-[11px] max-w-md mx-auto">
                The requested identifier could not be resolved in the local CERT r4.2 analytical index.
              </p>
              {focusAlertId && (
                <div className="p-3 bg-[#1A1A1A] border border-[#333333] text-left max-w-md mx-auto">
                  <div className="text-[10px] text-[#F2D35E] uppercase font-bold">Preserved Security Alert</div>
                  <div className="text-white text-xs mt-1">Alert ID: <span className="font-mono text-[#F2D35E]">{focusAlertId}</span></div>
                  <div className="text-[#888888] text-[10px] mt-1">
                    The originating alert reference remains recorded in security telemetry even if the corresponding user profile metadata is missing or quarantined.
                  </div>
                </div>
              )}
            </div>
          ) : (
            <>
              {/* TAB 1: OVERVIEW */}
              {activeTab === 'overview' && (
                <div className="space-y-6">
                  {/* Scrutiny Policy Explanation Card */}
                  <div className="p-4 bg-[#141414] border border-[#292929] space-y-2">
                    <div className="text-[11px] font-mono uppercase text-[#F2D35E] tracking-wider flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <ShieldAlert className="w-3.5 h-3.5" />
                        <span>Current Scrutiny Classification</span>
                      </div>
                      <span className="text-[9px] px-1.5 py-0.5 border border-[#333333] bg-[#1A1A1A] text-[#A0A0A0]">
                        CERT r4.2 Benchmark
                      </span>
                    </div>
                    <p className="text-xs text-[#EEEEEE] leading-relaxed">
                      {profile.scrutinyExplanation}
                    </p>
                    <div className="text-[10px] font-mono text-[#777777] border-t border-[#222222] pt-2">
                      Notice: Scrutiny levels represent triage prioritization. They do not constitute proof of guilt or malicious intent.
                    </div>
                  </div>

                  {/* Operational Telemetry Summary Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono">
                    <div className="p-3 bg-[#141414] border border-[#222222]">
                      <div className="text-[10px] text-[#777777] uppercase">Total Alerts</div>
                      <div className="text-xl font-bold text-[#F2D35E] mt-1">{profile.totalAlerts}</div>
                    </div>
                    <div className="p-3 bg-[#141414] border border-[#222222]">
                      <div className="text-[10px] text-[#777777] uppercase">Open Cases</div>
                      <div className="text-xl font-bold text-white mt-1">{profile.openCasesCount}</div>
                    </div>
                    <div className="p-3 bg-[#141414] border border-[#222222]">
                      <div className="text-[10px] text-[#777777] uppercase">Resolved Cases</div>
                      <div className="text-xl font-bold text-white mt-1">{profile.resolvedCasesCount}</div>
                    </div>
                    <div className="p-3 bg-[#141414] border border-[#222222]">
                      <div className="text-[10px] text-[#777777] uppercase">Distinct Hosts</div>
                      <div className="text-xl font-bold text-white mt-1">{profile.activityTotals.distinctPcs}</div>
                    </div>
                  </div>

                  {/* 18-Month Activity Metrics */}
                  <div className="p-4 bg-[#141414] border border-[#292929] space-y-3">
                    <div className="text-xs font-mono font-medium text-white uppercase tracking-wider flex items-center justify-between">
                      <span>Baseline Activity Aggregates (18 Months)</span>
                      <span className="text-[10px] text-[#777777]">{profile.activityTotals.totalEvents.toLocaleString()} total events</span>
                    </div>
                    <div className="grid grid-cols-2 gap-y-2.5 gap-x-4 text-xs font-mono">
                      <div className="flex justify-between border-b border-[#222222] pb-1">
                        <span className="text-[#888888]">Standard Logons:</span>
                        <span className="text-white">{profile.activityTotals.totalLogons}</span>
                      </div>
                      <div className="flex justify-between border-b border-[#222222] pb-1">
                        <span className="text-[#888888]">Off-Hours Logons:</span>
                        <span className={profile.activityTotals.offHoursLogons > 0 ? (profile.activityTotals.offHoursLogons >= 50 ? 'text-[#F2D35E] font-bold' : 'text-white') : 'text-[#666666]'}>
                          {profile.activityTotals.offHoursLogons > 0 ? profile.activityTotals.offHoursLogons : '0 (None recorded)'}
                        </span>
                      </div>
                      <div className="flex justify-between border-b border-[#222222] pb-1">
                        <span className="text-[#888888]">USB Connections:</span>
                        <span className={profile.activityTotals.usbConnects > 0 ? (profile.activityTotals.usbConnects >= 2000 ? 'text-[#F2D35E] font-bold' : 'text-white') : 'text-[#666666]'}>
                          {profile.activityTotals.usbConnects > 0 ? profile.activityTotals.usbConnects : '0 (None recorded)'}
                        </span>
                      </div>
                      <div className="flex justify-between border-b border-[#222222] pb-1">
                        <span className="text-[#888888]">Removable File Copies:</span>
                        <span className={profile.activityTotals.fileCopies > 0 ? (profile.activityTotals.fileCopies >= 3000 ? 'text-[#F2D35E] font-bold' : 'text-white') : 'text-[#666666]'}>
                          {profile.activityTotals.fileCopies > 0 ? profile.activityTotals.fileCopies : '0 (None recorded)'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Scrutiny Transition History Timeline */}
                  <div className="space-y-3">
                    <div className="text-xs font-mono font-medium text-white uppercase tracking-wider">
                      Scrutiny Change History & Audit Trail
                    </div>
                    <div className="space-y-2 font-mono text-xs">
                      {profile.scrutinyHistory.map((h, i) => (
                        <div key={h.id || i} className="p-3 bg-[#141414] border border-[#222222] flex items-start justify-between">
                          <div className="space-y-1">
                            <div className="flex items-center space-x-2">
                              <span className="text-[#777777]">{h.previousLevel}</span>
                              <ChevronRight className="w-3 h-3 text-[#F2D35E]" />
                              <span className="text-[#F2D35E] font-bold">{h.newLevel}</span>
                              {h.isManual && (
                                <span className="px-1.5 py-0.2 text-[9px] bg-[#2E2812] text-[#F2D35E] border border-[#52441A]">
                                  MANUAL OVERRIDE
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-[#A0A0A0]">{h.reason}</p>
                          </div>
                          <div className="text-right text-[10px] text-[#666666] shrink-0">
                            <div>{h.timestamp ? new Date(h.timestamp).toLocaleDateString() : 'Initial'}</div>
                            <div>by {h.actor}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: ALERTS */}
              {activeTab === 'alerts' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono uppercase tracking-wider text-white">
                      Explaining Behavioral Alerts ({profile.alerts.length})
                    </span>
                    <button
                      onClick={() => setActiveTab('actions')}
                      className="px-2.5 py-1 text-xs font-mono bg-[#F2D35E] text-[#0A0A0A] font-medium flex items-center space-x-1"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Create Case from Alert</span>
                    </button>
                  </div>

                  {profile.alerts.length === 0 ? (
                    <div className="p-8 text-center text-xs font-mono text-[#777777] bg-[#141414] border border-[#222222]">
                      No anomalous alerts recorded for {profile.employeeId}.
                    </div>
                  ) : (
                    profile.alerts.map(a => {
                      const isFocused = focusAlertId === a.alert_id;
                      return (
                        <div
                          key={a.alert_id}
                          className={`p-4 bg-[#141414] border transition-colors space-y-2.5 ${
                            isFocused
                              ? 'border-[#F2D35E] bg-[#1C1A14]'
                              : 'border-[#292929] hover:border-[#383838]'
                          }`}
                        >
                          <div className="flex items-center justify-between text-xs font-mono">
                            <div className="flex items-center space-x-2">
                              <span className="font-bold text-white">{a.alert_id}</span>
                              <span
                                className={`text-[10px] px-1.5 py-0.2 border ${
                                  a.severity === 'HIGH'
                                    ? 'border-[#EF4444]/40 bg-[#EF4444]/10 text-[#EF4444]'
                                    : 'border-[#F2D35E]/40 bg-[#F2D35E]/10 text-[#F2D35E]'
                                }`}
                              >
                                {a.severity}
                              </span>
                              <span className="text-[#A0A0A0]">{a.alert_type}</span>
                            </div>
                            <span
                              className={`text-[10px] px-2 py-0.5 border ${
                                a.review_status === 'RESOLVED'
                                  ? 'border-[#10B981]/40 bg-[#10B981]/10 text-[#10B981]'
                                  : a.review_status === 'CONFIRMED'
                                  ? 'border-[#EF4444]/40 bg-[#EF4444]/10 text-[#EF4444]'
                                  : a.review_status === 'UNDER_REVIEW'
                                  ? 'border-[#F2D35E]/40 bg-[#F2D35E]/10 text-[#F2D35E]'
                                  : 'border-[#444444] bg-[#1F1F1F] text-[#888888]'
                              }`}
                            >
                              {a.review_status}
                            </span>
                          </div>

                          <p className="text-xs text-[#D8D8D8] leading-relaxed">
                            {a.trigger_reason}
                          </p>

                          <div className="flex items-center justify-between text-[11px] font-mono text-[#777777] border-t border-[#222222] pt-2">
                            <span>
                              Metric: <strong className="text-white">{a.metric_name}</strong> = {a.metric_value} (Threshold: {a.threshold})
                            </span>
                            {a.linked_case_id ? (
                              <span className="text-[#F2D35E]">Linked: {a.linked_case_id}</span>
                            ) : (
                              <span className="text-[#555555]">Unlinked</span>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}

              {/* TAB 3: EVIDENCE TIMELINE */}
              {activeTab === 'evidence' && (
                <div className="space-y-4">
                  <div className="p-3 bg-[#141414] border border-[#292929] text-xs text-[#A0A0A0]">
                    <strong className="text-white">Telemetry Separation Principle:</strong> The table below displays verified factual events captured across logon, removable device, and file copy logs, separated strictly from forensic hypotheses.
                  </div>

                  <div className="space-y-3 font-mono text-xs">
                    <div className="p-3 bg-[#141414] border border-[#222222] space-y-1">
                      <div className="text-[10px] text-[#777777] uppercase">Active Period (Telemetry Span)</div>
                      <div className="text-white">
                        {profile.activityTotals.firstActivity
                          ? `${new Date(profile.activityTotals.firstActivity).toLocaleString()} — ${new Date(profile.activityTotals.lastActivity!).toLocaleString()}`
                          : 'Full 18-month CERT r4.2 cycle'}
                      </div>
                    </div>

                    <div className="p-3 bg-[#141414] border border-[#222222] space-y-2">
                      <div className="text-[10px] text-[#777777] uppercase">Removable Storage (USB) Verification</div>
                      <div className="flex justify-between text-xs border-b border-[#1E1E1E] pb-1">
                        <span className="text-[#888888]">Connect Events:</span>
                        <span className="text-white">{profile.activityTotals.usbConnects}</span>
                      </div>
                      <div className="flex justify-between text-xs border-b border-[#1E1E1E] pb-1">
                        <span className="text-[#888888]">Disconnect Events:</span>
                        <span className="text-white">{profile.activityTotals.usbDisconnects}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-[#888888]">Files Staged / Copied to Portable Media:</span>
                        <span className="text-white">{profile.activityTotals.fileCopies}</span>
                      </div>
                    </div>

                    <div className="p-3 bg-[#141414] border border-[#222222] space-y-2">
                      <div className="text-[10px] text-[#777777] uppercase">Authentication & Working Hours Schedule</div>
                      <div className="flex justify-between text-xs border-b border-[#1E1E1E] pb-1">
                        <span className="text-[#888888]">Working Window Schedule:</span>
                        <span className="text-white">07:00 – 19:00 Mon-Fri</span>
                      </div>
                      <div className="flex justify-between text-xs border-b border-[#1E1E1E] pb-1">
                        <span className="text-[#888888]">In-Hours Logons:</span>
                        <span className="text-white">
                          {profile.activityTotals.totalLogons - profile.activityTotals.offHoursLogons}
                        </span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-[#888888]">Out-of-Hours Authenticative Logons:</span>
                        <span className={`font-bold ${profile.activityTotals.offHoursLogons > 0 ? 'text-[#F2D35E]' : 'text-white'}`}>
                          {profile.activityTotals.offHoursLogons}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 4: CASES */}
              {activeTab === 'cases' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono uppercase tracking-wider text-white">
                      Investigation Cases ({profile.cases.length})
                    </span>
                    <button
                      onClick={() => setActiveTab('actions')}
                      className="px-2.5 py-1 text-xs font-mono bg-[#F2D35E] text-[#0A0A0A] font-medium flex items-center space-x-1"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>New Investigation</span>
                    </button>
                  </div>

                  {profile.cases.length === 0 ? (
                    <div className="p-8 text-center text-xs font-mono text-[#777777] bg-[#141414] border border-[#222222]">
                      No active or historical investigation cases for this employee.
                    </div>
                  ) : (
                    profile.cases.map(c => (
                      <div key={c.id} className="p-4 bg-[#141414] border border-[#292929] space-y-3 font-mono">
                        <div className="flex items-center justify-between text-xs">
                          <div className="flex items-center space-x-2">
                            <span className="font-bold text-white">{c.id}</span>
                            <span
                              className={`text-[10px] px-2 py-0.5 border ${
                                c.status === 'Resolved'
                                  ? 'border-[#10B981]/40 bg-[#10B981]/10 text-[#10B981]'
                                  : 'border-[#F2D35E]/40 bg-[#F2D35E]/10 text-[#F2D35E]'
                              }`}
                            >
                              {c.status}
                            </span>
                            <span className="text-[#A0A0A0]">Priority: {c.priority}</span>
                          </div>
                          <span className="text-[10px] text-[#666666]">
                            Created {new Date(c.createdAt).toLocaleDateString()}
                          </span>
                        </div>

                        <div className="text-xs text-white font-sans font-medium">{c.title}</div>

                        {c.outcome && (
                          <div className="p-2.5 bg-[#1A1A1A] border border-[#333333] text-xs space-y-1">
                            <div className="text-[10px] text-[#F2D35E] uppercase font-bold">
                              Formal Resolution Outcome
                            </div>
                            <div className="text-white font-medium">{c.outcome}</div>
                            {c.resolutionNotes && (
                              <p className="text-[11px] text-[#A0A0A0] italic">
                                "{c.resolutionNotes}"
                              </p>
                            )}
                          </div>
                        )}

                        {c.notes && c.notes.length > 0 && (
                          <div className="space-y-1.5 border-t border-[#222222] pt-2">
                            <span className="text-[10px] text-[#777777] uppercase">Case Notes ({c.notes.length})</span>
                            {c.notes.map(n => (
                              <div key={n.id} className="p-2 bg-[#0F0F0F] border border-[#1E1E1E] text-[11px]">
                                <div className="flex justify-between text-[10px] text-[#666666] mb-1">
                                  <span className="text-[#F2D35E] font-medium">[{n.category}] {n.author}</span>
                                  <span>{new Date(n.timestamp).toLocaleTimeString()}</span>
                                </div>
                                <p className="text-[#D8D8D8] font-sans">{n.text}</p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* TAB 5: ACTIONS */}
              {activeTab === 'actions' && (
                <div className="space-y-6">
                  {/* Action 1: Create Case Form */}
                  <form onSubmit={handleCreateCase} className="p-4 bg-[#141414] border border-[#292929] space-y-3 font-mono text-xs">
                    <div className="text-xs font-bold text-white uppercase tracking-wider flex items-center space-x-2">
                      <Plus className="w-4 h-4 text-[#F2D35E]" />
                      <span>Initiate New Investigation Case</span>
                    </div>

                    <div>
                      <label className="text-[10px] text-[#888888] uppercase block mb-1">Case Title</label>
                      <input
                        type="text"
                        placeholder="e.g. Inquiry into high-volume after-hours USB transfers"
                        value={newCaseTitle}
                        onChange={e => setNewCaseTitle(e.target.value)}
                        className="w-full bg-[#1A1A1A] border border-[#2E2E2E] px-3 py-1.5 text-xs text-white focus:outline-none focus:border-[#F2D35E]"
                        required
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[10px] text-[#888888] uppercase block mb-1">Priority</label>
                        <select
                          value={newCasePriority}
                          onChange={e => setNewCasePriority(e.target.value as any)}
                          className="w-full bg-[#1A1A1A] border border-[#2E2E2E] px-3 py-1.5 text-xs text-white focus:outline-none focus:border-[#F2D35E]"
                        >
                          <option value="LOW">LOW</option>
                          <option value="MEDIUM">MEDIUM</option>
                          <option value="HIGH">HIGH</option>
                        </select>
                      </div>

                      <div>
                        <label className="text-[10px] text-[#888888] uppercase block mb-1">Note Category</label>
                        <select
                          value={newCaseNoteCategory}
                          onChange={e => setNewCaseNoteCategory(e.target.value as any)}
                          className="w-full bg-[#1A1A1A] border border-[#2E2E2E] px-3 py-1.5 text-xs text-white focus:outline-none focus:border-[#F2D35E]"
                        >
                          <option value="OBSERVED_FACT">Observed Fact</option>
                          <option value="HYPOTHESIS">Hypothesis</option>
                          <option value="CORRELATION">Correlation</option>
                          <option value="CONCLUSION">Conclusion</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] text-[#888888] uppercase block mb-1">Initial Case Note</label>
                      <textarea
                        rows={2}
                        placeholder="Document initial observed reasons for opening inquiry..."
                        value={newCaseInitialNote}
                        onChange={e => setNewCaseInitialNote(e.target.value)}
                        className="w-full bg-[#1A1A1A] border border-[#2E2E2E] p-2 text-xs text-white focus:outline-none focus:border-[#F2D35E]"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="px-4 py-2 bg-[#F2D35E] hover:bg-[#E5C550] text-[#0A0A0A] font-bold text-xs transition-colors disabled:opacity-50"
                    >
                      {isSubmitting ? 'Creating Case...' : 'Create Case & Begin Investigation'}
                    </button>
                  </form>

                  {/* Action 2: Record Outcome Form */}
                  {profile.cases.length > 0 && (
                    <div className="p-4 bg-[#141414] border border-[#292929] space-y-3 font-mono text-xs">
                      <div className="text-xs font-bold text-white uppercase tracking-wider flex items-center space-x-2">
                        <CheckCircle2 className="w-4 h-4 text-[#F2D35E]" />
                        <span>Record Investigation Outcome</span>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-[10px] text-[#888888] uppercase block mb-1">Target Case</label>
                          <select
                            value={selectedCaseIdForOutcome}
                            onChange={e => setSelectedCaseIdForOutcome(e.target.value)}
                            className="w-full bg-[#1A1A1A] border border-[#2E2E2E] px-3 py-1.5 text-xs text-white focus:outline-none focus:border-[#F2D35E]"
                          >
                            {profile.cases.map(c => (
                              <option key={c.id} value={c.id}>
                                {c.id} ({c.status})
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="text-[10px] text-[#888888] uppercase block mb-1">Outcome</label>
                          <select
                            value={selectedOutcome}
                            onChange={e => setSelectedOutcome(e.target.value as any)}
                            className="w-full bg-[#1A1A1A] border border-[#2E2E2E] px-3 py-1.5 text-xs text-white focus:outline-none focus:border-[#F2D35E]"
                          >
                            <option value="Resolved — Legitimate Activity">Resolved — Legitimate Activity</option>
                            <option value="Potential Concern — Further Investigation Required">Potential Concern — Further Investigation Required</option>
                            <option value="Confirmed Incident — Evidence Reviewed">Confirmed Incident — Evidence Reviewed</option>
                          </select>
                        </div>
                      </div>

                      <div>
                        <label className="text-[10px] text-[#888888] uppercase block mb-1">Resolution Findings & Audit Notes</label>
                        <textarea
                          rows={3}
                          placeholder="Document verifiable findings leading to this outcome..."
                          value={outcomeNotes}
                          onChange={e => setOutcomeNotes(e.target.value)}
                          className="w-full bg-[#1A1A1A] border border-[#2E2E2E] p-2 text-xs text-white focus:outline-none focus:border-[#F2D35E]"
                          required
                        />
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          if (selectedOutcome === 'Confirmed Incident — Evidence Reviewed') {
                            setShowConfirmModal(true);
                          } else {
                            handleRecordOutcome();
                          }
                        }}
                        disabled={isSubmitting || !outcomeNotes.trim()}
                        className="px-4 py-2 bg-[#1A1A1A] hover:bg-[#252525] text-[#EEEEEE] border border-[#333333] font-bold text-xs transition-colors disabled:opacity-50"
                      >
                        {isSubmitting ? 'Recording...' : 'Record Outcome'}
                      </button>
                    </div>
                  )}

                  {/* Action 3: Add Note Form */}
                  {profile.cases.length > 0 && (
                    <form onSubmit={handleAddNote} className="p-4 bg-[#141414] border border-[#292929] space-y-3 font-mono text-xs">
                      <div className="text-xs font-bold text-white uppercase tracking-wider flex items-center space-x-2">
                        <FileText className="w-4 h-4 text-[#F2D35E]" />
                        <span>Add Case Note</span>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-[10px] text-[#888888] uppercase block mb-1">Target Case</label>
                          <select
                            value={selectedCaseIdForNote}
                            onChange={e => setSelectedCaseIdForNote(e.target.value)}
                            className="w-full bg-[#1A1A1A] border border-[#2E2E2E] px-3 py-1.5 text-xs text-white focus:outline-none focus:border-[#F2D35E]"
                          >
                            {profile.cases.map(c => (
                              <option key={c.id} value={c.id}>
                                {c.id} ({c.status})
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="text-[10px] text-[#888888] uppercase block mb-1">Category</label>
                          <select
                            value={noteCategory}
                            onChange={e => setNoteCategory(e.target.value as any)}
                            className="w-full bg-[#1A1A1A] border border-[#2E2E2E] px-3 py-1.5 text-xs text-white focus:outline-none focus:border-[#F2D35E]"
                          >
                            <option value="OBSERVED_FACT">Observed Fact</option>
                            <option value="HYPOTHESIS">Hypothesis</option>
                            <option value="CORRELATION">Correlation</option>
                            <option value="CONCLUSION">Conclusion</option>
                          </select>
                        </div>
                      </div>

                      <div>
                        <label className="text-[10px] text-[#888888] uppercase block mb-1">Note Content</label>
                        <textarea
                          rows={2}
                          placeholder="Type forensic note..."
                          value={noteText}
                          onChange={e => setNoteText(e.target.value)}
                          className="w-full bg-[#1A1A1A] border border-[#2E2E2E] p-2 text-xs text-white focus:outline-none focus:border-[#F2D35E]"
                          required
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={isSubmitting || !noteText.trim()}
                        className="px-4 py-2 bg-[#1A1A1A] hover:bg-[#252525] text-white border border-[#333333] font-bold text-xs transition-colors disabled:opacity-50"
                      >
                        {isSubmitting ? 'Saving Note...' : 'Add Note'}
                      </button>
                    </form>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Confirmation Modal for Confirmed Incident */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-60 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#141414] border border-[#EF4444] p-6 max-w-md w-full space-y-4 shadow-2xl text-xs font-mono">
            <div className="flex items-center space-x-2 text-[#EF4444] font-bold text-sm">
              <ShieldAlert className="w-5 h-5 shrink-0" />
              <span>Confirm Malicious Insider Incident</span>
            </div>
            <p className="text-[#D8D8D8] leading-relaxed">
              Recording this outcome will formally classify this employee under <strong>HIGH SCRUTINY</strong> and mark the forensic case as an evidentiary-supported incident.
            </p>
            <p className="text-[11px] text-[#888888] italic">
              "Machine alerts alone must never confirm an insider incident. This action must reflect human forensic corroboration."
            </p>
            <div className="flex justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="px-3 py-1.5 bg-[#222222] text-[#EEEEEE] hover:bg-[#2B2B2B]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRecordOutcome}
                className="px-3 py-1.5 bg-[#EF4444] text-white font-bold hover:bg-[#DC2626]"
              >
                Confirm Formal Incident
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manual Scrutiny Override Modal */}
      {showScrutinyModal && (
        <div className="fixed inset-0 z-60 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <form onSubmit={handleAdjustScrutiny} className="bg-[#141414] border border-[#292929] p-6 max-w-md w-full space-y-4 shadow-2xl text-xs font-mono">
            <div className="flex items-center justify-between text-white font-bold text-sm border-b border-[#222222] pb-2">
              <span className="flex items-center space-x-2">
                <Sliders className="w-4 h-4 text-[#F2D35E]" />
                <span>Adjust Scrutiny Level: {employeeId}</span>
              </span>
              <button type="button" onClick={() => setShowScrutinyModal(false)} className="text-[#777777] hover:text-white">✕</button>
            </div>

            <div>
              <label className="text-[10px] text-[#888888] uppercase block mb-1">New Scrutiny Level</label>
              <select
                value={overrideLevel}
                onChange={e => setOverrideLevel(e.target.value as any)}
                className="w-full bg-[#1A1A1A] border border-[#2E2E2E] px-3 py-1.5 text-xs text-white focus:outline-none focus:border-[#F2D35E]"
              >
                <option value="LOW">LOW</option>
                <option value="MEDIUM">MEDIUM</option>
                <option value="HIGH">HIGH</option>
              </select>
            </div>

            <div>
              <label className="text-[10px] text-[#888888] uppercase block mb-1">Audited Justification (Mandatory)</label>
              <textarea
                rows={3}
                placeholder="State verified operational reason for overriding scrutiny..."
                value={overrideReason}
                onChange={e => setOverrideReason(e.target.value)}
                className="w-full bg-[#1A1A1A] border border-[#2E2E2E] p-2 text-xs text-white focus:outline-none focus:border-[#F2D35E]"
                required
              />
            </div>

            <div className="flex justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setShowScrutinyModal(false)}
                className="px-3 py-1.5 bg-[#222222] text-[#EEEEEE] hover:bg-[#2B2B2B]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || !overrideReason.trim()}
                className="px-3 py-1.5 bg-[#F2D35E] text-[#0A0A0A] font-bold hover:bg-[#E5C550] disabled:opacity-50"
              >
                Apply Override
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
