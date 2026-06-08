import { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import Navbar from '../components/Navbar';

export default function Dashboard() {
    const [sessions, setSessions] = useState([]);
    const [showModal, setShowModal] = useState(false);
    const [loading, setLoading] = useState(false);
    const [colleges, setColleges] = useState([]);
    const [courses, setCourses] = useState([]);
    const [semesters, setSemesters] = useState([]);

    const [formData, setFormData] = useState({
        college: '',
        course: '',
        year: '',
        semester: ''
    });

    const router = useRouter();

    // Load sessions from localStorage
    useEffect(() => {
        const saved = localStorage.getItem('exam_sessions');
        if (saved) {
            setSessions(JSON.parse(saved));
        }
    }, []);

    // Fetch colleges on modal open
    useEffect(() => {
        if (showModal) {
            setLoading(true);
            fetch(`${process.env.NEXT_PUBLIC_API}/colleges`)
                .then(res => res.json())
                .then(data => {
                    const fetchedColleges = data.colleges || [];
                    setColleges(fetchedColleges.length > 0 ? fetchedColleges : ["VIT", "SRM", "BITS", "GraphicEra", "UPES", "Manipal"]);
                    setLoading(false);
                })
                .catch(err => {
                    console.error("Failed to fetch colleges", err);
                    setColleges(["VIT", "SRM", "BITS", "GraphicEra", "UPES", "Manipal"]);
                    setLoading(false);
                });
        }
    }, [showModal]);

    // Fetch courses when college changes
    useEffect(() => {
        if (formData.college) {
            setLoading(true);
            fetch(`${process.env.NEXT_PUBLIC_API}/courses?college=${formData.college}`)
                .then(res => res.json())
                .then(data => {
                    const fetchedCourses = data.courses || [];
                    setCourses(fetchedCourses.length > 0 ? fetchedCourses : ["BTech", "BCA", "BBA", "MBA", "MCA", "BSc"]);
                    setLoading(false);
                })
                .catch(err => {
                    console.error("Failed to fetch courses", err);
                    setCourses(["BTech", "BCA", "BBA", "MBA", "MCA", "BSc"]);
                    setLoading(false);
                });
        } else {
            setCourses([]);
            setFormData(prev => ({ ...prev, course: '', year: '', semester: '' }));
        }
    }, [formData.college]);

    // Fetch semesters when course and year are selected
    useEffect(() => {
        if (formData.college && formData.course && formData.year) {
            setLoading(true);
            // Map "Year 1" -> "year1" for backend
            const yearSlug = formData.year.toLowerCase().replace(' ', '');
            fetch(`${process.env.NEXT_PUBLIC_API}/semesters?college=${formData.college}&course=${formData.course}&year=${yearSlug}`)
                .then(res => res.json())
                .then(data => {
                    const fetchedSemesters = data.semesters || [];
                    setSemesters(fetchedSemesters.length > 0 ? fetchedSemesters : ["Sem 1", "Sem 2", "Sem 3", "Sem 4", "Sem 5", "Sem 6", "Sem 7", "Sem 8"]);
                    setLoading(false);
                })
                .catch(err => {
                    console.error("Failed to fetch semesters", err);
                    setSemesters(["Sem 1", "Sem 2", "Sem 3", "Sem 4", "Sem 5", "Sem 6", "Sem 7", "Sem 8"]);
                    setLoading(false);
                });
        } else {
            setSemesters([]);
            setFormData(prev => ({ ...prev, semester: '' }));
        }
    }, [formData.course, formData.year]);

    const handleCreateSession = () => {
        if (!formData.college || !formData.course || !formData.year || !formData.semester) {
            alert("Please select all fields");
            return;
        }

        const newSession = {
            id: Date.now(),
            ...formData,
            createdAt: new Date().toISOString(),
            lastUsed: "Today"
        };

        const updatedSessions = [newSession, ...sessions];
        localStorage.setItem('exam_sessions', JSON.stringify(updatedSessions));
        setSessions(updatedSessions);
        setShowModal(false);

        // Redirect to session page
        const yearSlug = formData.year.toLowerCase().replace(' ', '');
        router.push(`/session?college=${formData.college}&course=${formData.course}&year=${yearSlug}&semester=${formData.semester}`);
    };

    return (
        <div className="min-h-screen bg-white text-[#1D1D1F] font-inter">
            <Head>
                <title>Dashboard | ExamSense</title>
            </Head>

            <Navbar />

            <main className="max-w-[1200px] mx-auto pt-24 pb-12 px-10">
                <div className="flex justify-between items-end mb-10">
                    <div>
                        <h1 className="text-[32px] font-bold tracking-tight mb-2">Your Exam Sessions</h1>
                        <p className="text-[#6E6E73] text-sm">Pick up where you left off or start a new prediction.</p>
                    </div>
                    <button
                        onClick={() => setShowModal(true)}
                        className="bg-[#1D1D1F] text-white px-5 py-2.5 rounded-lg text-sm font-semibold hover:bg-black transition-all flex items-center gap-2"
                    >
                        <span className="text-lg">+</span> New Session
                    </button>
                </div>

                {/* SESSION CARDS GRID */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {/* CREATE CARD */}
                    <div
                        onClick={() => setShowModal(true)}
                        className="h-[200px] border-2 border-dashed border-[#D1D1D6] rounded-[16px] flex flex-col items-center justify-center cursor-pointer hover:border-[#6366F1] hover:bg-indigo-50/30 transition-all group"
                    >
                        <div className="w-12 h-12 rounded-full bg-zinc-100 flex items-center justify-center mb-3 group-hover:bg-indigo-100 transition-all">
                            <span className="text-3xl font-light text-[#6E6E73] group-hover:text-[#6366F1]">+</span>
                        </div>
                        <p className="text-[#6E6E73] font-medium text-sm">Start a new exam session</p>
                    </div>

                    {/* DYNAMIC SESSIONS */}
                    {sessions.map(session => (
                        <div key={session.id} className="h-[200px] border border-[#E5E5E5] rounded-[16px] p-6 flex flex-col justify-between hover:shadow-xl hover:border-transparent transition-all group bg-white">
                            <div>
                                <span className="inline-block px-2.5 py-0.5 rounded-full bg-zinc-100 text-[10px] font-bold uppercase tracking-wider text-[#6E6E73] mb-4">
                                    {session.college}
                                </span>
                                <h2 className="text-[22px] font-bold leading-tight line-clamp-2">
                                    {session.course} <br />
                                    <span className="text-zinc-400 font-medium">Semester {session.semester.replace('sem', '')}</span>
                                </h2>
                            </div>
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-zinc-400">Last used: Today</span>
                                <Link href={`/session?college=${session.college}&course=${session.course}&year=${session.year.toLowerCase().replace(' ', '')}&semester=${session.semester}`} className="text-[#6366F1] font-bold hover:underline">
                                    Open →
                                </Link>
                            </div>
                        </div>
                    ))}
                </div>

                {sessions.length === 0 && (
                    <div className="mt-12 text-center py-20 bg-zinc-50 rounded-2xl border border-dashed border-zinc-200">
                        <p className="text-[#6E6E73] text-sm">No sessions yet. Create your first one!</p>
                        <p className="text-[#6E6E73] text-xs mt-1">Create your first session to start predicting exam questions</p>
                    </div>
                )}
            </main>

            {/* MODAL */}
            {showModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/40 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white w-full max-w-[480px] rounded-[20px] p-10 shadow-2xl relative animate-fade-in-up">
                        <button
                            onClick={() => setShowModal(false)}
                            className="absolute top-6 right-6 text-zinc-400 hover:text-black text-2xl"
                        >
                            ×
                        </button>

                        <h2 className="text-2xl font-bold mb-8 tracking-tight">New Exam Session</h2>

                        <div className="space-y-6">
                            {/* College */}
                            <div>
                                <label className="block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-2">Select College</label>
                                <select
                                    className="w-full border border-[#E5E5E5] rounded-lg p-3 text-base focus:outline-none focus:border-black transition-all bg-white"
                                    value={formData.college}
                                    onChange={(e) => setFormData({ ...formData, college: e.target.value, course: '', year: '', semester: '' })}
                                >
                                    <option value="">Choose a college</option>
                                    {colleges.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                            </div>

                            {/* Course */}
                            {formData.college && (
                                <div>
                                    <label className="block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-2">Select Course</label>
                                    <select
                                        className="w-full border border-[#E5E5E5] rounded-lg p-3 text-base focus:outline-none focus:border-black transition-all bg-white"
                                        value={formData.course}
                                        onChange={(e) => setFormData({ ...formData, course: e.target.value, year: '', semester: '' })}
                                    >
                                        <option value="">Choose a course</option>
                                        {courses.map(c => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                </div>
                            )}

                            {/* Year */}
                            {formData.course && (
                                <div>
                                    <label className="block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-2">Select Year</label>
                                    <select
                                        className="w-full border border-[#E5E5E5] rounded-lg p-3 text-base focus:outline-none focus:border-black transition-all bg-white"
                                        value={formData.year}
                                        onChange={(e) => setFormData({ ...formData, year: e.target.value, semester: '' })}
                                    >
                                        <option value="">Choose a year</option>
                                        <option value="Year 1">Year 1</option>
                                        <option value="Year 2">Year 2</option>
                                        <option value="Year 3">Year 3</option>
                                        <option value="Year 4">Year 4</option>
                                    </select>
                                </div>
                            )}

                            {/* Semester */}
                            {formData.year && (
                                <div>
                                    <label className="block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-2">Select Semester</label>
                                    <select
                                        className="w-full border border-[#E5E5E5] rounded-lg p-3 text-base focus:outline-none focus:border-black transition-all bg-white"
                                        value={formData.semester}
                                        onChange={(e) => setFormData({ ...formData, semester: e.target.value })}
                                    >
                                        <option value="">Choose a semester</option>
                                        {semesters.map(s => <option key={s} value={s}>{s}</option>)}
                                    </select>
                                </div>
                            )}

                            <button
                                onClick={handleCreateSession}
                                className="w-full bg-[#1D1D1F] text-white py-4 rounded-lg font-bold hover:bg-black transition-all mt-4"
                            >
                                Create Session →
                            </button>
                        </div>

                        {loading && (
                            <div className="absolute inset-0 bg-white/50 flex items-center justify-center rounded-[20px]">
                                <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                            </div>
                        )}
                    </div>
                </div>
            )}

            <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in { animation: fadeIn 0.3s ease-out forwards; }
        .animate-fade-in-up { animation: fadeInUp 0.4s ease-out forwards; }
      `}</style>
        </div>
    );
}
