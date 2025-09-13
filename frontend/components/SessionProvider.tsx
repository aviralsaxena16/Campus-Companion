// In frontend/components/SessionProvider.tsx

'use client';

import { SessionProvider as Provider } from 'next-auth/react';
import React from 'react';

interface Props {
  children: React.ReactNode;
}

export default function SessionProvider({ children }: Props) {
  return <Provider>{children}</Provider>;
}