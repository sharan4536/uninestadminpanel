import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Penguin } from './Penguin';
import { Sparkles, Calendar, Clock, MapPin, Radio, Heart, ThumbsUp, Flame, Smile, Plus, UserPlus, Users, Search } from 'lucide-react';

// --- FEATURE 1: AI FRIEND MATCHING ---
function FriendMatchingDemo() {
  const [percent, setPercent] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setPercent((prev) => {
        if (prev >= 98) {
          setTimeout(() => setPercent(0), 4000); // Reset after 4s
          return 98;
        }
        return prev + 2;
      });
    }, 40);
    return () => clearInterval(interval);
  }, [percent]);

  return (
    <div className="relative w-full h-[350px] bg-sky-50/40 rounded-3xl border border-sky-100 flex items-center justify-center p-6 overflow-hidden shadow-sm">
      {/* Background glow grid */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#e0f2fe_1px,transparent_1px),linear-gradient(to_bottom,#e0f2fe_1px,transparent_1px)] bg-[size:24px_24px] opacity-40" />
      <div className="absolute w-48 h-48 rounded-full bg-sky-200/20 blur-[80px] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />

      <div className="relative flex flex-col md:flex-row items-center justify-between w-full max-w-md gap-8 z-10">
        {/* Card 1: Pippin */}
        <motion.div 
          initial={{ x: -50, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ type: 'spring' }}
          className="w-40 bg-white border border-sky-100/80 p-4 rounded-2xl flex flex-col items-center text-center shadow-md"
        >
          <div className="w-16 h-16 mb-2">
            <Penguin activity="skateboard" clothes="hoodie" direction="right" />
          </div>
          <h4 className="text-sm font-bold text-slate-800">Pip the Skater</h4>
          <p className="text-[10px] text-sky-500 font-bold mt-0.5">CSE, Soph</p>
          <div className="flex gap-1 mt-2">
            <span className="text-[8px] bg-sky-50 text-sky-600 px-1.5 py-0.5 rounded font-bold font-mono">Skate</span>
            <span className="text-[8px] bg-sky-50 text-sky-600 px-1.5 py-0.5 rounded font-bold font-mono">Coffee</span>
          </div>
        </motion.div>

        {/* Center Compatibility Circle */}
        <div className="flex flex-col items-center relative">
          <svg className="w-20 h-20 -rotate-90">
            <circle cx="40" cy="40" r="34" stroke="#f0f9ff" strokeWidth="4" fill="none" />
            <motion.circle 
              cx="40" 
              cy="40" 
              r="34" 
              stroke="#38bdf8" 
              strokeWidth="4" 
              fill="none" 
              strokeDasharray="213"
              strokeDashoffset={213 - (213 * percent) / 100}
              transition={{ ease: 'linear' }}
            />
          </svg>
          <div className="absolute top-[22px] text-center">
            <span className="text-lg font-black text-slate-800 font-mono">{percent}%</span>
            <p className="text-[8px] text-sky-500 font-black uppercase tracking-wider">Match</p>
          </div>
          {/* Compatibility link line */}
          <div className="absolute w-[180px] h-[2px] bg-gradient-to-r from-transparent via-sky-300 to-transparent top-10 -z-10 pointer-events-none" />
        </div>

        {/* Card 2: Penny */}
        <motion.div 
          initial={{ x: 50, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ type: 'spring' }}
          className="w-40 bg-white border border-sky-100/80 p-4 rounded-2xl flex flex-col items-center text-center shadow-md"
        >
          <div className="w-16 h-16 mb-2">
            <Penguin activity="study" expression="studious" clothes="scarf" direction="left" />
          </div>
          <h4 className="text-sm font-bold text-slate-800">Penny coding</h4>
          <p className="text-[10px] text-sky-500 font-bold mt-0.5">CSE, Soph</p>
          <div className="flex gap-1 mt-2">
            <span className="text-[8px] bg-sky-50 text-sky-600 px-1.5 py-0.5 rounded font-bold font-mono">Code</span>
            <span className="text-[8px] bg-sky-50 text-sky-600 px-1.5 py-0.5 rounded font-bold font-mono">Skate</span>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

// --- FEATURE 2: TIMETABLE SYNC ---
function TimetableSyncDemo() {
  const [isSynced, setIsSynced] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => {
      setIsSynced((prev) => !prev);
    }, 3000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="relative w-full h-[350px] bg-sky-50/40 rounded-3xl border border-sky-100 flex items-center justify-center p-6 overflow-hidden shadow-sm">
      <div className="absolute inset-0 bg-[radial-gradient(#e0f2fe_1.5px,transparent_1.5px)] bg-[size:16px_16px] opacity-50" />
      <div className="absolute w-48 h-48 rounded-full bg-sky-200/10 blur-[80px] bottom-10 right-10" />

      <div className="relative flex flex-col items-center w-full max-w-sm z-10">
        <div className="flex justify-between w-full gap-4 relative">
          
          {/* Timetable A */}
          <motion.div
            animate={isSynced ? { x: 20, y: 10 } : { x: 0, y: 0 }}
            transition={{ type: 'spring', stiffness: 50 }}
            className="w-[45%] bg-white border border-sky-100 p-3 rounded-2xl shadow-md flex flex-col gap-2"
          >
            <div className="flex items-center gap-1.5 border-b border-sky-50 pb-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-sky-500" />
              <span className="text-[9px] font-extrabold text-slate-700 uppercase tracking-wider">My Schedule</span>
            </div>
            <div className="space-y-1.5">
              <div className="bg-sky-50/40 p-1.5 rounded-lg border border-sky-100/50 text-[9px]">
                <p className="font-bold text-slate-700">9:00 AM - CSE 202</p>
              </div>
              <div className="bg-sky-50/40 p-1.5 rounded-lg border border-sky-100/50 text-[9px] relative overflow-hidden">
                <p className="font-bold text-slate-700">12:00 PM - Math</p>
                <div className="absolute inset-0 bg-sky-400/10 border border-sky-300/40 rounded-lg" />
              </div>
            </div>
          </motion.div>

          {/* Connect indicator icon */}
          <div className="absolute left-[50%] top-[40%] -translate-x-1/2 -translate-y-1/2 z-20">
            <motion.div 
              animate={{ rotate: isSynced ? 360 : 0 }}
              className={`w-10 h-10 rounded-full flex items-center justify-center border ${
                isSynced ? 'bg-sky-500 border-sky-400 text-white shadow-[0_0_15px_rgba(56,189,248,0.4)]' : 'bg-white border-sky-100 text-sky-500 shadow-sm'
              }`}
            >
              <Calendar className="w-4 h-4" />
            </motion.div>
          </div>

          {/* Timetable B */}
          <motion.div
            animate={isSynced ? { x: -20, y: -10 } : { x: 0, y: 0 }}
            transition={{ type: 'spring', stiffness: 50 }}
            className="w-[45%] bg-white border border-sky-100 p-3 rounded-2xl shadow-md flex flex-col gap-2"
          >
            <div className="flex items-center gap-1.5 border-b border-sky-50 pb-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              <span className="text-[9px] font-extrabold text-slate-700 uppercase tracking-wider">Pip's Schedule</span>
            </div>
            <div className="space-y-1.5">
              <div className="bg-sky-50/40 p-1.5 rounded-lg border border-sky-100/50 text-[9px] relative overflow-hidden">
                <p className="font-bold text-slate-700">12:00 PM - Math</p>
                <div className="absolute inset-0 bg-sky-400/10 border border-sky-300/40 rounded-lg" />
              </div>
              <div className="bg-sky-50/40 p-1.5 rounded-lg border border-sky-100/50 text-[9px]">
                <p className="font-bold text-slate-700">2:00 PM - Lab</p>
              </div>
            </div>
          </motion.div>

        </div>

        {/* Reveal Overlay result */}
        <AnimatePresence>
          {isSynced && (
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 10, opacity: 0 }}
              className="mt-6 bg-white border border-sky-150 shadow-[0_8px_20px_rgba(56,189,248,0.08)] px-4 py-2.5 rounded-2xl flex items-center gap-2.5"
            >
              <Clock className="w-4 h-4 text-sky-500" />
              <span className="text-[11px] font-bold text-slate-700">
                Overlap Match: Free at <span className="text-sky-500 font-extrabold">12:00 PM - 2:00 PM</span>
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}



// --- FEATURE 4: PULSE STORIES ---
function PulseStoriesDemo() {
  const [activeReaction, setActiveReaction] = useState<string | null>(null);

  const triggerReaction = (type: string) => {
    setActiveReaction(type);
    setTimeout(() => setActiveReaction(null), 1000);
  };

  const reactionEmojis = [
    { type: 'heart', icon: <Heart className="w-3.5 h-3.5 text-rose-500 fill-rose-500" /> },
    { type: 'like', icon: <ThumbsUp className="w-3.5 h-3.5 text-sky-500 fill-sky-500" /> },
    { type: 'fire', icon: <Flame className="w-3.5 h-3.5 text-orange-500 fill-orange-500" /> },
    { type: 'smile', icon: <Smile className="w-3.5 h-3.5 text-amber-500 fill-amber-500" /> }
  ];

  return (
    <div className="relative w-full h-[350px] bg-sky-50/40 rounded-3xl border border-sky-100 flex flex-col justify-between p-6 overflow-hidden shadow-sm">
      <div className="absolute inset-0 bg-[radial-gradient(#e0f2fe_1.5px,transparent_1.5px)] bg-[size:24px_24px] opacity-40" />
      
      {/* Floating Story Card */}
      <div className="flex-1 flex items-center justify-center relative">
        <motion.div 
          whileHover={{ scale: 1.02 }}
          className="w-48 aspect-[3/4] rounded-2xl border border-sky-100 bg-white shadow-md relative overflow-hidden flex flex-col justify-end p-3"
        >
          {/* Story Background Vector visual */}
          <div className="absolute inset-0 bg-gradient-to-t from-white via-white/40 to-transparent z-0" />
          {/* Micro scene of skating penguin */}
          <div className="absolute inset-0 flex items-center justify-center opacity-85 z-0 pb-6">
            <div className="w-20 h-20">
              <Penguin activity="skateboard" clothes="hoodie" direction="right" />
            </div>
          </div>

          <div className="relative z-10 text-left">
            <div className="flex items-center gap-2 mb-1.5">
              <div className="w-6 h-6 rounded-full border border-sky-300 p-0.5">
                <div className="w-full h-full bg-sky-50 rounded-full overflow-hidden">
                  <Penguin activity="idle" />
                </div>
              </div>
              <span className="text-[10px] font-black text-slate-800">Pip the Skater</span>
            </div>
            <p className="text-[9.5px] text-slate-600 font-bold">"Skateboard Quad run today was crazy!"</p>
          </div>

          {/* Floating animated reactions inside the story */}
          <AnimatePresence>
            {activeReaction && (
              <motion.div
                initial={{ y: 20, opacity: 0, scale: 0.5 }}
                animate={{ y: -60, opacity: [0, 1, 1, 0], scale: [0.5, 1.2, 1.2, 0.8] }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.9, ease: 'easeOut' }}
                className="absolute left-1/2 -translate-x-1/2 top-[40%] bg-white border border-sky-100 p-2 rounded-full shadow-lg"
              >
                {reactionEmojis.find(r => r.type === activeReaction)?.icon}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>

      {/* Social Reaction bar */}
      <div className="bg-white border border-sky-100 py-2 px-4 rounded-2xl flex items-center justify-between shadow-sm">
        <span className="text-[9.5px] font-black text-slate-500 uppercase tracking-widest">SEND REACTION</span>
        <div className="flex gap-2">
          {reactionEmojis.map((emoji) => (
            <button
              key={emoji.type}
              onClick={() => triggerReaction(emoji.type)}
              className="w-8 h-8 rounded-xl bg-sky-50 hover:bg-sky-100 flex items-center justify-center transition-colors hover:scale-110 active:scale-95"
            >
              {emoji.icon}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// --- FEATURE 5: HANGOUT PLANNER ---
function HangoutPlannerDemo() {
  const [plannerStep, setPlannerStep] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setPlannerStep((prev) => (prev + 1) % 3);
    }, 3500);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="relative w-full h-[350px] bg-sky-50/40 rounded-3xl border border-sky-100 flex items-center justify-center p-6 overflow-hidden shadow-sm">
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#e0f2fe_1px,transparent_1px),linear-gradient(to_bottom,#e0f2fe_1px,transparent_1px)] bg-[size:20px_20px] opacity-30" />

      <div className="relative w-full max-w-sm bg-white border border-sky-100 p-4 rounded-3xl shadow-md flex flex-col gap-3 z-10">
        <div className="flex items-center justify-between border-b border-sky-50 pb-2">
          <div className="flex items-center gap-2">
            <Users className="w-4.5 h-4.5 text-sky-500" />
            <h4 className="text-xs font-extrabold text-slate-800">Study Group planner</h4>
          </div>
          <span className="text-[8px] bg-sky-50 text-sky-600 font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">3 Students</span>
        </div>

        {/* Schedule grid comparison */}
        <div className="space-y-2">
          {/* Student 1 */}
          <div className="flex items-center justify-between text-[9px] gap-2">
            <span className="text-slate-500 font-bold w-12 truncate text-left">Penny</span>
            <div className="flex-1 h-5 bg-sky-50/50 rounded relative overflow-hidden flex border border-sky-100/30">
              <div className="w-[30%] bg-rose-500/10 border-r border-rose-500/20 h-full" />
              <div className="w-[40%] bg-transparent h-full" />
              <div className="w-[30%] bg-rose-500/10 border-l border-rose-500/20 h-full" />
            </div>
          </div>
          {/* Student 2 */}
          <div className="flex items-center justify-between text-[9px] gap-2">
            <span className="text-slate-500 font-bold w-12 truncate text-left">Pippin</span>
            <div className="flex-1 h-5 bg-sky-50/50 rounded relative overflow-hidden flex border border-sky-100/30">
              <div className="w-[20%] bg-rose-500/10 border-r border-rose-500/20 h-full" />
              <div className="w-[50%] bg-transparent h-full" />
              <div className="w-[30%] bg-rose-500/10 border-l border-rose-500/20 h-full" />
            </div>
          </div>
          {/* Student 3 */}
          <div className="flex items-center justify-between text-[9px] gap-2">
            <span className="text-slate-500 font-bold w-12 truncate text-left">Percy</span>
            <div className="flex-1 h-5 bg-sky-50/50 rounded relative overflow-hidden flex border border-sky-100/30">
              <div className="w-[45%] bg-rose-500/10 border-r border-rose-500/20 h-full" />
              <div className="w-[30%] bg-transparent h-full" />
              <div className="w-[25%] bg-rose-500/10 border-l border-rose-500/20 h-full" />
            </div>
          </div>
        </div>

        {/* Overlay Common Area grid selector */}
        <div className="relative mt-2">
          <div className="h-6 bg-sky-50/50 rounded border border-sky-100 flex items-center justify-between px-3 text-[9px]">
            <span className="text-slate-500 uppercase tracking-widest font-mono">Overlap Slots</span>
            <motion.span 
              animate={{ opacity: plannerStep === 2 ? 1 : 0.4 }}
              className="text-sky-600 font-bold"
            >
              3:00 PM - 5:00 PM today
            </motion.span>
          </div>
          
          {/* Selection indicator box highlight */}
          {plannerStep === 2 && (
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="absolute inset-0 bg-sky-100/80 border-2 border-sky-400 rounded-lg shadow-[0_0_15px_rgba(56,189,248,0.2)] flex items-center justify-center"
            >
              <span className="text-[9px] font-black text-sky-600 tracking-wider uppercase">COMMON TIME MATCHED!</span>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}

// --- FEATURE 6: CAMPUS MAP ---
function CampusMapDemo() {
  const [activePin, setActivePin] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setActivePin((prev) => (prev + 1) % 3);
    }, 3000);
    return () => clearInterval(timer);
  }, []);

  const pins = [
    { id: 0, name: 'Main Quad', x: '45%', y: '35%', count: 18, details: '12 sophomores near quad' },
    { id: 1, name: 'Library Hall', x: '20%', y: '60%', count: 24, details: 'Study group: Math II active' },
    { id: 2, name: 'Science Lab', x: '75%', y: '50%', count: 8, details: 'Lab session ends in 10m' }
  ];

  return (
    <div className="relative w-full h-[350px] bg-sky-50/40 rounded-3xl border border-sky-100 flex items-center justify-center p-6 overflow-hidden shadow-sm">
      {/* 3D Map vector layout wireframes */}
      <svg className="absolute inset-0 w-full h-full opacity-35 pointer-events-none" viewBox="0 0 400 300">
        <path d="M 50 150 L 200 50 L 350 150 L 200 250 Z" fill="none" stroke="#7dd3fc" strokeWidth="1.5" />
        <path d="M 100 120 L 200 180 L 300 120" fill="none" stroke="#38bdf8" strokeWidth="1" />
        <path d="M 200 50 L 200 250" fill="none" stroke="#38bdf8" strokeWidth="1" />
      </svg>

      <div className="relative w-full h-full">
        {/* Glowing node pins */}
        {pins.map((pin) => {
          const isActive = activePin === pin.id;
          return (
            <div
              key={pin.id}
              style={{ left: pin.x, top: pin.y }}
              className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center pointer-events-auto"
            >
              <div className="relative">
                {isActive && (
                  <span className="absolute -inset-3 bg-sky-400/30 rounded-full animate-ping" />
                )}
                <button
                  onClick={() => setActivePin(pin.id)}
                  className={`w-8 h-8 rounded-full border flex items-center justify-center shadow-md transition-all duration-300 ${
                    isActive ? 'bg-sky-500 border-sky-400 text-white' : 'bg-white border-sky-100 text-slate-400'
                  }`}
                >
                  <MapPin className="w-4 h-4" />
                </button>
              </div>
              <span className="text-[8.5px] font-black text-slate-700 mt-1 whitespace-nowrap bg-white/95 px-1.5 py-0.5 rounded border border-sky-100 shadow-sm">
                {pin.name} ({pin.count})
              </span>
            </div>
          );
        })}

        {/* Floating marker detail display panel */}
        <div className="absolute bottom-2 left-2 right-2 bg-white border border-sky-100 px-4 py-3 rounded-2xl flex items-center justify-between shadow-lg">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-sky-50 flex items-center justify-center text-sky-500 border border-sky-100/50">
              <Search className="w-4 h-4" />
            </div>
            <div className="text-left">
              <h5 className="text-[10px] font-extrabold text-slate-800 uppercase tracking-wider">
                {pins[activePin].name}
              </h5>
              <p className="text-xs text-slate-500 font-semibold">{pins[activePin].details}</p>
            </div>
          </div>
          <span className="text-[10px] bg-sky-50 text-sky-600 font-extrabold px-2.5 py-1 rounded-lg border border-sky-100/50">
            Active Node
          </span>
        </div>
      </div>
    </div>
  );
}

// --- CONTAINER EXPORT ---
interface FeatureCardProps {
  badge: string;
  title: string;
  description: string;
  demoComponent: React.ReactNode;
  index: number;
}

function FeatureCard({ badge, title, description, demoComponent, index }: FeatureCardProps) {
  const isEven = index % 2 === 0;

  return (
    <div className={`flex flex-col ${isEven ? 'lg:flex-row' : 'lg:flex-row-reverse'} items-center gap-12 py-16 border-b border-sky-100/50`}>
      {/* Title / Description info block */}
      <motion.div 
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-100px' }}
        transition={{ duration: 0.8 }}
        className="w-full lg:w-1/2 flex flex-col gap-4 text-left"
      >
        <span className="text-xs text-sky-500 font-black uppercase tracking-[0.2em]">{badge}</span>
        <h3 className="text-3xl md:text-4xl font-extrabold text-slate-800 tracking-tight leading-tight">
          {title}
        </h3>
        <p className="text-slate-600 text-sm md:text-base leading-relaxed font-semibold">
          {description}
        </p>
      </motion.div>

      {/* Animated interactive Demo block */}
      <motion.div 
        initial={{ opacity: 0, y: 40 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-100px' }}
        transition={{ duration: 0.8, delay: 0.15 }}
        className="w-full lg:w-1/2"
      >
        {demoComponent}
      </motion.div>
    </div>
  );
}

export function LandingFeatures() {
  const featuresList = [
    {
      badge: 'FEATURE 01 — FRIEND MATCHING',
      title: 'AI-Powered Campus Matchmaker',
      description: 'Discover your crowd automatically. UniNest profiles evaluate schedule alignments, major, mutual clubs, and campus hangout frequencies to find friends with whom you organically share campus steps.',
      demoComponent: <FriendMatchingDemo />
    },
    {
      badge: 'FEATURE 02 — CALENDAR ALIGNMENT',
      title: 'Smart Timetable Sync',
      description: 'Never guess when friends are free. Upload your university timetable in one click. Our sync algorithm analyzes mutual free gaps to automatically find and display periods where your circles can grab lunch or study.',
      demoComponent: <TimetableSyncDemo />
    },
    {
      badge: 'FEATURE 03 — REALTIME UPDATES',
      title: 'Campus Pulse Stories',
      description: 'See college life unfold in real-time. Share floating story bubbles and micro-moments. Express reactions, coordinate pop-up hangs, and always know which spot on the quad is currently buzzing.',
      demoComponent: <PulseStoriesDemo />
    },
    {
      badge: 'FEATURE 04 — SOCIAL SYNCING',
      title: 'Common Hangout Planner',
      description: 'Plan meetings in seconds. Choose friends, and UniNest maps calendar conflicts to find perfect lunch gaps, group project availability slots, and coordinates location check-ins smoothly.',
      demoComponent: <HangoutPlannerDemo />
    },
    {
      badge: 'FEATURE 05 — INTERACTIVE RADAR',
      title: 'Live Campus Heatmap',
      description: 'An interactive virtual representation of your university. Watch anonymous crowd pulses density indicate when the student center, athletic quad, or library are crowded, helping you coordinate your day.',
      demoComponent: <CampusMapDemo />
    }
  ];

  return (
    <section id="explore-features" className="w-full max-w-6xl mx-auto px-6 py-12 md:py-24">
      <div className="text-center space-y-4 mb-16">
        <h2 className="text-4xl md:text-5xl font-black text-slate-800 tracking-tight">
          Campus Life, <span className="text-transparent bg-clip-text bg-gradient-to-r from-sky-400 to-sky-500">Fully Synced.</span>
        </h2>
        <p className="text-slate-600 max-w-xl mx-auto text-sm md:text-base font-semibold">
          Explore the features engineered to turn chaotic semesters into a connected, magical student social ecosystem.
        </p>
      </div>

      <div className="flex flex-col">
        {featuresList.map((feature, idx) => (
          <FeatureCard
            key={feature.badge}
            index={idx}
            badge={feature.badge}
            title={feature.title}
            description={feature.description}
            demoComponent={feature.demoComponent}
          />
        ))}
      </div>
    </section>
  );
}
