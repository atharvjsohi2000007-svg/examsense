import { useState } from 'react';
import Head from 'next/head';
import Navbar from '../components/Navbar';

export default function UploadPage() {
    const [dragActive, setDragActive] = useState(false);
    const [file, setFile] = useState(null);
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);

    const [formData, setFormData] = useState({
        college: '',
        course: '',
        year: '',
        semester: ''
    });

    const handleDrag = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === "dragenter" || e.type === "dragover") {
            setDragActive(true);
        } else if (e.type === "dragleave") {
            setDragActive(false);
        }
    };

    const handleDrop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            setFile(e.dataTransfer.files[0]);
        }
    };

    const handleUpload = async () => {
        if (!file || !formData.college || !formData.course || !formData.year || !formData.semester) {
            alert("Please fill all fields and select a file.");
            return;
        }

        setLoading(true);
        const body = new FormData();
        body.append('file', file);
        body.append('college', formData.college);
        body.append('course', formData.course);
        body.append('year', formData.year);
        body.append('semester', formData.semester);

        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API}/upload`, {
                method: 'POST',
                body
            });
            const result = await res.json();
            if (result.success) {
                setSuccess(true);
            } else {
                alert(result.detail || "Upload failed.");
            }
        } catch (err) {
            console.error(err);
            alert("Something went wrong during upload.");
        } finally {
            setLoading(false);
        }
    };

    if (success) {
        return (
            <div className="min-h-screen bg-white">
                <Navbar />
                <main className="max-w-[600px] mx-auto pt-32 px-6 text-center flex flex-col items-center">
                    <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-8 animate-bounce">
                        <span className="text-3xl">✓</span>
                    </div>
                    <h1 className="text-3xl font-bold mb-4">Thank you! Paper uploaded successfully</h1>
                    <p className="text-zinc-500 mb-10 max-w-[400px]">Our AI is now processing the document. your free Pro month will be activated within 24 hours.</p>
                    <button
                        onClick={() => { setSuccess(false); setFile(null); }}
                        className="bg-[#1D1D1F] text-white px-10 py-3 rounded-full font-bold shadow-lg"
                    >
                        Upload Another
                    </button>
                </main>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-white text-[#1D1D1F] font-inter">
            <Head>
                <title>Upload | ExamSense</title>
            </Head>
            <Navbar />

            <main className="max-w-[600px] mx-auto pt-32 px-6 pb-20">
                <div className="text-center mb-12">
                    <h1 className="text-[36px] font-bold leading-tight mb-4 tracking-tighter">Help Your College Community</h1>
                    <p className="text-[#6E6E73] text-lg">Upload question papers and earn 1 month of Pro access free</p>
                </div>

                <div className="bg-white border border-[#E5E5E5] rounded-[24px] p-10 shadow-sm">
                    {/* UPLOAD ZONE */}
                    <div
                        className={`relative border-2 border-dashed rounded-[18px] p-12 text-center transition-all ${dragActive ? 'border-indigo-500 bg-indigo-50/30' : 'border-[#E5E5E5] hover:border-zinc-300'}`}
                        onDragEnter={handleDrag}
                        onDragLeave={handleDrag}
                        onDragOver={handleDrag}
                        onDrop={handleDrop}
                    >
                        <input
                            type="file"
                            accept=".pdf"
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                            onChange={(e) => setFile(e.target.files[0])}
                        />
                        {file ? (
                            <div className="flex flex-col items-center">
                                <span className="text-4xl mb-4">📄</span>
                                <p className="font-bold mb-1 truncate max-w-full italic">{file.name}</p>
                                <p className="text-xs text-zinc-400">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                                <button
                                    onClick={(e) => { e.preventDefault(); setFile(null); }}
                                    className="mt-4 text-xs font-bold text-red-500 hover:underline"
                                >
                                    Remove file
                                </button>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center pointer-events-none">
                                <div className="w-16 h-16 bg-zinc-50 rounded-full flex items-center justify-center mb-6">
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-zinc-400">
                                        <path d="M21 15V19C21 19.5304 20.7893 20.0391 20.4142 20.4142C20.0391 20.7893 19.5304 21 19 21H5C4.46957 21 3.96086 20.7893 3.58579 20.4142C3.21071 20.0391 3 19.5304 3 19V15M17 8L12 3M12 3L7 8M12 3V15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                    </svg>
                                </div>
                                <p className="font-bold text-sm mb-1">Drag and drop your PDF here</p>
                                <p className="text-xs text-zinc-400">or click to browse</p>
                            </div>
                        )}
                    </div>

                    {/* FORM FIELDS */}
                    <div className="mt-10 space-y-6">
                        <div className="grid grid-cols-1 gap-6">
                            <div>
                                <label className="block text-[11px] font-black uppercase tracking-widest text-zinc-500 mb-2">College</label>
                                <input
                                    type="text"
                                    placeholder="e.g. VIT"
                                    className="w-full border border-[#E5E5E5] rounded-[10px] p-3 text-sm focus:outline-none focus:border-black transition-all"
                                    value={formData.college}
                                    onChange={e => setFormData({ ...formData, college: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-[11px] font-black uppercase tracking-widest text-zinc-500 mb-2">Course / Branch</label>
                                <input
                                    type="text"
                                    placeholder="e.g. BTech CSE"
                                    className="w-full border border-[#E5E5E5] rounded-[10px] p-3 text-sm focus:outline-none focus:border-black transition-all"
                                    value={formData.course}
                                    onChange={e => setFormData({ ...formData, course: e.target.value })}
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-6">
                            <div>
                                <label className="block text-[11px] font-black uppercase tracking-widest text-zinc-500 mb-2">Year</label>
                                <select
                                    className="w-full border border-[#E5E5E5] rounded-[10px] p-3 text-sm focus:outline-none focus:border-black transition-all bg-white"
                                    value={formData.year}
                                    onChange={e => setFormData({ ...formData, year: e.target.value })}
                                >
                                    <option value="">Select</option>
                                    <option value="year1">Year 1</option>
                                    <option value="year2">Year 2</option>
                                    <option value="year3">Year 3</option>
                                    <option value="year4">Year 4</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-[11px] font-black uppercase tracking-widest text-zinc-500 mb-2">Semester</label>
                                <select
                                    className="w-full border border-[#E5E5E5] rounded-[10px] p-3 text-sm focus:outline-none focus:border-black transition-all bg-white"
                                    value={formData.semester}
                                    onChange={e => setFormData({ ...formData, semester: e.target.value })}
                                >
                                    <option value="">Select</option>
                                    {[1, 2, 3, 4, 5, 6, 7, 8].map(s => (
                                        <option key={s} value={`sem${s}`}>Semester {s}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <button
                            disabled={loading}
                            onClick={handleUpload}
                            className={`w-full bg-[#1D1D1F] text-white py-4 rounded-[10px] font-bold shadow-lg hover:bg-black transition-all flex items-center justify-center gap-3 ${loading ? 'opacity-50' : ''}`}
                        >
                            {loading ? (
                                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            ) : 'Upload Paper →'}
                        </button>
                    </div>
                </div>
            </main>
        </div>
    );
}
