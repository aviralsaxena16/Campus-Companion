// In frontend/app/page.tsx
'use client';

import { useState, FormEvent, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { Send, Bot, User, Link as LinkIcon, Mail, MessageSquare, Paperclip } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import Link from 'next/link';

import AuthButtons from '@/components/AuthButtons';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';

// --- Type Definitions ---
interface Message {
  text: string;
  sender: 'user' | 'ai';
}
interface Update {
    id: number;
    title: string;
    summary: string;
    discovered_at: string;
}
type View = 'chat' | 'updates';

// --- Main Dashboard Component ---
export default function Dashboard() {
  const { data: session } = useSession();
  const [currentView, setCurrentView] = useState<View>('chat');

  return (
    <div className="flex h-screen bg-gray-100 dark:bg-gray-900">
      {/* Left Sidebar */}
      <aside className="w-64 flex-col border-r bg-white p-4 dark:bg-gray-800 dark:border-gray-700 hidden md:flex">
        <h2 className="text-2xl font-bold">Navigator</h2>
        <Separator className="my-4" />
        <nav className="flex flex-col space-y-2">
            <Button variant={currentView === 'chat' ? 'secondary' : 'ghost'} onClick={() => setCurrentView('chat')} className="justify-start">
                <MessageSquare className="mr-2 h-4 w-4" />
                Agent Chat
            </Button>
            <Button variant={currentView === 'updates' ? 'secondary' : 'ghost'} onClick={() => setCurrentView('updates')} className="justify-start">
                <Mail className="mr-2 h-4 w-4" />
                Important Updates
            </Button>
        </nav>
        <div className="mt-auto">
            <AuthButtons />
        </div>
      </aside>

      {/* Main Content: Renders the correct view based on state */}
      <main className="flex flex-1 flex-col">
        {currentView === 'chat' && <ChatView />}
        {currentView === 'updates' && <UpdatesView />}
      </main>
    </div>
  );
}

// --- Chat View Component (Self-contained within this file) ---
const ChatView = () => {
    const { data: session } = useSession();
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [uploadedFilePath, setUploadedFilePath] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleConnectGoogle = async () => {
        if (!session?.user?.email) return alert("Please sign in first.");
        alert("This will trigger a browser pop-up for Google authentication. Please check your browser and complete the sign-in flow.");
        try {
            const response = await fetch('http://127.0.0.1:8000/api/users/connect_google_account', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_email: session.user.email }),
            });
            const data = await response.json();
            alert(data.message);
        } catch (error) {
            console.error("Failed to connect Google Account:", error);
            alert("Failed to connect Google Account. Check the console for details.");
        }
    };

    const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setIsLoading(true);
        const formData = new FormData();
        formData.append('file', file);

        try {
            const response = await fetch('http://127.0.0.1:8000/api/files/upload', {
                method: 'POST',
                body: formData,
            });
            const data = await response.json();
            if (response.ok) {
                setUploadedFilePath(data.file_path);
                alert(`File "${file.name}" uploaded successfully! You can now ask questions about it.`);
            } else {
                throw new Error(data.detail || "File upload failed");
            }
        } catch (error) {
            console.error("File upload error:", error);
            alert((error as Error).message);
        } finally {
            setIsLoading(false);
            if (fileInputRef.current) fileInputRef.current.value = "";
        }
    };
    
    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        let currentInput = input;
        if (!currentInput.trim() || !session?.user?.email) return;

        if (uploadedFilePath) {
            currentInput = `(Regarding the uploaded file at path: ${uploadedFilePath}) ${currentInput}`;
            setUploadedFilePath(null);
        }

        const userMessage: Message = { text: input, sender: 'user' };
        setMessages((prev) => [...prev, userMessage]);
        setIsLoading(true);
        setInput('');
        
        try {
            const response = await fetch('http://127.0.0.1:8000/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: currentInput, user_email: session.user.email }),
            });
            const data = await response.json();
            setMessages((prev) => [...prev, { text: data.response, sender: 'ai' }]);
        } catch (error) {
            console.error("Chat API error:", error);
            const errorMessage: Message = { text: 'Sorry, I ran into an error connecting to the agent.', sender: 'ai' };
            setMessages((prev) => [...prev, errorMessage]);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <>
            <header className="flex h-16 items-center justify-between border-b bg-white p-4 dark:bg-gray-800 dark:border-gray-700">
                <h1 className="text-xl font-semibold">AI Agent Chat</h1>
                {session && (<Button onClick={handleConnectGoogle} variant="outline"><LinkIcon className="mr-2 h-4 w-4" />Connect Google Account</Button>)}
            </header>
            <div className="flex flex-1 overflow-hidden">
                <div className="flex-1 flex flex-col p-4 gap-4">
                    <div className="flex-1 overflow-y-auto space-y-4 pr-4">
                        {messages.map((msg, index) => (
                            <div key={index} className={`flex items-start gap-3 ${msg.sender === 'user' ? 'justify-end' : ''}`}>
                                {msg.sender === 'ai' && <Bot className="h-6 w-6 text-blue-500" />}
                                <div className={`rounded-lg px-4 py-2 max-w-lg ${msg.sender === 'user' ? 'bg-blue-600 text-white' : 'bg-gray-200 dark:bg-gray-700'}`}><p className="whitespace-pre-wrap">{msg.text}</p></div>
                                {msg.sender === 'user' && <User className="h-6 w-6" />}
                            </div>
                        ))}
                        <div ref={messagesEndRef} />
                    </div>
                    <form onSubmit={handleSubmit} className="relative flex items-center gap-2">
                        <Button type="button" size="icon" variant="ghost" onClick={() => fileInputRef.current?.click()} disabled={isLoading}><Paperclip className="h-5 w-5" /></Button>
                        <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" accept=".pdf" />
                        <Input placeholder={uploadedFilePath ? `File "${uploadedFilePath.split(/[/\\]/).pop()}" attached. Ask a question...` : "Ask your agent..."} value={input} onChange={(e) => setInput(e.target.value)} disabled={!session || isLoading} className="pr-12"/>
                        <Button type="submit" size="icon" className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8" disabled={!session || isLoading}><Send className="h-4 w-4" /></Button>
                    </form>
                </div>
                <aside className="w-80 border-l p-4 dark:bg-gray-800 dark:border-gray-700 hidden lg:block">
                    <Card><CardHeader><CardTitle>Agent Plan</CardTitle></CardHeader><CardContent><p className="text-sm text-gray-500">The agent's step-by-step plan will appear here...</p></CardContent></Card>
                </aside>
            </div>
        </>
    );
};

// --- Updates View Component (Self-contained within this file) ---
const UpdatesView = () => {
    const { data: session } = useSession();
    const [updates, setUpdates] = useState<Update[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isScanning, setIsScanning] = useState(false);

    useEffect(() => {
        if (session?.user?.email) {
            setIsLoading(true);
            fetch(`http://127.0.0.1:8000/api/updates/${session.user.email}`)
                .then(res => res.json())
                .then(data => { setUpdates(data); setIsLoading(false); })
                .catch(() => setIsLoading(false));
        }
    }, [session]);

    const handleScanNow = async () => {
        if (!session?.user?.email) return;
        setIsScanning(true);
        try {
            const res = await fetch('http://127.0.0.1:8000/api/updates/scan_now', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_email: session.user.email }),
            });
            const data = await res.json();
            setUpdates(data); // Refresh the UI with the new data
        } catch (error) {
            console.error("Failed to scan emails:", error);
            alert("An error occurred during the scan.");
        } finally {
            setIsScanning(false);
        }
    };

    return (
        <div className="flex flex-col h-full">
            <header className="flex h-16 items-center justify-between border-b bg-white p-4 dark:bg-gray-800 dark:border-gray-700">
                <h1 className="text-xl font-semibold">Important Updates</h1>
                <Button onClick={handleScanNow} disabled={isScanning}>
                    {isScanning ? 'Scanning...' : 'Scan Emails Now'}
                </Button>
            </header>
            <div className="flex-1 overflow-y-auto p-4 md:p-8">
                <div className="w-full max-w-4xl mx-auto">
                    <p className="text-gray-500 mb-6">Your agent's scan of important emails. Click "Scan Emails Now" to get the latest updates.</p>
                    <div className="space-y-4">
                        {isLoading ? <p>Loading updates...</p> :
                         updates.length > 0 ? updates.map(update => (
                            <Card key={update.id}>
                                <CardHeader>
                                    <CardTitle>{update.title}</CardTitle>
                                    <CardDescription>Found {formatDistanceToNow(new Date(update.discovered_at), { addSuffix: true })}</CardDescription>
                                </CardHeader>
                                <CardContent><p>{update.summary}</p></CardContent>
                            </Card>
                         )) : (
                            <Card className="text-center p-8">
                                <CardHeader><CardTitle>No important updates found yet.</CardTitle></CardHeader>
                                <CardContent><p>Click "Scan Emails Now" to get started!</p></CardContent>
                            </Card>
                         )}
                    </div>
                </div>
            </div>
        </div>
    );
};