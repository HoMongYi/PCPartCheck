import type { DemoDashboardResponse } from '@pcpartcheck/api-contracts';

import { CompatibilityDashboard } from './compatibility-dashboard';

export const dynamic = 'force-dynamic';

async function loadDashboard(): Promise<DemoDashboardResponse | null> {
  const endpoint =
    process.env.PCPARTCHECK_API_URL ?? 'http://127.0.0.1:3001/v1/demo';
  try {
    const response = await fetch(endpoint, { cache: 'no-store' });
    if (!response.ok) return null;
    return (await response.json()) as DemoDashboardResponse;
  } catch {
    return null;
  }
}

export default async function Home() {
  const dashboard = await loadDashboard();

  if (!dashboard) {
    return (
      <main className="error-shell">
        <p className="eyebrow">REFERENCE API / OFFLINE</p>
        <h1>PCPartCheck</h1>
        <p>검사 서버에 연결하지 못했습니다. Reference API가 실행 중인지 확인해 주세요.</p>
      </main>
    );
  }

  return <CompatibilityDashboard dashboard={dashboard} />;
}
