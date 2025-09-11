// In frontend/app/page.tsx

'use client'; 

import { useState, useEffect } from 'react';

export default function Home() {
  // State to store the message from the backend
  const [message, setMessage] = useState('Loading...');

  useEffect(() => {
    fetch('http://127.0.0.1:8000/')
      .then((response) => response.json())
      .then((data) => {
        setMessage(data.message);
      })
      .catch((error) => {
        console.error('Error fetching data:', error);
        setMessage('Failed to connect to backend.');
      });
  }, []); 

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <h1 className="text-4xl font-bold">Frontend-Backend Connection Test</h1>
      <p className="mt-4 text-xl bg-gray-100 dark:bg-gray-800 p-4 rounded-lg">
        Message from backend: <span className="font-mono text-green-500">{message}</span>
      </p>
    </main>
  );
}