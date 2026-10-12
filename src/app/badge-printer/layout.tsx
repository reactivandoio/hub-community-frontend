import { AdminGuard } from '@/components/admin/admin-guard';

// Signed-in admin or community-manager only (REA-10); see components/admin/admin-guard.
export default function GuardedLayout({ children }: { children: React.ReactNode }) {
  return <AdminGuard>{children}</AdminGuard>;
}
