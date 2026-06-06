import { useState, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import Navbar from '../components/Navbar';

export default function FlashcardsPage() {
    const router = useRouter();
    const { college, course, year, semester } = router.query;

    const [cards, setCards] = useState([]);
    const [loading, setLoading] = useState(true);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isFlipped, setIsFlipped] = useState(false);

    useEffect(() => {
        if (college && course && semester) {
            setLoading(true);
            fetch(`${process.env.NEXT_PUBLIC_API}/flashcards`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ college, course, semester })
            })
                .then(res => res.json())
                .then(data => {
                    setCards(data.flashcards || []);
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

    const currentCard = cards[currentIndex];
    const isLocked = currentIndex >= 5;

    return (
        <div className="min-h-screen bg-white text-[#1D1D1F] font-inter">
            <Head>
                <title>Flashcards | ExamSense</title>
            </Head>
            <Navbar />

            <main className="max-w-[600px] mx-auto pt-32 px-6">
                {/* PROGRESS */}
                <div className="mb-12">
                    <div className="flex justify-between items-end mb-2">
                        <span className="text-[13px] font-bold text-[#6E6E73]">Card {currentIndex + 1} of {cards.length}</span>
                        <span className="text-[11px] font-black uppercase tracking-widest text-indigo-500">Free Tier</span>
                    </div>
                    <div className="w-full bg-zinc-100 h-1 rounded-full overflow-hidden">
                        <div
                            className="bg-indigo-500 h-full transition-all duration-500"
                            style={{ width: `${((currentIndex + 1) / cards.length) * 100}%` }}
                        />
                    </div>
                </div>

                {/* CARD CONTAINER */}
                <div className="relative h-[400px] perspective-1000">
                    <div
                        onClick={() => !isLocked && setIsFlipped(!isFlipped)}
                        className={`relative w-full h-full transition-transform duration-500 preserve-3d cursor-pointer ${isFlipped ? 'rotate-y-180' : ''} ${isLocked ? 'blur-md grayscale' : ''}`}
                    >
                        {/* Front */}
                        <div className="absolute inset-0 backface-hidden bg-[#EEF2FF] border border-[#E5E5E5] rounded-[24px] p-10 flex flex-col items-center justify-center text-center shadow-sm">
                            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-500 mb-6">{currentCard?.topic}</span>
                            <h2 className="text-2xl font-bold leading-snug">{currentCard?.front}</h2>
                            <p className="mt-12 text-[#6E6E73] text-[11px] font-bold uppercase tracking-widest opacity-40">Click to reveal answer</p>
                        </div>

                        {/* Back */}
                        <div className="absolute inset-0 backface-hidden rotate-y-180 bg-[#F0FDF4] border border-[#E5E5E5] rounded-[24px] p-10 flex flex-col items-center justify-center text-center shadow-sm">
                            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-green-600 mb-6">Answer</span>
                            <p className="text-xl font-medium leading-relaxed">{currentCard?.back}</p>
                        </div>
                    </div>

                    {/* LOCK OVERLAY */}
                    {isLocked && (
                        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center text-center p-10 bg-white/40 backdrop-blur-sm rounded-[24px]">
                            <div className="text-4xl mb-4">🔒</div>
                            <h3 className="text-xl font-bold mb-2">Unlock all {cards.length} flashcards</h3>
                            <p className="text-sm text-zinc-500 mb-6 max-w-[240px]">Get unlimited access to all AI generated study tools.</p>
                            <button className="bg-[#1D1D1F] text-white px-8 py-3 rounded-full font-bold hover:scale-105 transition-all">
                                Go Pro → ₹99/month
                            </button>
                        </div>
                    )}
                </div>

                {/* CONTROLS */}
                <div className="mt-12 flex items-center justify-between">
                    <button
                        disabled={currentIndex === 0}
                        onClick={() => { setCurrentIndex(currentIndex - 1); setIsFlipped(false); }}
                        className="text-[15px] font-bold text-[#6E6E73] hover:text-black disabled:opacity-30 flex items-center gap-2"
                    >
                        ← Previous
                    </button>

                    <button className="text-[13px] font-bold text-indigo-500 border border-indigo-100 px-4 py-1 rounded-full hover:bg-indigo-50">
                        Shuffle
                    </button>

                    <button
                        disabled={currentIndex === cards.length - 1}
                        onClick={() => { setCurrentIndex(currentIndex + 1); setIsFlipped(false); }}
                        className="text-[15px] font-bold text-[#1D1D1F] hover:text-indigo-600 disabled:opacity-30 flex items-center gap-2"
                    >
                        Next →
                    </button>
                </div>
            </main>

            <style jsx>{`
        .perspective-1000 { perspective: 1000px; }
        .preserve-3d { transform-style: preserve-3d; }
        .backface-hidden { backface-visibility: hidden; }
        .rotate-y-180 { transform: rotateY(180deg); }
      `}</style>
        </div>
    );
}
