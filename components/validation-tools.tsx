'use client';

import { useState } from 'react';
import { appPath } from '../lib/runtime-paths';

const WEBFLOW_WAY_INSTALL_URL =
  'https://webflow.com/oauth/authorize?response_type=code&client_id=28685cff5fef23c426a670bb57bf383b25cd16125bc5bba2103d899b3f4a7092&workspace=createsomethingagency';

export function ValidationToolsPage({ userEmail }: { userEmail: string }) {
  const [showGsapModal, setShowGsapModal] = useState(false);
  const [gsapUrl, setGsapUrl] = useState('');
  const [gsapValidating, setGsapValidating] = useState(false);
  const [gsapResult, setGsapResult] = useState<{
    passed: boolean;
    summary: { passRate: number; totalPages: number; passedPages: number; failedPages: number };
  } | null>(null);
  const [gsapError, setGsapError] = useState<string | null>(null);

  async function handleQuickValidate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!gsapUrl.trim()) {
      setGsapError('Please enter a URL');
      return;
    }

    setGsapValidating(true);
    setGsapError(null);
    setGsapResult(null);

    try {
      const response = await fetch(appPath('/api/validation/gsap'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: gsapUrl.trim() })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Validation failed');
      }

      setGsapResult(data);
    } catch (err) {
      setGsapError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setGsapValidating(false);
    }
  }

  return (
    <main className="container">
      <div className="page-stack">
        <section className="page-header">
          <div>
            <h1 className="page-title">Validation Tools</h1>
            <p className="page-subtitle">
              Test and validate your templates before submission to ensure marketplace compliance.
            </p>
          </div>
        </section>

        <section className="card">
          <div className="page-header">
            <div>
              <h2 className="card-title">Start with the fastest check</h2>
              <p className="card-subtitle">Quick read first, full inspection second.</p>
            </div>
            <span className="pill">Primary workflow</span>
          </div>
          <div className="form-actions" style={{ marginTop: '1rem' }}>
            <button className="button button-primary" type="button" onClick={() => setShowGsapModal(true)}>
              Quick Validate
            </button>
            <a className="button-link button-secondary" href={appPath('/validation/playground')}>
              Open Full Playground
            </a>
          </div>
        </section>

        <section>
          <h2 className="card-title" style={{ marginBottom: '0.75rem' }}>
            Other Validation Tools
          </h2>
          <div className="grid grid-2">
            <div className="card">
              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 'var(--radius-sm)',
                    background: 'var(--color-primary-soft)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    color: 'var(--color-primary)',
                    fontWeight: 700,
                    fontSize: '1.2rem'
                  }}
                >
                  W
                </div>
                <div>
                  <h3 className="card-title">Webflow Way Validator</h3>
                  <div className="pill-row" style={{ marginTop: '0.35rem' }}>
                    <span className="pill">Designer App</span>
                    <span className="pill">Requires Install</span>
                  </div>
                </div>
              </div>
              <p className="card-subtitle" style={{ marginTop: '0.75rem' }}>
                Designer App that validates templates against Webflow Way best practices. Automated checks
                for design system, naming conventions, SEO, page structure, and more.
              </p>
              <div className="notice" style={{ marginTop: '0.75rem' }}>
                <strong>How it works:</strong> Install from Workspace Settings, publish your project first,
                run from Apps panel (30-60 seconds), get step-by-step fix instructions.
              </div>
              <div className="form-actions" style={{ marginTop: '0.75rem' }}>
                <a
                  className="button-link button-primary"
                  href={WEBFLOW_WAY_INSTALL_URL}
                  target="_blank"
                  rel="noreferrer"
                >
                  Install App
                </a>
              </div>
            </div>
          </div>
        </section>

        <section className="card">
          <h3 className="card-title">Validation Heuristics</h3>
          <p className="card-subtitle" style={{ marginTop: '0.35rem' }}>
            Use validation to catch high-cost issues before review.
          </p>
          <ul style={{ margin: '0.75rem 0 0', paddingLeft: '1rem', color: 'var(--color-fg-muted)' }}>
            <li>Catch potential issues early in development</li>
            <li>Reduce submission review time</li>
            <li>Ensure compliance with marketplace guidelines</li>
            <li>Improve template quality and user experience</li>
          </ul>
          <div className="notice" style={{ marginTop: '0.75rem' }}>
            <strong>Best Practice:</strong> Run all available validation tools before submitting your template
            to the marketplace.
          </div>
        </section>
      </div>

      {showGsapModal ? (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 100,
            background: 'rgba(0,0,0,0.4)',
            display: 'grid',
            placeItems: 'center',
            padding: '1rem'
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowGsapModal(false);
          }}
        >
          <div className="card" style={{ maxWidth: '32rem', width: '100%', boxShadow: 'var(--shadow-md)' }}>
            <div className="page-header">
              <h2 className="card-title">Quick GSAP Validation</h2>
              <button
                className="button button-secondary"
                type="button"
                onClick={() => setShowGsapModal(false)}
                style={{ minHeight: 'auto', padding: '0.4rem 0.75rem' }}
              >
                Close
              </button>
            </div>
            <form className="form-stack" onSubmit={handleQuickValidate} style={{ marginTop: '1rem' }}>
              <div className="field">
                <label className="field-label" htmlFor="gsapUrl">
                  Webflow Site URL
                </label>
                <input
                  className="field-input"
                  id="gsapUrl"
                  type="url"
                  placeholder="https://your-site.webflow.io"
                  value={gsapUrl}
                  onChange={(e) => setGsapUrl(e.target.value)}
                  disabled={gsapValidating}
                />
              </div>
              {gsapError ? <div className="notice notice-error">{gsapError}</div> : null}
              {gsapResult ? (
                <div className={`notice ${gsapResult.passed ? 'notice-success' : 'notice-error'}`}>
                  <strong>{gsapResult.passed ? 'Validation Passed' : 'Validation Failed'}</strong>
                  <div style={{ marginTop: '0.35rem' }}>
                    {gsapResult.summary.passRate}% pass rate across {gsapResult.summary.totalPages} pages.
                    {gsapResult.summary.failedPages > 0 ? (
                      <> {gsapResult.summary.failedPages} page(s) failed.</>
                    ) : null}
                  </div>
                </div>
              ) : null}
              <button className="button button-primary" type="submit" disabled={gsapValidating}>
                {gsapValidating ? 'Validating…' : 'Validate Site'}
              </button>
            </form>
          </div>
        </div>
      ) : null}
    </main>
  );
}
