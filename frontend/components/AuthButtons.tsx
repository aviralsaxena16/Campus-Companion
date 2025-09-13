// In frontend/components/AuthButtons.tsx

'use client';

import { useSession, signIn, signOut } from 'next-auth/react';
import { useEffect } from 'react'; // <-- IMPORT useEffect

export default function AuthButtons() {
  const { data: session, status } = useSession();

  // ADD THIS useEffect HOOK
  useEffect(() => {
    if (status === 'authenticated' && session?.user?.email) {
      // User has just logged in, so we notify our backend
      fetch('http://127.0.0.1:8000/api/users/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: session.user.email }),
      })
      .then(response => response.json())
      .then(data => console.log('Backend user session created:', data))
      .catch(error => console.error('Error notifying backend of login:', error));
    }
  }, [status, session]);
  
  if (session) {
    return (
      <div className="flex items-center space-x-4">
        <p>Signed in as {session.user?.email}</p>
        <button 
          onClick={() => signOut()}
          className="px-4 py-2 bg-red-600 text-white rounded-lg"
        >
          Sign out
        </button>
      </div>
    );
  }

  return (
    <button 
      onClick={() => signIn('google')}
      className="px-4 py-2 bg-blue-600 text-white rounded-lg"
    >
      Sign in with Google
    </button>
  );
}