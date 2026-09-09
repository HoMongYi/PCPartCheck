import { expect, test } from '@playwright/test';

test('shows real engine scenarios and keeps similar failures informational', async ({
  page,
  request,
}) => {
  const apiBaseUrl = process.env.PCPARTCHECK_E2E_API_URL ?? 'http://127.0.0.1:3001';
  const apiResponse = await request.get(`${apiBaseUrl}/v1/demo`);
  expect(apiResponse.ok()).toBeTruthy();
  const dashboard = (await apiResponse.json()) as {
    readonly scenarios: readonly unknown[];
    readonly similarEvidence: readonly unknown[];
  };
  expect(dashboard.scenarios).toHaveLength(8);
  expect(dashboard.similarEvidence).toHaveLength(3);

  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'PCPartCheck' })).toBeVisible();
  await expect(page.getByText('CANONICAL 3.0.0')).toBeVisible();
  await expect(page.getByTestId('scenario-card')).toHaveCount(8);
  await expect(page.getByText('Status는 기술 판정')).toBeVisible();
  await expect(page.getByText('Power Budget 기준값')).toBeVisible();
  await expect(page.getByTestId('exact-evidence-card')).toBeVisible();
  await expect(
    page
      .getByTestId('scenario-card')
      .filter({ hasText: 'disabled-capability' })
      .getByText('STATUS / 확인 안 함'),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: '과거 유사한 구성의 조립 실패 사례 3건' }),
  ).toBeVisible();
  await expect(
    page.getByText('유사 사례는 현재 구성의 호환 불가를 의미하지 않습니다.'),
  ).toBeVisible();
  await expect(page.getByTestId('similar-evidence-card')).toHaveCount(3);

  await page.getByRole('button', { name: '차단' }).click();
  await expect(page.getByTestId('scenario-card')).toHaveCount(3);
  await expect(page.getByText('CPU와 메인보드 소켓이 다른 구성')).toBeVisible();
  await expect(page.getByText('ARGB 헤더가 맞지 않는 구성')).toHaveCount(0);

  const pageWidth = await page.evaluate<number>(
    'document.documentElement.scrollWidth',
  );
  const viewportWidth = await page.evaluate<number>(
    'document.documentElement.clientWidth',
  );
  expect(pageWidth).toBeLessThanOrEqual(viewportWidth);
});
