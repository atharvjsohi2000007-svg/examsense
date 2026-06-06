import { useState, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import Navbar from '../components/Navbar';

export default function QuizPage() {
    const router = useRouter();
    const { college, course, semester } = router.query;

    const [questions, setQuestions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [selectedOption, setSelectedOption] = useState(null);
    const [score, setScore] = useState(0);
    const [quizFinished, setQuizFinished] = useState(false);

    useEffect(() => {
        if (college && course && semester) {
            setLoading(true);
            fetch(`${process.env.NEXT_PUBLIC_API}/quiz`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ college, course, semester })
            })
                .then(res => res.json())
                .then(data => {
                    setQuestions(data.questions || []);
                    setLoading(false);
                })
                .catch(err => {
                    console.error(err);
                    setLoading(false);
                });
        }
    }, [college, course, semester]);

    if (loading) {
        return (
            <div className="min-h-screen bg-white">
                <Navbar />
                <div className="h-screen flex items-center justify-center">
                    <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                </div>
            </div>
        );
    }

    if (quizFinished) {
        return (
            <div className="min-h-screen bg-white flex flex-col">
                <Navbar />
                <main className="flex-1 flex flex-col items-center justify-center text-center p-6">
                    <h2 className="text-[96px] font-black text-[#1D1D1F] leading-none mb-4">{score} <span className="text-[32px] text-zinc-300">/ {questions.length}</span></h2>
                    <div className="mb-12">
                        {score >= 8 ? (
                            <p className="text-2xl font-bold text-green-600">Excellent! You're ready! 🎉</p>
                        ) : score >= 5 ? (
                            <p className="text-2xl font-bold text-indigo-600">Good job! Keep studying 📚</p>
                        ) : (
                            <p className="text-2xl font-bold text-[#E54D2E]">Keep practicing! You got this 💪</p>
                        )}
                    </div>
                    <div className="flex gap-4">
                        <button onClick={() => window.location.reload()} className="px-8 py-3 rounded-full border border-zinc-200 font-bold hover:bg-zinc-50">Try Again</button>
                        <button onClick={() => router.back()} className="px-8 py-3 rounded-full bg-[#1D1D1F] text-white font-bold hover:bg-black">Back to Session</button>
                    </div>
                </main>
            </div>
        );
    }

    const q = questions[currentIndex];

    return (
        <div className="min-h-screen bg-white text-[#1D1D1F] font-inter">
            <Head>
                <title>Quiz | ExamSense</title>
            </Head>
            <Navbar />

            <main className="max-w-[700px] mx-auto pt-32 px-6 pb-20">
                {/* PROGRESS */}
                <div className="mb-12">
                    <div className="flex justify-between items-end mb-2">
                        <span className="text-[13px] font-bold text-[#6E6E73]">Question {currentIndex + 1} of {questions.length}</span>
                        <span className="text-[11px] font-black uppercase tracking-widest text-[#1D1D1F]">AI-GENERATED QUIZ</span>
                    </div>
                    <div className="w-full bg-zinc-100 h-1 rounded-full overflow-hidden">
                        <div
                            className="bg-[#1D1D1F] h-full transition-all duration-500"
                            style={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }}
                        />
                    </div>
                </div>

                {/* QUESTION CARD */}
                <div className="bg-white border border-[#E5E5E5] rounded-[24px] p-10 shadow-sm mb-10">
                    <span className="text-[13px] font-black text-zinc-300 mb-4 block tracking-widest">Q{currentIndex + 1}</span>
                    <h2 className="text-[24px] font-bold leading-tight mb-10">{q?.question}</h2>

                    <div className="space-y-3">
                        {Object.entries(q?.options || {}).map(([key, val]) => (
                            <button
                                key={key}
                                disabled={selectedOption !== null}
                                onClick={() => {
                                    setSelectedOption(key);
                                    if (key === q.correct) setScore(score + 1);
                                }}
                                className={`w-full text-left p-5 rounded-[12px] border transition-all font-medium flex justify-between items-center group ${selectedOption === key
                                        ? (key === q.correct ? 'bg-[#F0FDF4] border-[#86EFAC]' : 'bg-[#FEF2F2] border-[#FECACA]')
                                        : (selectedOption !== null && key === q.correct ? 'bg-[#F0FDF4] border-[#86EFAC]' : 'bg-white border-[#E5E5E5] hover:border-black')
                                    }`}
                            >
                                <span>{val}</span>
                                {selectedOption === key && (
                                    <span className="text-xl">{key === q.correct ? '✓' : '✗'}</span>
                                )}
                                {selectedOption !== null && key === q.correct && selectedOption !== key && (
                                    <span className="text-xl text-green-500">✓</span>
                                )}
                            </button>
                        ))}
                    </div>

                    {selectedOption && (
                        <div className="mt-12 animate-fade-in">
                            <div className="p-6 bg-zinc-50 rounded-[12px] border border-zinc-100 mb-10">
                                <p className="text-[11px] font-black uppercase text-zinc-400 mb-2 tracking-widest flex items-center gap-2">
                                    <span>💡</span> EXPLANATION
                                </p>
                                <p className="text-sm leading-relaxed text-[#6E6E73]">{q?.explanation}</p>
                            </div>

                            <div className="flex justify-end">
                                <button
                                    onClick={() => {
                                        if (currentIndex + 1 < questions.length) {
                                            setCurrentIndex(currentIndex + 1);
                                            setSelectedOption(null);
                                        } else {
                                            setQuizFinished(true);
                                        }
                                    }}
                                    className="bg-[#1D1D1F] text-white px-8 py-3 rounded-full font-bold hover:bg-black transition-all"
                                >
                                    {currentIndex + 1 === questions.length ? 'Finish Quiz' : 'Next Question →'}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </main>

            <style jsx>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fade-in { animation: fadeIn 0.4s ease-out forwards; }
      `}</style>
        </div>
    );
}
