import { AdminGuard } from '@/components/admin/admin-guard';
import { AdminShell } from '@/components/admin/admin-shell';

// Signed-in admin or community-manager only (REA-10); see components/admin/admin-guard.
// The sidebar, top bar and breadcrumb of every admin page come from AdminShell (REA-24).
export default function GuardedLayout({ children }: { children: React.ReactNode }) {
  return (
    <AdminGuard>
      <AdminShell>{children}</AdminShell>
    </AdminGuard>
  );
}
