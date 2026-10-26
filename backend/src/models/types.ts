export type EntityType = 'EMPLOYEE' | 'DEVICE' | 'FILE' | 'STORAGE' | 'DOMAIN' | 'USER' | 'SERVER' | 'IP';
export type Severity = 'INFO' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type InvestigationStatus = 'New' | 'In Progress' | 'Needs Review' | 'Resolved';
export type EmploymentStatus = 'ACTIVE' | 'NOTICE_PERIOD' | 'ON_LEAVE' | 'TERMINATED';
export type FindingCategory = 
  | 'AFTER_HOURS_BULK_EXFILTRATION'
  | 'RESIGNATION_DATA_HOARDING'
  | 'UNAUTHORIZED_REMOVABLE_STORAGE'
  | 'PRIVILEGE_ABUSE_LATERAL_ACCESS'
  | 'CREDENTIAL_COMPROMISE_SUSPICION'
  | 'ABNORMAL_CLOUD_STORAGE_UPLOAD';

export interface EmployeeSummary {
  id: string; // e.g. "user:elena.rostova"
  employeeId: string; // e.g. "EMP-1048"
  name: string; // e.g. "Elena Rostova"
  label: string; // display name
  type: EntityType;
  department: string; // e.g. "Finance & Accounting"
  role: string; // e.g. "Senior Financial Controller"
  orgUnit: string; // e.g. "Corporate Treasury / M&A"
  employmentStatus: EmploymentStatus;
  associatedDevices: string[];
  privilegeLevel: 'STANDARD' | 'ELEVATED' | 'DOMAIN_ADMIN' | 'EXECUTIVE';
  eventCount: number;
  firstSeen: string;
  lastSeen: string;
  riskScore: number; // 0-100
  deviationIndex: number; // 0-100 BDI
  profileStatus: 'PROFILED' | 'INSUFFICIENT_HISTORY' | 'PENDING_BASELINE';
  tags: string[];
  anomalous: boolean;
  activeFindingsCount: number;
}

// Backwards-compatible alias for existing views
export type EntitySummary = EmployeeSummary;

export interface Device {
  id: string; // e.g. "host:WS-FIN-01"
  label: string;
  deviceType: 'WORKSTATION' | 'LAPTOP' | 'REMOVABLE_USB' | 'SERVER' | 'GATEWAY';
  assignedEmployeeId?: string;
  assignedEmployeeName?: string;
  department?: string;
  operatingSystem: string;
  ipAddress: string;
  lastActive: string;
  riskLevel: Severity;
  isMonitored: boolean;
}

export interface FeatureDeviation {
  feature: string;
  baseline_value: number;
  current_value: number;
  absolute_shift: number;
  percentage_change: number;
  z_score: number;
  severity: 'NORMAL' | 'LOW' | 'MEDIUM' | 'HIGH';
  weight: number;
}

export interface BehavioralProfile {
  entityId: string; // employee identifier
  employeeName?: string;
  department?: string;
  role?: string;
  profileStatus: 'PROFILED' | 'INSUFFICIENT_HISTORY' | 'PENDING_BASELINE';
  baselineEventCount: number;
  currentEventCount: number;
  behavioralDeviationIndex: number;
  isAnomalous: boolean;
  isolationForestRiskScore?: number;
  rawAnomalyScore?: number;
  featureDeviations: FeatureDeviation[];
  hourlyBaseline: number[]; // 24 values
  hourlyCurrent: number[]; // 24 values
  entropyBaseline?: number;
  entropyCurrent?: number;
  explanation: string;
  safeguardNote?: string;
}

export interface ActivityEvent {
  event_id: string;
  timestamp: string;
  event_type: string; // LOGON, LOGOFF, FILE_ACCESS, FILE_COPY, REMOVABLE_CONNECT, etc.
  employee_id: string;
  employee_name: string;
  department: string;
  entity_id: string; // alias for employee_id
  entity_type: EntityType;
  severity: Severity;
  device_id: string;
  target_resource: string;
  source_ip: string;
  destination_ip: string;
  destination_port: number;
  protocol: string;
  bytes_transferred: number;
  is_off_hours: boolean;
  process_name: string;
  rule_triggered: string;
  is_synthetic: number;
}

// Backwards-compatible alias for existing views
export type SecurityEvent = ActivityEvent;

export interface ThreatFinding {
  id: string;
  category: FindingCategory;
  categoryLabel: string;
  employeeId: string;
  employeeName: string;
  department: string;
  timestamp: string;
  observationWindow: string;
  anomalyScore: number; // 0-100
  evidenceCompleteness: 'HIGH' | 'MEDIUM' | 'PARTIAL';
  explanation: string;
  baselineComparison: string;
  supportingEventIds: string[];
  reviewStatus: 'NEW' | 'UNDER_REVIEW' | 'ESCALATED' | 'BENIGN' | 'RESOLVED';
  mitreTactic: string;
  whatHappened?: string;
  whyFlagged?: string;
  employeeInvolved?: string;
  nextSteps?: string;
}

export interface InvestigationNote {
  id: string;
  author: string;
  timestamp: string;
  text: string;
  category: 'OBSERVED_FACT' | 'HYPOTHESIS' | 'CORRELATION' | 'CONCLUSION';
}

export interface Investigation {
  id: string;
  title: string;
  status: InvestigationStatus;
  severity: Severity;
  createdAt: string;
  updatedAt: string;
  leadAnalyst: string;
  subjectEmployee?: string;
  subjectEmployeeName?: string;
  department?: string;
  summary: string;
  involvedEntities: string[];
  correlatedChains: string[];
  evidenceEventIds: string[];
  notes: InvestigationNote[];
  observedFacts: string[];
  hypotheses: string[];
  recommendations?: string[];
  confidence: number;
  limitations: string;
}

export interface GraphNode {
  id: string;
  label: string;
  type: string; // EMPLOYEE, DEVICE, FILE, SERVER, DOMAIN
  department?: string;
  event_count: number;
  risk_level: Severity;
  metadata?: Record<string, any>;
  x?: number;
  y?: number;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  relationship: string;
  event_type: string;
  timestamp: string;
  evidence_event_id: string;
  port?: number;
  bytes?: number;
  protocol?: string;
}

export interface DataSourceMeta {
  id: string;
  name: string;
  format: 'CSV' | 'JSON' | 'PARQUET';
  recordCount: number;
  sizeBytes: number;
  startDate: string;
  endDate: string;
  validationStatus: 'VALIDATED' | 'VALIDATION_WARNING' | 'FAILED';
  provenance: string;
  lastIngested: string;
  isDemo: boolean;
}

export interface PipelineRunMeta {
  pipeline_version: string;
  dataset_type: 'CERT_INSIDER_THREAT' | 'SYNTHETIC_DEMO' | 'ENTERPRISE_APEX';
  dataset_path: string;
  engine: 'PySpark (Local Multi-Threaded Spark Engine)' | 'PyArrow / Pandas Analytical Core';
  spark_version?: string;
  total_events_processed: number;
  valid_events_count: number;
  rejected_events_count: number;
  total_employees_profiled: number;
  anomalous_employees_count: number;
  findings_generated_count: number;
  processing_duration_seconds: number;
  output_parquet_path: string;
  data_quality: {
    null_counts: Record<string, number>;
    duplicates_removed: number;
    schema_compliance: boolean;
  };
}

// ==========================================
// Scrutiny & Investigation Engine Types
// ==========================================
export type ScrutinyLevel = 'LOW' | 'MEDIUM' | 'HIGH';
export type CaseOutcome = 
  | 'Resolved — Legitimate Activity'
  | 'Potential Concern — Further Investigation Required'
  | 'Confirmed Incident — Evidence Reviewed';

export interface ScrutinyHistoryRecord {
  id: string;
  previousLevel: ScrutinyLevel;
  newLevel: ScrutinyLevel;
  timestamp: string;
  reason: string;
  relevantAlertOrCaseIds?: string[];
  isManual: boolean;
  actor: string;
}

export interface InvestigationCaseRecord {
  id: string;
  employeeId: string;
  linkedAlertIds: string[];
  title: string;
  status: 'New' | 'In Progress' | 'Needs Review' | 'Resolved';
  outcome?: CaseOutcome;
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
  leadInvestigator: string;
  createdAt: string;
  updatedAt: string;
  resolutionDate?: string;
  resolutionNotes?: string;
  notes: {
    id: string;
    author: string;
    timestamp: string;
    text: string;
    category: 'OBSERVED_FACT' | 'HYPOTHESIS' | 'CORRELATION' | 'CONCLUSION';
  }[];
  scrutinyChangeApplied?: {
    from: ScrutinyLevel;
    to: ScrutinyLevel;
    reason: string;
  };
}

export interface AuditEventRecord {
  id: string;
  actor: string;
  actionType: 'CASE_CREATED' | 'NOTE_ADDED' | 'STATUS_CHANGED' | 'OUTCOME_RECORDED' | 'SCRUTINY_CHANGED' | 'ALERT_REVIEWED';
  employeeId: string;
  caseId?: string;
  previousValue?: string;
  newValue?: string;
  reason: string;
  timestamp: string;
}

export interface AlertNotificationRecord {
  id: string;
  employeeId: string;
  alertId: string;
  isFirstAlert: boolean;
  message: string;
  status: 'PENDING' | 'DISMISSED' | 'REVIEWED';
  timestamp: string;
  severity: Severity;
  alertType: string;
}

export interface ScrutinyAlertRecord {
  alert_id: string;
  user: string;
  alert_type: string;
  severity: Severity;
  metric_name: string;
  metric_value: number;
  threshold: number;
  trigger_reason: string;
  dataset_source: string;
  disclaimer?: string;
  review_status: 'NEW' | 'UNDER_REVIEW' | 'BENIGN' | 'RESOLVED' | 'CONFIRMED';
  linked_case_id?: string;
}

export interface ScrutinyEmployeeRecord {
  employeeId: string;
  name?: string;
  department?: string;
  role?: string;
  datasetSource?: 'CERT' | 'SYNTHETIC_DEMO';
  isDemo?: boolean;
  scrutinyLevel: ScrutinyLevel;
  totalAlerts: number;
  openCasesCount: number;
  resolvedCasesCount: number;
  lastAlertTimestamp?: string;
  lastAlertReason?: string;
  mostRecentCaseStatus?: string;
  activityTotals: {
    totalEvents: number;
    distinctPcs: number;
    totalLogons: number;
    totalLogoffs: number;
    offHoursLogons: number;
    usbConnects: number;
    usbDisconnects: number;
    fileCopies: number;
    firstActivity?: string;
    lastActivity?: string;
  };
  scrutinyExplanation: string;
  scrutinyHistory: ScrutinyHistoryRecord[];
  alerts: ScrutinyAlertRecord[];
  cases: InvestigationCaseRecord[];
}

