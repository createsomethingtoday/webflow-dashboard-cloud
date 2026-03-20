import { NextResponse } from 'next/server';
import { hasAdminAccess } from '@create-something/webflow-dashboard-core/security';
import { hashString } from '@create-something/webflow-dashboard-core/hash';
import { getUserFromRequest } from '../../../../lib/server/session';
import { getOptionalEnv } from '../../../../lib/server/env';

function safeRate(numerator: number, denominator: number): number {
  return denominator > 0 ? Math.round((numerator / denominator) * 10000) / 100 : 0;
}

function safeRatio(numerator: number, denominator: number): number {
  return denominator > 0 ? Math.round((numerator / denominator) * 100) / 100 : 0;
}

function percentageLift(current: number, previous: number): number | null {
  if (previous === 0) return current > 0 ? 100 : null;
  return Math.round(((current - previous) / previous) * 10000) / 100;
}

function parseDays(raw: string | null): number {
  const days = parseInt(raw || '14', 10) || 14;
  return Math.min(Math.max(days, 1), 90);
}

const NO_STORE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
  Pragma: 'no-cache',
  Expires: '0'
} as const;

type CountRow = { count: number };

async function queryCount(db: D1Database, sql: string, params: string[] = []): Promise<number> {
  const row = await db.prepare(sql).bind(...params).first<CountRow>();
  return Number(row?.count ?? 0);
}

async function queryEngagement(
  db: D1Database,
  startModifier: string,
  endModifier?: string
): Promise<{ actionEvents: number; engagedUsers: number }> {
  const baseSql = `
    SELECT
      COUNT(*) as action_events,
      COUNT(DISTINCT user_hash) as engaged_users
    FROM analytics_events
    WHERE user_hash IS NOT NULL
      AND user_hash != 'server'
      AND event_name NOT LIKE 'auth_%'
      AND event_name != 'page_view'
      AND created_at >= datetime('now', ?)
  `;

  if (!endModifier) {
    const row = await db.prepare(baseSql).bind(startModifier).first<{ action_events: number; engaged_users: number }>();
    return {
      actionEvents: Number(row?.action_events ?? 0),
      engagedUsers: Number(row?.engaged_users ?? 0)
    };
  }

  const row = await db
    .prepare(`${baseSql} AND created_at < datetime('now', ?)`)
    .bind(startModifier, endModifier)
    .first<{ action_events: number; engaged_users: number }>();

  return {
    actionEvents: Number(row?.action_events ?? 0),
    engagedUsers: Number(row?.engaged_users ?? 0)
  };
}

async function queryLoginMetrics(
  db: D1Database,
  startModifier: string,
  endModifier?: string
): Promise<{ loginEvents: number; uniqueLoginHashes: number }> {
  const baseSql = `
    SELECT
      COUNT(*) as login_events,
      COUNT(DISTINCT json_extract(properties, '$.email_hash')) as unique_login_hashes
    FROM analytics_events
    WHERE event_name = 'auth_login_token_generated'
      AND json_valid(properties) = 1
      AND json_extract(properties, '$.email_hash') IS NOT NULL
      AND created_at >= datetime('now', ?)
  `;

  if (!endModifier) {
    const row = await db.prepare(baseSql).bind(startModifier).first<{ login_events: number; unique_login_hashes: number }>();
    return {
      loginEvents: Number(row?.login_events ?? 0),
      uniqueLoginHashes: Number(row?.unique_login_hashes ?? 0)
    };
  }

  const row = await db
    .prepare(`${baseSql} AND created_at < datetime('now', ?)`)
    .bind(startModifier, endModifier)
    .first<{ login_events: number; unique_login_hashes: number }>();

  return {
    loginEvents: Number(row?.login_events ?? 0),
    uniqueLoginHashes: Number(row?.unique_login_hashes ?? 0)
  };
}

export async function GET(request: Request) {
  const user = await getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const env = await getOptionalEnv();
  if (
    !hasAdminAccess(user.email, {
      adminEmailsCsv: env?.ADMIN_EMAILS,
      environment: env?.ENVIRONMENT
    })
  ) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const db = env?.DB;
  if (!db) {
    return NextResponse.json({ error: 'Database not available' }, { status: 500 });
  }

  const url = new URL(request.url);
  const days = parseDays(url.searchParams.get('days'));
  const currentStartModifier = `-${days} days`;
  const previousStartModifier = `-${days * 2} days`;
  const currentEndModifier = currentStartModifier;

  try {
    const [
      dashboardPageViewsCurrent,
      dashboardUniqueVisitorsCurrent,
      dashboardPageViewsPrevious,
      dashboardUniqueVisitorsPrevious
    ] = await Promise.all([
      queryCount(
        db,
        `SELECT COUNT(*) as count FROM analytics_events
         WHERE event_name = 'page_view' AND user_hash IS NOT NULL AND user_hash != 'server'
         AND page_path = '/dashboard' AND created_at >= datetime('now', ?)`,
        [currentStartModifier]
      ),
      queryCount(
        db,
        `SELECT COUNT(DISTINCT user_hash) as count FROM analytics_events
         WHERE event_name = 'page_view' AND user_hash IS NOT NULL AND user_hash != 'server'
         AND page_path = '/dashboard' AND created_at >= datetime('now', ?)`,
        [currentStartModifier]
      ),
      queryCount(
        db,
        `SELECT COUNT(*) as count FROM analytics_events
         WHERE event_name = 'page_view' AND user_hash IS NOT NULL AND user_hash != 'server'
         AND page_path = '/dashboard' AND created_at >= datetime('now', ?) AND created_at < datetime('now', ?)`,
        [previousStartModifier, currentEndModifier]
      ),
      queryCount(
        db,
        `SELECT COUNT(DISTINCT user_hash) as count FROM analytics_events
         WHERE event_name = 'page_view' AND user_hash IS NOT NULL AND user_hash != 'server'
         AND page_path = '/dashboard' AND created_at >= datetime('now', ?) AND created_at < datetime('now', ?)`,
        [previousStartModifier, currentEndModifier]
      )
    ]);

    const [loginCurrent, loginPrevious, engagementCurrent, engagementPrevious] = await Promise.all([
      queryLoginMetrics(db, currentStartModifier),
      queryLoginMetrics(db, previousStartModifier, currentEndModifier),
      queryEngagement(db, currentStartModifier),
      queryEngagement(db, previousStartModifier, currentEndModifier)
    ]);

    const qualityRow = await db
      .prepare(
        `SELECT
          SUM(CASE WHEN event_name = 'image_upload_attempted' THEN 1 ELSE 0 END) as upload_attempts,
          SUM(CASE WHEN event_name = 'image_upload_success' THEN 1 ELSE 0 END) as upload_successes,
          SUM(CASE WHEN event_name = 'asset_update_started' THEN 1 ELSE 0 END) as updates_started,
          SUM(CASE WHEN event_name = 'asset_update_completed' THEN 1 ELSE 0 END) as updates_completed
        FROM analytics_events WHERE created_at >= datetime('now', ?)`
      )
      .bind(currentStartModifier)
      .first<{ upload_attempts: number; upload_successes: number; updates_started: number; updates_completed: number }>();

    // Track admin request
    try {
      await db
        .prepare('INSERT INTO analytics_events (event_name, user_hash, page_path, properties) VALUES (?, ?, ?, ?)')
        .bind('analytics_requests_report_requested', await hashString(user.email), '/api/analytics/requests', JSON.stringify({ days }))
        .run();
    } catch {}

    return NextResponse.json(
      {
        period: { days, currentStart: currentStartModifier, previousStart: previousStartModifier, previousEnd: currentEndModifier },
        visitors: {
          assetDashboardUniqueVisitors: dashboardUniqueVisitorsCurrent,
          assetDashboardPageViews: dashboardPageViewsCurrent,
          loginProxyUniqueVisitors: loginCurrent.uniqueLoginHashes,
          loginProxyEvents: loginCurrent.loginEvents,
          lift: {
            assetDashboardUniqueVisitorsPct: percentageLift(dashboardUniqueVisitorsCurrent, dashboardUniqueVisitorsPrevious),
            assetDashboardPageViewsPct: percentageLift(dashboardPageViewsCurrent, dashboardPageViewsPrevious),
            loginProxyUniqueVisitorsPct: percentageLift(loginCurrent.uniqueLoginHashes, loginPrevious.uniqueLoginHashes)
          }
        },
        engagement: {
          current: {
            actionEvents: engagementCurrent.actionEvents,
            engagedUsers: engagementCurrent.engagedUsers,
            actionsPerEngagedUser: safeRatio(engagementCurrent.actionEvents, engagementCurrent.engagedUsers)
          },
          previous: {
            actionEvents: engagementPrevious.actionEvents,
            engagedUsers: engagementPrevious.engagedUsers,
            actionsPerEngagedUser: safeRatio(engagementPrevious.actionEvents, engagementPrevious.engagedUsers)
          },
          lift: {
            actionEventsPct: percentageLift(engagementCurrent.actionEvents, engagementPrevious.actionEvents),
            engagedUsersPct: percentageLift(engagementCurrent.engagedUsers, engagementPrevious.engagedUsers)
          },
          quality: {
            uploadAttempts: Number(qualityRow?.upload_attempts ?? 0),
            uploadSuccesses: Number(qualityRow?.upload_successes ?? 0),
            uploadSuccessRatePct: safeRate(Number(qualityRow?.upload_successes ?? 0), Number(qualityRow?.upload_attempts ?? 0)),
            updatesStarted: Number(qualityRow?.updates_started ?? 0),
            updatesCompleted: Number(qualityRow?.updates_completed ?? 0),
            updateCompletionRatePct: safeRate(Number(qualityRow?.updates_completed ?? 0), Number(qualityRow?.updates_started ?? 0))
          }
        }
      },
      { headers: NO_STORE_HEADERS }
    );
  } catch (err) {
    console.error('Analytics requests error:', err);
    return NextResponse.json({ error: 'Failed to generate analytics report' }, { status: 500 });
  }
}
