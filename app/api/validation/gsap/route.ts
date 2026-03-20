import { NextResponse } from 'next/server';
import { getUserFromRequest } from '../../../../lib/server/session';

interface WorkerPageResult {
  url: string;
  title?: string;
  success?: boolean;
  passed: boolean;
  flaggedCodeCount: number;
  error?: string;
  summary?: {
    securityRiskCount: number;
    validGsapCount: number;
  };
  details?: {
    flaggedCode: { message: string; flaggedCode: string[] }[];
    securityRisks?: { message: string; flaggedCode: string[] }[];
  };
}

interface WorkerResponse {
  url: string;
  success: boolean;
  passed: boolean;
  siteResults: {
    pageCount: number;
    analyzedCount: number;
    passedCount: number;
    failedCount: number;
    requestFailureCount?: number;
    validationFailureCount?: number;
  };
  pageResults: WorkerPageResult[];
  crawlStats?: { duration?: number; pagesPerSecond?: number };
  error?: string;
  message?: string;
}

const WORKER_URL = 'https://gsap-validation-worker.createsomething.workers.dev/crawlWebsite';
const WORKER_TIMEOUT_MS = 30_000;

export async function POST(request: Request) {
  const user = await getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = (await request.json()) as { url?: string };
  const { url } = body;

  if (!url) {
    return NextResponse.json({ error: 'URL is required' }, { status: 400 });
  }

  if (!url.startsWith('https://') || !url.includes('.webflow.io')) {
    return NextResponse.json(
      { error: 'URL must be a Webflow site (https://...webflow.io)' },
      { status: 400 }
    );
  }

  try {
    const abortController = new AbortController();
    const timeoutId = setTimeout(() => abortController.abort(), WORKER_TIMEOUT_MS);

    let response: Response;
    try {
      response = await fetch(WORKER_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, maxDepth: 1, maxPages: 50 }),
        signal: abortController.signal
      });
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      if (response.status === 502 || response.status === 503) {
        return NextResponse.json(
          { error: 'Validation service temporarily unavailable. Please try again in a few moments.' },
          { status: 503 }
        );
      }
      if (response.status === 429) {
        return NextResponse.json(
          { error: 'Too many validation requests. Please wait a moment before trying again.' },
          { status: 429 }
        );
      }
      return NextResponse.json({ error: 'Validation service error. Please try again later.' }, { status: 500 });
    }

    const workerData = (await response.json()) as WorkerResponse;
    const pageResults = Array.isArray(workerData.pageResults) ? workerData.pageResults : [];
    const analyzedCount =
      workerData.siteResults?.analyzedCount ?? pageResults.filter((p) => p.success !== false).length;
    const passedCount =
      workerData.siteResults?.passedCount ??
      pageResults.filter((p) => p.success !== false && p.passed).length;
    const requestFailureCount =
      workerData.siteResults?.requestFailureCount ??
      pageResults.filter((p) => p.success === false).length;
    const validationFailureCount =
      workerData.siteResults?.validationFailureCount ??
      pageResults.filter((p) => p.success !== false && !p.passed).length;
    const failedCount =
      workerData.siteResults?.failedCount ?? requestFailureCount + validationFailureCount;
    const totalPages = workerData.siteResults?.pageCount ?? pageResults.length;
    const normalizedSuccess =
      workerData.success === true && (!workerData.error || workerData.error.length === 0) && totalPages > 0;
    const normalizedPassed =
      normalizedSuccess && failedCount === 0 && analyzedCount === totalPages && totalPages > 0;

    if (!normalizedSuccess) {
      return NextResponse.json(
        { error: workerData.error || workerData.message || 'Validation service returned an invalid response.' },
        { status: 502 }
      );
    }

    const issueMap = new Map<string, number>();
    for (const page of pageResults) {
      if (page.details?.flaggedCode) {
        for (const issue of page.details.flaggedCode) {
          issueMap.set(issue.message, (issueMap.get(issue.message) || 0) + 1);
        }
      }
    }
    const commonIssues = Array.from(issueMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([issue, count]) => ({ issue, count }));

    const recommendations: { type: string; title: string; description: string; action: string; required: boolean; priority: number }[] = [];
    if (!normalizedPassed) {
      recommendations.push({
        type: 'critical',
        title: 'Template Failed Validation',
        description: 'This template contains code that violates Webflow template guidelines.',
        action: 'Review and fix all flagged code before submission.',
        required: true,
        priority: 1
      });
    }
    const totalFlagged = pageResults.reduce((t, p) => t + (p.flaggedCodeCount || 0), 0);
    if (totalFlagged > 0) {
      recommendations.push({
        type: 'warning',
        title: 'Custom Code Issues Found',
        description: `${totalFlagged} instances of flagged code detected across pages.`,
        action: 'Use only approved GSAP implementations and remove custom CSS animations.',
        required: true,
        priority: 2
      });
    }
    const totalSecurity = pageResults.reduce((t, p) => t + (p.summary?.securityRiskCount || 0), 0);
    if (totalSecurity > 0) {
      recommendations.push({
        type: 'critical',
        title: 'Security Risks Detected',
        description: `${totalSecurity} security risks found in custom code.`,
        action: 'Remove all potentially harmful code immediately.',
        required: true,
        priority: 1
      });
    }
    if (normalizedPassed) {
      recommendations.push({
        type: 'success',
        title: 'Template Validation Passed',
        description: 'All pages comply with Webflow template guidelines.',
        action: 'Template is ready for submission to the marketplace.',
        required: false,
        priority: 3
      });
    }
    recommendations.sort((a, b) => a.priority - b.priority);

    return NextResponse.json({
      url: workerData.url,
      success: normalizedSuccess,
      passed: normalizedPassed,
      timestamp: new Date().toISOString(),
      summary: {
        totalPages,
        analyzedPages: analyzedCount,
        passedPages: passedCount,
        failedPages: failedCount,
        passRate: totalPages > 0 ? Math.round((passedCount / totalPages) * 100) : 0
      },
      issues: {
        totalFlaggedCode: totalFlagged,
        totalSecurityRisks: totalSecurity,
        totalValidGsap: pageResults.reduce((t, p) => t + (p.summary?.validGsapCount || 0), 0),
        commonIssues
      },
      pageResults: pageResults.map((page) => ({
        url: page.url,
        title: page.title || page.url,
        passed: page.success !== false && page.passed,
        flaggedCodeCount: page.flaggedCodeCount || 0,
        securityRiskCount: page.summary?.securityRiskCount || 0,
        validGsapCount: page.summary?.validGsapCount || 0,
        mainIssues: (page.details?.flaggedCode?.slice(0, 3) || []).map((issue) => ({
          type: issue.message,
          preview: issue.flaggedCode?.[0]?.substring(0, 100) || '',
          fullDetails: issue.flaggedCode || []
        })),
        allFlaggedCode: page.details?.flaggedCode || []
      })),
      crawlStats: workerData.crawlStats,
      recommendations
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      return NextResponse.json({ error: 'Validation timed out. Please try again.' }, { status: 504 });
    }
    console.error('[Validation] Error:', err);
    return NextResponse.json({ error: 'An unexpected error occurred during validation.' }, { status: 500 });
  }
}
