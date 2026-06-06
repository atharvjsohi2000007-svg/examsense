import { useState, useEffect, useRef } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import Navbar from '../components/Navbar';

export default function SessionPage() {
    const router = useRouter();
    const { college, course, year, semester } = router.query;

    const [activeView, setActiveView] = useState('default');
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState(null);

    // Predict View Data
    const [predictions, setPredictions] = useState([]);
    const [hotTopics, setHotTopics] = useState([]);
    const [safeToSkip, setSafeToSkip] = useState([]);

    // Flashcards View Data
    const [flashcards, setFlashcards] = useState([]);
    const [currentCardIndex, setCurrentCardIndex] = useState(0);
    const [isFlipped, setIsFlipped] = useState(false);

    // Quiz View Data
    const [quizQuestions, setQuizQuestions] = useState([]);
    const [currentQuizIndex, setCurrentQuizIndex] = useState(0);
    const [userScore, setUserScore] = useState(0);
    const [quizFinished, setQuizFinished] = useState(false);
    const [selectedOption, setSelectedOption] = useState(null);

    // Ask View Data
    const [chatHistory, setChatHistory] = useState([]);
    const [query, setQuery] = useState('');
    const chatEndRef = useRef(null);

    // Model Paper Data
    const [modelPaper, setModelPaper] = useState("");

    const scrollToBottom = () => {
        chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [chatHistory]);

    const handlePredict = async () => {
        setActiveView('predict');
        setLoading(true);
        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API}/predict`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ college, course, year, semester })
            });
            const result = await res.json();
            setPredictions(result.predicted_questions || []);
            setHotTopics(result.hot_topics || []);
            setSafeToSkip(result.safe_to_skip || []);
            setData(result);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleModelPaper = async () => {
        setActiveView('model-paper');
        setLoading(true);
        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API}/model-paper`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ college, course, year, semester })
            });
            const result = await res.json();
            setModelPaper(result.paper || "No model paper generated.");
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleFlashcards = async () => {
        setActiveView('flashcards');
        setLoading(true);
        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API}/flashcards`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ college, course, semester })
            });
            const result = await res.json();
            setFlashcards(result.flashcards || []);
            setCurrentCardIndex(0);
            setIsFlipped(false);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleQuiz = async () => {
        setActiveView('quiz');
        setLoading(true);
        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API}/quiz`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ college, course, semester })
            });
            const result = await res.json();
            setQuizQuestions(result.questions || []);
            setCurrentQuizIndex(0);
            setUserScore(0);
            setQuizFinished(false);
            setSelectedOption(null);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleAsk = () => setActiveView('ask');

    const handleSendQuery = async () => {
        if (!query.trim()) return;
        const userMsg = { role: 'user', text: query };
        setChatHistory(prev => [...prev, userMsg]);
        setQuery('');
        setLoading(true);
        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API}/ask`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ college, course, semester, question: query })
            });
            const result = await res.json();
            const aiMsg = { role: 'ai', text: result.answer || "I couldn't find an answer for that." };
            setChatHistory(prev => [...prev, aiMsg]);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const renderMiddlePanel = () => {
        if (loading) {
            return (
                <div className="h-full flex flex-col items-center justify-center space-y-4">
                    <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                    <p className="text-zinc-500 font-medium">AI is thinking...</p>
                </div>
            );
        }

        switch (activeView) {
            case 'predict':
                return (
                    <div className="space-y-6">
                        <div className="flex justify-between items-center bg-zinc-50 p-4 rounded-xl border border-zinc-100">
                            <span className="text-sm text-zinc-500 font-semibold">{predictions.length} Questions Predicted</span>
                            <span className="text-xs text-zinc-400">Based on 10 years of data</span>
                        </div>
                        {predictions.map((q, idx) => (
                            <div key={idx} className="bg-white border border-zinc-200 rounded-2xl p-6 flex items-start gap-6 hover:border-indigo-500 transition-all">
                                <div className="pt-1">
                                    {q.priority === 'MUST_PREPARE' && <span className="bg-red-50 text-red-600 px-2 py-1 rounded text-[10px] font-black uppercase tracking-wider">Must Prepare</span>}
                                    {q.priority === 'IMPORTANT' && <span className="bg-orange-50 text-orange-600 px-2 py-1 rounded text-[10px] font-black uppercase tracking-wider">Important</span>}
                                    {q.priority === 'OPTIONAL' && <span className="bg-zinc-50 text-zinc-600 px-2 py-1 rounded text-[10px] font-black uppercase tracking-wider">Optional</span>}
                                </div>
                                <div className="flex-1">
                                    <h3 className="text-lg font-bold text-[#1D1D1F] mb-1">{q.question}</h3>
                                    <p className="text-sm text-zinc-500 mb-4">{q.topic}</p>
                                    <div className="flex gap-1.5">
                                        {(q.years_appeared || []).map(y => (
                                            <span key={y} className="px-2 py-0.5 bg-zinc-100 text-zinc-500 text-[10px] font-bold rounded">{y}</span>
                                        ))}
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="text-3xl font-black text-indigo-600">{q.probability_percent}%</div>
                                    <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Confidence</div>
                                </div>
                            </div>
                        ))}
                    </div>
                );
            case 'model-paper':
                return (
                    <div className="relative">
                        <button className="absolute top-0 right-0 bg-zinc-100 px-3 py-1 rounded text-xs font-bold" onClick={() => window.print()}>Print</button>
                        <pre className="font-mono text-sm leading-relaxed whitespace-pre-wrap p-8 bg-zinc-50 rounded-2xl border border-zinc-200">
                            {modelPaper}
                        </pre>
                    </div>
                );
            case 'flashcards':
                const card = flashcards[currentCardIndex];
                if (!card) return <div className="text-center py-20 text-zinc-400">No flashcards found.</div>;
                return (
                    <div className="h-full flex flex-col items-center justify-center">
                        <div className="mb-8 text-sm font-bold text-zinc-400 uppercase tracking-widest">Card {currentCardIndex + 1} of {flashcards.length}</div>
                        <div
                            onClick={() => setIsFlipped(!isFlipped)}
                            className="w-full max-w-[480px] h-[300px] perspective-1000 cursor-pointer"
                        >
                            <div className={`relative w-full h-full transition-transform duration-500 preserve-3d ${isFlipped ? 'rotate-y-180' : ''}`}>
                                {/* Front */}
                                <div className="absolute inset-0 backface-hidden bg-white border-2 border-indigo-50 p-12 rounded-[24px] shadow-xl flex flex-col items-center justify-center text-center">
                                    <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest mb-4">{card.topic}</span>
                                    <p className="text-2xl font-bold">{card.front}</p>
                                    <p className="mt-8 text-zinc-300 text-xs font-bold italic">Click to flip</p>
                                </div>
                                {/* Back */}
                                <div className="absolute inset-0 backface-hidden rotate-y-180 bg-zinc-900 border-2 border-indigo-500 p-12 rounded-[24px] shadow-xl flex flex-col items-center justify-center text-center text-white">
                                    <p className="text-xl leading-relaxed">{card.back}</p>
                                </div>
                            </div>
                        </div>
                        <div className="mt-12 flex gap-4">
                            <button
                                onClick={(e) => { e.stopPropagation(); setCurrentCardIndex(Math.max(0, currentCardIndex - 1)); setIsFlipped(false); }}
                                className="px-6 py-2 rounded-full border border-zinc-200 font-bold hover:bg-zinc-50"
                            >
                                ← Previous
                            </button>
                            <button
                                onClick={(e) => { e.stopPropagation(); setCurrentCardIndex(Math.min(flashcards.length - 1, currentCardIndex + 1)); setIsFlipped(false); }}
                                className="px-6 py-2 rounded-full bg-indigo-500 text-white font-bold hover:bg-indigo-600"
                            >
                                Next →
                            </button>
                        </div>
                    </div>
                );
            case 'quiz':
                if (quizFinished) {
                    return (
                        <div className="text-center py-20">
                            <h2 className="text-[64px] font-black text-indigo-600 mb-4">{userScore}/{quizQuestions.length}</h2>
                            <p className="text-xl font-bold mb-8 text-zinc-500">Quiz Completed!</p>
                            <button onClick={() => handleQuiz()} className="bg-[#1D1D1F] text-white px-8 py-3 rounded-full font-bold">Try Again</button>
                        </div>
                    );
                }
                const q = quizQuestions[currentQuizIndex];
                if (!q) return null;
                return (
                    <div className="max-w-2xl mx-auto">
                        <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-2 block">Question {currentQuizIndex + 1}</span>
                        <h2 className="text-2xl font-bold mb-10 leading-tight">{q.question}</h2>
                        <div className="space-y-4">
                            {Object.entries(q.options || {}).map(([key, val]) => (
                                <button
                                    key={key}
                                    disabled={selectedOption !== null}
                                    onClick={() => {
                                        setSelectedOption(key);
                                        if (key === q.correct) setUserScore(userScore + 1);
                                    }}
                                    className={`w-full text-left p-5 rounded-xl border-2 transition-all font-medium flex justify-between items-center ${selectedOption === key
                                            ? (key === q.correct ? 'border-green-500 bg-green-50' : 'border-red-500 bg-red-50')
                                            : (selectedOption !== null && key === q.correct ? 'border-green-500 bg-green-50' : 'border-zinc-100 hover:border-indigo-500')
                                        }`}
                                >
                                    <span>{val}</span>
                                    {selectedOption !== null && key === q.correct && <span className="text-green-600 font-bold">✓</span>}
                                </button>
                            ))}
                        </div>
                        {selectedOption && (
                            <div className="mt-10 animate-fade-in">
                                <div className="p-6 bg-zinc-50 rounded-xl mb-6">
                                    <p className="text-xs font-black uppercase text-zinc-400 mb-1">Explanation</p>
                                    <p className="text-sm text-zinc-600">{q.explanation}</p>
                                </div>
                                <button
                                    onClick={() => {
                                        if (currentQuizIndex + 1 < quizQuestions.length) {
                                            setCurrentQuizIndex(currentQuizIndex + 1);
                                            setSelectedOption(null);
                                        } else {
                                            setQuizFinished(true);
                                        }
                                    }}
                                    className="w-full bg-indigo-500 text-white py-4 rounded-xl font-bold hover:bg-indigo-600"
                                >
                                    Next Question →
                                </button>
                            </div>
                        )}
                    </div>
                );
            case 'ask':
                return (
                    <div className="h-full flex flex-col pb-20">
                        <div className="flex-1 overflow-y-auto space-y-6 pr-2">
                            {chatHistory.length === 0 && (
                                <div className="h-full flex flex-col items-center justify-center text-center opacity-50">
                                    <div className="text-4xl mb-4">💬</div>
                                    <h3 className="font-bold mb-8">Ask engine is ready</h3>
                                    <div className="flex flex-wrap justify-center gap-3">
                                        {["What topics come every year?", "What can I skip?", "Explain Unit 3 keywords"].map(p => (
                                            <button key={p} onClick={() => setQuery(p)} className="px-4 py-2 border rounded-full text-xs font-medium hover:bg-zinc-50">{p}</button>
                                        ))}
                                    </div>
                                </div>
                            )}
                            {chatHistory.map((m, i) => (
                                <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                    <div className={`max-w-[80%] rounded-2xl px-5 py-3 text-sm font-medium leading-relaxed ${m.role === 'user' ? 'bg-indigo-600 text-white' : 'bg-zinc-100 text-[#1D1D1F]'
                                        }`}>
                                        {m.text}
                                    </div>
                                </div>
                            ))}
                            <div ref={chatEndRef} />
                        </div>
                        <div className="absolute bottom-10 left-10 right-10 flex gap-4 bg-white/80 backdrop-blur pb-4 pt-2">
                            <input
                                type="text"
                                value={query}
                                onChange={e => setQuery(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleSendQuery()}
                                placeholder="Ask about this session..."
                                className="flex-1 border border-zinc-200 rounded-full px-6 text-sm focus:outline-none focus:border-indigo-500"
                            />
                            <button
                                onClick={handleSendQuery}
                                className="bg-indigo-600 text-white w-10 h-10 rounded-full flex items-center justify-center hover:bg-indigo-700"
                            >
                                ↑
                            </button>
                        </div>
                    </div>
                );
            default:
                return (
                    <div className="h-full flex flex-col items-center justify-center text-center opacity-50">
                        <div className="w-16 h-16 bg-zinc-100 rounded-full flex items-center justify-center mb-6">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-zinc-400">
                                <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                <path d="M2 17L12 22L22 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                <path d="M2 12L12 17L22 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                        </div>
                        <h2 className="text-2xl font-bold mb-2">Select an action</h2>
                        <p className="text-sm max-w-[240px]">Choose from the left panel to get started with your exam prep.</p>
                    </div>
                );
        }
    };

    return (
        <div className="h-screen bg-white text-[#1D1D1F] font-inter overflow-hidden flex flex-col">
            <Head>
                <title>Session | ExamSense</title>
            </Head>

            <Navbar />

            <div className="flex-1 flex pt-[48px]">
                {/* LEFT PANEL */}
                <aside className="w-[280px] bg-[#F5F5F7] border-r border-[#E5E5E5] flex flex-col p-6 overflow-y-auto">
                    <div className="mb-8">
                        <h2 className="text-lg font-bold truncate">{college}</h2>
                        <p className="text-[13px] text-[#6E6E73] font-medium flex items-center gap-1.5 mt-1">
                            {course} • Sem {semester?.replace('sem', '')}
                            <span className="w-2 h-2 bg-green-500 rounded-full inline-block" />
                        </p>
                    </div>

                    <div className="border-b border-zinc-200 mb-6" />

                    <p className="text-[10px] font-black uppercase text-zinc-400 tracking-widest mb-4">Actions</p>
                    <div className="space-y-2 mb-8">
                        {[
                            { id: 'predict', label: '🎯 Predict Questions', onClick: handlePredict },
                            { id: 'model-paper', label: '📄 Model Paper', onClick: handleModelPaper },
                            { id: 'flashcards', label: '🃏 Flashcards', onClick: handleFlashcards },
                            { id: 'quiz', label: '🧠 MCQ Quiz', onClick: handleQuiz },
                            { id: 'ask', label: '💬 Ask Anything', onClick: handleAsk },
                        ].map(btn => (
                            <button
                                key={btn.id}
                                onClick={btn.onClick}
                                className={`w-full text-left px-4 py-3 rounded-xl text-sm font-bold transition-all border ${activeView === btn.id
                                        ? 'bg-[#EEF2FF] border-indigo-200 text-indigo-600'
                                        : 'bg-white border-zinc-200 text-zinc-600 hover:border-indigo-400'
                                    }`}
                            >
                                {btn.label}
                            </button>
                        ))}
                    </div>

                    <div className="border-b border-zinc-200 mb-6" />

                    <p className="text-[10px] font-black uppercase text-zinc-400 tracking-widest mb-4">Session Info</p>
                    <div className="space-y-3">
                        <div className="text-[13px] text-zinc-500">📚 College: <span className="text-zinc-800 font-bold ml-1">{college}</span></div>
                        <div className="text-[13px] text-zinc-500">📖 Course: <span className="text-zinc-800 font-bold ml-1">{course}</span></div>
                        <div className="text-[13px] text-zinc-500">📅 Year: <span className="text-zinc-800 font-bold ml-1">{year}</span></div>
                        <div className="text-[13px] text-zinc-500">🗓 Sem: <span className="text-zinc-800 font-bold ml-1">{semester}</span></div>
                    </div>
                </aside>

                {/* MIDDLE PANEL */}
                <section className="flex-1 bg-white p-10 overflow-y-auto relative">
                    {renderMiddlePanel()}
                </section>

                {/* RIGHT PANEL */}
                <aside className="w-[280px] bg-[#F5F5F7] border-l border-[#E5E5E5] p-6 overflow-y-auto space-y-6">
                    <h2 className="text-sm font-bold uppercase tracking-widest text-zinc-400 mb-4">Study Tools</h2>

                    {/* Hot Topics */}
                    <div className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-sm">
                        <h3 className="text-sm font-bold mb-4 flex items-center gap-2">🔥 Hot Topics</h3>
                        <div className="space-y-2">
                            {hotTopics.length > 0 ? hotTopics.map(t => (
                                <div key={t} className="text-xs font-semibold text-zinc-600 bg-zinc-50 p-2 rounded-lg border border-zinc-100">{t}</div>
                            )) : <p className="text-[11px] text-zinc-400 italic">Run prediction to see hot topics.</p>}
                        </div>
                    </div>

                    {/* Safe to Skip */}
                    <div className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-sm">
                        <h3 className="text-sm font-bold mb-4 flex items-center gap-2">✓ Safe to Skip</h3>
                        <div className="space-y-2">
                            {safeToSkip.length > 0 ? safeToSkip.map(t => (
                                <div key={t} className="text-xs font-semibold text-zinc-400 p-2 rounded-lg bg-zinc-50/50 border border-dotted border-zinc-200">{t}</div>
                            )) : <p className="text-[11px] text-zinc-400 italic">Check after prediction.</p>}
                        </div>
                    </div>

                    {/* Stats */}
                    <div className="bg-indigo-600 text-white rounded-2xl p-5 shadow-lg">
                        <p className="text-[10px] font-black uppercase text-indigo-300 tracking-[0.2em] mb-4">Analysis Stats</p>
                        <div className="text-2xl font-black mb-1">{data?.total_papers_analyzed || 0}</div>
                        <p className="text-[11px] font-bold text-indigo-200">Papers Analyzed</p>
                        <div className="mt-4 pt-4 border-t border-indigo-500 flex justify-between items-center text-[11px] font-bold">
                            <span>Source: Library</span>
                            <span className="bg-indigo-500 px-1.5 py-0.5 rounded text-[9px]">2014-2024</span>
                        </div>
                    </div>
                </aside>
            </div>

            <style jsx global>{`
        .perspective-1000 { perspective: 1000px; }
        .preserve-3d { transform-style: preserve-3d; }
        .backface-hidden { backface-visibility: hidden; }
        .rotate-y-180 { transform: rotateY(180deg); }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        .animate-fade-in { animation: fadeIn 0.4s ease-out forwards; }
      `}</style>
        </div>
    );
}
