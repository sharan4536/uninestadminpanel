import React from 'react';
import { Calendar, MapPin, MessageSquare, Clock, Zap, ArrowRight, ShieldCheck } from 'lucide-react';

export function LandingPage() {
  return (
    <div className="h-[100dvh] w-full overflow-y-auto bg-slate-50 text-slate-900 font-sans selection:bg-sky-200 selection:text-sky-900">
      <style>
        {`
          @keyframes float {
            0% { transform: translateY(0px) scale(1); }
            50% { transform: translateY(-15px) scale(1.02); }
            100% { transform: translateY(0px) scale(1); }
          }
          .animate-float {
            animation: float 6s ease-in-out infinite;
          }
          .animate-float-delayed {
            animation: float 6s ease-in-out 3s infinite;
          }
        `}
      </style>
      
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/70 backdrop-blur-xl border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-sky-400 to-sky-600 flex items-center justify-center shadow-md shadow-sky-500/20">
              <span className="text-white font-bold text-xl">U</span>
            </div>
            <span className="text-xl font-bold tracking-tight text-slate-800">UniNest</span>
          </div>
          <button 
            onClick={() => window.location.href = '/admin'}
            className="px-5 py-2 text-sm font-semibold rounded-full bg-slate-100 hover:bg-slate-200 transition-all text-slate-700 border border-slate-200"
          >
            Admin Login
          </button>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-40 pb-32 overflow-hidden flex flex-col items-center justify-center text-center px-6">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-sky-200/50 rounded-full blur-[120px] opacity-70 pointer-events-none"></div>
        <div className="absolute top-0 right-10 w-[400px] h-[400px] bg-emerald-200/40 rounded-full blur-[100px] pointer-events-none"></div>
        
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white border border-slate-200 shadow-sm mb-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
          <Zap className="w-4 h-4 text-amber-500" />
          <span className="text-sm font-semibold text-slate-600">The Ultimate Campus Super-App</span>
        </div>

        <h1 className="text-6xl md:text-8xl font-extrabold tracking-tighter mb-6 text-slate-900 animate-in fade-in slide-in-from-bottom-6 duration-1000 delay-100">
          Your Campus.<br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-sky-500 to-indigo-500">In Your Pocket.</span>
        </h1>
        
        <p className="text-xl md:text-2xl text-slate-600 max-w-2xl mb-10 font-medium animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-200 leading-relaxed">
          Experience a revolutionary way to navigate university life with stunning, lively campus interfaces and magical AI features.
        </p>

        <div className="flex items-center gap-4 animate-in fade-in slide-in-from-bottom-10 duration-1000 delay-300">
          <button className="px-8 py-4 rounded-full bg-sky-500 text-white font-bold text-lg hover:bg-sky-400 hover:scale-105 transition-all flex items-center gap-2 shadow-xl shadow-sky-500/30">
            Download App <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      </section>

      {/* Features Showcase */}
      <section className="py-20 px-6 max-w-7xl mx-auto relative z-10 flex flex-col gap-32">
        
        {/* Feature 1: Timetables */}
        <div className="flex flex-col md:flex-row items-center gap-12 md:gap-24">
          <div className="flex-1 w-full flex justify-center">
            <div className="relative group perspective-1000">
              <div className="absolute inset-0 bg-sky-200/60 blur-[80px] rounded-full group-hover:bg-sky-300/60 transition-colors duration-700"></div>
              <img 
                src="/images/uni_timetable_1778867329358.png" 
                alt="Running student with glowing schedule" 
                className="relative z-10 w-full max-w-lg rounded-[2rem] shadow-2xl border-4 border-white animate-float object-cover aspect-square"
              />
            </div>
          </div>
          <div className="flex-1 space-y-6 text-center md:text-left">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-sky-100 border border-sky-200 text-sky-700 font-bold tracking-wide uppercase text-sm">
              <Calendar className="w-4 h-4" /> Magical AI
            </div>
            <h3 className="text-5xl md:text-6xl font-extrabold tracking-tight text-slate-900 leading-tight">
              Schedules,<br/> <span className="text-transparent bg-clip-text bg-gradient-to-r from-sky-500 to-indigo-500">Auto-Generated.</span>
            </h3>
            <p className="text-xl text-slate-600 leading-relaxed font-medium">
              Upload a PDF or login to your portal. Our artificial intelligence instantly parses your schedule, compares it with friends, and alerts you while you're running to class.
            </p>
          </div>
        </div>

        {/* Feature 2: Spot */}
        <div className="flex flex-col md:flex-row-reverse items-center gap-12 md:gap-24">
          <div className="flex-1 w-full flex justify-center">
            <div className="relative group">
              <div className="absolute inset-0 bg-emerald-200/60 blur-[80px] rounded-full group-hover:bg-emerald-300/60 transition-colors duration-700"></div>
              <img 
                src="/images/uni_spot_1778867345585.png" 
                alt="Students running on campus map" 
                className="relative z-10 w-full max-w-lg rounded-[2rem] shadow-2xl border-4 border-white animate-float-delayed object-cover aspect-square"
              />
            </div>
          </div>
          <div className="flex-1 space-y-6 text-center md:text-left">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-100 border border-emerald-200 text-emerald-700 font-bold tracking-wide uppercase text-sm">
              <MapPin className="w-4 h-4" /> Live Map
            </div>
            <h3 className="text-5xl md:text-6xl font-extrabold tracking-tight text-slate-900 leading-tight">
              Find your <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-500 to-teal-500">Spot.</span>
            </h3>
            <p className="text-xl text-slate-600 leading-relaxed font-medium">
              Check into your favorite campus spots to let friends know where you are. See who's around on the interactive live campus map as everyone rushes between classes.
            </p>
          </div>
        </div>

        {/* Feature 3: Hangout Planner */}
        <div className="flex flex-col md:flex-row items-center gap-12 md:gap-24">
          <div className="flex-1 w-full flex justify-center">
            <div className="relative group">
              <div className="absolute inset-0 bg-amber-200/60 blur-[80px] rounded-full group-hover:bg-amber-300/60 transition-colors duration-700"></div>
              <img 
                src="/images/uni_hangout_1778867360604.png" 
                alt="Friends running to hangout" 
                className="relative z-10 w-full max-w-lg rounded-[2rem] shadow-2xl border-4 border-white animate-float object-cover aspect-square"
              />
            </div>
          </div>
          <div className="flex-1 space-y-6 text-center md:text-left">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-100 border border-amber-200 text-amber-700 font-bold tracking-wide uppercase text-sm">
              <Clock className="w-4 h-4" /> Time Sync
            </div>
            <h3 className="text-5xl md:text-6xl font-extrabold tracking-tight text-slate-900 leading-tight">
              The Perfect <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-500 to-orange-500">Hangout.</span>
            </h3>
            <p className="text-xl text-slate-600 leading-relaxed font-medium">
              Trying to plan a meetup? UniNest instantly cross-references your friends' timetables to find the exact magical time slots where everyone can run to the cafe together.
            </p>
          </div>
        </div>

        {/* Feature 4: Chat */}
        <div className="flex flex-col md:flex-row-reverse items-center gap-12 md:gap-24">
          <div className="flex-1 w-full flex justify-center">
            <div className="relative group">
              <div className="absolute inset-0 bg-indigo-200/60 blur-[80px] rounded-full group-hover:bg-indigo-300/60 transition-colors duration-700"></div>
              <img 
                src="/images/uni_chat_1778867376999.png" 
                alt="Encrypted Chat on Campus" 
                className="relative z-10 w-full max-w-lg rounded-[2rem] shadow-2xl border-4 border-white animate-float-delayed object-cover aspect-square"
              />
            </div>
          </div>
          <div className="flex-1 space-y-6 text-center md:text-left">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-indigo-100 border border-indigo-200 text-indigo-700 font-bold tracking-wide uppercase text-sm">
              <MessageSquare className="w-4 h-4" /> E2E Security
            </div>
            <h3 className="text-5xl md:text-6xl font-extrabold tracking-tight text-slate-900 leading-tight">
              Unbreakable <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-500 to-purple-500">Privacy.</span>
            </h3>
            <p className="text-xl text-slate-600 leading-relaxed font-medium">
              End-to-end encrypted direct messaging and course-specific study groups. Your campus conversations stay completely private, wherever you are.
            </p>
          </div>
        </div>

      </section>

      {/* Admin Section */}
      <section className="py-32 px-6 max-w-5xl mx-auto">
        <div className="p-12 rounded-[3rem] bg-white border border-slate-200 shadow-[0_20px_50px_-12px_rgba(0,0,0,0.1)] overflow-hidden relative group text-center flex flex-col items-center">
          <div className="absolute top-0 right-0 w-full h-full bg-sky-500/5 blur-[100px] rounded-full pointer-events-none"></div>
          <div className="w-20 h-20 rounded-3xl bg-sky-100 text-sky-500 flex items-center justify-center mb-8 group-hover:scale-110 transition-transform relative z-10 shadow-sm border border-sky-200">
            <ShieldCheck className="w-10 h-10" />
          </div>
          <h3 className="text-4xl md:text-5xl font-extrabold mb-6 text-slate-900 relative z-10 tracking-tight">Admin Dashboard</h3>
          <p className="text-xl text-slate-600 font-medium leading-relaxed max-w-2xl relative z-10 mb-10">
            A powerful, dedicated dashboard for university administrators to seamlessly manage campus events, broadcast campus-wide announcements, and configure push notifications.
          </p>
          <button 
            onClick={() => window.location.href = '/admin'}
            className="px-8 py-4 rounded-full bg-slate-900 hover:bg-slate-800 text-white font-bold text-lg transition-colors relative z-10 inline-flex items-center gap-3 shadow-lg"
          >
            Access Admin Console <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      </section>

      {/* Supported Colleges */}
      <section className="py-24 px-6 max-w-6xl mx-auto text-center border-t border-slate-200">
        <h2 className="text-2xl font-bold tracking-tight mb-12 text-slate-500">Currently live and supported at</h2>
        <div className="flex flex-wrap justify-center gap-4 md:gap-6">
          {['VIT Vellore', 'VIT Chennai', 'Alliance University', 'GITAM Visakhapatnam', 'GITAM Bengaluru', 'GITAM Hyderabad', 'Dayananda Sagar University'].map(college => (
            <div key={college} className="px-8 py-4 rounded-full bg-white border border-slate-200 text-slate-700 font-semibold text-lg hover:border-sky-300 hover:bg-sky-50 hover:-translate-y-1 hover:shadow-lg hover:shadow-sky-100 transition-all cursor-default">
              {college}
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200 py-12 px-6 text-center text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2 text-slate-400">
            <div className="w-8 h-8 rounded-xl bg-slate-200 flex items-center justify-center">
              <span className="text-slate-600 font-extrabold text-lg">U</span>
            </div>
            <span className="font-bold tracking-tight text-lg">UniNest</span>
          </div>
          <p className="text-sm font-medium">© 2026 UniNest Inc. All rights reserved.</p>
          <div className="flex gap-6 text-sm font-semibold hover:text-slate-800 transition-colors cursor-pointer">
            Privacy Policy
          </div>
        </div>
      </footer>
    </div>
  );
}
