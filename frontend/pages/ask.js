import { useState, useEffect, useRef } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import Navbar from '../components/Navbar';

export default function AskPage() {
    const router = useRouter();
    const { college, course, semester } = router.query;

    const [history, setHistory] = useState([]);
    const [query, setQuery] = useState('');
    const [loading, setLoading] = useState(false);
    const chatEndRef = useRef(null);

    const scrollToBottom = () => {
        chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [history]);

    const handleSend = async (text) => {
        const finalQuery = text || query;
        if (!finalQuery.trim()) return;

        const userMsg = { role: 'user', text: finalQuery };
        setHistory(prev => [...prev, userMsg]);
        setQuery('');
        setLoading(true);

        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API}/ask`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ college, course, semester, question: finalQuery })
            });
            const result = await res.json();
            const aiMsg = { role: 'ai', text: result.answer || "I couldn't find an answer in the past papers." };
            setHistory(prev => [...prev, aiMsg]);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="h-screen bg-white text-[#1D1D1F] font-inter flex flex-col overflow-hidden">
            <Head>
                <title>Ask AI | ExamSense</title>
            </Head>
            <Navbar />

            <main className="flex-1 flex flex-col pt-12 items-center relative overflow-hidden">
                {/* TOP BAR */}
                <div className="w-full max-w-[800px] px-8 pt-10 pb-6 flex items-center justify-between z-20">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">Ask Anything</h1>
                        <div className="flex gap-2 mt-2">
                            <span className="px-2 py-0.5 rounded-full bg-zinc-100 text-[10px] font-bold text-zinc-500">{college}</span>
                            <span className="px-2 py-0.5 rounded-full bg-zinc-100 text-[10px] font-bold text-zinc-500">{course}</span>
                        </div>
                    </div>
                </div>

                {/* CHAT AREA */}
                <div className="flex-1 w-full max-w-[800px] px-8 overflow-y-auto space-y-6 pb-40">
                    {history.length === 0 && (
                        <div className="h-full flex flex-col items-center justify-center text-center opacity-60">
                            <div className="text-5xl mb-6">🤖</div>
                            <h2 className="text-xl font-bold mb-8">What would you like to know?</h2>
                            <div className="flex flex-wrap justify-center gap-3">
                                {[
                                    "What topics come every year?",
                                    "What can I safely skip?",
                                    "Explain Unit 3 important topics"
                                ].map(p => (
                                    <button
                                        key={p}
                                        onClick={() => handleSend(p)}
                                        className="px-5 py-2.5 rounded-full border border-zinc-200 text-sm font-medium hover:bg-zinc-50 hover:border-black transition-all"
                                    >
                                        {p}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {history.map((m, i) => (
                        <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in`}>
                            <div className={`max-w-[85%] px-5 py-3.5 text-[15px] font-medium leading-relaxed shadow-sm ${m.role === 'user'
                                    ? 'bg-[#6366F1] text-white rounded-[20px] rounded-br-[4px]'
                                    : 'bg-[#F4F4F5] text-[#1D1D1F] rounded-[20px] rounded-bl-[4px]'
                                }`}>
                                {m.text}
                            </div>
                        </div>
                    ))}

                    {loading && (
                        <div className="flex justify-start">
                            <div className="bg-[#F4F4F5] px-5 py-3.5 rounded-[20px] rounded-bl-[4px] flex gap-1.5">
                                <div className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce" />
                                <div className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce [animation-delay:0.2s]" />
                                <div className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce [animation-delay:0.4s]" />
                            </div>
                        </div>
                    )}
                    <div ref={chatEndRef} />
                </div>

                {/* INPUT BAR */}
                <div className="absolute bottom-0 left-0 right-0 bg-white border-t border-[#E5E5E5] p-6 z-30 flex justify-center">
                    <div className="w-full max-w-[800px] flex gap-3">
                        <input
                            type="text"
                            value={query}
                            onChange={e => setQuery(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleSend()}
                            placeholder="Ask anything about your exam..."
                            className="flex-1 bg-zinc-50 border border-[#E5E5E5] rounded-[14px] px-6 py-4 text-sm focus:outline-none focus:border-indigo-500 focus:bg-white transition-all shadow-inner"
                        />
                        <button
                            onClick={() => handleSend()}
                            className="bg-[#6366F1] text-white w-14 h-14 rounded-[14px] flex items-center justify-center hover:bg-indigo-700 transition-all shadow-lg active:scale-95"
                        >
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M5 12H19M19 12L13 6M19 12L13 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                        </button>
                    </div>
                </div>
            </main>

            <style jsx>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fade-in { animation: fadeIn 0.3s ease-out forwards; }
      `}</style>
        </div>
    );
}
