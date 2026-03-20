import { requireUser } from '../../lib/server/session';
import { ValidationToolsPage } from '../../components/validation-tools';

export const dynamic = 'force-dynamic';

export default async function ValidationPage() {
  const user = await requireUser();

  return <ValidationToolsPage userEmail={user.email} />;
}
