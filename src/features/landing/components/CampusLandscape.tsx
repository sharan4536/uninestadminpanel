import React from 'react';
import { motion } from 'framer-motion';
import { Penguin } from './Penguin';
import { Calendar, UserCheck, Radio, Sparkles } from 'lucide-react';

interface CampusLandscapeProps {
  isRevealed: boolean;
}

export function CampusLandscape({ isRevealed }: CampusLandscapeProps) {
  // SVG spring transitions
  const springTransition = (delay: number) => ({
    type: 'spring' as const,
    stiffness: 80,
    damping: 15,
    delay,
  });

  return (
    <div className="relative w-full h-[650px] md:h-[800px] overflow-hidden bg-gradient-to-b from-slate-950 via-slate-900 to-indigo-950/80 rounded-[3rem] border border-white/5 shadow-2xl">
      {/* Sky Background Parallax Clouds */}
      <div className="absolute inset-0 z-0 pointer-events-none opacity-40">
        <motion.div 
          animate={{ x: [-20, 20, -20] }}
          transition={{ duration: 25, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute top-10 left-10 w-48 h-12 bg-sky-400/10 blur-xl rounded-full"
        />
        <motion.div 
          animate={{ x: [20, -20, 20] }}
          transition={{ duration: 30, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute top-24 right-16 w-64 h-16 bg-blue-500/10 blur-xl rounded-full"
        />
      </div>

      <svg viewBox="0 0 1000 800" className="w-full h-full object-cover select-none">
        {/* SVG Defs for gradients & shadow filters */}
        <defs>
          <linearGradient id="hillBackGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1e293b" />
            <stop offset="100%" stopColor="#0f172a" />
          </linearGradient>
          <linearGradient id="hillFrontGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#006286" />
            <stop offset="40%" stopColor="#0f4c64" />
            <stop offset="100%" stopColor="#082f49" />
          </linearGradient>
          <linearGradient id="buildingGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1e3a8a" />
            <stop offset="50%" stopColor="#0f172a" />
            <stop offset="100%" stopColor="#020617" />
          </linearGradient>
          <linearGradient id="pathGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.3" />
            <stop offset="50%" stopColor="#2db7f2" stopOpacity="0.1" />
            <stop offset="100%" stopColor="#0284c7" stopOpacity="0.3" />
          </linearGradient>
          <filter id="neonGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* 1. BACKGROUND HILL (Rises slightly first) */}
        <motion.path
          d="M0 650 Q250 500 500 580 T1000 620 V800 H0 Z"
          fill="url(#hillBackGrad)"
          initial={{ y: 200, opacity: 0 }}
          animate={isRevealed ? { y: 0, opacity: 1 } : {}}
          transition={springTransition(0.1)}
        />

        {/* BACKGROUND BUILDINGS (Rising from background hill) */}
        <g id="background-buildings">
          {/* Science Center Dome */}
          <motion.path
            d="M220 540 C220 480 300 480 300 540 Z"
            fill="#0f172a"
            stroke="#1e3a8a"
            strokeWidth="1"
            initial={{ y: 120, opacity: 0 }}
            animate={isRevealed ? { y: 0, opacity: 0.95 } : {}}
            transition={springTransition(0.3)}
          />
          {/* Clock Tower */}
          <motion.rect
            x="720"
            y="380"
            width="35"
            height="180"
            rx="2"
            fill="url(#buildingGrad)"
            stroke="#0284c7"
            strokeWidth="1.5"
            initial={{ y: 150, opacity: 0 }}
            animate={isRevealed ? { y: 0, opacity: 0.9 } : {}}
            transition={springTransition(0.25)}
          />
          <motion.polygon
            points="720,380 737.5,340 755,380"
            fill="#fb923c"
            opacity="0.9"
            initial={{ y: 150, opacity: 0 }}
            animate={isRevealed ? { y: 0, opacity: 1 } : {}}
            transition={springTransition(0.35)}
          />
          {/* Glowing Clock face */}
          {isRevealed && (
            <motion.circle
              cx="737.5"
              cy="395"
              r="6"
              fill="#38bdf8"
              filter="url(#neonGlow)"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 1 }}
            />
          )}
        </g>

        {/* 2. FOREGROUND HILL (Magical Grass-Growing scaleY transition) */}
        <motion.path
          d="M0 680 Q250 560 500 620 T1000 660 V800 H0 Z"
          fill="url(#hillFrontGrad)"
          style={{ transformOrigin: '500px 800px' }}
          initial={{ scaleY: 0, opacity: 0 }}
          animate={isRevealed ? { scaleY: 1, opacity: 1 } : {}}
          transition={springTransition(0.15)}
        />

        {/* 3. PATHWAYS (Sketching outline effect using strokeDashoffset) */}
        <g id="pathways">
          {/* Pathway 1 (Left to Center-Right) */}
          <motion.path
            d="M0 720 Q300 680 500 730 T1000 720"
            fill="none"
            stroke="url(#pathGrad)"
            strokeWidth="28"
            strokeLinecap="round"
            initial={{ pathLength: 0 }}
            animate={isRevealed ? { pathLength: 1 } : {}}
            transition={{ duration: 1.5, delay: 0.3, ease: 'easeOut' }}
          />
          {/* Pathway 2 (Cross paths) */}
          <motion.path
            d="M320 690 Q450 780 650 690"
            fill="none"
            stroke="url(#pathGrad)"
            strokeWidth="16"
            strokeLinecap="round"
            initial={{ pathLength: 0 }}
            animate={isRevealed ? { pathLength: 1 } : {}}
            transition={{ duration: 1.2, delay: 0.6, ease: 'easeOut' }}
          />
        </g>

        {/* 4. MAIN CAMPUS BUILDINGS (Rise upward slowly) */}
        <g id="main-buildings">
          {/* UniNest Dorm Library */}
          <motion.path
            d="M420 630 V490 H560 V630 Z"
            fill="url(#buildingGrad)"
            stroke="#2db7f2"
            strokeWidth="2"
            initial={{ y: 200, opacity: 0 }}
            animate={isRevealed ? { y: 0, opacity: 1 } : {}}
            transition={springTransition(0.3)}
          />
          {/* Roof Pediment */}
          <motion.polygon
            points="410,490 490,430 570,490"
            fill="#006286"
            stroke="#2db7f2"
            strokeWidth="1.5"
            initial={{ y: 200, opacity: 0 }}
            animate={isRevealed ? { y: 0, opacity: 1 } : {}}
            transition={springTransition(0.4)}
          />
          {/* Glowing Windows */}
          <g opacity="0.8">
            {[0, 1, 2].map((col) =>
              [0, 1, 2].map((row) => (
                <motion.rect
                  key={`win-${col}-${row}`}
                  x={440 + col * 35}
                  y={510 + row * 30}
                  width="15"
                  height="20"
                  rx="2"
                  fill="#fbbf24" // warm golden lights
                  filter="url(#neonGlow)"
                  initial={{ opacity: 0 }}
                  animate={isRevealed ? { opacity: [0, 1, 0.8, 1] } : {}}
                  transition={{ delay: 0.8 + col * 0.1 + row * 0.1, duration: 0.5 }}
                />
              ))
            )}
          </g>
        </g>

        {/* 5. POPPING TREES (Spring scale animation) */}
        <g id="campus-nature">
          {/* Left Tree 1 */}
          <motion.g
            initial={{ scale: 0 }}
            style={{ transformOrigin: '150px 650px' }}
            animate={isRevealed ? { scale: 1 } : {}}
            transition={springTransition(0.5)}
          >
            <rect x="146" y="610" width="8" height="45" fill="#78350f" rx="2" />
            <circle cx="150" cy="590" r="28" fill="#15803d" />
            <circle cx="136" cy="576" r="20" fill="#166534" />
            <circle cx="164" cy="580" r="18" fill="#22c55e" opacity="0.8" />
          </motion.g>

          {/* Right Tree 2 */}
          <motion.g
            initial={{ scale: 0 }}
            style={{ transformOrigin: '850px 670px' }}
            animate={isRevealed ? { scale: 1 } : {}}
            transition={springTransition(0.6)}
          >
            <rect x="846" y="620" width="8" height="60" fill="#78350f" rx="2" />
            <path d="M850 560 L815 625 H885 Z" fill="#166534" />
            <path d="M850 535 L825 590 H875 Z" fill="#15803d" />
            <path d="M850 515 L835 560 H865 Z" fill="#22c55e" />
          </motion.g>
        </g>

        {/* 6. CAMPUS BENCHES */}
        <g id="benches">
          <motion.g
            initial={{ scale: 0 }}
            style={{ transformOrigin: '320px 710px' }}
            animate={isRevealed ? { scale: 1 } : {}}
            transition={springTransition(0.5)}
          >
            {/* Green benches */}
            <rect x="300" y="700" width="40" height="6" fill="#16a34a" rx="1.5" />
            <line x1="305" y1="706" x2="305" y2="716" stroke="#475569" strokeWidth="2.5" />
            <line x1="335" y1="706" x2="335" y2="716" stroke="#475569" strokeWidth="2.5" />
            <rect x="300" y="690" width="4" height="12" fill="#15803d" />
            <rect x="336" y="690" width="4" height="12" fill="#15803d" />
          </motion.g>
        </g>
      </svg>

      {/* --- EMBEDDED PENGUIN ACTORS ---
          Fitted absolute over the relative container at specific layout grids */}
      {isRevealed && (
        <div className="absolute inset-0 z-10 pointer-events-none">
          
          {/* Skateboarding Penguin zooming left to right on bottom path */}
          <motion.div
            initial={{ x: '-20%', y: '82%' }}
            animate={{ x: '110%' }}
            transition={{ duration: 14, repeat: Infinity, ease: 'linear', delay: 1 }}
            className="absolute w-20 h-20"
          >
            <Penguin activity="skateboard" clothes="hoodie" direction="right" />
          </motion.div>

          {/* Bicycle Penguin going right to left */}
          <motion.div
            initial={{ x: '110%', y: '78%' }}
            animate={{ x: '-20%' }}
            transition={{ duration: 16, repeat: Infinity, ease: 'linear', delay: 4 }}
            className="absolute w-18 h-18"
          >
            <Penguin activity="bicycle" clothes="scarf" direction="left" />
          </motion.div>

          {/* Studying Penguin under Left Tree */}
          <div className="absolute left-[11%] top-[68%] w-18 h-18">
            <Penguin activity="study" expression="studious" clothes="none" direction="right" />
          </div>

          {/* Professor Penguin lecturing on the walkway next to library */}
          <div className="absolute left-[39%] top-[57%] w-16 h-16">
            <Penguin type="professor" activity="teach" expression="happy" direction="right" />
          </div>

          {/* Two Penguin friends talking near the library */}
          <div className="absolute left-[54%] top-[72%] w-16 h-16 flex gap-1">
            <Penguin activity="talking" expression="happy" clothes="hoodie" direction="right" />
            <Penguin activity="idle" expression="excited" clothes="uniform" direction="left" />
          </div>

          {/* A Penguin sitting on the green bench */}
          <div className="absolute left-[29.8%] top-[80.5%] w-14 h-14">
            <Penguin activity="idle" expression="happy" clothes="none" direction="right" />
          </div>
        </div>
      )}

      {/* --- FLOATING UI CARDS ---
          Frosted glassmorphism elements that hover around the campus sky to emphasize features */}
      <div className="absolute inset-0 z-20 pointer-events-none flex flex-col justify-between p-6">
        
        {/* Top Floating Row */}
        <div className="flex justify-between items-start w-full">
          {/* Card 1: Timetable Synced */}
          {isRevealed && (
            <motion.div
              initial={{ x: -100, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.8, type: 'spring' }}
              className="glass-card flex items-center gap-3 px-4 py-3 rounded-2xl border border-white/10 bg-slate-900/60 backdrop-blur-md shadow-lg pointer-events-auto hover:translate-y-[-4px] transition-transform duration-300"
            >
              <div className="w-9 h-9 rounded-xl bg-cyan-500/20 flex items-center justify-center text-cyan-400">
                <Calendar className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Timetable Sync</p>
                <p className="text-xs font-extrabold text-white">4 Class Overlaps Found!</p>
              </div>
            </motion.div>
          )}

          {/* Card 2: AI Compatibility match */}
          {isRevealed && (
            <motion.div
              initial={{ x: 100, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 1.0, type: 'spring' }}
              className="glass-card flex items-center gap-3 px-4 py-3 rounded-2xl border border-white/10 bg-slate-900/60 backdrop-blur-md shadow-lg pointer-events-auto hover:translate-y-[-4px] transition-transform duration-300"
            >
              <div className="w-9 h-9 rounded-xl bg-emerald-500/20 flex items-center justify-center text-emerald-400">
                <UserCheck className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">AI Friend Match</p>
                <p className="text-xs font-extrabold text-white">96% Compatibility Match</p>
              </div>
            </motion.div>
          )}
        </div>

        {/* Bottom Floating Row */}
        <div className="flex justify-between items-end w-full">
          {/* Card 4: Social Pulse moments */}
          {isRevealed && (
            <motion.div
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 1.4, type: 'spring' }}
              className="glass-card flex items-center gap-3 px-4 py-3 rounded-2xl border border-white/10 bg-slate-900/60 backdrop-blur-md shadow-lg pointer-events-auto hover:translate-y-[-4px] transition-transform duration-300"
            >
              <div className="w-9 h-9 rounded-xl bg-amber-500/20 flex items-center justify-center text-amber-400">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Pulse Story</p>
                <p className="text-xs font-extrabold text-white">"Skateboard run at the Quad!"</p>
              </div>
            </motion.div>
          )}
        </div>

      </div>

    </div>
  );
}
