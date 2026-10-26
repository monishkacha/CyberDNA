import {
  EmployeeSummary,
  EntitySummary,
  Device,
  ThreatFinding,
  BehavioralProfile,
  ActivityEvent,
  SecurityEvent,
  Investigation,
  InvestigationNote,
  GraphNode,
  GraphEdge,
  DataSourceMeta
} from '../types';

const API_BASE = 'http://localhost:3001/api';

async function fetchJson<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${endpoint}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(options?.headers || {})
    },
    ...options
  });
  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`API error (${res.status}): ${errorText}`);
  }
  const json = await res.json();
  return json.data !== undefined ? json.data : json;
}

async function fetchRawJson<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${endpoint}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(options?.headers || {})
    },
    ...options
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    return {
      success: false,
      error: json.error || `HTTP ${res.status}: ${res.statusText}`,
      status: res.status
    } as any;
  }
  return json;
}

export const api = {
  async getOverviewStats() {
    return fetchJson<any>('/stats/overview');
  },

  async getEmployees(params?: { department?: string; anomalous?: boolean; search?: string }) {
    const q = new URLSearchParams();
    if (params?.department) q.set('department', params.department);
    if (params?.anomalous !== undefined) q.set('anomalous', String(params.anomalous));
    if (params?.search) q.set('search', params.search);
    return fetchJson<EmployeeSummary[]>(`/employees?${q.toString()}`);
  },

  async getEmployeeDetail(id: string) {
    return fetchJson<{ employee: EmployeeSummary; entity: EmployeeSummary; profile?: BehavioralProfile; findings?: ThreatFinding[] }>(`/employees/${encodeURIComponent(id)}`);
  },

  // Alias for backward compatibility
  async getEntities(params?: { type?: string; anomalous?: boolean; search?: string }) {
    return this.getEmployees(params);
  },

  async getEntityDetail(id: string) {
    return this.getEmployeeDetail(id);
  },

  async getDevices() {
    return fetchJson<Device[]>('/devices');
  },

  async getFindings(params?: { employeeId?: string; category?: string; reviewStatus?: string }) {
    const q = new URLSearchParams();
    if (params?.employeeId) q.set('employeeId', params.employeeId);
    if (params?.category) q.set('category', params.category);
    if (params?.reviewStatus) q.set('reviewStatus', params.reviewStatus);
    return fetchJson<ThreatFinding[]>(`/findings?${q.toString()}`);
  },

  async getFindingDetail(id: string) {
    return fetchJson<ThreatFinding & { supportingEvents?: ActivityEvent[] }>(`/findings/${encodeURIComponent(id)}`);
  },

  async updateFindingStatus(id: string, status: 'NEW' | 'UNDER_REVIEW' | 'ESCALATED' | 'BENIGN' | 'RESOLVED') {
    return fetchJson<ThreatFinding>(`/findings/${encodeURIComponent(id)}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status })
    });
  },

  async getEvents(params?: {
    entityId?: string;
    employeeId?: string;
    eventType?: string;
    category?: string;
    severity?: string;
    deviceId?: string;
    search?: string;
    limit?: number;
    offset?: number;
  }) {
    const q = new URLSearchParams();
    if (params?.entityId) q.set('entityId', params.entityId);
    if (params?.employeeId) q.set('employeeId', params.employeeId);
    if (params?.eventType) q.set('eventType', params.eventType);
    if (params?.category) q.set('category', params.category);
    if (params?.severity) q.set('severity', params.severity);
    if (params?.deviceId) q.set('deviceId', params.deviceId);
    if (params?.search) q.set('search', params.search);
    if (params?.limit) q.set('limit', String(params.limit));
    if (params?.offset) q.set('offset', String(params.offset));
    
    const res = await fetch(`${API_BASE}/events?${q.toString()}`);
    const json = await res.json();
    return { total: json.total || 0, events: (json.data || []) as ActivityEvent[] };
  },

  async getInvestigations() {
    return fetchJson<Investigation[]>('/investigations');
  },

  async getInvestigationDetail(id: string) {
    return fetchJson<Investigation>(`/investigations/${encodeURIComponent(id)}`);
  },

  async createInvestigation(data: Partial<Investigation>) {
    return fetchJson<Investigation>('/investigations', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  async addInvestigationNote(id: string, note: { text: string; author: string; category: string }) {
    return fetchJson<InvestigationNote>(`/investigations/${encodeURIComponent(id)}/notes`, {
      method: 'POST',
      body: JSON.stringify(note)
    });
  },

  async updateInvestigationStatus(id: string, status: string) {
    return fetchJson<Investigation>(`/investigations/${encodeURIComponent(id)}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status })
    });
  },

  async getGraph() {
    return fetchJson<{ nodes: GraphNode[]; edges: GraphEdge[] }>('/graph');
  },

  async getAnalytics() {
    return fetchJson<any>('/analytics');
  },

  async getDataSources() {
    return fetchJson<DataSourceMeta[]>('/datasources');
  },

  async runPipeline() {
    return fetchJson<any>('/pipeline/run', { method: 'POST' });
  },

  async getEvaluationSummary() {
    return fetchJson<any>('/evaluation/summary');
  },

  async getEvaluationIncidents(params?: { scenario?: number; status?: string; search?: string }) {
    const q = new URLSearchParams();
    if (params?.scenario) q.set('scenario', String(params.scenario));
    if (params?.status) q.set('status', params.status);
    if (params?.search) q.set('search', params.search);
    return fetchJson<{ total: number; filtered: number; data: any[] }>(`/evaluation/incidents?${q.toString()}`);
  },

  async getEvaluationScenarios() {
    return fetchJson<any[]>('/evaluation/scenarios');
  },

  async getEvaluationRules() {
    return fetchJson<any[]>('/evaluation/rules');
  },

  async getEvaluationCoverage() {
    return fetchJson<any>('/evaluation/coverage');
  },

  async rerunEvaluation() {
    return fetchJson<any>('/evaluation/rerun', { method: 'POST' });
  },

  // ==========================================
  // Employee Scrutiny & Investigation Engine
  // ==========================================
  async getScrutinyDirectory(params?: {
    page?: number;
    pageSize?: number;
    scrutiny?: string;
    hasOpenCases?: boolean;
    hasAlerts?: boolean;
    search?: string;
    sortBy?: string;
    sortOrder?: string;
  }) {
    const q = new URLSearchParams();
    if (params?.page) q.set('page', String(params.page));
    if (params?.pageSize) q.set('pageSize', String(params.pageSize));
    if (params?.scrutiny && params.scrutiny !== 'ALL') q.set('scrutiny', params.scrutiny);
    if (params?.hasOpenCases !== undefined) q.set('hasOpenCases', String(params.hasOpenCases));
    if (params?.hasAlerts !== undefined) q.set('hasAlerts', String(params.hasAlerts));
    if (params?.search) q.set('search', params.search);
    if (params?.sortBy) q.set('sortBy', params.sortBy);
    if (params?.sortOrder) q.set('sortOrder', params.sortOrder);
    return fetchRawJson<any>(`/scrutiny/employees?${q.toString()}`);
  },

  async getScrutinyEmployee(employeeId: string) {
    return fetchRawJson<any>(`/scrutiny/employees/${encodeURIComponent(employeeId)}`);
  },

  async createScrutinyCase(employeeId: string, data: {
    title: string;
    priority?: string;
    linkedAlertIds?: string[];
    leadInvestigator?: string;
    initialNote?: string;
    initialNoteCategory?: string;
  }) {
    return fetchRawJson<any>(`/scrutiny/employees/${encodeURIComponent(employeeId)}/cases`, {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  async addScrutinyCaseNote(caseId: string, data: {
    author?: string;
    text: string;
    category?: string;
  }) {
    return fetchRawJson<any>(`/scrutiny/cases/${encodeURIComponent(caseId)}/notes`, {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  async recordCaseOutcome(caseId: string, data: {
    outcome: string;
    resolutionNotes: string;
    investigator?: string;
    adjustScrutiny?: boolean;
  }) {
    return fetchRawJson<any>(`/scrutiny/cases/${encodeURIComponent(caseId)}/outcome`, {
      method: 'PATCH',
      body: JSON.stringify(data)
    });
  },

  async updateScrutinyCaseStatus(caseId: string, status: string) {
    return fetchRawJson<any>(`/scrutiny/cases/${encodeURIComponent(caseId)}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status })
    });
  },

  async adjustEmployeeScrutiny(employeeId: string, data: {
    newLevel: string;
    reason: string;
    actor?: string;
  }) {
    return fetchRawJson<any>(`/scrutiny/employees/${encodeURIComponent(employeeId)}/scrutiny`, {
      method: 'PATCH',
      body: JSON.stringify(data)
    });
  },

  async getScrutinyNotifications() {
    return fetchRawJson<any>('/scrutiny/notifications');
  },

  async dismissScrutinyNotification(notificationId: string) {
    return fetchRawJson<any>(`/scrutiny/notifications/${encodeURIComponent(notificationId)}/dismiss`, {
      method: 'PATCH'
    });
  },

  async getScrutinyAuditLog() {
    return fetchRawJson<any>('/scrutiny/audit-log');
  },

  async getScrutinyAlerts(limit: number = 10) {
    return fetchRawJson<any>(`/scrutiny/alerts?limit=${limit}`);
  },

  getExportUrl(investigationId: string) {
    return `${API_BASE}/investigations/${encodeURIComponent(investigationId)}/export`;
  }
};
