import Head from 'next/head';
import Link from 'next/link';
import Navbar from '../components/Navbar';

export default function Home() {
  return (
    <div className="min-h-screen bg-white text-[#1D1D1F] font-inter">
      <Head>
        <title>ExamSense</title>
        <meta name="description" content="The smartest way to prepare for your exams." />
      </Head>

      <Navbar />

      <main>
        {/* HERO SECTION */}
        <section className="pt-[120px] pb-24 px-6 text-center">
          <div className="max-w-3xl mx-auto">
            <span className="text-[17px] font-semibold text-[#6366F1] mb-4 block">
              Introducing ExamSense
            </span>

            <h1 className="text-6xl md:text-[80px] font-bold leading-[1.05] tracking-tighter text-[#1D1D1F] mb-6 whitespace-pre-line">
              {`The smartest way\nto prepare for\nyour exams.`}
            </h1>

            <p className="text-[19px] md:text-[21px] text-[#6E6E73] max-w-2xl mx-auto mb-10 leading-relaxed">
              AI that reads 10 years of past papers from VIT, SRM, BITS, Manipal, UPES and Graphic Era.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
              <Link href="/dashboard">
                <button className="bg-[#1D1D1F] text-white px-[28px] py-[12px] rounded-full text-[17px] font-medium hover:bg-zinc-800 transition-all">
                  Start for free →
                </button>
              </Link>
              <button className="text-[17px] text-[#6366F1] font-medium hover:underline">
                Learn more ›
              </button>
            </div>
          </div>
        </section>

        {/* PRODUCT SHOWCASE SECTION */}
        <section className="bg-[#1D1D1F] py-20 px-6">
          <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Card 1 */}
            <div className="bg-transparent text-white border-r border-white/10 md:pr-12 last:border-0">
              <p className="text-[14px] font-semibold text-zinc-400 mb-2 uppercase tracking-wider">Question Prediction</p>
              <div className="text-[64px] font-bold mb-2">87%</div>
              <p className="text-[14px] text-zinc-400 mb-6">accuracy on repeated topics</p>
              <div className="flex items-end gap-1 h-12">
                {[40, 70, 50, 90, 60, 87].map((h, i) => (
                  <div key={i} className="flex-1 bg-white/20 rounded-t-sm" style={{ height: `${h}%` }} />
                ))}
              </div>
            </div>

            {/* Card 2 */}
            <div className="bg-transparent text-white border-r border-white/10 md:px-12 last:border-0">
              <p className="text-[14px] font-semibold text-zinc-400 mb-2 uppercase tracking-wider">Papers Analyzed</p>
              <div className="text-[64px] font-bold mb-2">2,000+</div>
              <p className="text-[14px] text-zinc-400">across 6 colleges</p>
            </div>

            {/* Card 3 */}
            <div className="bg-transparent text-white md:pl-12">
              <p className="text-[14px] font-semibold text-zinc-400 mb-2 uppercase tracking-wider">Historical Data</p>
              <div className="text-[64px] font-bold mb-2">10+</div>
              <p className="text-[14px] text-zinc-400">years per college</p>
            </div>
          </div>
        </section>

        {/* COLLEGES SECTION */}
        <section id="colleges" className="py-24 px-6 bg-white text-center">
          <div className="max-w-7xl mx-auto">
            <h2 className="text-4xl md:text-5xl font-bold mb-4 tracking-tight">Built for your college</h2>
            <p className="text-[#6E6E73] text-[19px] mb-12">Supporting India's top private universities</p>

            <div className="flex flex-wrap justify-center gap-3">
              {["VIT", "SRM", "BITS Pilani", "Graphic Era", "UPES", "Manipal"].map(college => (
                <span key={college} className="border border-[#E5E5E5] px-5 py-2 rounded-full text-[15px] font-medium text-[#1D1D1F]">
                  {college}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* HOW IT WORKS SECTION */}
        <section id="features" className="py-24 px-6 bg-zinc-50">
          <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-16">
            <div>
              <div className="text-[48px] font-bold text-[#E5E5E5] mb-4">01</div>
              <h3 className="text-xl font-bold mb-2">Select your college and semester</h3>
              <p className="text-[#6E6E73] leading-relaxed">Choose your branch and current semester to get started with analysis.</p>
            </div>
            <div>
              <div className="text-[48px] font-bold text-[#E5E5E5] mb-4">02</div>
              <h3 className="text-xl font-bold mb-2">AI analyzes 10 years of papers</h3>
              <p className="text-[#6E6E73] leading-relaxed">Our models process historical data to identify repeating patterns and high-weightage topics.</p>
            </div>
            <div>
              <div className="text-[48px] font-bold text-[#E5E5E5] mb-4">03</div>
              <h3 className="text-xl font-bold mb-2">Get predicted questions instantly</h3>
              <p className="text-[#6E6E73] leading-relaxed">Unlock a curated list of predicted questions and model papers for your exam.</p>
            </div>
          </div>
        </section>

        {/* FINAL CTA SECTION */}
        <section className="bg-[#1D1D1F] py-24 px-6 text-center text-white">
          <div className="max-w-2xl mx-auto">
            <h2 className="text-4xl md:text-5xl font-bold mb-8">Ready to ace your exams?</h2>
            <Link href="/dashboard">
              <button className="bg-white text-[#1D1D1F] px-8 py-3 rounded-full text-[17px] font-bold hover:bg-zinc-100 transition-all">
                Start predicting for free
              </button>
            </Link>
          </div>
        </section>
      </main>

      {/* FOOTER */}
      <footer className="py-12 border-t border-[#E5E5E5] text-center">
        <p className="text-[12px] text-[#6E6E73] font-medium tracking-tight">
          © 2025 ExamSense — Built for Indian Students.
        </p>
      </footer>
    </div>
  );
}
