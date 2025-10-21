import { requireAdmin } from '@/lib/session';

import BulkAssignClient from './client';

export default async function BulkAssignPage() {
  await requireAdmin();

  return (
    <div className="app-shell py-8">
      <BulkAssignClient />
    </div>
  );
}
