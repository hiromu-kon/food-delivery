import { AuthShell } from '@/features/auth/auth-shell';
import { LogoutButton } from '@/features/auth/logout-button';
import { NoticeBanner } from '@/components/ui/notice-banner';
export default function AccessDeniedPage() {
  return (
    <AuthShell title="このアカウントでは利用できません">
      <div className="space-y-6">
        <NoticeBanner tone="warning">
          注文者のアカウントでログインしてください。利用が停止されている場合も、この画面が表示されます。
        </NoticeBanner>
        <LogoutButton />
      </div>
    </AuthShell>
  );
}
