import Link from 'next/link';

export default function Navbar() {
    return (
        <nav className="fixed top-0 w-full z-50 bg-white/80 backdrop-blur-md border-b border-[#E5E5E5]">
            <div className="max-w-7xl mx-auto px-6 h-12 flex items-center justify-between">
                <Link href="/" className="text-sm font-bold tracking-tight text-[#1D1D1F] flex items-center gap-1">
                    ⚡ ExamSense
                </Link>

                <div className="hidden md:flex items-center gap-8 text-[12px] text-[#6E6E73] font-medium">
                    <a href="#features" className="hover:text-[#1D1D1F] transition-colors">Features</a>
                    <a href="#colleges" className="hover:text-[#1D1D1F] transition-colors">Colleges</a>
                    <a href="#pricing" className="hover:text-[#1D1D1F] transition-colors">Pricing</a>
                </div>

                <div className="flex items-center gap-6">
                    <button className="text-[12px] text-[#6E6E73] hover:text-[#1D1D1F] transition-colors">
                        Sign in
                    </button>
                    <Link href="/dashboard">
                        <button className="bg-[#1D1D1F] text-white px-3 py-1 rounded-full text-[12px] font-medium hover:bg-black transition-all">
                            Get started
                        </button>
                    </Link>
                </div>
            </div>
        </nav>
    );
}
