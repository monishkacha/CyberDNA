import { describe, it } from 'node:test';
import assert from 'node:assert';
import { EvaluationService } from './services/evaluationStore.js';

describe('EvaluationService Benchmark API Suite', () => {
  it('should load evaluation summary with 70 reference incidents', () => {
    const summary = EvaluationService.getSummary();
    assert.ok(summary);
    assert.strictEqual(summary.dataset_version, 'CERT Insider Threat Test Dataset Release 4.2');
    assert.strictEqual(summary.metrics.overall.total_incidents, 70);
    assert.strictEqual(summary.metrics.overall.window_detected_count, 69);
    assert.strictEqual(summary.metrics.overall.window_missed_count, 1);
  });

  it('should retrieve all 70 incident comparisons', () => {
    const result = EvaluationService.getIncidents();
    assert.strictEqual(result.total, 70);
    assert.strictEqual(result.filtered, 70);
    assert.strictEqual(result.data.length, 70);

    const first = result.data[0];
    assert.ok(first.incident_id.startsWith('CERT-INC-'));
    assert.ok(first.user);
    assert.ok(first.start);
    assert.ok(first.end);
    assert.ok(first.window_detection_status);
  });

  it('should filter incidents by scenario', () => {
    const sc1 = EvaluationService.getIncidents({ scenario: 1 });
    assert.strictEqual(sc1.filtered, 30);
    sc1.data.forEach(inc => assert.strictEqual(inc.scenario, 1));

    const sc2 = EvaluationService.getIncidents({ scenario: 2 });
    assert.strictEqual(sc2.filtered, 30);
    sc2.data.forEach(inc => assert.strictEqual(inc.scenario, 2));

    const sc3 = EvaluationService.getIncidents({ scenario: 3 });
    assert.strictEqual(sc3.filtered, 10);
    sc3.data.forEach(inc => assert.strictEqual(inc.scenario, 3));
  });

  it('should filter incidents by detection status', () => {
    const detected = EvaluationService.getIncidents({ status: 'DETECTED' });
    assert.strictEqual(detected.filtered, 69);

    const missed = EvaluationService.getIncidents({ status: 'MISSED' });
    assert.strictEqual(missed.filtered, 1);
    assert.strictEqual(missed.data[0].user, 'DCH0843');
  });

  it('should search incidents by employee or incident ID', () => {
    const searched = EvaluationService.getIncidents({ search: 'DCH0843' });
    assert.strictEqual(searched.filtered, 1);
    assert.strictEqual(searched.data[0].user, 'DCH0843');
  });

  it('should retrieve scenario breakdown for all 3 scenarios', () => {
    const scenarios = EvaluationService.getScenarios();
    assert.strictEqual(scenarios.length, 3);
  });

  it('should retrieve rule performance specifications', () => {
    const rules = EvaluationService.getRulePerformance();
    assert.ok(rules.length >= 3);
  });

  it('should retrieve data source coverage breakdown', () => {
    const cov = EvaluationService.getCoverage();
    assert.ok(cov);
    assert.deepStrictEqual(cov.supported_data_sources, ['logon.csv', 'device.csv', 'file.csv']);
  });
});
