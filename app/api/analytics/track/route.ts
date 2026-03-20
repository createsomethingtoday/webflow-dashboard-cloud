import { NextResponse } from 'next/server';
import { hashString } from '@create-something/webflow-dashboard-core/hash';
import { getUserFromRequest } from '../../../../lib/server/session';
import { getOptionalEnv } from '../../../../lib/server/env';

export async function POST(request: Request) {
  const env = await getOptionalEnv();
  const db = env?.DB;
  if (!db) {
    return NextResponse.json({ success: true });
  }

  try {
    const body = (await request.json()) as {
      eventName?: string;
      pagePath?: string;
      properties?: Record<string, unknown>;
    };

    if (!body.eventName) {
      return NextResponse.json({ error: 'Event name required' }, { status: 400 });
    }

    const user = await getUserFromRequest(request);
    const userHash = user ? await hashString(user.email) : 'anonymous';

    await db
      .prepare(
        'INSERT INTO analytics_events (event_name, user_hash, page_path, properties) VALUES (?, ?, ?, ?)'
      )
      .bind(
        body.eventName,
        userHash,
        body.pagePath || null,
        body.properties ? JSON.stringify(body.properties) : null
      )
      .run();

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Analytics tracking error:', err);
    return NextResponse.json({ success: true });
  }
}
