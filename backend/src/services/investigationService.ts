import fs from 'fs';
import path from 'path';
import {
  ScrutinyLevel,
  CaseOutcome,
  ScrutinyHistoryRecord,
  InvestigationCaseRecord,
  AuditEventRecord,
  AlertNotificationRecord,
  ScrutinyAlertRecord,
  ScrutinyEmployeeRecord,
  Investigation,
  InvestigationNote
} from '../models/types.js';

export interface DirectoryQuery {
  page?: number;
  pageSize?: number;
  scrutiny?: 'ALL' | ScrutinyLevel;
  hasOpenCases?: boolean;
  hasAlerts?: boolean;
  search?: string;
  sortBy?: 'alerts' | 'scrutiny' | 'events' | 'user';
  sortOrder?: 'asc' | 'desc';
  dataset?: 'ALL' | 'CERT';
}

export class InvestigationService {
  private static instance: InvestigationService | null = null;

  private employeesMap: Map<string, ScrutinyEmployeeRecord> = new Map();
  private aliasMap: Map<string, string> = new Map(); // normalized key (lowercase) -> canonical ID
  private casesMap: Map<string, InvestigationCaseRecord> = new Map();
  private auditEvents: AuditEventRecord[] = [];
  private notificationsMap: Map<string, AlertNotificationRecord> = new Map();
  private manualScrutinyOverrides: Map<string, { level: ScrutinyLevel; reason: string; actor: string; timestamp: string }> = new Map();

  private storageDir: string;
  private isAtlasConfigured: boolean = false;

  private constructor() {
    const projectRoot = path.resolve(process.cwd(), process.cwd().endsWith('backend') ? '..' : '.');
    this.storageDir = path.join(projectRoot, 'analytics', 'output', 'cert_r4.2', 'investigations');
    this.isAtlasConfigured = Boolean(process.env.MONGODB_URI);

    this.ensureStorageDir();
    this.initializeData(projectRoot);
  }

  public static getInstance(): InvestigationService {
    if (!InvestigationService.instance) {
      InvestigationService.instance = new InvestigationService();
    }
    return InvestigationService.instance;
  }

  private ensureStorageDir(): void {
    if (!fs.existsSync(this.storageDir)) {
      fs.mkdirSync(this.storageDir, { recursive: true });
    }
  }

  private registerAliases(canonicalId: string): void {
    const lower = canonicalId.toLowerCase();
    this.aliasMap.set(lower, canonicalId);

    const withoutUser = canonicalId.replace(/^user:/i, '');
    this.aliasMap.set(withoutUser.toLowerCase(), canonicalId);

    const withUser = `user:${withoutUser}`;
    this.aliasMap.set(withUser.toLowerCase(), canonicalId);
  }

  public resolveCanonicalId(rawId: string): string | null {
    if (!rawId) return null;
    const trimmed = rawId.trim();

    if (this.employeesMap.has(trimmed)) return trimmed;

    const lower = trimmed.toLowerCase();
    if (this.aliasMap.has(lower)) return this.aliasMap.get(lower)!;

    const withoutUser = trimmed.replace(/^user:/i, '');
    if (this.employeesMap.has(withoutUser)) return withoutUser;
    if (this.aliasMap.has(withoutUser.toLowerCase())) return this.aliasMap.get(withoutUser.toLowerCase())!;

    const withUser = `user:${withoutUser}`;
    if (this.employeesMap.has(withUser)) return withUser;
    if (this.aliasMap.has(withUser.toLowerCase())) return this.aliasMap.get(withUser.toLowerCase())!;

    return null;
  }

  private initializeData(projectRoot: string): void {
    const certDir = path.join(projectRoot, 'analytics', 'output', 'cert_r4.2');
    const employeesJsonPath = path.join(certDir, 'employees.json');
    const alertsJsonPath = path.join(certDir, 'alerts.json');
    const pipelineResultsPath = path.join(projectRoot, 'analytics', 'output', 'pipeline_results.json');

    // 1. Load CERT alerts
    const alertsByUser: Map<string, ScrutinyAlertRecord[]> = new Map();
    if (fs.existsSync(alertsJsonPath)) {
      try {
        const rawAlerts = JSON.parse(fs.readFileSync(alertsJsonPath, 'utf-8'));
        for (const a of rawAlerts) {
          const user = a.user;
          const alertRec: ScrutinyAlertRecord = {
            alert_id: a.alert_id,
            user: a.user,
            alert_type: a.alert_type,
            severity: a.severity || 'MEDIUM',
            metric_name: a.metric_name,
            metric_value: a.metric_value,
            threshold: a.threshold,
            trigger_reason: a.trigger_reason,
            dataset_source: a.dataset_source || 'CERT Insider Threat Test Dataset r4.2',
            disclaimer: a.disclaimer,
            review_status: 'NEW'
          };
          if (!alertsByUser.has(user)) {
            alertsByUser.set(user, []);
          }
          alertsByUser.get(user)!.push(alertRec);
        }
      } catch (err: any) {
        console.error('[InvestigationService] Failed to load alerts.json:', err.message);
      }
    }

    // 2. Load CERT employees (1,000 employees)
    if (fs.existsSync(employeesJsonPath)) {
      try {
        const rawEmps = JSON.parse(fs.readFileSync(employeesJsonPath, 'utf-8'));
        for (const e of rawEmps) {
          const u = e.user;
          const userAlerts = alertsByUser.get(u) || [];
          const initialScrutiny = this.calculateInitialScrutiny(userAlerts);

          const empRecord: ScrutinyEmployeeRecord = {
            employeeId: u,
            scrutinyLevel: initialScrutiny.level,
            totalAlerts: userAlerts.length,
            openCasesCount: 0,
            resolvedCasesCount: 0,
            lastAlertTimestamp: e.last_activity ? new Date(e.last_activity).toISOString() : undefined,
            lastAlertReason: userAlerts.length > 0 ? userAlerts[0].trigger_reason : undefined,
            mostRecentCaseStatus: 'No Active Cases',
            activityTotals: {
              totalEvents: e.total_events || 0,
              distinctPcs: e.distinct_pcs || 1,
              totalLogons: e.total_logons || 0,
              totalLogoffs: e.total_logoffs || 0,
              offHoursLogons: e.off_hours_logons || 0,
              usbConnects: e.usb_connects || 0,
              usbDisconnects: e.usb_disconnects || 0,
              fileCopies: e.file_copies || 0,
              firstActivity: e.first_activity ? new Date(e.first_activity).toISOString() : undefined,
              lastActivity: e.last_activity ? new Date(e.last_activity).toISOString() : undefined
            },
            scrutinyExplanation: initialScrutiny.explanation,
            scrutinyHistory: [
              {
                id: `SCRUT-INIT-${u}`,
                previousLevel: 'LOW',
                newLevel: initialScrutiny.level,
                timestamp: new Date().toISOString(),
                reason: initialScrutiny.explanation,
                relevantAlertOrCaseIds: userAlerts.map(a => a.alert_id),
                isManual: false,
                actor: 'SYSTEM_AUTOPOLICY'
              }
            ],
            alerts: userAlerts,
            cases: [],
            datasetSource: 'CERT'
          };
          this.employeesMap.set(u, empRecord);
          this.registerAliases(u);
        }
      } catch (err: any) {
        console.error('[InvestigationService] Failed to load employees.json:', err.message);
      }
    }

    // 3. Load persisted state from storageDir
    this.loadPersistedState();

    // 4. Generate first-alert / recurring-alert notifications for unreviewed alerts
    this.populateInitialNotifications();
  }

  private calculateInitialScrutiny(alerts: ScrutinyAlertRecord[]): { level: ScrutinyLevel; explanation: string } {
    if (alerts.length === 0) {
      return {
        level: 'LOW',
        explanation: 'Standard baseline monitoring. No behavioral alerts triggered in 18-month telemetry.'
      };
    }

    const hasCompound = alerts.some(a => a.alert_type === 'COMPOUND_OFF_HOURS_USB_ACTIVITY');
    if (alerts.length >= 2 || hasCompound) {
      return {
        level: 'HIGH',
        explanation: hasCompound
          ? 'Elevated scrutiny: Compound off-hours logon and removable media staging detected.'
          : `Elevated scrutiny: Multiple distinct operational alerts (${alerts.length} alerts) triggered across activity domains.`
      };
    }

    return {
      level: 'MEDIUM',
      explanation: 'Triage review recommended: Single suspicious-activity alert flagged in baseline aggregation.'
    };
  }

  private loadPersistedState(): void {
    const casesPath = path.join(this.storageDir, 'cases.json');
    const overridesPath = path.join(this.storageDir, 'scrutiny_overrides.json');
    const auditPath = path.join(this.storageDir, 'audit_events.json');
    const notifsPath = path.join(this.storageDir, 'notifications.json');

    // Load overrides
    if (fs.existsSync(overridesPath)) {
      try {
        const overrides = JSON.parse(fs.readFileSync(overridesPath, 'utf-8'));
        for (const [u, o] of Object.entries(overrides as Record<string, any>)) {
          this.manualScrutinyOverrides.set(u, o);
          const canonicalId = this.resolveCanonicalId(u) || u;
          const emp = this.employeesMap.get(canonicalId);
          if (emp) {
            emp.scrutinyLevel = o.level;
            emp.scrutinyExplanation = `Manual Investigator Override: ${o.reason} (by ${o.actor})`;
            emp.scrutinyHistory.push({
              id: `SCRUT-OVERRIDE-${Date.now()}`,
              previousLevel: emp.scrutinyLevel,
              newLevel: o.level,
              timestamp: o.timestamp,
              reason: o.reason,
              isManual: true,
              actor: o.actor
            });
          }
        }
      } catch (err: any) {
        console.error('[InvestigationService] Failed to load scrutiny overrides:', err.message);
      }
    }

    // Load cases (strictly filter out synthetic demonstration cases)
    if (fs.existsSync(casesPath)) {
      try {
        const cases = JSON.parse(fs.readFileSync(casesPath, 'utf-8'));
        for (const c of cases) {
          if (
            !c ||
            String(c.id).startsWith('DEMO-') ||
            String(c.title).includes('[DEMO]') ||
            String(c.employeeId).toLowerCase().includes('elena') ||
            String(c.employeeId).toLowerCase().includes('marcus') ||
            String(c.employeeId).toLowerCase().includes('david.clark')
          ) {
            continue;
          }
          this.casesMap.set(c.id, c);
          const canonicalId = this.resolveCanonicalId(c.employeeId) || c.employeeId;
          const emp = this.employeesMap.get(canonicalId);
          if (emp) {
            if (!emp.cases.some(existing => existing.id === c.id)) {
              emp.cases.push(c);
              if (c.status === 'Resolved') {
                emp.resolvedCasesCount++;
              } else {
                emp.openCasesCount++;
              }
              emp.mostRecentCaseStatus = `${c.status} (${c.id})`;

              // Link alerts
              for (const aId of c.linkedAlertIds || []) {
                const a = emp.alerts.find(alt => alt.alert_id === aId);
                if (a) {
                  a.linked_case_id = c.id;
                  a.review_status = c.status === 'Resolved' ? (c.outcome?.includes('Legitimate') ? 'RESOLVED' : 'CONFIRMED') : 'UNDER_REVIEW';
                }
              }
            }
          }
        }
      } catch (err: any) {
        console.error('[InvestigationService] Failed to load cases.json:', err.message);
      }
    }

    // Load audit events (filter out demo audit entries)
    if (fs.existsSync(auditPath)) {
      try {
        const rawEvents = JSON.parse(fs.readFileSync(auditPath, 'utf-8'));
        this.auditEvents = (Array.isArray(rawEvents) ? rawEvents : []).filter((e: any) =>
          !e.caseId?.startsWith('DEMO-') &&
          !e.reason?.includes('Demo Case') &&
          !e.employeeId?.toLowerCase().includes('elena') &&
          !e.employeeId?.toLowerCase().includes('marcus') &&
          !e.employeeId?.toLowerCase().includes('david.clark')
        );
      } catch (err: any) {
        console.error('[InvestigationService] Failed to load audit_events.json:', err.message);
      }
    }

    // Load notifications
    if (fs.existsSync(notifsPath)) {
      try {
        const notifs = JSON.parse(fs.readFileSync(notifsPath, 'utf-8'));
        for (const n of notifs) {
          this.notificationsMap.set(n.id, n);
        }
      } catch (err: any) {
        console.error('[InvestigationService] Failed to load notifications.json:', err.message);
      }
    }
  }

  private populateInitialNotifications(): void {
    if (this.notificationsMap.size > 0) return;

    for (const [empId, emp] of this.employeesMap.entries()) {
      if (emp.alerts.length > 0) {
        for (const a of emp.alerts) {
          if (a.review_status === 'NEW') {
            const notifId = `NOTIF-${a.alert_id}`;
            const isFirst = emp.alerts.length === 1;
            const notif: AlertNotificationRecord = {
              id: notifId,
              employeeId: empId,
              alertId: a.alert_id,
              isFirstAlert: isFirst,
              message: isFirst
                ? `First suspicious-activity alert for Employee ${empId}. Would you like to review the activity?`
                : `Recurring suspicious-activity alert for Employee ${empId}. Priority review suggested.`,
              status: 'PENDING',
              timestamp: emp.lastAlertTimestamp || new Date().toISOString(),
              severity: a.severity,
              alertType: a.alert_type
            };
            this.notificationsMap.set(notifId, notif);
          }
        }
      }
    }
    this.persistState();
  }

  private persistState(): void {
    try {
      this.ensureStorageDir();
      fs.writeFileSync(path.join(this.storageDir, 'cases.json'), JSON.stringify(Array.from(this.casesMap.values()), null, 2));
      fs.writeFileSync(path.join(this.storageDir, 'audit_events.json'), JSON.stringify(this.auditEvents, null, 2));
      fs.writeFileSync(path.join(this.storageDir, 'notifications.json'), JSON.stringify(Array.from(this.notificationsMap.values()), null, 2));

      const overridesObj: Record<string, any> = {};
      for (const [k, v] of this.manualScrutinyOverrides.entries()) {
        overridesObj[k] = v;
      }
      fs.writeFileSync(path.join(this.storageDir, 'scrutiny_overrides.json'), JSON.stringify(overridesObj, null, 2));
    } catch (err: any) {
      console.error('[InvestigationService] Local disk persistence error:', err.message);
    }
  }

  // =========================================================================
  // Directory & Profile Lookups
  // =========================================================================

  public getDirectory(query: DirectoryQuery = {}) {
    const {
      page = 1,
      pageSize = 15,
      scrutiny = 'ALL',
      hasOpenCases,
      hasAlerts,
      search,
      sortBy = 'alerts',
      sortOrder = 'desc'
    } = query;

    // Operational cohort contains solely real CERT employees
    let all: ScrutinyEmployeeRecord[] = Array.from(this.employeesMap.values());

    // Filter by scrutiny level
    if (scrutiny !== 'ALL') {
      all = all.filter(e => e.scrutinyLevel === scrutiny);
    }

    // Filter by open cases
    if (hasOpenCases) {
      all = all.filter(e => e.openCasesCount > 0);
    }

    // Filter by alerts
    if (hasAlerts) {
      all = all.filter(e => e.totalAlerts > 0);
    }

    // Search by ID or Name or Department
    if (search && search.trim().length > 0) {
      const q = search.trim().toLowerCase();
      all = all.filter(e =>
        e.employeeId.toLowerCase().includes(q) ||
        (e.name && e.name.toLowerCase().includes(q)) ||
        (e.department && e.department.toLowerCase().includes(q)) ||
        (e.lastAlertReason && e.lastAlertReason.toLowerCase().includes(q))
      );
    }

    // Compute Summary counts across the cohort
    const baseCohort = Array.from(this.employeesMap.values());

    let unresolvedAlertsCount = 0;
    let openCasesCount = 0;
    let highScrutinyCount = 0;
    let mediumScrutinyCount = 0;
    let lowScrutinyCount = 0;

    for (const e of baseCohort) {
      if (e.scrutinyLevel === 'HIGH') highScrutinyCount++;
      else if (e.scrutinyLevel === 'MEDIUM') mediumScrutinyCount++;
      else lowScrutinyCount++;

      openCasesCount += e.openCasesCount;
      unresolvedAlertsCount += e.alerts.filter(a => a.review_status === 'NEW' || a.review_status === 'UNDER_REVIEW').length;
    }

    const summary = {
      totalEmployees: baseCohort.length,
      highScrutiny: highScrutinyCount,
      mediumScrutiny: mediumScrutinyCount,
      lowScrutiny: lowScrutinyCount,
      openCases: openCasesCount,
      unresolvedAlerts: unresolvedAlertsCount
    };

    // Sorting
    all.sort((a, b) => {
      let cmp = 0;
      if (sortBy === 'alerts') {
        cmp = a.totalAlerts - b.totalAlerts;
      } else if (sortBy === 'scrutiny') {
        const rank = { HIGH: 3, MEDIUM: 2, LOW: 1 };
        cmp = rank[a.scrutinyLevel] - rank[b.scrutinyLevel];
      } else if (sortBy === 'events') {
        cmp = a.activityTotals.totalEvents - b.activityTotals.totalEvents;
      } else if (sortBy === 'user') {
        cmp = a.employeeId.localeCompare(b.employeeId);
      }
      return sortOrder === 'desc' ? -cmp : cmp;
    });

    const total = all.length;
    const totalPages = Math.ceil(total / pageSize) || 1;
    const offset = (page - 1) * pageSize;
    const paginated = all.slice(offset, offset + pageSize).map(e => ({
      employeeId: e.employeeId,
      name: e.name,
      department: e.department,
      role: e.role,
      scrutinyLevel: e.scrutinyLevel,
      totalAlerts: e.totalAlerts,
      openCasesCount: e.openCasesCount,
      resolvedCasesCount: e.resolvedCasesCount,
      lastAlertTimestamp: e.lastAlertTimestamp,
      lastAlertReason: e.lastAlertReason,
      mostRecentCaseStatus: e.mostRecentCaseStatus,
      activityTotals: e.activityTotals,
      datasetSource: e.datasetSource,
      isDemo: e.isDemo
    }));

    return {
      total,
      page,
      pageSize,
      totalPages,
      summary,
      data: paginated
    };
  }

  public getEmployeeProfile(employeeId: string): ScrutinyEmployeeRecord | null {
    if (!employeeId) return null;
    const canonicalId = this.resolveCanonicalId(employeeId);
    if (!canonicalId) {
      return null;
    }
    const emp = this.employeesMap.get(canonicalId);
    return emp || null;
  }

  // =========================================================================
  // Case Management Actions
  // =========================================================================

  public getOperationalStats() {
    const employees = Array.from(this.employeesMap.values());
    let highScrutiny = 0;
    let mediumScrutiny = 0;
    let lowScrutiny = 0;
    let totalEvents = 0;

    for (const e of employees) {
      if (e.scrutinyLevel === 'HIGH') highScrutiny++;
      else if (e.scrutinyLevel === 'MEDIUM') mediumScrutiny++;
      else lowScrutiny++;

      totalEvents += (e.activityTotals?.totalEvents || 0);
    }

    const allCases = Array.from(this.casesMap.values());
    const openCases = allCases.filter(c => String(c.status).toLowerCase() !== 'resolved');

    let allAlertsCount = 0;
    let pendingReviewCount = 0;
    for (const e of employees) {
      for (const a of e.alerts) {
        allAlertsCount++;
        if (a.review_status === 'NEW' || a.review_status === 'UNDER_REVIEW') {
          pendingReviewCount++;
        }
      }
    }

    return {
      totalEmployees: employees.length,
      totalEvents,
      highScrutiny,
      mediumScrutiny,
      lowScrutiny,
      activeAlerts: allAlertsCount,
      pendingReview: pendingReviewCount,
      openCases: openCases.length,
      totalCases: allCases.length
    };
  }

  public getAllCases(): InvestigationCaseRecord[] {
    return Array.from(this.casesMap.values()).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  public getCaseById(caseId: string): InvestigationCaseRecord | undefined {
    return this.casesMap.get(caseId);
  }

  public getAllCasesForApi(): Investigation[] {
    return this.getAllCases().map(c => this.caseToInvestigation(c));
  }

  public getCaseByIdForApi(caseId: string): Investigation | undefined {
    const c = this.getCaseById(caseId);
    return c ? this.caseToInvestigation(c) : undefined;
  }

  private caseToInvestigation(c: InvestigationCaseRecord): Investigation {
    const canonicalId = this.resolveCanonicalId(c.employeeId) || c.employeeId;
    const emp = this.employeesMap.get(canonicalId);

    const severityMap: Record<ScrutinyLevel, 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'> = {
      LOW: 'LOW',
      MEDIUM: 'MEDIUM',
      HIGH: 'HIGH'
    };

    return {
      id: c.id,
      title: c.title,
      status: c.status,
      severity: severityMap[c.priority] || 'HIGH',
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
      leadAnalyst: c.leadInvestigator,
      subjectEmployee: c.employeeId,
      subjectEmployeeName: emp?.name,
      department: emp?.department,
      summary: c.resolutionNotes || c.notes?.[0]?.text || `Investigation regarding anomalous activity for ${c.employeeId}`,
      involvedEntities: [c.employeeId],
      correlatedChains: c.linkedAlertIds || [],
      evidenceEventIds: [],
      notes: (c.notes || []).map(n => ({
        id: n.id,
        author: n.author,
        timestamp: n.timestamp,
        text: n.text,
        category: n.category
      })),
      observedFacts: c.notes?.filter(n => n.category === 'OBSERVED_FACT').map(n => n.text) || [],
      hypotheses: c.notes?.filter(n => n.category === 'HYPOTHESIS').map(n => n.text) || [],
      confidence: c.outcome ? 0.95 : 0.75,
      limitations: 'Evidence evaluated against local forensic baseline.'
    };
  }

  public createCase(data: {
    employeeId: string;
    title: string;
    priority?: ScrutinyLevel;
    linkedAlertIds?: string[];
    leadInvestigator?: string;
    initialNote?: string;
    initialNoteCategory?: 'OBSERVED_FACT' | 'HYPOTHESIS' | 'CORRELATION' | 'CONCLUSION';
  }): InvestigationCaseRecord {
    const canonicalId = this.resolveCanonicalId(data.employeeId);
    if (!canonicalId) {
      throw new Error(`Employee ${data.employeeId} not found in repository`);
    }
    const emp = this.employeesMap.get(canonicalId)!;

    const caseId = `CASE-${Date.now().toString().slice(-6)}-${canonicalId.replace(/[^a-zA-Z0-9]/g, '')}`;
    const linked = data.linkedAlertIds || emp.alerts.map(a => a.alert_id);
    const priority = data.priority || emp.scrutinyLevel;
    const investigator = data.leadInvestigator || 'Senior Forensics Analyst';

    const notes = [];
    if (data.initialNote) {
      notes.push({
        id: `NOTE-${Date.now()}-1`,
        author: investigator,
        timestamp: new Date().toISOString(),
        text: data.initialNote,
        category: data.initialNoteCategory || ('OBSERVED_FACT' as const)
      });
    }

    const newCase: InvestigationCaseRecord = {
      id: caseId,
      employeeId: canonicalId,
      linkedAlertIds: linked,
      title: data.title || `Forensic Investigation: Anomalous Activity for ${canonicalId}`,
      status: 'New',
      priority,
      leadInvestigator: investigator,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      notes
    };

    // Update alerts status
    for (const aId of linked) {
      const a = emp.alerts.find(alt => alt.alert_id === aId);
      if (a) {
        a.linked_case_id = caseId;
        a.review_status = 'UNDER_REVIEW';
      }
    }

    // Dismiss pending notification if exists
    for (const n of this.notificationsMap.values()) {
      if ((n.employeeId === canonicalId || n.employeeId === data.employeeId) && n.status === 'PENDING') {
        n.status = 'REVIEWED';
      }
    }

    emp.cases.push(newCase);
    emp.openCasesCount++;
    emp.mostRecentCaseStatus = `New (${caseId})`;

    this.casesMap.set(caseId, newCase);

    this.logAudit({
      actor: investigator,
      actionType: 'CASE_CREATED',
      employeeId: canonicalId,
      caseId,
      reason: `Case initialized with priority ${priority}`
    });

    this.persistState();
    return newCase;
  }

  public addCaseNote(
    caseId: string,
    data: { author?: string; text: string; category?: 'OBSERVED_FACT' | 'HYPOTHESIS' | 'CORRELATION' | 'CONCLUSION' }
  ) {
    const c = this.casesMap.get(caseId);
    if (!c) throw new Error(`Case ${caseId} not found`);

    const note = {
      id: `NOTE-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      author: data.author || 'Analyst',
      timestamp: new Date().toISOString(),
      text: data.text,
      category: data.category || 'OBSERVED_FACT'
    };

    c.notes.push(note);
    c.updatedAt = new Date().toISOString();

    this.logAudit({
      actor: note.author,
      actionType: 'NOTE_ADDED',
      employeeId: c.employeeId,
      caseId: c.id,
      reason: `Note added under category: ${note.category}`
    });

    this.persistState();
    return note;
  }

  public recordOutcome(
    caseId: string,
    data: {
      outcome: CaseOutcome;
      resolutionNotes: string;
      investigator?: string;
      adjustScrutiny?: boolean;
    }
  ): InvestigationCaseRecord {
    const c = this.casesMap.get(caseId);
    if (!c) throw new Error(`Case ${caseId} not found`);

    if (!data.resolutionNotes || data.resolutionNotes.trim().length === 0) {
      throw new Error('Resolution notes are mandatory when recording an investigation outcome');
    }

    const investigator = data.investigator || c.leadInvestigator;
    const canonicalId = this.resolveCanonicalId(c.employeeId) || c.employeeId;
    const emp = this.employeesMap.get(canonicalId);
    const prevScrutiny = emp?.scrutinyLevel || 'MEDIUM';

    c.outcome = data.outcome;
    c.resolutionDate = new Date().toISOString();
    c.resolutionNotes = data.resolutionNotes;
    c.updatedAt = new Date().toISOString();

    if (data.outcome === 'Resolved — Legitimate Activity') {
      c.status = 'Resolved';
      if (emp) {
        emp.openCasesCount = Math.max(0, emp.openCasesCount - 1);
        emp.resolvedCasesCount++;
        emp.mostRecentCaseStatus = `Resolved: Legitimate (${caseId})`;

        for (const aId of c.linkedAlertIds) {
          const a = emp.alerts.find(alt => alt.alert_id === aId);
          if (a) a.review_status = 'RESOLVED';
        }

        // Automatic scrutiny reduction
        const unreviewedCount = emp.alerts.filter(a => a.review_status === 'NEW' || a.review_status === 'UNDER_REVIEW').length;
        if (unreviewedCount === 0 || data.adjustScrutiny) {
          emp.scrutinyLevel = 'LOW';
          emp.scrutinyExplanation = `Scrutiny lowered to LOW: Documented legitimate activity in ${caseId}.`;
          const historyEntry: ScrutinyHistoryRecord = {
            id: `SCRUT-RESOLVE-${Date.now()}`,
            previousLevel: prevScrutiny,
            newLevel: 'LOW',
            timestamp: new Date().toISOString(),
            reason: `Resolved as Legitimate: ${data.resolutionNotes}`,
            relevantAlertOrCaseIds: [caseId],
            isManual: false,
            actor: investigator
          };
          emp.scrutinyHistory.push(historyEntry);
          c.scrutinyChangeApplied = { from: prevScrutiny, to: 'LOW', reason: historyEntry.reason };
        }
      }
    } else if (data.outcome === 'Potential Concern — Further Investigation Required') {
      c.status = 'In Progress';
      if (emp) {
        emp.mostRecentCaseStatus = `In Progress: Potential Concern (${caseId})`;
      }
    } else if (data.outcome === 'Confirmed Incident — Evidence Reviewed') {
      c.status = 'Resolved';
      if (emp) {
        emp.openCasesCount = Math.max(0, emp.openCasesCount - 1);
        emp.resolvedCasesCount++;
        emp.mostRecentCaseStatus = `Confirmed Incident (${caseId})`;
        emp.scrutinyLevel = 'HIGH';
        emp.scrutinyExplanation = `Elevated Scrutiny (HIGH): Formal insider incident confirmed under ${caseId}.`;

        for (const aId of c.linkedAlertIds) {
          const a = emp.alerts.find(alt => alt.alert_id === aId);
          if (a) a.review_status = 'CONFIRMED';
        }

        const historyEntry: ScrutinyHistoryRecord = {
          id: `SCRUT-CONFIRM-${Date.now()}`,
          previousLevel: prevScrutiny,
          newLevel: 'HIGH',
          timestamp: new Date().toISOString(),
          reason: `Confirmed Incident: ${data.resolutionNotes}`,
          relevantAlertOrCaseIds: [caseId],
          isManual: false,
          actor: investigator
        };
        emp.scrutinyHistory.push(historyEntry);
        c.scrutinyChangeApplied = { from: prevScrutiny, to: 'HIGH', reason: historyEntry.reason };
      }
    }

    this.logAudit({
      actor: investigator,
      actionType: 'OUTCOME_RECORDED',
      employeeId: canonicalId,
      caseId: c.id,
      previousValue: prevScrutiny,
      newValue: emp?.scrutinyLevel,
      reason: `Outcome: ${data.outcome} | Note: ${data.resolutionNotes}`
    });

    this.persistState();
    return c;
  }

  public updateCaseStatus(caseId: string, status: 'New' | 'In Progress' | 'Needs Review' | 'Resolved') {
    const c = this.casesMap.get(caseId);
    if (!c) throw new Error(`Case ${caseId} not found`);

    const prev = c.status;
    c.status = status;
    c.updatedAt = new Date().toISOString();

    const canonicalId = this.resolveCanonicalId(c.employeeId) || c.employeeId;
    const emp = this.employeesMap.get(canonicalId);
    if (emp) {
      if (status === 'Resolved' && prev !== 'Resolved') {
        emp.openCasesCount = Math.max(0, emp.openCasesCount - 1);
        emp.resolvedCasesCount++;
      } else if (status !== 'Resolved' && prev === 'Resolved') {
        emp.openCasesCount++;
        emp.resolvedCasesCount = Math.max(0, emp.resolvedCasesCount - 1);
      }
      emp.mostRecentCaseStatus = `${status} (${caseId})`;
    }

    this.logAudit({
      actor: 'Investigator',
      actionType: 'STATUS_CHANGED',
      employeeId: canonicalId,
      caseId,
      previousValue: prev,
      newValue: status,
      reason: `Investigation case status changed to ${status}`
    });

    this.persistState();
    return c;
  }

  public adjustScrutiny(
    employeeId: string,
    newLevel: ScrutinyLevel,
    reason: string,
    actor: string = 'Investigator'
  ): ScrutinyEmployeeRecord {
    const canonicalId = this.resolveCanonicalId(employeeId);
    if (!canonicalId) throw new Error(`Employee ${employeeId} not found`);
    const emp = this.employeesMap.get(canonicalId)!;

    if (!reason || reason.trim().length === 0) {
      throw new Error('A documented reason is mandatory when manually modifying employee scrutiny');
    }

    const prev = emp.scrutinyLevel;
    emp.scrutinyLevel = newLevel;
    emp.scrutinyExplanation = `Manual adjustment to ${newLevel}: ${reason} (by ${actor})`;

    const historyEntry: ScrutinyHistoryRecord = {
      id: `SCRUT-MANUAL-${Date.now()}`,
      previousLevel: prev,
      newLevel,
      timestamp: new Date().toISOString(),
      reason,
      isManual: true,
      actor
    };
    emp.scrutinyHistory.push(historyEntry);

    this.manualScrutinyOverrides.set(canonicalId, {
      level: newLevel,
      reason,
      actor,
      timestamp: historyEntry.timestamp
    });

    this.logAudit({
      actor,
      actionType: 'SCRUTINY_CHANGED',
      employeeId: canonicalId,
      previousValue: prev,
      newValue: newLevel,
      reason
    });

    this.persistState();
    return emp;
  }

  public getNotifications(): AlertNotificationRecord[] {
    return Array.from(this.notificationsMap.values()).filter(n => n.status === 'PENDING');
  }

  public dismissNotification(id: string): AlertNotificationRecord | null {
    const n = this.notificationsMap.get(id);
    if (!n) return null;
    n.status = 'DISMISSED';
    this.persistState();
    return n;
  }

  public getAuditLog(): AuditEventRecord[] {
    return [...this.auditEvents].reverse();
  }

  public getAllAlerts(): any[] {
    const list: any[] = [];
    for (const emp of this.employeesMap.values()) {
      for (const a of emp.alerts) {
        list.push({
          alertId: a.alert_id,
          employeeId: emp.employeeId,
          ruleId: a.alert_type,
          severity: a.severity,
          metricName: a.metric_name,
          metricValue: a.metric_value,
          explanation: a.trigger_reason,
          timestamp: emp.lastAlertTimestamp
        });
      }
    }
    return list;
  }

  private logAudit(entry: Omit<AuditEventRecord, 'id' | 'timestamp'>): void {
    const auditRecord: AuditEventRecord = {
      id: `AUDIT-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      timestamp: new Date().toISOString(),
      ...entry
    };
    this.auditEvents.push(auditRecord);
  }
}

