import fs from 'fs';
import path from 'path';
import { execSync, spawn } from 'child_process';

const rootDir = process.cwd().endsWith('backend') ? path.resolve(process.cwd(), '..') : process.cwd();
const evalOutputDir = path.join(rootDir, 'analytics', 'output', 'cert_r4.2', 'evaluation');

export interface IncidentComparison {
  incident_id: string;
  scenario: number;
  scenario_title: string;
  user: string;
  start: string;
  end: string;
  start_iso: string;
  end_iso: string;
  duration_hours: number;
  observables_file: string;
  observables_total: number;
  observables_supported: number;
  observables_unsupported: number;
  observables_coverage_ratio: number;
  observables_counts_by_type: Record<string, number>;
  key_evidence_highlights: Array<{
    event_type: string;
    date: string;
    pc: string;
    summary: string;
    is_supported: boolean;
  }>;
  has_baseline_alert: boolean;
  baseline_alerts_count: number;
  baseline_alerts: Array<any>;
  window_logons: number;
  window_off_hours_logons: number;
  window_usb_connects: number;
  window_file_copies: number;
  window_distinct_pcs: number;
  window_pcs: string[];
  window_detection_status: 'DETECTED' | 'MISSED' | 'UNSUPPORTED_DATA_SOURCE' | 'INCONCLUSIVE';
  matching_rules: string[];
  decision_explanation: string;
}

export class EvaluationService {
  /**
   * Retrieves the comprehensive evaluation run summary.
   */
  public static getSummary(): any {
    const summaryPath = path.join(evalOutputDir, 'evaluation_summary.json');
    if (!fs.existsSync(summaryPath)) {
      return {
        status: 'PENDING_FIRST_RUN',
        message: 'CERT r4.2 evaluation results have not been generated yet. Please run the evaluation suite.',
        evaluation_id: null,
        run_timestamp: null,
        metrics: null
      };
    }

    try {
      const content = fs.readFileSync(summaryPath, 'utf-8');
      return JSON.parse(content);
    } catch (err: any) {
      console.error('[EvaluationService] Error reading evaluation_summary.json:', err.message);
      throw new Error(`Failed to read evaluation summary: ${err.message}`);
    }
  }

  /**
   * Retrieves the 70 incident comparison records with optional filtering.
   */
  public static getIncidents(filters?: {
    scenario?: number;
    status?: string;
    search?: string;
  }): { total: number; filtered: number; data: IncidentComparison[] } {
    const incJsonPath = path.join(evalOutputDir, 'incident_comparison.json');
    if (!fs.existsSync(incJsonPath)) {
      return { total: 0, filtered: 0, data: [] };
    }

    try {
      const content = fs.readFileSync(incJsonPath, 'utf-8');
      let list: IncidentComparison[] = JSON.parse(content);
      const total = list.length;

      if (filters?.scenario && filters.scenario > 0) {
        list = list.filter(inc => inc.scenario === filters.scenario);
      }

      if (filters?.status && filters.status !== 'ALL') {
        const targetStatus = filters.status.toUpperCase();
        list = list.filter(inc => inc.window_detection_status === targetStatus);
      }

      if (filters?.search && filters.search.trim()) {
        const q = filters.search.toLowerCase().trim();
        list = list.filter(inc =>
          inc.user.toLowerCase().includes(q) ||
          inc.incident_id.toLowerCase().includes(q) ||
          (inc.decision_explanation && inc.decision_explanation.toLowerCase().includes(q)) ||
          (inc.window_pcs && inc.window_pcs.some(p => p.toLowerCase().includes(q)))
        );
      }

      return { total, filtered: list.length, data: list };
    } catch (err: any) {
      console.error('[EvaluationService] Error reading incident_comparison.json:', err.message);
      throw new Error(`Failed to read incident comparisons: ${err.message}`);
    }
  }

  /**
   * Retrieves scenario breakdown metrics.
   */
  public static getScenarios(): any[] {
    const summary = this.getSummary();
    if (summary && summary.metrics && summary.metrics.by_scenario) {
      return Object.values(summary.metrics.by_scenario);
    }
    return [];
  }

  /**
   * Retrieves rule performance audit metrics.
   */
  public static getRulePerformance(): any[] {
    const rulePath = path.join(evalOutputDir, 'rule_performance.csv');
    if (!fs.existsSync(rulePath)) {
      return [];
    }

    try {
      const content = fs.readFileSync(rulePath, 'utf-8');
      const lines = content.split('\n').filter(l => l.trim().length > 0);
      if (lines.length < 2) return [];

      const headers = lines[0].split(',').map(h => h.trim());
      const records: any[] = [];

      for (let i = 1; i < lines.length; i++) {
        // Basic CSV split accounting for quoted descriptions
        const row = lines[i];
        // Parse CSV line with quotes safely
        const values: string[] = [];
        let inQuote = false;
        let current = '';
        for (let c = 0; c < row.length; c++) {
          const char = row[c];
          if (char === '"') {
            inQuote = !inQuote;
          } else if (char === ',' && !inQuote) {
            values.push(current.trim());
            current = '';
          } else {
            current += char;
          }
        }
        values.push(current.trim());

        const record: any = {};
        headers.forEach((h, idx) => {
          record[h] = values[idx] || '';
        });
        records.push(record);
      }

      return records;
    } catch (err: any) {
      console.error('[EvaluationService] Error reading rule_performance.csv:', err.message);
      return [];
    }
  }

  /**
   * Retrieves data source and indicator coverage audit data.
   */
  public static getCoverage(): any {
    const covPath = path.join(evalOutputDir, 'coverage_summary.json');
    if (!fs.existsSync(covPath)) {
      return null;
    }

    try {
      const content = fs.readFileSync(covPath, 'utf-8');
      return JSON.parse(content);
    } catch (err: any) {
      console.error('[EvaluationService] Error reading coverage_summary.json:', err.message);
      return null;
    }
  }

  /**
   * Safely executes the evaluation runner script.
   */
  public static rerunEvaluation(): { success: boolean; message: string; output?: string } {
    try {
      console.log('[EvaluationService] Initiating evaluation runner execution...');
      const pythonExe = process.platform === 'win32'
        ? path.join(rootDir, 'analytics', '.venv', 'Scripts', 'python.exe')
        : path.join(rootDir, 'analytics', '.venv', 'bin', 'python');

      const cliPath = path.join(rootDir, 'analytics', 'cyberdna_evaluation', 'cli.py');
      const resolvedPython = fs.existsSync(pythonExe) ? pythonExe : 'python';

      const output = execSync(`"${resolvedPython}" "${cliPath}"`, {
        cwd: rootDir,
        timeout: 45000,
        encoding: 'utf-8'
      });

      console.log('[EvaluationService] Evaluation completed successfully.');
      return {
        success: true,
        message: 'Evaluation re-executed successfully.',
        output: output.slice(-500)
      };
    } catch (err: any) {
      console.error('[EvaluationService] Error re-running evaluation:', err.message);
      return {
        success: false,
        message: `Evaluation execution error: ${err.message}`
      };
    }
  }
}
