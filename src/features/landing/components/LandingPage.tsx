import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import gsap from 'gsap';
import Lenis from 'lenis';
import { ThreeParticles } from './ThreeParticles';
import { Penguin } from './Penguin';
import { CampusLandscape } from './CampusLandscape';
import { LandingFeatures } from './LandingFeatures';
import { ClassroomScene } from './ClassroomScene';
import { Sparkles, ArrowRight, MessageSquare, Shield, Smartphone, Heart, Zap } from 'lucide-react';
import { toast } from 'sonner';

interface LandingPageProps {
  onJoinClick: () => void;
}

export function LandingPage({ onJoinClick }: LandingPageProps) {
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [introStage, setIntroStage] = useState<'loading' | 'sky' | 'run' | 'meet' | 'throw' | 'revealed'>('loading');
  const [isCampusRevealed, setIsCampusRevealed] = useState(false);
  const [showCaps, setShowCaps] = useState(false);
  
  const cameraWrapperRef = useRef<HTMLDivElement>(null);
  const skySectionRef = useRef<HTMLDivElement>(null);

  const handleDownloadClick = () => {
    toast("Coming soon! App store links will be available shortly.");
  };

  // 1. Cinematic Loading Screen counter
  useEffect(() => {
    if (introStage !== 'loading') return;
    const interval = setInterval(() => {
      setLoadingProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          setTimeout(() => {
            setIntroStage('sky');
          }, 800);
          return 100;
        }
        return prev + 4;
      });
    }, 80);
    return () => clearInterval(interval);
  }, [introStage]);

  // 2. Control intro sequence stages
  useEffect(() => {
    if (introStage === 'sky') {
      // Transition from sky gaze to penguin run after 1s
      const timer = setTimeout(() => setIntroStage('run'), 1000);
      return () => clearTimeout(timer);
    }
    if (introStage === 'run') {
      // Penguins run in for 1.8s
      const timer = setTimeout(() => setIntroStage('meet'), 1800);
      return () => clearTimeout(timer);
    }
    if (introStage === 'meet') {
      // Look at each other excitedly for 1.5s
      const timer = setTimeout(() => {
        setIntroStage('throw');
        setShowCaps(true);
      }, 1500);
      return () => clearTimeout(timer);
    }
    if (introStage === 'throw') {
      // Caps thrown, trigger camera scroll up to reveal campus (2.5s)
      if (cameraWrapperRef.current) {
        gsap.to(cameraWrapperRef.current, {
          y: '-100vh',
          duration: 2.2,
          ease: 'power3.inOut',
          onComplete: () => {
            setIntroStage('revealed');
            setIsCampusRevealed(true);
          }
        });
      }
    }
  }, [introStage]);

  // 3. Initialize Lenis Smooth Scroll once campus is revealed
  useEffect(() => {
    if (introStage !== 'revealed') return;

    const lenis = new Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      orientation: 'vertical',
      gestureOrientation: 'vertical',
      smoothWheel: true,
    });

    function raf(time: number) {
      lenis.raf(time);
      requestAnimationFrame(raf);
    }

    requestAnimationFrame(raf);

    return () => {
      lenis.destroy();
    };
  }, [introStage]);

  const handleExploreClick = () => {
    const el = document.getElementById('explore-campus-anchor');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="min-h-screen bg-sky-50 text-slate-800 overflow-x-hidden select-none font-sans">
      
      {/* A. LOADING SCREEN */}
      <AnimatePresence>
        {introStage === 'loading' && (
          <motion.div 
            exit={{ opacity: 0, scale: 1.02 }}
            transition={{ duration: 0.6, ease: 'easeInOut' }}
            className="fixed inset-0 w-full h-full bg-sky-50 flex flex-col items-center justify-center z-50 p-6"
          >
            {/* Mascot Penguin image card */}
            <motion.div 
              animate={{ scale: [1, 1.03, 1] }}
              transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
              className="w-48 h-48 mb-6 rounded-3xl overflow-hidden shadow-lg border border-sky-100/50 bg-white p-2"
            >
              <img src="/images/running_penguins.jpg" className="w-full h-full object-cover rounded-2xl" alt="UniNest Mascot Penguins" />
            </motion.div>

            {/* Glowing Text */}
            <h2 className="text-xl font-extrabold font-mono tracking-[0.2em] text-sky-600 mb-4 animate-pulse">
              ENTERING UNINEST WORLD...
            </h2>

            {/* Loading Bar */}
            <div className="w-64 h-2 bg-sky-100 border border-sky-200/50 rounded-full overflow-hidden relative">
              <motion.div 
                className="h-full bg-gradient-to-r from-sky-400 to-sky-500 shadow-[0_0_8px_rgba(56,189,248,0.4)]"
                style={{ width: `${loadingProgress}%` }}
              />
            </div>
            
            <p className="text-[11px] font-mono text-sky-500 mt-2 font-bold">{loadingProgress}% Loaded</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* CAMERA SCROLL WRAPPER (GSAP pans this container upward when caps are thrown) */}
      <div ref={cameraWrapperRef} className="w-full relative" style={{ willChange: 'transform' }}>
        
        {/* ========================================================
            SCREEN 1: FOGGY SKY GAZE & INTRO ANIMATION (100vh)
            ======================================================== */}
        <div 
          ref={skySectionRef}
          className="h-screen w-full relative overflow-hidden bg-gradient-to-b from-sky-100 via-sky-50 to-white flex flex-col items-center justify-between py-16"
        >
          {/* Subtle WebGL particles & fog overlay */}
          <ThreeParticles />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-white/90 pointer-events-none z-10" />

          {/* Clouds backdrop */}
          <div className="absolute top-[20%] w-full flex justify-between px-12 opacity-40 select-none z-0">
            <motion.div animate={{ x: [-20, 20] }} transition={{ duration: 10, repeat: Infinity, repeatType: 'reverse' }} className="w-72 h-20 bg-sky-200 rounded-full blur-2xl" />
            <motion.div animate={{ x: [20, -20] }} transition={{ duration: 12, repeat: Infinity, repeatType: 'reverse' }} className="w-96 h-24 bg-sky-300 rounded-full blur-3xl" />
          </div>

          {/* Heading */}
          <div className="h-16 flex items-center justify-center z-20">
            {introStage === 'sky' && (
              <motion.p 
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.8 }}
                className="text-xs font-mono tracking-[0.3em] uppercase text-sky-500 font-bold"
              >
                Gaze up... Campus rises next
              </motion.p>
            )}
          </div>

          {/* PENGUIN INTRUDER STAGE (Left & Right Running Penguins) */}
          <div className="w-full relative h-48 flex items-end justify-center z-25 overflow-visible">
            
            {/* Left Running Penguin */}
            {(introStage === 'run' || introStage === 'meet' || introStage === 'throw') && (
              <motion.div
                initial={{ x: '-60vw' }}
                animate={introStage === 'run' ? { x: '-40px' } : { x: '-40px' }}
                transition={{ duration: 1.6, ease: 'easeOut' }}
                className="absolute w-24 h-24 origin-bottom flex flex-col items-center"
                style={{ filter: introStage === 'run' ? 'blur(0.5px)' : 'none' }}
              >
                <Penguin 
                  activity={introStage === 'run' ? 'walking' : introStage === 'throw' ? 'throw_cap' : 'talking'} 
                  expression={introStage === 'meet' ? 'excited' : 'happy'}
                  clothes="hoodie" 
                  direction="right" 
                />
                
                {/* Heart/Excited bubble on meet */}
                {introStage === 'meet' && (
                  <motion.div 
                    initial={{ scale: 0, y: 10 }}
                    animate={{ scale: 1, y: 0 }}
                    className="absolute -top-10 bg-rose-500 text-white rounded-full p-2 shadow-lg"
                  >
                    <Heart className="w-3.5 h-3.5 fill-white" />
                  </motion.div>
                )}
              </motion.div>
            )}

            {/* Right Running Penguin */}
            {(introStage === 'run' || introStage === 'meet' || introStage === 'throw') && (
              <motion.div
                initial={{ x: '60vw' }}
                animate={introStage === 'run' ? { x: '40px' } : { x: '40px' }}
                transition={{ duration: 1.6, ease: 'easeOut' }}
                className="absolute w-24 h-24 origin-bottom flex flex-col items-center"
                style={{ filter: introStage === 'run' ? 'blur(0.5px)' : 'none' }}
              >
                <Penguin 
                  activity={introStage === 'run' ? 'walking' : introStage === 'throw' ? 'throw_cap' : 'idle'} 
                  expression={introStage === 'meet' ? 'excited' : 'happy'}
                  clothes="scarf" 
                  direction="left" 
                />

                {/* Exclamation point bubble on meet */}
                {introStage === 'meet' && (
                  <motion.div 
                    initial={{ scale: 0, y: 10 }}
                    animate={{ scale: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="absolute -top-10 bg-sky-500 text-white rounded-full px-2 py-1 shadow-lg text-xs font-black"
                  >
                    !
                  </motion.div>
                )}
              </motion.div>
            )}

            {/* Slow Motion Spinning Caps flying up when thrown */}
            {showCaps && (
              <g className="absolute inset-0 flex justify-center pointer-events-none z-30">
                {/* Left Cap */}
                <motion.div
                  initial={{ y: 20, x: -30, rotate: 0, scale: 1 }}
                  animate={{ 
                    y: -600, 
                    x: -80,
                    rotate: 720, 
                    scale: 0.7 
                  }}
                  transition={{ duration: 2.2, ease: 'easeOut' }}
                  className="absolute w-8 h-8"
                >
                  <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-[0_0_12px_rgba(56,189,248,0.5)]">
                    <polygon points="50,10 90,30 50,50 10,30" fill="#0284c7" stroke="#ffffff" strokeWidth="2" />
                    <path d="M30,30 V45 C30,50 38,55 50,55 C62,55 70,50 70,45 V30 Z" fill="#0284c7" />
                    <line x1="50" y1="30" x2="20" y2="40" stroke="#eab308" strokeWidth="2.5" />
                    <circle cx="20" cy="40" r="4" fill="#eab308" />
                  </svg>
                </motion.div>
                {/* Right Cap */}
                <motion.div
                  initial={{ y: 20, x: 30, rotate: 0, scale: 1 }}
                  animate={{ 
                    y: -650, 
                    x: 80,
                    rotate: -840, 
                    scale: 0.7 
                  }}
                  transition={{ duration: 2.2, ease: 'easeOut', delay: 0.05 }}
                  className="absolute w-8 h-8"
                >
                  <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-[0_0_12px_rgba(56,189,248,0.5)]">
                    <polygon points="50,10 90,30 50,50 10,30" fill="#0ea5e9" stroke="#ffffff" strokeWidth="2" />
                    <path d="M30,30 V45 C30,50 38,55 50,55 C62,55 70,50 70,45 V30 Z" fill="#0ea5e9" />
                    <line x1="50" y1="30" x2="80" y2="40" stroke="#fbbf24" strokeWidth="2.5" />
                    <circle cx="80" cy="40" r="4" fill="#fbbf24" />
                  </svg>
                </motion.div>
              </g>
            )}

          </div>

          <div className="h-12 z-20" />
        </div>

        {/* ========================================================
            SCREEN 2: LANDING PAGE CAMPUS REVEAL (Hero + Scroll Flow)
            ======================================================== */}
        <div className="w-full bg-white relative overflow-visible" style={{ minHeight: '100vh' }}>
          
          {/* Glassmorphism Sticky Navbar */}
          <nav className="sticky top-0 w-full z-40 bg-white/85 backdrop-blur-md border-b border-sky-100 px-6 py-4 flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-sky-400 to-sky-500 flex items-center justify-center shadow-md overflow-hidden">
                <img src="/logo.png?v=3" className="w-6 h-6 object-contain" alt="UniNest Logo" />
              </div>
              <span className="font-extrabold text-lg text-slate-800 font-sans tracking-wide">
                Uni<span className="text-sky-500">Nest</span>
              </span>
            </div>
            
            <div className="hidden md:flex items-center gap-8 text-xs font-bold uppercase tracking-wider text-slate-500">
              <a href="#explore-features" className="hover:text-sky-500 transition-colors">Features</a>
              <a href="#classroom" className="hover:text-sky-500 transition-colors">Classroom</a>
              <a href="#footer" className="hover:text-sky-500 transition-colors">Campus Map</a>
            </div>

            <button 
              onClick={handleDownloadClick}
              className="px-5 py-2 text-xs font-black uppercase tracking-wider bg-gradient-to-r from-sky-400 to-sky-500 hover:opacity-95 text-white rounded-full shadow-[0_4px_12px_rgba(56,189,248,0.2)]"
            >
              Download
            </button>
          </nav>

          {/* HERO GRID */}
          <div className="w-full max-w-6xl mx-auto px-6 pt-16 md:pt-24 pb-12 grid grid-cols-1 lg:grid-cols-12 gap-16 items-center">
            
            {/* Title / Hero copy (7 cols) */}
            <div className="lg:col-span-7 flex flex-col text-left gap-6 relative">
              
              {/* Floating micro notification popups */}
              <AnimatePresence>
                {isCampusRevealed && (
                  <>
                    <motion.div
                      initial={{ scale: 0, x: -20, y: -20 }}
                      animate={{ scale: 1, x: 0, y: 0 }}
                      className="absolute -top-12 left-0 bg-white/90 border border-sky-100 px-3.5 py-2 rounded-2xl flex items-center gap-2 text-xs font-bold text-slate-700 shadow-md pointer-events-none hover:translate-y-[-2px] transition-transform"
                    >
                      <span className="w-2 h-2 rounded-full bg-sky-400 animate-pulse" />
                      <span>Pip matched schedules! Overlap found at 1PM</span>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>

              <h1 className="text-5xl md:text-7xl font-black tracking-tight text-slate-900 leading-none">
                Your Campus.<br />
                Your People.<br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-sky-400 via-sky-500 to-sky-600 filter drop-shadow-[0_4px_16px_rgba(56,189,248,0.15)]">
                  Your UniNest.
                </span>
              </h1>

              <p className="text-slate-600 text-base md:text-lg font-semibold leading-relaxed max-w-lg">
                Discover matching classmates, sync semester schedules instantly, organize study groups, and experience college life in one living student social ecosystem.
              </p>

              <div className="flex gap-4 mt-2">
                <button
                  onClick={handleDownloadClick}
                  className="px-8 h-14 rounded-full bg-gradient-to-r from-sky-400 to-sky-500 hover:opacity-95 font-bold text-sm tracking-wide text-white shadow-[0_12px_24px_rgba(56,189,248,0.25)] flex items-center gap-2 group transition-all"
                >
                  Download
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </button>
                <button
                  onClick={handleExploreClick}
                  className="px-8 h-14 rounded-full border border-sky-150 hover:border-sky-200 bg-sky-50/50 hover:bg-sky-50 font-bold text-sm tracking-wide text-sky-600 transition-all"
                >
                  Explore Campus
                </button>
              </div>

            </div>

            {/* Custom Polaroid Polaroid Frame with Running Penguins (5 cols) */}
            <div className="lg:col-span-5 flex justify-center">
              <motion.div 
                initial={{ y: 50, opacity: 0 }}
                animate={isCampusRevealed ? { y: 0, opacity: 1 } : {}}
                transition={{ type: 'spring', stiffness: 40, delay: 0.4 }}
                className="w-full max-w-[340px] rounded-[2.5rem] bg-white p-4 shadow-[0_32px_64px_rgba(56,189,248,0.15)] border border-sky-100 flex flex-col gap-4 relative overflow-hidden"
              >
                <div className="w-full aspect-[4/5] rounded-[1.8rem] overflow-hidden relative group border border-sky-50">
                  <img src="/images/running_penguins.jpg" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" alt="UniNest Running Penguins" />
                  <div className="absolute top-4 left-4 bg-white/95 backdrop-blur-sm px-3.5 py-1.5 rounded-full text-[10px] font-black text-sky-500 border border-sky-100 uppercase tracking-widest flex items-center gap-1.5 shadow-sm">
                    <span className="w-1.5 h-1.5 rounded-full bg-sky-500 animate-pulse" />
                    Campus Nest
                  </div>
                </div>
                <div className="px-2 pb-2 text-left">
                  <h3 className="font-extrabold text-slate-800 text-base">Meet Your Classmates</h3>
                  <p className="text-slate-500 text-xs mt-1 font-semibold leading-relaxed">Join thousands of students syncing schedules, sharing vibes, and coordinating events on the campus nest.</p>
                </div>
              </motion.div>
            </div>

          </div>

          {/* RISING VECTOR CAMPUS MAP CONTAINER */}
          <div id="explore-campus-anchor" className="w-full max-w-6xl mx-auto px-6 py-12 md:py-20">
            <div className="text-left max-w-xl mb-12">
              <span className="text-xs text-sky-500 font-black uppercase tracking-[0.2em]">Magical Campus Ecosystem</span>
              <h2 className="text-3xl md:text-5xl font-black text-slate-900 mt-2 leading-tight">
                Watch the campus rise...
              </h2>
              <p className="text-slate-600 text-sm md:text-base font-semibold mt-3">
                Scroll to watch roads trace, hills load, and our penguin students and professors pop up onto their desks, pathways, and study spots.
              </p>
            </div>
            
            <CampusLandscape isRevealed={isCampusRevealed} />
          </div>

          {/* ANIMATED FEATURES SECTIONS */}
          <LandingFeatures />

          {/* CLASSROOM SCENE SECTION */}
          <section id="classroom" className="w-full max-w-6xl mx-auto px-6 py-16 md:py-28 border-t border-sky-100">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-16 items-center mb-12">
              <div className="lg:col-span-5 flex flex-col text-left gap-4">
                <span className="text-xs text-sky-500 font-black uppercase tracking-[0.2em]">Interactive Classrooms</span>
                <h2 className="text-3xl md:text-5xl font-black text-slate-900 leading-tight">
                  Penguin Lectures, Fully Integrated
                </h2>
                <p className="text-slate-600 text-sm md:text-base leading-relaxed font-semibold">
                  Step inside our interactive classrooms. Watch the Penguin Professor coordinate schedules and map syllabus requirements on our custom digital board overlays while students raise wings, take notes, and collaborate.
                </p>
                <div className="flex gap-4 mt-2">
                  <div className="flex items-center gap-2 text-xs text-slate-500 font-bold">
                    <Smartphone className="w-4 h-4 text-sky-500" />
                    <span>Mobile Companion ready</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-500 font-bold">
                    <Shield className="w-4 h-4 text-sky-500" />
                    <span>Secure end-to-end sync</span>
                  </div>
                </div>
              </div>

              <div className="lg:col-span-7">
                <ClassroomScene />
              </div>
            </div>
          </section>

          {/* FOOTER */}
          <footer id="footer" className="w-full border-t border-sky-100 bg-sky-50 py-16 px-6 relative overflow-hidden">
            {/* Background glowing particles/lighting */}
            <div className="absolute w-72 h-72 rounded-full bg-sky-200/20 blur-[120px] bottom-[-50px] left-1/2 -translate-x-1/2" />
            
            <div className="w-full max-w-6xl mx-auto flex flex-col items-center gap-8 relative z-10">
              
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-sky-400 to-sky-500 flex items-center justify-center shadow-md overflow-hidden">
                  <img src="/logo.png?v=3" className="w-7 h-7 object-contain" alt="UniNest Logo" />
                </div>
                <span className="font-extrabold text-xl text-slate-800 font-sans tracking-wide">
                  Uni<span className="text-sky-500">Nest</span>
                </span>
              </div>

              <p className="text-center text-slate-600 text-xs md:text-sm font-semibold max-w-md leading-relaxed">
                “A living magical university world where Penguin Students connect, belong, and experience campus life together under the guidance of Penguin Professors.”
              </p>

              <div className="flex gap-6 text-slate-500 text-xs font-black uppercase tracking-widest mt-2">
                <button onClick={onJoinClick} className="hover:text-sky-500 transition-colors">Join Now</button>
                <a href="#explore-features" className="hover:text-sky-500 transition-colors">Explore Campus</a>
                <button onClick={onJoinClick} className="hover:text-sky-500 transition-colors">Login</button>
              </div>

              <div className="w-full border-t border-sky-100/70 pt-8 mt-4 flex flex-col md:flex-row justify-between items-center gap-4">
                <span className="text-[10px] font-mono text-slate-500">
                  © 2026 UniNest Corp. Built with Pixar-level love & React.
                </span>
                <div className="flex gap-4">
                  <span className="text-[10px] font-mono text-slate-500">Privacy Policy</span>
                  <span className="text-[10px] font-mono text-slate-500">Terms of Service</span>
                </div>
              </div>

            </div>
          </footer>

        </div>

      </div>

    </div>
  );
}
