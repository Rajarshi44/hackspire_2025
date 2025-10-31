import { DashboardShell } from '@/components/dashboard-shell';
import ProtectedRoute from '@/components/protected-route';
import { ReactNode } from 'react';

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <ProtectedRoute>
      <DashboardShell>
        {children}
      </DashboardShell>
    </ProtectedRoute>
  );
}
