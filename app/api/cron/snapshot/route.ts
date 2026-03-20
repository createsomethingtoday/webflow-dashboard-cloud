import { NextResponse } from 'next/server';
import { isAuthorizedCronRequest } from '@create-something/webflow-dashboard-core/security';
import { getEnvOrThrow } from '../../../../lib/server/env';
import { getServerAirtable } from '../../../../lib/server/airtable';

async function handleSnapshot(request: Request): Promise<NextResponse> {
  const env = await getEnvOrThrow();

  if (!isAuthorizedCronRequest(request, env.CRON_SECRET, env.ENVIRONMENT)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = env.DB;
  if (!db) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
  }

  try {
    const airtable = await getServerAirtable();
    const allAssets = await airtable.getAllAssetsForSnapshot();

    const today = new Date().toISOString().split('T')[0];

    const assetsToSnapshot = allAssets.filter(
      (asset) =>
        (asset.uniqueViewers ?? 0) > 0 ||
        (asset.cumulativePurchases ?? 0) > 0 ||
        (asset.cumulativeRevenue ?? 0) > 0
    );

    if (assetsToSnapshot.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No assets with analytics data to snapshot',
        captured: 0,
        date: today
      });
    }

    const stmt = db.prepare(
      `INSERT OR REPLACE INTO analytics_snapshots
       (asset_id, captured_at, unique_viewers, cumulative_purchases, cumulative_revenue)
       VALUES (?, ?, ?, ?, ?)`
    );

    const batch = assetsToSnapshot.map((asset) =>
      stmt.bind(asset.id, today, asset.uniqueViewers || 0, asset.cumulativePurchases || 0, asset.cumulativeRevenue || 0)
    );

    await db.batch(batch);

    return NextResponse.json({
      success: true,
      captured: assetsToSnapshot.length,
      date: today,
      assets: assetsToSnapshot.map((a) => ({ id: a.id, name: a.name }))
    });
  } catch (err) {
    console.error('Snapshot cron error:', err);
    return NextResponse.json(
      { error: `Failed to capture snapshots: ${err instanceof Error ? err.message : 'Unknown error'}` },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  return handleSnapshot(request);
}

export async function POST(request: Request) {
  return handleSnapshot(request);
}
