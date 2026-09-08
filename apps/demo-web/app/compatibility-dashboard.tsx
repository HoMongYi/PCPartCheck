'use client';

import type {
  DemoDashboardResponse,
  DemoScenarioResult,
} from '@pcpartcheck/api-contracts';
import { useMemo, useState } from 'react';

type Filter = 'ALL' | 'ALLOW' | 'WARNING' | 'BLOCK' | 'REVIEW';

const filters: ReadonlyArray<{ readonly id: Filter; readonly label: string }> = [
  { id: 'ALL', label: '전체' },
  { id: 'ALLOW', label: '진행 가능' },
  { id: 'WARNING', label: '경고' },
  { id: 'BLOCK', label: '차단' },
  { id: 'REVIEW', label: '검토' },
];

const decisionLabels: Readonly<Record<DemoScenarioResult['decision'], string>> = {
  ALLOW: '진행 가능',
  ALLOW_WITH_WARNING: '경고 후 진행',
  ALLOW_IF_CONDITIONS_MET: '조건 확인 후 진행',
  REVIEW: '직접 검토',
  BLOCK: '조립 차단',
  NO_DECISION: '판정 없음',
};

const statusLabels: Readonly<Record<DemoScenarioResult['status'], string>> = {
  PASS: '통과',
  WARNING: '주의',
  CONDITIONAL: '조건부',
  UNKNOWN: '정보 부족',
  REVIEW_REQUIRED: '검토 필요',
  INCOMPATIBLE: '호환 불가',
  NOT_CHECKED: '확인 안 함',
};

function matchesFilter(scenario: DemoScenarioResult, filter: Filter): boolean {
  if (filter === 'ALL') return true;
  if (filter === 'ALLOW') return scenario.decision === 'ALLOW';
  if (filter === 'WARNING') {
    return (
      scenario.decision === 'ALLOW_WITH_WARNING' ||
      scenario.decision === 'ALLOW_IF_CONDITIONS_MET'
    );
  }
  if (filter === 'REVIEW') {
    return scenario.decision === 'REVIEW' || scenario.decision === 'NO_DECISION';
  }
  return scenario.decision === 'BLOCK';
}

function DecisionMark({ decision }: { readonly decision: DemoScenarioResult['decision'] }) {
  return (
    <span className={`decision-mark decision-${decision.toLowerCase()}`}>
      <span aria-hidden="true" className="decision-dot" />
      {decisionLabels[decision]}
    </span>
  );
}

export function CompatibilityDashboard({
  apiDocsUrl,
  dashboard,
}: {
  readonly apiDocsUrl: string;
  readonly dashboard: DemoDashboardResponse;
}) {
  const [activeFilter, setActiveFilter] = useState<Filter>('ALL');
  const visibleScenarios = useMemo(
    () => dashboard.scenarios.filter((scenario) => matchesFilter(scenario, activeFilter)),
    [activeFilter, dashboard.scenarios],
  );
  const blockCount = dashboard.scenarios.filter(
    (scenario) => scenario.decision === 'BLOCK',
  ).length;
  const reviewCount = dashboard.scenarios.filter(
    (scenario) => scenario.decision === 'REVIEW',
  ).length;

  return (
    <main>
      <header className="masthead">
        <div className="brand-lockup">
          <span className="brand-index">PCC / 01</span>
          <span className="brand-rule" aria-hidden="true" />
          <span className="schema-chip">CANONICAL 3.0.0</span>
        </div>
        <a className="api-link" href={apiDocsUrl}>
          API 문서 <span aria-hidden="true">↗</span>
        </a>
      </header>

      <section className="hero" aria-labelledby="page-title">
        <div className="hero-copy">
          <p className="eyebrow">DETERMINISTIC COMPATIBILITY ENGINE</p>
          <h1 id="page-title">PCPartCheck</h1>
          <p className="hero-description">
            맞을 것 같다는 추측 대신, 정규화된 제원과 공개된 규칙으로 조립 가능성을
            확인합니다. 정보가 부족하면 억지로 통과시키지 않고 검토 항목으로 남깁니다.
          </p>
        </div>
        <div className="inspection-stamp" aria-label="검사 시나리오 요약">
          <span>TEST BATCH</span>
          <strong>{String(dashboard.scenarios.length).padStart(2, '0')}</strong>
          <dl>
            <div><dt>차단</dt><dd>{blockCount}</dd></div>
            <div><dt>검토</dt><dd>{reviewCount}</dd></div>
          </dl>
        </div>
      </section>

      <section className="scenario-section" aria-labelledby="scenario-title">
        <div className="section-heading">
          <div>
            <p className="section-number">01 / ENGINE OUTPUT</p>
            <h2 id="scenario-title">합성 조립 시나리오</h2>
          </div>
          <p>모든 결과는 현재 엔진을 실행해 만든 값입니다.</p>
        </div>

        <div className="result-contract" aria-label="Status와 Decision 설명">
          <p><strong>Status는 기술 판정</strong>입니다. Rule 중 가장 심각한 결과를 그대로 보여 줍니다.</p>
          <p><strong>Decision은 소비자 행동</strong>입니다. Required와 Advisory 정책을 반영해 진행 여부를 정합니다.</p>
        </div>

        <div className="filter-bar" aria-label="판정 필터">
          {filters.map((filter) => (
            <button
              aria-pressed={activeFilter === filter.id}
              key={filter.id}
              onClick={() => setActiveFilter(filter.id)}
              type="button"
            >
              {filter.label}
            </button>
          ))}
        </div>

        <div className="scenario-grid" aria-live="polite">
          {visibleScenarios.map((scenario, index) => (
            <article
              className={`scenario-card scenario-${scenario.decision.toLowerCase()}`}
              data-testid="scenario-card"
              key={scenario.id}
            >
              <div className="scenario-meta">
                <span>{String(index + 1).padStart(2, '0')}</span>
                <span>{scenario.id}</span>
              </div>
              <h3>{scenario.title}</h3>
              <p>{scenario.summary}</p>
              <div className="scenario-result">
                <DecisionMark decision={scenario.decision} />
                <span className="status-label">STATUS / {statusLabels[scenario.status]}</span>
              </div>
              {(scenario.blockingRuleIds.length > 0 ||
                scenario.reviewRuleIds.length > 0 ||
                scenario.advisoryRuleIds.length > 0) && (
                <div className="rule-strip">
                  {[
                    ...scenario.blockingRuleIds,
                    ...scenario.reviewRuleIds,
                    ...scenario.advisoryRuleIds,
                  ].map((ruleId) => <code key={ruleId}>{ruleId}</code>)}
                </div>
              )}
              <details
                className="scenario-detail"
                open={Boolean(scenario.powerBudget) ||
                  scenario.status === 'UNKNOWN' ||
                  scenario.status === 'NOT_CHECKED'}
              >
                <summary>Rule 결과와 Coverage</summary>
                <div className="coverage-grid">
                  <span>Required {scenario.coverage.required.evaluated}/{scenario.coverage.required.total}</span>
                  <span>Unknown {scenario.coverage.required.unknown + scenario.coverage.advisory.unknown}</span>
                  <span>Not checked {scenario.coverage.required.notChecked + scenario.coverage.advisory.notChecked + scenario.coverage.disabled.notChecked}</span>
                </div>
                <ul className="rule-result-list">
                  {scenario.ruleResults.map((result) => (
                    <li key={result.ruleId}>
                      <code>{result.ruleId}</code>
                      <span>{result.policyMode} · {statusLabels[result.status]}</span>
                      <p>{result.summary}</p>
                    </li>
                  ))}
                </ul>
                <div className="capability-list" aria-label="Capability 상태">
                  {scenario.capabilities.map((capability) => (
                    <span key={`${capability.capabilityId}-${capability.mode}`}>
                      {capability.capabilityId} / {capability.mode} / {statusLabels[capability.status]}
                    </span>
                  ))}
                </div>
                {scenario.powerBudget && (
                  <div className="power-budget">
                    <strong>Power Budget 기준값</strong>
                    <dl>
                      <div><dt>추정 피크</dt><dd>{scenario.powerBudget.estimatedPeakPowerW} W</dd></div>
                      <div><dt>최소 출력</dt><dd>{scenario.powerBudget.minimumPsuW} W</dd></div>
                      <div><dt>계산 권장</dt><dd>{scenario.powerBudget.calculatedRecommendedPsuW} W</dd></div>
                      <div><dt>최종 권장</dt><dd>{scenario.powerBudget.recommendedPsuW} W</dd></div>
                      <div><dt>선택 PSU</dt><dd>{scenario.powerBudget.ratedPsuW} W</dd></div>
                    </dl>
                  </div>
                )}
              </details>
            </article>
          ))}
        </div>
      </section>

      <section className="evidence-section" aria-labelledby="evidence-title">
        <div className="evidence-intro">
          <p className="section-number">02 / FIELD REFERENCE</p>
          <h2 id="evidence-title">과거 유사한 구성의 조립 실패 사례 3건</h2>
          <p className="evidence-disclaimer">
            <span aria-hidden="true">!</span>
            유사 사례는 현재 구성의 호환 불가를 의미하지 않습니다.
          </p>
          <p>
            부품과 설치 조건이 완전히 같은 사례만 판정 근거가 됩니다. 아래 기록은 비슷한
            구성에서 무엇을 다시 확인해야 하는지 알려 주는 참고 자료입니다.
          </p>
        </div>

        <div className="evidence-list">
          <article className="exact-evidence" data-testid="exact-evidence-card">
            <div className="evidence-score">
              <span>MATCH</span>
              <strong>EXACT</strong>
            </div>
            <div className="evidence-body">
              <p className="evidence-id">CASE / {dashboard.exactEvidence.evidenceId}</p>
              <h3>승인된 동일 설치 조건의 실제 실패</h3>
              <p>
                같은 부품과 Installation Context에서 확인된 기록이라 현재 판정에 영향을
                줄 수 있습니다. 이 예시의 Rule 결과는{' '}
                <strong>{statusLabels[dashboard.exactEvidence.resultStatus]}</strong>입니다.
              </p>
              <dl className="field-comparison">
                <div>
                  <dt>접근 범위</dt>
                  <dd>{dashboard.exactEvidence.visibility} / {dashboard.exactEvidence.redaction}</dd>
                </div>
                <div>
                  <dt>기록 상태</dt>
                  <dd>{dashboard.exactEvidence.fieldEvidenceStatus} / {dashboard.exactEvidence.outcome}</dd>
                </div>
              </dl>
            </div>
          </article>
          {dashboard.similarEvidence.map((evidence, index) => (
            <article data-testid="similar-evidence-card" key={evidence.evidenceId}>
              <div className="evidence-score">
                <span>SIMILARITY</span>
                <strong>{Math.round(evidence.similarityScore * 100)}%</strong>
              </div>
              <div className="evidence-body">
                <p className="evidence-id">
                  CASE {String(index + 1).padStart(2, '0')} / {evidence.evidenceId}
                </p>
                <h3>{evidence.issueType.replaceAll('_', ' ')}</h3>
                <p>
                  {evidence.matchedFields.length}개 항목이 같고{' '}
                  {evidence.differences.length}개 항목이 다릅니다.
                </p>
                <dl className="field-comparison">
                  <div>
                    <dt>같은 항목</dt>
                    <dd>{evidence.matchedFields.join(', ') || '없음'}</dd>
                  </div>
                  <div>
                    <dt>다른 항목</dt>
                    <dd>{evidence.differences.join(', ') || '없음'}</dd>
                  </div>
                </dl>
              </div>
            </article>
          ))}
        </div>
      </section>

      <footer>
        <span>PCPartCheck / REFERENCE BUILD</span>
        <span>ENGINE 0.1.0 · RULESET 0.1.0</span>
      </footer>
    </main>
  );
}
