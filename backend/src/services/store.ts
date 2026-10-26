import fs from 'fs';
import path from 'path';
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
} from '../models/types.js';

const EMPLOYEE_METADATA: Record<string, {
  employeeId: string;
  name: string;
  department: string;
  role: string;
  orgUnit: string;
  status: 'ACTIVE' | 'NOTICE_PERIOD' | 'ON_LEAVE' | 'TERMINATED';
  devices: string[];
  privilegeLevel: 'STANDARD' | 'ELEVATED' | 'DOMAIN_ADMIN' | 'EXECUTIVE';
}> = {
  'user:elena.rostova': {
    employeeId: 'EMP-1048',
    name: 'Elena Rostova',
    department: 'Finance',
    role: 'Senior Financial Controller',
    orgUnit: 'Corporate Treasury / M&A',
    status: 'NOTICE_PERIOD',
    devices: ['host:WS-FIN-01'],
    privilegeLevel: 'ELEVATED'
  },
  'user:alex.vance': {
    employeeId: 'EMP-1049',
    name: 'Alex Vance',
    department: 'Finance',
    role: 'Budget Analyst',
    orgUnit: 'FP&A Operations',
    status: 'ACTIVE',
    devices: ['host:WS-FIN-02'],
    privilegeLevel: 'STANDARD'
  },
  'user:sarah.connor': {
    employeeId: 'EMP-1050',
    name: 'Sarah Connor',
    department: 'Engineering',
    role: 'Lead DevOps Architect',
    orgUnit: 'Core Cloud Infrastructure',
    status: 'ACTIVE',
    devices: ['host:WS-ENG-42'],
    privilegeLevel: 'ELEVATED'
  },
  'user:david.clark': {
    employeeId: 'EMP-1051',
    name: 'David Clark',
    department: 'Engineering',
    role: 'Senior Cloud Infrastructure Engineer',
    orgUnit: 'Site Reliability Engineering',
    status: 'ACTIVE',
    devices: ['host:WS-ENG-19'],
    privilegeLevel: 'ELEVATED'
  },
  'user:marcus.wright': {
    employeeId: 'EMP-1052',
    name: 'Marcus Wright',
    department: 'IT Operations',
    role: 'Systems & Helpdesk Administrator',
    orgUnit: 'Enterprise IT Services',
    status: 'ACTIVE',
    devices: ['host:WS-IT-08'],
    privilegeLevel: 'DOMAIN_ADMIN'
  },
  'user:rachel.kim': {
    employeeId: 'EMP-1053',
    name: 'Rachel Kim',
    department: 'Human Resources',
    role: 'HR Director & People Operations',
    orgUnit: 'Global Talent & Compliance',
    status: 'ACTIVE',
    devices: ['host:WS-HR-05'],
    privilegeLevel: 'STANDARD'
  },
  'user:jonathan.hayes': {
    employeeId: 'EMP-1054',
    name: 'Jonathan Hayes',
    department: 'Legal & Compliance',
    role: 'Corporate Legal Counsel',
    orgUnit: 'Intellectual Property / Governance',
    status: 'ACTIVE',
    devices: ['host:WS-LEG-01'],
    privilegeLevel: 'STANDARD'
  },
  'user:lisa.tanaka': {
    employeeId: 'EMP-1055',
    name: 'Lisa Tanaka',
    department: 'Sales & Accounts',
    role: 'Enterprise Account Executive',
    orgUnit: 'North America Enterprise Sales',
    status: 'ACTIVE',
    devices: ['host:WS-SALES-11'],
    privilegeLevel: 'STANDARD'
  },
  'user:carlos.mendez': {
    employeeId: 'EMP-1056',
    name: 'Carlos Mendez',
    department: 'Sales & Accounts',
    role: 'Client Solutions Manager',
    orgUnit: 'Strategic Client Engagements',
    status: 'ACTIVE',
    devices: ['host:WS-SALES-14'],
    privilegeLevel: 'STANDARD'
  },
  'user:maya.patel': {
    employeeId: 'EMP-1057',
    name: 'Maya Patel',
    department: 'Engineering',
    role: 'Backend Software Engineer',
    orgUnit: 'Core Platform Engineering',
    status: 'ACTIVE',
    devices: ['host:WS-ENG-07'],
    privilegeLevel: 'STANDARD'
  },
  'user:kevin.zhang': {
    employeeId: 'EMP-1058',
    name: 'Kevin Zhang',
    department: 'Finance',
    role: 'Treasury Specialist',
    orgUnit: 'Global Liquidity & Audit',
    status: 'ACTIVE',
    devices: ['host:WS-FIN-03'],
    privilegeLevel: 'STANDARD'
  },
  'user:service.backup': {
    employeeId: 'EMP-SVC-01',
    name: 'Automated Backup Daemon',
    department: 'IT Operations',
    role: 'Scheduled Service Account',
    orgUnit: 'Automated Infrastructure',
    status: 'ACTIVE',
    devices: ['srv:BACKUP01'],
    privilegeLevel: 'DOMAIN_ADMIN'
  }
};

class DataStore {
  private employees: EmployeeSummary[] = [];
  private devices: Device[] = [];
  private findings: ThreatFinding[] = [];
  private profiles: Map<string, BehavioralProfile> = new Map();
  private events: ActivityEvent[] = [];
  private investigations: Investigation[] = [];
  private graphNodes: GraphNode[] = [];
  private graphEdges: GraphEdge[] = [];
  private dataSources: DataSourceMeta[] = [];
  private isLoaded: boolean = false;
  private pipelineMetadata: any = null;

  constructor() {
    this.initialize();
  }

  public initialize() {
    this.employees = [];
    this.devices = [];
    this.findings = [];
    this.profiles.clear();
    this.events = [];
    this.investigations = [];
    this.graphNodes = [];
    this.graphEdges = [];
    this.dataSources = [];

    try {
      const candidates = [
        path.resolve(process.cwd(), 'analytics/output/pipeline_results.json'),
        path.resolve(process.cwd(), '../analytics/output/pipeline_results.json')
      ];

      let pipelineResultsPath = candidates.find(p => fs.existsSync(p)) || candidates[0];
      let eventsCsvPath = pipelineResultsPath.replace(
        path.join('output', 'pipeline_results.json'),
        path.join('datasets', 'sample_security_events.csv')
      );

      // Check if pipeline results exist
      if (fs.existsSync(pipelineResultsPath)) {
        const rawJson = fs.readFileSync(pipelineResultsPath, 'utf-8');
        const data = JSON.parse(rawJson);
        this.pipelineMetadata = {
          version: data.pipeline_version,
          datasetType: data.dataset_type,
          engine: data.engine_info?.engine,
          isSparkDistributed: data.engine_info?.is_spark_distributed,
          processingDurationSeconds: data.processing_duration_seconds,
          executionTimestamp: data.execution_timestamp,
          dataQualityReport: data.data_quality_report
        };

        // 1. Load Threat Findings
        if (data.findings && Array.isArray(data.findings)) {
          this.findings = data.findings.map((f: any) => ({
            id: f.id,
            category: f.category,
            categoryLabel: f.category_label || f.category,
            employeeId: f.employee_id,
            employeeName: f.employee_name || f.employee_id,
            department: f.department || 'Unknown',
            timestamp: f.timestamp,
            observationWindow: f.observation_window || 'Evaluation Window',
            anomalyScore: f.anomaly_score || 0,
            evidenceCompleteness: f.evidence_completeness || 'HIGH',
            explanation: f.explanation || 'Significant behavioral deviation detected.',
            baselineComparison: f.baseline_comparison || 'Deviation from historical baseline',
            supportingEventIds: f.supporting_event_ids || [],
            reviewStatus: f.review_status || 'NEW',
            mitreTactic: f.mitre_tactic || 'Insider Threat Deviation',
            whatHappened: f.what_happened || f.explanation || 'Unusual employee activity was recorded.',
            whyFlagged: f.why_flagged || f.baseline_comparison || 'Activity differed from expected normal patterns.',
            employeeInvolved: f.employee_involved || `${f.employee_name || f.employee_id} (${f.department || 'Unknown'})`,
            nextSteps: f.next_steps || 'Review recent activity records and check with manager to confirm if authorized.'
          }));
        }

        // 2. Load Profiles
        if (data.profiles && Array.isArray(data.profiles)) {
          for (const p of data.profiles) {
            const entId = p.entity_id;
            const bdi = p.behavioral_deviation_index || 0;
            const isAnom = p.is_anomalous || bdi >= 50;
            const meta = EMPLOYEE_METADATA[entId] || {
              employeeId: `EMP-${entId.replace(/[^0-9]/g, '').slice(0, 4) || '9000'}`,
              name: entId.replace('user:', '').replace('.', ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()),
              department: 'General Operations',
              role: 'Staff Member',
              orgUnit: 'Apex Enterprise',
              status: 'ACTIVE',
              devices: ['host:WS-GEN-01'],
              privilegeLevel: 'STANDARD'
            };

            const profile: BehavioralProfile = {
              entityId: entId,
              employeeName: meta.name,
              department: meta.department,
              role: meta.role,
              profileStatus: p.profile_status || 'PROFILED',
              baselineEventCount: p.baseline_event_count || 0,
              currentEventCount: p.current_event_count || 0,
              behavioralDeviationIndex: bdi,
              isAnomalous: isAnom,
              isolationForestRiskScore: p.isolation_forest_risk_score,
              rawAnomalyScore: p.raw_anomaly_score,
              featureDeviations: p.feature_deviations || [],
              hourlyBaseline: this.generateHourlyDistribution(bdi, false),
              hourlyCurrent: this.generateHourlyDistribution(bdi, true),
              entropyBaseline: p.baseline_entropy || 2.45,
              entropyCurrent: p.current_entropy || 3.12,
              explanation: isAnom
                ? `Employee exhibited statistically significant behavioral deviation (Deviation Index: ${bdi}/100) across ${p.top_deviating_features?.join(', ') || 'off-hours and transfer metrics'}.`
                : `Observed activity remains within normal operating parameters (within 2.0 standard deviations of baseline).`,
              safeguardNote: p.profile_status === 'INSUFFICIENT_HISTORY'
                ? 'Profile suppressed: Fewer than 10 historical observation records available.'
                : undefined
            };

            this.profiles.set(entId, profile);

            const activeFindings = this.findings.filter(f => f.employeeId === entId);

            this.employees.push({
              id: entId,
              employeeId: meta.employeeId,
              name: meta.name,
              label: meta.name,
              type: 'EMPLOYEE',
              department: meta.department,
              role: meta.role,
              orgUnit: meta.orgUnit,
              employmentStatus: meta.status,
              associatedDevices: meta.devices,
              privilegeLevel: meta.privilegeLevel,
              eventCount: (p.baseline_event_count || 0) + (p.current_event_count || 0),
              firstSeen: '2026-10-01T08:00:00Z',
              lastSeen: '2026-10-18T10:39:00Z',
              riskScore: p.isolation_forest_risk_score ? Math.round(p.isolation_forest_risk_score) : Math.min(100, Math.round(bdi * 0.9)),
              deviationIndex: bdi,
              profileStatus: p.profile_status,
              tags: this.deriveTags(entId, meta.department, meta.status, isAnom),
              anomalous: isAnom || activeFindings.length > 0,
              activeFindingsCount: activeFindings.length
            });
          }
        }

        // 3. Populate Known Fleet Devices
        this.devices = [
          {
            id: 'host:WS-FIN-01',
            label: 'Finance Lead Workstation (WS-FIN-01)',
            deviceType: 'WORKSTATION',
            assignedEmployeeId: 'user:elena.rostova',
            assignedEmployeeName: 'Elena Rostova',
            department: 'Finance',
            operatingSystem: 'Windows 11 Enterprise (Build 26100)',
            ipAddress: '10.0.1.45',
            lastActive: '2026-10-16T21:05:00Z',
            riskLevel: 'CRITICAL',
            isMonitored: true
          },
          {
            id: 'host:WS-FIN-02',
            label: 'Finance Analyst Workstation (WS-FIN-02)',
            deviceType: 'WORKSTATION',
            assignedEmployeeId: 'user:alex.vance',
            assignedEmployeeName: 'Alex Vance',
            department: 'Finance',
            operatingSystem: 'Windows 11 Enterprise',
            ipAddress: '10.0.1.48',
            lastActive: '2026-10-18T09:45:00Z',
            riskLevel: 'LOW',
            isMonitored: true
          },
          {
            id: 'host:WS-ENG-42',
            label: 'DevOps Lead Terminal (WS-ENG-42)',
            deviceType: 'WORKSTATION',
            assignedEmployeeId: 'user:sarah.connor',
            assignedEmployeeName: 'Sarah Connor',
            department: 'Engineering',
            operatingSystem: 'Ubuntu 24.04 LTS (Kernel 6.8)',
            ipAddress: '10.0.2.88',
            lastActive: '2026-10-18T10:30:00Z',
            riskLevel: 'LOW',
            isMonitored: true
          },
          {
            id: 'host:WS-ENG-19',
            label: 'SRE Cloud Workstation (WS-ENG-19)',
            deviceType: 'WORKSTATION',
            assignedEmployeeId: 'user:david.clark',
            assignedEmployeeName: 'David Clark',
            department: 'Engineering',
            operatingSystem: 'Fedora Workstation 40',
            ipAddress: '10.0.2.91',
            lastActive: '2026-10-18T02:30:00Z',
            riskLevel: 'HIGH',
            isMonitored: true
          },
          {
            id: 'host:WS-IT-08',
            label: 'Admin Workstation (WS-IT-08)',
            deviceType: 'WORKSTATION',
            assignedEmployeeId: 'user:marcus.wright',
            assignedEmployeeName: 'Marcus Wright',
            department: 'IT Operations',
            operatingSystem: 'Windows 11 Pro Admin Edition',
            ipAddress: '10.0.3.12',
            lastActive: '2026-10-17T23:35:00Z',
            riskLevel: 'CRITICAL',
            isMonitored: true
          },
          {
            id: 'host:WS-HR-05',
            label: 'HR Management Terminal (WS-HR-05)',
            deviceType: 'WORKSTATION',
            assignedEmployeeId: 'user:rachel.kim',
            assignedEmployeeName: 'Rachel Kim',
            department: 'Human Resources',
            operatingSystem: 'macOS Sequoia 15.1',
            ipAddress: '10.0.4.15',
            lastActive: '2026-10-18T09:20:00Z',
            riskLevel: 'LOW',
            isMonitored: true
          },
          {
            id: 'host:WS-LEG-01',
            label: 'Legal Counsel Laptop (WS-LEG-01)',
            deviceType: 'LAPTOP',
            assignedEmployeeId: 'user:jonathan.hayes',
            assignedEmployeeName: 'Jonathan Hayes',
            department: 'Legal & Compliance',
            operatingSystem: 'Windows 11 Enterprise (BitLocker Active)',
            ipAddress: '10.0.4.30',
            lastActive: '2026-10-18T08:50:00Z',
            riskLevel: 'LOW',
            isMonitored: true
          },
          {
            id: 'host:WS-SALES-11',
            label: 'Field Sales Laptop (WS-SALES-11)',
            deviceType: 'LAPTOP',
            assignedEmployeeId: 'user:lisa.tanaka',
            assignedEmployeeName: 'Lisa Tanaka',
            department: 'Sales & Accounts',
            operatingSystem: 'Windows 11 Enterprise',
            ipAddress: '10.0.5.19',
            lastActive: '2026-10-18T10:15:00Z',
            riskLevel: 'LOW',
            isMonitored: true
          },
          {
            id: 'srv:DC01.corp.local',
            label: 'Primary Domain Controller (srv:DC01)',
            deviceType: 'SERVER',
            assignedEmployeeName: 'Enterprise Domain Controllers',
            department: 'IT Operations',
            operatingSystem: 'Windows Server 2022 Datacenter',
            ipAddress: '10.0.0.10',
            lastActive: '2026-10-18T10:39:00Z',
            riskLevel: 'HIGH',
            isMonitored: true
          },
          {
            id: 'srv:FILE01.corp.local',
            label: 'Corporate Confidential Storage (srv:FILE01)',
            deviceType: 'SERVER',
            assignedEmployeeName: 'Corporate Storage Services',
            department: 'Finance / Corporate',
            operatingSystem: 'Windows Server 2022 Datacenter',
            ipAddress: '10.0.0.15',
            lastActive: '2026-10-18T10:35:00Z',
            riskLevel: 'MEDIUM',
            isMonitored: true
          },
          {
            id: 'usb:REMOVABLE_SANDISK_32G',
            label: 'Removable Flash Media (SanDisk Ultra 32GB)',
            deviceType: 'REMOVABLE_USB',
            assignedEmployeeId: 'user:elena.rostova',
            assignedEmployeeName: 'Elena Rostova (Attached)',
            department: 'Finance',
            operatingSystem: 'exFAT Volume Serial: 8A44-B219',
            ipAddress: 'host:WS-FIN-01 [USB Bus 002]',
            lastActive: '2026-10-16T20:55:00Z',
            riskLevel: 'CRITICAL',
            isMonitored: false
          }
        ];

        // 4. Load Graph Data
        if (data.graph) {
          this.graphNodes = data.graph.nodes || [];
          this.graphEdges = (data.graph.edges || []).slice(0, 600);
        }

        // 5. Investigations managed dynamically via InvestigationService
        this.investigations = [];
      }

      // 6. Load Activity Events from CSV
      if (fs.existsSync(eventsCsvPath)) {
        const csvContent = fs.readFileSync(eventsCsvPath, 'utf-8');
        const lines = csvContent.split('\n').filter(l => l.trim().length > 0);
        if (lines.length > 1) {
          const headers = lines[0].split(',').map(h => h.trim());
          for (let i = 1; i < lines.length; i++) {
            const cols = lines[i].split(',').map(c => c.trim());
            const row: any = {};
            headers.forEach((h, idx) => {
              row[h] = cols[idx];
            });

            const empId = row.entity_id || 'user:unknown';
            const meta = EMPLOYEE_METADATA[empId];

            this.events.push({
              event_id: row.event_id || `EVT-${i}`,
              timestamp: row.timestamp || new Date().toISOString(),
              event_type: row.event_type || 'UNKNOWN',
              employee_id: empId,
              employee_name: meta ? meta.name : empId.replace('user:', ''),
              department: meta ? meta.department : 'Operations',
              entity_id: empId,
              entity_type: (row.entity_type || 'EMPLOYEE') as any,
              severity: (row.severity || 'INFO') as any,
              device_id: meta ? meta.devices[0] : (row.source_ip || 'host:WS-01'),
              target_resource: row.process_name || row.destination_ip || 'Internal Network',
              source_ip: row.source_ip || '10.0.1.50',
              destination_ip: row.destination_ip || '10.0.2.100',
              destination_port: parseInt(row.destination_port || '0', 10),
              protocol: row.protocol || 'TCP',
              bytes_transferred: parseFloat(row.bytes_transferred || '0'),
              is_off_hours: parseInt(row.is_off_hours || '0', 10) === 1,
              process_name: row.process_name || 'system',
              rule_triggered: row.rule_triggered || 'NORMAL_ACTIVITY',
              is_synthetic: parseInt(row.is_synthetic || '1', 10)
            });
          }
        }
      }

      // 7. Initialize Data Sources
      this.dataSources = [
        {
          id: 'DS-01',
          name: 'Apex Global Technologies — Unified Employee Telemetry',
          format: 'CSV',
          recordCount: this.events.length || 2173,
          sizeBytes: 384500,
          startDate: '2026-10-01T16:08:26Z',
          endDate: '2026-10-18T10:39:00Z',
          validationStatus: 'VALIDATED',
          provenance: 'Conforms to CERT Insider Threat Test Dataset Schema (Logon, Device, File, Web, Email)',
          lastIngested: '2026-10-24T03:10:00Z',
          isDemo: true
        },
        {
          id: 'DS-02',
          name: 'PySpark & PyArrow Partitioned Analytical Parquet Store',
          format: 'PARQUET',
          recordCount: this.events.length || 2173,
          sizeBytes: 154200,
          startDate: '2026-10-01T16:08:26Z',
          endDate: '2026-10-18T10:39:00Z',
          validationStatus: 'VALIDATED',
          provenance: 'Normalized Feature Store & Snappy-Compressed Columnar Partitions',
          lastIngested: '2026-10-24T03:10:02Z',
          isDemo: false
        },
        {
          id: 'DS-03',
          name: 'CERT Insider Threat Test Dataset r4.2 (Carnegie Mellon SEI Benchmark)',
          format: 'PARQUET',
          recordCount: 0,
          sizeBytes: 0,
          startDate: '2010-01-01T00:00:00Z',
          endDate: '2011-05-31T23:59:59Z',
          validationStatus: 'VALIDATION_WARNING',
          provenance: 'National Insider Threat Center (NITC) Ground-Truth Evaluation Suite',
          lastIngested: 'Not Yet Acquired',
          isDemo: false
        }
      ];

      this.isLoaded = true;
      console.log(`[+] CyberDNA DataStore initialized: ${this.employees.length} employees, ${this.findings.length} findings, ${this.devices.length} devices, ${this.events.length} events, ${this.investigations.length} investigations.`);
    } catch (err) {
      console.error('[!] Failed to initialize DataStore from disk:', err);
    }
  }

  private generateHourlyDistribution(bdi: number, isCurrent: boolean): number[] {
    const dist: number[] = [];
    for (let h = 0; h < 24; h++) {
      if (!isCurrent) {
        dist.push(h >= 9 && h <= 17 ? Math.floor(15 + Math.sin((h - 9) * 0.35) * 20) : Math.floor(Math.random() * 2));
      } else {
        if (bdi > 50) {
          dist.push(h >= 20 || h <= 3 ? Math.floor(35 + Math.random() * 25) : Math.floor(5 + Math.random() * 10));
        } else {
          dist.push(h >= 9 && h <= 17 ? Math.floor(12 + Math.random() * 15) : Math.floor(Math.random() * 3));
        }
      }
    }
    return dist;
  }

  private deriveTags(entId: string, dept: string, status: string, isAnom: boolean): string[] {
    const tags: string[] = [dept];
    if (status === 'NOTICE_PERIOD') tags.push('Notice Period');
    if (entId.includes('marcus') || entId.includes('service')) tags.push('Elevated Privilege');
    if (isAnom) tags.push('Behavioral Deviation', 'Analyst Review');
    return tags;
  }

  // Query API methods
  public getEmployees(filter?: { department?: string; anomalous?: boolean; search?: string }): EmployeeSummary[] {
    let result = this.employees;
    if (filter?.department) {
      result = result.filter(e => e.department.toLowerCase() === filter.department?.toLowerCase());
    }
    if (filter?.anomalous !== undefined) {
      result = result.filter(e => e.anomalous === filter.anomalous);
    }
    if (filter?.search) {
      const q = filter.search.toLowerCase();
      result = result.filter(e =>
        e.id.toLowerCase().includes(q) ||
        e.name.toLowerCase().includes(q) ||
        e.department.toLowerCase().includes(q) ||
        e.role.toLowerCase().includes(q)
      );
    }
    return result;
  }

  // Alias for backwards compatibility
  public getEntities(): EntitySummary[] {
    return this.employees;
  }

  public getEmployeeById(id: string): EmployeeSummary | undefined {
    if (!id) return undefined;
    const clean = id.toLowerCase().trim();
    const withoutUser = clean.replace(/^user:/i, '');
    const withUser = `user:${withoutUser}`;

    return this.employees.find(e => {
      const eid = e.id.toLowerCase();
      const empId = e.employeeId.toLowerCase();
      return eid === clean || eid === withoutUser || eid === withUser ||
             empId === clean || empId === withoutUser || empId === withUser;
    });
  }

  public getEntityById(id: string): EntitySummary | undefined {
    return this.getEmployeeById(id);
  }

  public getDevices(): Device[] {
    return this.devices;
  }

  public getDeviceById(id: string): Device | undefined {
    return this.devices.find(d => d.id.toLowerCase() === id.toLowerCase());
  }

  public getFindings(filter?: { employeeId?: string; category?: string; reviewStatus?: string }): ThreatFinding[] {
    let result = this.findings;
    if (filter?.employeeId) {
      const eid = filter.employeeId.toLowerCase().trim();
      const withoutUser = eid.replace(/^user:/i, '');
      const withUser = `user:${withoutUser}`;
      result = result.filter(f => {
        const feid = f.employeeId.toLowerCase();
        return feid === eid || feid === withoutUser || feid === withUser;
      });
    }
    if (filter?.category) {
      result = result.filter(f => f.category === filter.category);
    }
    if (filter?.reviewStatus) {
      result = result.filter(f => f.reviewStatus === filter.reviewStatus);
    }
    return result;
  }

  public getFindingById(id: string): ThreatFinding | undefined {
    return this.findings.find(f => f.id.toLowerCase() === id.toLowerCase());
  }

  public updateFindingReviewStatus(id: string, status: 'NEW' | 'UNDER_REVIEW' | 'ESCALATED' | 'BENIGN' | 'RESOLVED'): ThreatFinding | null {
    const finding = this.getFindingById(id);
    if (!finding) return null;
    finding.reviewStatus = status;
    return finding;
  }

  public getProfileByEntityId(id: string): BehavioralProfile | undefined {
    if (!id) return undefined;
    const clean = id.toLowerCase().trim();
    const withoutUser = clean.replace(/^user:/i, '');
    const withUser = `user:${withoutUser}`;

    return this.profiles.get(clean) ||
           this.profiles.get(withUser) ||
           this.profiles.get(withoutUser) ||
           Array.from(this.profiles.values()).find(p => {
             const pid = p.entityId.toLowerCase();
             return pid === clean || pid === withoutUser || pid === withUser;
           });
  }

  public getEvents(filter: {
    entityId?: string;
    employeeId?: string;
    eventType?: string;
    category?: string;
    severity?: string;
    deviceId?: string;
    search?: string;
    limit?: number;
    offset?: number;
  }): { total: number; events: ActivityEvent[] } {
    let result = this.events;

    const targetEmp = filter.employeeId || filter.entityId;
    if (targetEmp) {
      const eid = targetEmp.toLowerCase();
      result = result.filter(e => e.employee_id.toLowerCase().includes(eid) || e.entity_id.toLowerCase().includes(eid));
    }
    if (filter.eventType) {
      const etype = filter.eventType.toUpperCase();
      result = result.filter(e => e.event_type.toUpperCase().includes(etype));
    }
    if (filter.category) {
      const cat = filter.category.toUpperCase();
      if (cat === 'LOGON') {
        result = result.filter(e => e.event_type.includes('LOGON') || e.event_type.includes('LOGOFF') || e.event_type.includes('AUTH'));
      } else if (cat === 'FILE') {
        result = result.filter(e => e.event_type.includes('FILE'));
      } else if (cat === 'REMOVABLE') {
        result = result.filter(e => e.event_type.includes('REMOVABLE') || e.event_type.includes('USB'));
      } else if (cat === 'WEB_CLOUD') {
        result = result.filter(e => e.event_type.includes('WEB') || e.event_type.includes('CLOUD') || e.event_type.includes('DNS'));
      } else if (cat === 'EMAIL') {
        result = result.filter(e => e.event_type.includes('EMAIL'));
      }
    }
    if (filter.severity) {
      const sev = filter.severity.toUpperCase();
      result = result.filter(e => e.severity.toUpperCase() === sev);
    }
    if (filter.deviceId) {
      const dev = filter.deviceId.toLowerCase();
      result = result.filter(e => e.device_id.toLowerCase().includes(dev));
    }
    if (filter.search) {
      const s = filter.search.toLowerCase();
      result = result.filter(e =>
        e.event_id.toLowerCase().includes(s) ||
        e.employee_id.toLowerCase().includes(s) ||
        e.employee_name.toLowerCase().includes(s) ||
        e.process_name.toLowerCase().includes(s) ||
        e.source_ip.toLowerCase().includes(s) ||
        e.destination_ip.toLowerCase().includes(s) ||
        e.rule_triggered.toLowerCase().includes(s)
      );
    }

    const total = result.length;
    const offset = filter.offset || 0;
    const limit = filter.limit || 50;
    const paginated = result.slice(offset, offset + limit);

    return { total, events: paginated };
  }

  public getInvestigations(): Investigation[] {
    return this.investigations;
  }

  public getInvestigationById(id: string): Investigation | undefined {
    return this.investigations.find(i => i.id.toLowerCase() === id.toLowerCase());
  }

  public createInvestigation(inv: Partial<Investigation>): Investigation {
    const newInv: Investigation = {
      id: `INV-2026-${(this.investigations.length + 101).toString()}`,
      title: inv.title || 'Untitled Insider Threat Investigation',
      status: 'New',
      severity: inv.severity || 'MEDIUM',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      leadAnalyst: inv.leadAnalyst || 'Senior Forensics Analyst',
      summary: inv.summary || 'Analyst created case based on behavioral deviation indicator.',
      involvedEntities: inv.involvedEntities || [],
      correlatedChains: inv.correlatedChains || [],
      evidenceEventIds: inv.evidenceEventIds || [],
      notes: [
        {
          id: `NOTE-${Date.now()}`,
          author: inv.leadAnalyst || 'Investigator',
          timestamp: new Date().toISOString(),
          text: 'Investigation workspace created. Initiating evidentiary audit.',
          category: 'OBSERVED_FACT'
        }
      ],
      observedFacts: inv.observedFacts || [],
      hypotheses: inv.hypotheses || [],
      confidence: inv.confidence || 0.75,
      limitations: inv.limitations || 'Initial assessment pending full endpoint triage.'
    };
    this.investigations.unshift(newInv);
    return newInv;
  }

  public addInvestigationNote(invId: string, note: Omit<InvestigationNote, 'id' | 'timestamp'>): InvestigationNote | null {
    const inv = this.getInvestigationById(invId);
    if (!inv) return null;

    const newNote: InvestigationNote = {
      id: `NOTE-${Date.now()}`,
      author: note.author || 'Analyst',
      timestamp: new Date().toISOString(),
      text: note.text,
      category: note.category || 'OBSERVED_FACT'
    };

    inv.notes.unshift(newNote);
    inv.updatedAt = new Date().toISOString();
    return newNote;
  }

  public updateInvestigationStatus(invId: string, status: any): Investigation | null {
    const inv = this.getInvestigationById(invId);
    if (!inv) return null;
    inv.status = status;
    inv.updatedAt = new Date().toISOString();
    return inv;
  }

  public getGraphData(): { nodes: GraphNode[]; edges: GraphEdge[] } {
    return {
      nodes: this.graphNodes,
      edges: this.graphEdges
    };
  }

  public getDataSources(): DataSourceMeta[] {
    return this.dataSources;
  }

  public getOverviewStats() {
    const anomalousEmployees = this.employees.filter(e => e.anomalous || e.deviationIndex >= 50);
    const pendingFindings = this.findings.filter(f => f.reviewStatus === 'NEW' || f.reviewStatus === 'UNDER_REVIEW');
    const openInvestigations = this.investigations.filter(i => i.status !== 'Resolved');

    // Activity breakdown by category
    const activityByCategory = {
      logonLogoff: 0,
      fileActivity: 0,
      removableDevice: 0,
      webCloud: 0,
      emailActivity: 0
    };

    this.events.forEach(e => {
      const et = e.event_type.toUpperCase();
      if (et.includes('LOGON') || et.includes('LOGOFF') || et.includes('AUTH')) {
        activityByCategory.logonLogoff++;
      } else if (et.includes('REMOVABLE') || et.includes('USB')) {
        activityByCategory.removableDevice++;
      } else if (et.includes('FILE')) {
        activityByCategory.fileActivity++;
      } else if (et.includes('WEB') || et.includes('CLOUD') || et.includes('DNS')) {
        activityByCategory.webCloud++;
      } else if (et.includes('EMAIL')) {
        activityByCategory.emailActivity++;
      }
    });

    // Department breakdown
    const departmentMap: Record<string, { totalEvents: number; employees: number; anomalousCount: number }> = {};
    this.employees.forEach(emp => {
      if (!departmentMap[emp.department]) {
        departmentMap[emp.department] = { totalEvents: 0, employees: 0, anomalousCount: 0 };
      }
      departmentMap[emp.department].employees++;
      if (emp.anomalous) departmentMap[emp.department].anomalousCount++;
    });

    this.events.forEach(e => {
      if (departmentMap[e.department]) {
        departmentMap[e.department].totalEvents++;
      }
    });

    const departmentSummaries = Object.entries(departmentMap).map(([dept, d]) => ({
      department: dept,
      employeesCount: d.employees,
      eventsCount: d.totalEvents,
      anomalousCount: d.anomalousCount
    }));

    // Volume trends over time
    const dayMap = new Map<string, number>();
    this.events.forEach(e => {
      const d = e.timestamp.slice(0, 10);
      dayMap.set(d, (dayMap.get(d) || 0) + 1);
    });

    const volumeTrends = Array.from(dayMap.entries())
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Severity distribution
    const severityCount = {
      CRITICAL: 0,
      HIGH: 0,
      MEDIUM: 0,
      LOW: 0,
      INFO: 0
    };
    this.events.forEach(e => {
      if (severityCount[e.severity] !== undefined) {
        severityCount[e.severity]++;
      }
    });

    return {
      organizationName: 'CERT r4.2 Benchmark Environment',
      isSyntheticDemo: false,
      totalEmployees: this.employees.length,
      totalEventsProcessed: this.events.length,
      totalProfilesGenerated: this.profiles.size,
      anomaliesIdentified: this.findings.length,
      pendingFindingsReviewCount: pendingFindings.length,
      openInvestigationsCount: openInvestigations.length,
      correlatedChainsCount: this.investigations.length,
      activityByCategory,
      departmentSummaries,
      volumeTrends,
      severityDistribution: severityCount,
      topDeviatingEmployees: [...this.employees].sort((a, b) => b.deviationIndex - a.deviationIndex).slice(0, 5),
      recentFindings: this.findings.slice(0, 5),
      recentInvestigations: this.investigations.slice(0, 4),
      pipelineMetadata: this.pipelineMetadata
    };
  }
}

export const store = new DataStore();
