import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import './globals.css';

export const metadata: Metadata = {
  title: 'PCPartCheck — 조립 전 호환성 검사',
  description: '근거와 정책을 함께 보여주는 결정론적 PC 부품 호환성 검사 데모',
};

export default function RootLayout({ children }: { readonly children: ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
