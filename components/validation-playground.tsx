'use client';

import { useState } from 'react';
import { appPath } from '../lib/runtime-paths';

type SortOption = 'issues-high' | 'issues-low' | 'name' | 'health';
type TabOption = 'overview' | 'pages' | 'issues' | 'recommendations';

interface FlaggedCode {
  message: string;
  flaggedCode: string[];
}

interface PageResult {
  url: string;
  title: string;
  passed: boolean;
  flaggedCodeCount: number;
  securityRiskCount: number;
  validGsapCount: number;
  mainIssues: { type: string; preview: string; fullDetails: string[] }[];
  allFlaggedCode: FlaggedCode[];
}

interface Recommendation {
  type: 'critical' | 'warning' | 'success';
  title: string;
  description: string;
  action: string;
  required?: boolean;
}

interface ValidationResult {
  url: string;
  passed: boolean;
  timestamp: string;
  summary: {
    totalPages: number;
    analyzedPages: number;
    passedPages: number;
    failedPages: number;
    passRate: number;
  };
  issues: {
    totalFlaggedCode: number;
    totalSecurityRisks: number;
    totalValidGsap: number;
    commonIssues: { issue: string; count: number }[];
  };
  pageResults: PageResult[];
  crawlStats?: { duration?: number; pagesPerSecond?: number };
  recommendations: Recommendation[];
}

function sortPages(pages: PageResult[], sortOption: SortOption): PageResult[] {
  const sorted = [...pages];
  switch (sortOption) {
    case 'issues-high':
      return sorted.sort((a, b) => b.flaggedCodeCount - a.flaggedCodeCount);
    case 'issues-low':
      return sorted.sort((a, b) => a.flaggedCodeCount - b.flaggedCodeCount);
    case 'name':
      return sorted.sort((a, b) => a.url.localeCompare(b.url));
    case 'health':
      return sorted.sort((a, b) => (a.passed === b.passed ? 0 : a.passed ? -1 : 1));
    default:
      return sorted;
  }
}

export function ValidationPlayground() {
  const [url, setUrl] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ValidationResult | null>(null);
  const [activeTab, setActiveTab] = useState<TabOption>('overview');
  const [sortOption, setSortOption] = useState<SortOption>('issues-high');
  const [expandedPages, setExpandedPages] = useState<Set<string>>(new Set());

  async function handleValidate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!url.trim()) {
      setError('Please enter a URL');
      return;
    }

    setError(null);
    setIsValidating(true);
    setResult(null);

    try {
      const response = await fetch(appPath('/api/validation/gsap'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() })
      });

      if (!response.ok) {
        const data = (await response.json()) as { error?: string; message?: string };
        throw new Error(data.error || data.message || 'Validation failed');
      }

      setResult((await response.json()) as ValidationResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsValidating(false);
    }
  }

  function togglePageExpand(pageUrl: string) {
    setExpandedPages((current) => {
      const next = new Set(current);
      if (next.has(pageUrl)) {
        next.delete(pageUrl);
      } else {
        next.add(pageUrl);
      }
      return next;
    });
  }

  const sortedPageResults = result ? sortPages(result.pageResults, sortOption) : [];

  return (
    <main className="container">
      <div className="page-stack">
        <section className="page-header">
          <div>
            <a className="nav-link" href={appPath('/validation')} style={{ marginBottom: '0.5rem', display: 'inline-block' }}>
              &larr; Back to Validation Tools
            </a>
            <h1 className="page-title">GSAP Validation Playground</h1>
            <p className="page-subtitle">
              Validate your Webflow site against GSAP template guidelines. The validator crawls up to 50
              pages and checks for custom code compliance.
            </p>
          </div>
        </section>

        <section className="card">
          <form onSubmit={handleValidate}>
            <div className="field">
              <label className="field-label" htmlFor="playground-url">
                Webflow Site URL
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '0.75rem' }}>
                <input
                  className="field-input"
                  id="playground-url"
                  type="url"
                  placeholder="https://your-site.webflow.io"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  disabled={isValidating}
                />
                <button className="button button-primary" type="submit" disabled={isValidating}>
                  {isValidating ? 'Validating…' : 'Validate Site'}
                </button>
              </div>
              {error ? (
                <p style={{ color: 'var(--color-error)', fontSize: '0.9rem', margin: '0.5rem 0 0' }}>{error}</p>
              ) : null}
            </div>
          </form>
        </section>

        {result ? (
          <>
            <section
              className={`notice ${result.passed ? 'notice-success' : 'notice-error'}`}
              style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span
                  style={{
                    width: '2rem',
                    height: '2rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: '50%',
                    fontWeight: 700,
                    background: result.passed ? 'var(--color-success)' : 'var(--color-error)',
                    color: '#fff'
                  }}
                >
                  {result.passed ? '✓' : '✗'}
                </span>
                <strong style={{ fontSize: '1.15rem' }}>
                  {result.passed ? 'Validation Passed' : 'Validation Failed'}
                </strong>
              </div>
              <div style={{ paddingLeft: '2.75rem', color: 'inherit', fontSize: '0.9rem' }}>
                <div>{result.url}</div>
                <div>Validated {new Date(result.timestamp).toLocaleString()}</div>
              </div>
            </section>

            <section className="grid grid-3" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
              <div className="metric">
                <div className="metric-value">{result.summary.passRate}%</div>
                <div className="metric-label">Pass Rate</div>
              </div>
              <div className="metric">
                <div className="metric-value">{result.summary.totalPages}</div>
                <div className="metric-label">Total Pages</div>
              </div>
              <div className="metric" style={{ borderColor: 'rgba(0, 215, 34, 0.25)' }}>
                <div className="metric-value" style={{ color: 'var(--color-success)' }}>
                  {result.summary.passedPages}
                </div>
                <div className="metric-label">Passed</div>
              </div>
              <div className="metric" style={{ borderColor: 'rgba(238, 29, 54, 0.25)' }}>
                <div className="metric-value" style={{ color: 'var(--color-error)' }}>
                  {result.summary.failedPages}
                </div>
                <div className="metric-label">Failed</div>
              </div>
            </section>

            <section className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div className="submit-switch" style={{ padding: '1rem 1.25rem 0' }}>
                {(['overview', 'pages', 'issues', 'recommendations'] as TabOption[]).map((tab) => (
                  <button
                    key={tab}
                    className="step-tab"
                    data-active={activeTab === tab}
                    type="button"
                    onClick={() => setActiveTab(tab)}
                  >
                    {tab === 'overview'
                      ? 'Overview'
                      : tab === 'pages'
                        ? `Pages (${result.pageResults.length})`
                        : tab === 'issues'
                          ? `Issues (${result.issues.totalFlaggedCode})`
                          : `Recommendations (${result.recommendations.length})`}
                  </button>
                ))}
              </div>

              <div style={{ padding: '1.25rem' }}>
                {activeTab === 'overview' ? (
                  <div className="grid grid-2">
                    <div style={{ background: 'var(--color-bg-subtle)', borderRadius: 'var(--radius-md)', padding: '1rem' }}>
                      <h3 className="card-title">Issue Summary</h3>
                      <div className="grid grid-3" style={{ marginTop: '0.75rem' }}>
                        <div>
                          <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{result.issues.totalFlaggedCode}</div>
                          <div style={{ color: 'var(--color-fg-muted)', fontSize: '0.88rem' }}>Flagged Code</div>
                        </div>
                        <div>
                          <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{result.issues.totalSecurityRisks}</div>
                          <div style={{ color: 'var(--color-fg-muted)', fontSize: '0.88rem' }}>Security Risks</div>
                        </div>
                        <div>
                          <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{result.issues.totalValidGsap}</div>
                          <div style={{ color: 'var(--color-fg-muted)', fontSize: '0.88rem' }}>Valid GSAP</div>
                        </div>
                      </div>
                    </div>
                    <div style={{ background: 'var(--color-bg-subtle)', borderRadius: 'var(--radius-md)', padding: '1rem' }}>
                      <h3 className="card-title">Common Issues</h3>
                      {result.issues.commonIssues.length > 0 ? (
                        <ul style={{ margin: '0.75rem 0 0', padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                          {result.issues.commonIssues.map((ci) => (
                            <li key={ci.issue} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
                              <span
                                style={{
                                  background: 'var(--color-error-soft)',
                                  color: 'var(--color-error)',
                                  padding: '0.1rem 0.4rem',
                                  borderRadius: '0.25rem',
                                  fontSize: '0.8rem',
                                  fontWeight: 600
                                }}
                              >
                                {ci.count}x
                              </span>
                              <span style={{ color: 'var(--color-fg-muted)', fontSize: '0.9rem' }}>{ci.issue}</span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p style={{ color: 'var(--color-fg-muted)', margin: '0.75rem 0 0' }}>No common issues found</p>
                      )}
                    </div>
                    {result.crawlStats ? (
                      <div style={{ color: 'var(--color-fg-muted)', fontSize: '0.84rem', gridColumn: '1 / -1' }}>
                        Duration: {result.crawlStats.duration?.toFixed(1) || 'N/A'}s
                        {result.crawlStats.pagesPerSecond
                          ? ` · Speed: ${result.crawlStats.pagesPerSecond.toFixed(1)} pages/sec`
                          : null}
                      </div>
                    ) : null}
                  </div>
                ) : null}

                {activeTab === 'pages' ? (
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.75rem' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--color-fg-muted)', fontSize: '0.9rem' }}>
                        Sort by:
                        <select
                          className="field-select"
                          style={{ width: 'auto', minHeight: 'auto', padding: '0.4rem 0.6rem' }}
                          value={sortOption}
                          onChange={(e) => setSortOption(e.target.value as SortOption)}
                        >
                          <option value="issues-high">Most Issues</option>
                          <option value="issues-low">Least Issues</option>
                          <option value="name">Name</option>
                          <option value="health">Health</option>
                        </select>
                      </label>
                    </div>
                    <div className="asset-list">
                      {sortedPageResults.map((page) => (
                        <div
                          key={page.url}
                          className="asset-row"
                          style={!page.passed ? { borderLeft: '3px solid var(--color-error)' } : undefined}
                        >
                          <button
                            type="button"
                            onClick={() => togglePageExpand(page.url)}
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              width: '100%',
                              background: 'transparent',
                              border: 'none',
                              cursor: 'pointer',
                              textAlign: 'left',
                              padding: 0
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <span
                                style={{
                                  width: '1.5rem',
                                  height: '1.5rem',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  borderRadius: '50%',
                                  fontSize: '0.75rem',
                                  fontWeight: 700,
                                  background: page.passed ? 'var(--color-success)' : 'var(--color-error)',
                                  color: '#fff'
                                }}
                              >
                                {page.passed ? '✓' : '✗'}
                              </span>
                              <div>
                                <div style={{ fontWeight: 500 }}>{page.title || 'Untitled'}</div>
                                <div style={{ color: 'var(--color-fg-muted)', fontSize: '0.8rem' }}>{page.url}</div>
                              </div>
                            </div>
                            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                              {page.flaggedCodeCount > 0 ? (
                                <span className="pill" style={{ background: 'var(--color-error-soft)', color: 'var(--color-error)' }}>
                                  {page.flaggedCodeCount} flagged
                                </span>
                              ) : null}
                              {page.securityRiskCount > 0 ? (
                                <span className="pill" style={{ background: 'var(--color-warning-soft)', color: 'var(--color-warning)' }}>
                                  {page.securityRiskCount} security
                                </span>
                              ) : null}
                              {page.validGsapCount > 0 ? (
                                <span className="pill" style={{ background: 'var(--color-success-soft)', color: 'var(--color-success)' }}>
                                  {page.validGsapCount} valid GSAP
                                </span>
                              ) : null}
                              <span style={{ color: 'var(--color-fg-muted)', fontSize: '1.25rem', width: '1.5rem', textAlign: 'center' }}>
                                {expandedPages.has(page.url) ? '−' : '+'}
                              </span>
                            </div>
                          </button>
                          {expandedPages.has(page.url) ? (
                            <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid var(--color-border)' }}>
                              {page.allFlaggedCode.length > 0 ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                  <h4 style={{ margin: 0, fontSize: '0.92rem' }}>Flagged Code</h4>
                                  {page.allFlaggedCode.map((flagged, idx) => (
                                    <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                      <p style={{ color: 'var(--color-error)', fontSize: '0.9rem', margin: 0 }}>
                                        {flagged.message}
                                      </p>
                                      {flagged.flaggedCode.map((code, cIdx) => (
                                        <pre
                                          key={cIdx}
                                          className="inline-code"
                                          style={{
                                            whiteSpace: 'pre-wrap',
                                            wordBreak: 'break-all',
                                            margin: 0,
                                            padding: '0.5rem',
                                            fontSize: '0.8rem'
                                          }}
                                        >
                                          {code}
                                        </pre>
                                      ))}
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <p style={{ color: 'var(--color-fg-muted)', margin: 0 }}>No issues found on this page</p>
                              )}
                            </div>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                {activeTab === 'issues' ? (
                  <div>
                    {result.issues.totalFlaggedCode === 0 ? (
                      <div style={{ textAlign: 'center', padding: '2rem 0' }}>
                        <span
                          style={{
                            display: 'inline-flex',
                            width: '3rem',
                            height: '3rem',
                            alignItems: 'center',
                            justifyContent: 'center',
                            borderRadius: '50%',
                            background: 'var(--color-success)',
                            color: '#fff',
                            fontSize: '1.25rem',
                            marginBottom: '0.75rem'
                          }}
                        >
                          ✓
                        </span>
                        <p style={{ color: 'var(--color-fg-muted)' }}>No issues found across all pages.</p>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        {result.pageResults
                          .filter((p) => p.flaggedCodeCount > 0)
                          .map((page) => (
                            <div key={page.url}>
                              <h4 style={{ margin: '0 0 0.5rem' }}>
                                <a href={page.url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-primary)' }}>
                                  {page.title || page.url}
                                </a>
                              </h4>
                              {page.allFlaggedCode.map((flagged, idx) => (
                                <div
                                  key={idx}
                                  style={{
                                    paddingLeft: '0.75rem',
                                    borderLeft: '2px solid var(--color-error)',
                                    marginBottom: '0.5rem'
                                  }}
                                >
                                  <p style={{ color: 'var(--color-error)', fontSize: '0.9rem', margin: '0 0 0.25rem' }}>
                                    {flagged.message}
                                  </p>
                                  {flagged.flaggedCode.map((code, cIdx) => (
                                    <pre
                                      key={cIdx}
                                      className="inline-code"
                                      style={{
                                        whiteSpace: 'pre-wrap',
                                        wordBreak: 'break-all',
                                        margin: '0 0 0.25rem',
                                        padding: '0.5rem',
                                        fontSize: '0.8rem'
                                      }}
                                    >
                                      {code}
                                    </pre>
                                  ))}
                                </div>
                              ))}
                            </div>
                          ))}
                      </div>
                    )}
                  </div>
                ) : null}

                {activeTab === 'recommendations' ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {result.recommendations.map((rec, idx) => (
                      <div
                        key={idx}
                        className={`notice ${
                          rec.type === 'critical'
                            ? 'notice-error'
                            : rec.type === 'warning'
                              ? 'notice-warning'
                              : 'notice-success'
                        }`}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
                          <strong>{rec.title}</strong>
                          {rec.required ? (
                            <span
                              style={{
                                padding: '0.1rem 0.4rem',
                                background: 'var(--color-error)',
                                color: '#fff',
                                borderRadius: '0.25rem',
                                fontSize: '0.75rem',
                                fontWeight: 600
                              }}
                            >
                              Required
                            </span>
                          ) : null}
                        </div>
                        <p style={{ margin: '0 0 0.35rem', fontSize: '0.9rem' }}>{rec.description}</p>
                        <p style={{ margin: 0, fontSize: '0.9rem' }}>
                          <strong>Action:</strong> {rec.action}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            </section>
          </>
        ) : null}
      </div>
    </main>
  );
}
