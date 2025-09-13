// In frontend/app/page.tsx
'use client';

import { useState, FormEvent } from 'react';
import { useSession } from 'next-auth/react';
import { Send, Bot, User, Link as LinkIcon } from 'lucide-react'; // Import LinkIcon

import AuthButtons from '@/components/AuthButtons';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';

interface Message {
  text: string;
  sender: 'user' | 'ai';
}

export default function Dashboard() {
  const { data: session } = useSession();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // --- NEW FUNCTION to handle connecting Google Account ---
  const handleConnectGoogle = async () => {
    if (!session?.user?.email) {
      alert("Please sign in first.");
      return;
    }
    alert("This will trigger a browser pop-up for Google authentication. Please check your browser and complete the sign-in flow. The backend server terminal will guide you.");
    try {
      const response = await fetch('http://127.0.0.1:8000/api/users/connect_google_account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_email: session.user.email }),
      });
      const data = await response.json();
      alert(data.message); // Show success message
    } catch (error) {
      console.error("Failed to connect Google Account:", error);
      alert("Failed to connect Google Account. Check the console for details.");
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !session?.user?.email) return;

    const userMessage: Message = { text: input, sender: 'user' };
    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);
    
    try {
        const response = await fetch('http://127.0.0.1:8000/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: input, user_email: session.user.email }),
        });
        const data = await response.json();
        const aiMessage: Message = { text: data.response, sender: 'ai' };
        setMessages((prev) => [...prev, aiMessage]);
    } catch (error) {
        console.error("Chat API error:", error);
    } finally {
        setIsLoading(false);
        setInput('');
    }
  };

  return (
    <div className="flex h-screen bg-gray-100 dark:bg-gray-900">
      {/* Left Sidebar */}
      <aside className="w-64 flex-col border-r bg-white p-4 dark:bg-gray-800 dark:border-gray-700 hidden md:flex">
        <h2 className="text-2xl font-bold">Navigator</h2>
        <Separator className="my-4" />
        <nav className="flex flex-col space-y-2">
            <Button variant="ghost" className="justify-start">Agent Chat</Button>
        </nav>
        <div className="mt-auto">
            <AuthButtons />
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex flex-1 flex-col">
        <header className="flex h-16 items-center justify-between border-b bg-white p-4 dark:bg-gray-800 dark:border-gray-700">
          <h1 className="text-xl font-semibold">AI Agent Chat</h1>
           {/* --- NEW BUTTON --- */}
           {session && (
            <Button onClick={handleConnectGoogle} variant="outline">
                <LinkIcon className="mr-2 h-4 w-4" />
                Connect Google Account
            </Button>
           )}
        </header>
        
        <div className="flex flex-1 overflow-hidden">
            {/* Chat Area */}
            <div className="flex-1 flex flex-col p-4 gap-4">
                <div className="flex-1 overflow-y-auto space-y-4 pr-4">
                    {messages.map((msg, index) => (
                        <div key={index} className={`flex items-start gap-3 ${msg.sender === 'user' ? 'justify-end' : ''}`}>
                            {msg.sender === 'ai' && <Bot className="h-6 w-6 text-blue-500" />}
                            <div className={`rounded-lg px-4 py-2 max-w-lg ${msg.sender === 'user' ? 'bg-blue-600 text-white' : 'bg-gray-200 dark:bg-gray-700'}`}>
                                <p>{msg.text}</p>
                            </div>
                            {msg.sender === 'user' && <User className="h-6 w-6" />}
                        </div>
                    ))}
                </div>
                <form onSubmit={handleSubmit} className="relative">
                    <Input
                        placeholder="Ask your agent to 'check my email' or 'schedule the workshop from the Gist file'..."
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        disabled={!session || isLoading}
                        className="pr-12"
                    />
                    <Button type="submit" size="icon" className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8" disabled={!session || isLoading}>
                        <Send className="h-4 w-4" />
                    </Button>
                </form>
            </div>

            {/* Right Sidebar - Plan Monitor */}
            <aside className="w-80 border-l p-4 dark:bg-gray-800 dark:border-gray-700 hidden lg:block">
                <Card>
                    <CardHeader><CardTitle>Agent Plan</CardTitle></CardHeader>
                    <CardContent>
                        <p className="text-sm text-gray-500">The agent's step-by-step plan will appear here...</p>
                    </CardContent>
                </Card>
            </aside>
        </div>
      </main>
    </div>
  );
}