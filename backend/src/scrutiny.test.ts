import { test, describe } from 'node:test';
import assert from 'node:assert';
import { InvestigationService } from './services/investigationService.js';

describe('InvestigationService & Employee Scrutiny Engine Suite', () => {
  const service = InvestigationService.getInstance();

  test('should load employee directory with pagination and 1000 employees', () => {
    const dir = service.getDirectory({ page: 1, pageSize: 15 });
    assert.strictEqual(dir.total, 1000);
    assert.strictEqual(dir.pageSize, 15);
    assert.strictEqual(dir.data.length, 15);
    assert.strictEqual(dir.page, 1);
    assert.strictEqual(dir.summary.totalEmployees, 1000);
    assert.strictEqual(dir.summary.highScrutiny, 76);
    assert.ok(dir.summary.unresolvedAlerts <= 282 && dir.summary.unresolvedAlerts > 0);
  });

  test('should filter employee directory by scrutiny level', () => {
    const highDir = service.getDirectory({ scrutiny: 'HIGH', pageSize: 10 });
    assert.strictEqual(highDir.total, 76);
    for (const emp of highDir.data) {
      assert.strictEqual(emp.scrutinyLevel, 'HIGH');
    }

    const lowDir = service.getDirectory({ scrutiny: 'LOW', pageSize: 10 });
    assert.strictEqual(lowDir.total, 814);
    for (const emp of lowDir.data) {
      assert.strictEqual(emp.scrutinyLevel, 'LOW');
    }
  });

  test('should search employee directory by employee ID', () => {
    const searchResult = service.getDirectory({ search: 'AJF0370' });
    assert.strictEqual(searchResult.total, 1);
    assert.strictEqual(searchResult.data[0].employeeId, 'AJF0370');
    assert.strictEqual(searchResult.data[0].scrutinyLevel, 'HIGH');
    assert.strictEqual(searchResult.data[0].totalAlerts, 4);
  });

  test('should retrieve complete employee profile with alerts and telemetry totals', () => {
    const profile = service.getEmployeeProfile('AJF0370');
    assert.ok(profile);
    assert.strictEqual(profile.employeeId, 'AJF0370');
    assert.strictEqual(profile.alerts.length, 4);
    assert.strictEqual(profile.activityTotals.totalEvents, 22822);
    assert.strictEqual(profile.activityTotals.offHoursLogons, 903);
    assert.strictEqual(profile.activityTotals.usbConnects, 4261);
    assert.ok(profile.scrutinyHistory.length >= 1);
  });

  test('should manage alert notifications and allow dismissal (Review Later)', () => {
    const notifs = service.getNotifications();
    assert.ok(notifs.length > 0);

    const firstNotif = notifs[0];
    assert.ok(firstNotif.message.includes('suspicious-activity alert for Employee'));

    const dismissed = service.dismissNotification(firstNotif.id);
    assert.ok(dismissed);
    assert.strictEqual(dismissed.status, 'DISMISSED');
  });

  test('should create investigation case, add note, and update status', () => {
    const targetUser = 'ABC0174';
    const initialProfile = service.getEmployeeProfile(targetUser);
    assert.ok(initialProfile);

    const newCase = service.createCase({
      employeeId: targetUser,
      title: 'Suspicious After-Hours Data Transfer Inquiry',
      priority: 'HIGH',
      leadInvestigator: 'Analyst Monish',
      initialNote: 'Initiated formal inquiry following trigger on compound off-hours USB rule.',
      initialNoteCategory: 'OBSERVED_FACT'
    });

    assert.ok(newCase.id.startsWith('CASE-'));
    assert.strictEqual(newCase.employeeId, targetUser);
    assert.strictEqual(newCase.status, 'New');
    assert.strictEqual(newCase.notes.length, 1);

    // Add note
    const addedNote = service.addCaseNote(newCase.id, {
      author: 'Analyst Monish',
      text: 'Verified employee was scheduled for standard shift on target dates.',
      category: 'HYPOTHESIS'
    });
    assert.ok(addedNote.id);
    assert.strictEqual(addedNote.category, 'HYPOTHESIS');

    // Update status
    const updatedStatus = service.updateCaseStatus(newCase.id, 'In Progress');
    assert.strictEqual(updatedStatus.status, 'In Progress');
  });

  test('should record outcome Resolved — Legitimate Activity and reduce scrutiny to LOW', () => {
    const targetUser = 'ACC0042'; // Has 1 alert in baseline
    const targetProfile = service.getEmployeeProfile(targetUser);
    assert.ok(targetProfile);
    assert.strictEqual(targetProfile.scrutinyLevel, 'MEDIUM');

    const createdCase = service.createCase({
      employeeId: targetUser,
      title: 'Off-Hours Overtime Review for ACC0042',
      leadInvestigator: 'Lead Investigator'
    });

    const resolved = service.recordOutcome(createdCase.id, {
      outcome: 'Resolved — Legitimate Activity',
      resolutionNotes: 'Supervisor verified approved engineering maintenance window overnight.',
      investigator: 'Lead Investigator',
      adjustScrutiny: true
    });

    assert.strictEqual(resolved.status, 'Resolved');
    assert.strictEqual(resolved.outcome, 'Resolved — Legitimate Activity');

    // Verify employee scrutiny reduced to LOW
    const updatedProfile = service.getEmployeeProfile(targetUser);
    assert.ok(updatedProfile);
    assert.strictEqual(updatedProfile.scrutinyLevel, 'LOW');
    assert.ok(updatedProfile.scrutinyExplanation.includes('legitimate activity'));
  });

  test('should record outcome Confirmed Incident — Evidence Reviewed and elevate scrutiny to HIGH', () => {
    const targetUser = 'BJM0111';
    const createdCase = service.createCase({
      employeeId: targetUser,
      title: 'Data Exfiltration Forensics for BJM0111',
      leadInvestigator: 'Forensics Specialist'
    });

    const confirmed = service.recordOutcome(createdCase.id, {
      outcome: 'Confirmed Incident — Evidence Reviewed',
      resolutionNotes: 'Forensic inspection recovered unauthorized staging directory with sensitive exports.',
      investigator: 'Forensics Specialist'
    });

    assert.strictEqual(confirmed.status, 'Resolved');
    assert.strictEqual(confirmed.outcome, 'Confirmed Incident — Evidence Reviewed');

    const updatedProfile = service.getEmployeeProfile(targetUser);
    assert.ok(updatedProfile);
    assert.strictEqual(updatedProfile.scrutinyLevel, 'HIGH');
  });

  test('should allow manual scrutiny adjustment with mandatory audited reason', () => {
    const targetUser = 'BAL0044';
    const adjusted = service.adjustScrutiny(
      targetUser,
      'HIGH',
      'Placed on priority scrutiny due to upcoming privileged role transition.',
      'Security Operations Director'
    );

    assert.strictEqual(adjusted.scrutinyLevel, 'HIGH');
    const latestHistory = adjusted.scrutinyHistory[adjusted.scrutinyHistory.length - 1];
    assert.strictEqual(latestHistory.newLevel, 'HIGH');
    assert.strictEqual(latestHistory.actor, 'Security Operations Director');
    assert.strictEqual(latestHistory.isManual, true);

    // Audit log should include this event
    const auditLog = service.getAuditLog();
    const event = auditLog.find(e => e.employeeId === targetUser && e.actionType === 'SCRUTINY_CHANGED');
    assert.ok(event);
    assert.strictEqual(event.newValue, 'HIGH');
  });

  // =========================================================================
  // Section F: University Demonstration Verification Tests
  // =========================================================================

  test('should open an existing employee profile from CERT r4.2 telemetry', () => {
    const profile = service.getEmployeeProfile('HDD0806');
    assert.ok(profile, 'HDD0806 profile must exist in local dataset');
    assert.strictEqual(profile.employeeId, 'HDD0806');
    assert.ok(profile.activityTotals.totalEvents > 0, 'Total events must be derived from records');
    assert.ok(profile.activityTotals.totalLogons > 0, 'Total logons must be derived from records');
  });

  test('should open an employee with zero security alerts without errors or synthetic data invention', () => {
    // AAM0658 is an employee in CERT r4.2 with zero alerts
    const profile = service.getEmployeeProfile('AAM0658');
    assert.ok(profile, 'Zero-alert employee profile must be viewable');
    assert.strictEqual(profile.employeeId, 'AAM0658');
    assert.strictEqual(profile.totalAlerts, 0);
    assert.strictEqual(profile.alerts.length, 0);
    assert.strictEqual(profile.scrutinyLevel, 'LOW');
    assert.ok(profile.activityTotals.totalLogons > 0, 'Baseline logons must be derived from records');
    assert.ok(profile.scrutinyExplanation.includes('baseline monitoring'));
  });

  test('should handle consistent employee identifiers with and without user: prefix', () => {
    // CERT employee lookup with and without prefix
    const withoutPrefixCert = service.getEmployeeProfile('HDD0806');
    const withPrefixCert = service.getEmployeeProfile('user:HDD0806');
    assert.ok(withoutPrefixCert, 'Profile with HDD0806 must resolve');
    assert.ok(withPrefixCert, 'Profile with user:HDD0806 must resolve');
    assert.strictEqual(withoutPrefixCert.employeeId, withPrefixCert.employeeId);
    assert.strictEqual(service.resolveCanonicalId('user:HDD0806'), 'HDD0806');
    assert.strictEqual(service.resolveCanonicalId('hdd0806'), 'HDD0806');

    // Zero-alert employee lookup with and without prefix
    const zeroWithoutPrefix = service.getEmployeeProfile('AAM0658');
    const zeroWithPrefix = service.getEmployeeProfile('user:AAM0658');
    assert.ok(zeroWithoutPrefix, 'Profile with AAM0658 must resolve');
    assert.ok(zeroWithPrefix, 'Profile with user:AAM0658 must resolve');
    assert.strictEqual(zeroWithoutPrefix.employeeId, zeroWithPrefix.employeeId);
    assert.strictEqual(service.resolveCanonicalId('user:aam0658'), 'AAM0658');
  });

  test('should return null (useful 404) for a genuinely missing employee', () => {
    const missing = service.getEmployeeProfile('user:nonexistent.employee.999');
    assert.strictEqual(missing, null, 'Genuinely missing employee must return null');
    assert.strictEqual(service.resolveCanonicalId('user:nonexistent.employee.999'), null);

    const missingDemo = service.getEmployeeProfile('user:elena.rostova');
    assert.strictEqual(missingDemo, null, 'Fabricated demo employee user:elena.rostova must not exist in operational cohort');
  });

  test('should link a genuine CERT alert to the correct employee', () => {
    const ajf = service.getEmployeeProfile('AJF0370');
    assert.ok(ajf);
    assert.strictEqual(ajf.alerts.length, 4);
    for (const a of ajf.alerts) {
      assert.strictEqual(a.user, 'AJF0370');
      assert.ok(a.alert_id.startsWith('CERT-ALT-'));
    }

    const hdd = service.getEmployeeProfile('HDD0806');
    assert.ok(hdd);
    assert.strictEqual(hdd.alerts.length, 1);
    assert.strictEqual(hdd.alerts[0].alert_id, 'CERT-ALT-00106');
    assert.strictEqual(hdd.alerts[0].alert_type, 'HIGH_OFF_HOURS_LOGONS');
  });

  test('should ensure zero synthetic demo cases exist in operational case store', () => {
    const allCases = service.getAllCases();
    for (const c of allCases) {
      assert.ok(!c.id.startsWith('DEMO-'), `Case ${c.id} must not be a demo case`);
      assert.ok(!c.title.includes('[DEMO]'), `Case title "${c.title}" must not contain [DEMO] badge`);
      assert.ok(!c.employeeId.includes('elena'), `Case ${c.id} must not belong to synthetic employee Elena`);
      assert.ok(!c.employeeId.includes('marcus'), `Case ${c.id} must not belong to synthetic employee Marcus`);
      assert.ok(!c.employeeId.includes('david.clark'), `Case ${c.id} must not belong to synthetic employee David`);
    }

    // Verify demo cases cannot be retrieved
    assert.strictEqual(service.getCaseById('DEMO-CASE-001'), undefined);
    assert.strictEqual(service.getCaseById('DEMO-CASE-002'), undefined);
    assert.strictEqual(service.getCaseById('DEMO-CASE-003'), undefined);
    assert.strictEqual(service.getCaseById('DEMO-CASE-004'), undefined);
    assert.strictEqual(service.getCaseById('DEMO-CASE-005'), undefined);
  });

  test('should accurately calculate dashboard operational counts from actual CERT data', () => {
    const stats = service.getOperationalStats();
    assert.strictEqual(stats.totalEmployees, 1000, 'Total employees must match actual CERT 1,000 employees');
    assert.strictEqual(stats.totalEvents, 1705820, 'Total telemetry events must equal 1,705,820');
    assert.strictEqual(stats.highScrutiny, 76, 'High scrutiny count must be derived from actual thresholds');
    assert.strictEqual(stats.highScrutiny + stats.mediumScrutiny + stats.lowScrutiny, 1000, 'Scrutiny classifications must sum to 1000');
    assert.strictEqual(stats.activeAlerts, 282, 'Total alerts must equal 282');
    assert.ok(stats.pendingReview <= 282, 'Pending review alerts must not exceed total alerts');
    assert.strictEqual(typeof stats.openCases, 'number');
  });

  test('should update a case and preserve its audit history', () => {
    const testCase = service.createCase({
      employeeId: 'HDD0806',
      title: 'Audit Trail Verification Case',
      leadInvestigator: 'Analyst Monish'
    });
    const updated = service.updateCaseStatus(testCase.id, 'Needs Review');
    assert.strictEqual(updated.status, 'Needs Review');

    // Verify audit trail record
    const auditLog = service.getAuditLog();
    const statusEvent = auditLog.find(e => e.caseId === testCase.id && e.actionType === 'STATUS_CHANGED');
    assert.ok(statusEvent, 'Status change audit record must exist');
    assert.strictEqual(statusEvent.newValue, 'Needs Review');
  });

  test('should persist genuine case records across local storage for backend restarts', () => {
    const fs = require('fs');
    const path = require('path');
    const projectRoot = path.resolve(process.cwd(), process.cwd().endsWith('backend') ? '..' : '.');
    const casesFile = path.join(projectRoot, 'analytics', 'output', 'cert_r4.2', 'investigations', 'cases.json');

    assert.ok(fs.existsSync(casesFile), 'cases.json must exist in local storage directory');
    const content = JSON.parse(fs.readFileSync(casesFile, 'utf-8'));
    assert.ok(Array.isArray(content), 'cases.json must be a JSON array');

    const ids = content.map((c: any) => c.id);
    assert.ok(!ids.includes('DEMO-CASE-001'), 'DEMO-CASE-001 must not be in persisted cases');
    assert.ok(!ids.includes('DEMO-CASE-002'), 'DEMO-CASE-002 must not be in persisted cases');
    assert.ok(!ids.includes('DEMO-CASE-003'), 'DEMO-CASE-003 must not be in persisted cases');
    assert.ok(!ids.includes('DEMO-CASE-004'), 'DEMO-CASE-004 must not be in persisted cases');
    assert.ok(!ids.includes('DEMO-CASE-005'), 'DEMO-CASE-005 must not be in persisted cases');
  });
});
