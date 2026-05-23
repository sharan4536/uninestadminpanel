import React from 'react';
import { motion } from 'framer-motion';
import { Penguin } from './Penguin';

export function ClassroomScene() {
  // Generate 20 floating dust particles in sunbeams
  const dustParticles = Array.from({ length: 20 }, (_, i) => ({
    id: i,
    x: Math.random() * 80 + 10, // percentage x
    y: Math.random() * 80 + 10, // percentage y
    size: Math.random() * 4 + 2, // px size
    duration: Math.random() * 5 + 4, // speed
    delay: Math.random() * 3,
  }));

  return (
    <div className="relative w-full h-[600px] overflow-hidden bg-sky-50/50 rounded-[3rem] border border-sky-100 shadow-xl">
      {/* 1. ROOM ENVIRONMENT BASE (Soft skyblue/white walls) */}
      <div className="absolute inset-0 bg-gradient-to-b from-sky-50 via-white to-sky-50" />

      {/* Wooden floor perspective drawing */}
      <svg className="absolute inset-0 w-full h-full select-none" viewBox="0 0 1000 600">
        <defs>
          <linearGradient id="floorGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f0f9ff" /> {/* Whisper blue floor */}
            <stop offset="100%" stopColor="#e0f2fe" />
          </linearGradient>
          <linearGradient id="windowGlow" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.3" /> {/* Soft Sky Light */}
            <stop offset="60%" stopColor="#e0f2fe" stopOpacity="0.1" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="boardGlow" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="100%" stopColor="#f0f9ff" />
          </linearGradient>
        </defs>

        {/* Floor polygon */}
        <polygon points="0,480 1000,480 1000,600 0,600" fill="url(#floorGrad)" />
        {/* Floor boards panel lines */}
        {[...Array(12)].map((_, i) => (
          <line
            key={`line-${i}`}
            x1={-100 + i * 110}
            y1={600}
            x2={100 + i * 70}
            y2={480}
            stroke="#bae6fd"
            strokeWidth="1.5"
          />
        ))}

        {/* 2. CLASSROOM ARCH WINDOWS (Left Wall) */}
        <g id="windows" fill="#ffffff" stroke="#sky-100" strokeWidth="2">
          {/* Window 1 */}
          <path d="M50 480 V180 C50 100 130 100 130 180 V480 Z" fill="#bae6fd" opacity="0.4" />
          {/* Window 2 */}
          <path d="M190 480 V180 C190 100 270 100 270 180 V480 Z" fill="#bae6fd" opacity="0.4" />
        </g>

        {/* Sunbeams shining from Windows across classroom */}
        <polygon points="50,180 380,480 720,480 130,180" fill="url(#windowGlow)" style={{ mixBlendMode: 'multiply' }} filter="blur(6px)" />
        <polygon points="190,180 520,480 860,480 270,180" fill="url(#windowGlow)" style={{ mixBlendMode: 'multiply' }} filter="blur(6px)" />

        {/* 3. INDOOR PLANTS (Swaying using Framer Motion) */}
        <g id="plants">
          {/* Plant 1 (Left corner) */}
          <motion.g
            animate={{ rotate: [-2, 2, -2] }}
            transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
            style={{ transformOrigin: '30px 480px' }}
          >
            {/* Pot */}
            <rect x="18" y="440" width="24" height="25" rx="3" fill="#cbd5e1" />
            <polygon points="15,440 45,440 42,437 18,437" fill="#94a3b8" />
            {/* Palm/Monstera leaves */}
            <path d="M30 440 Q10 400 -10 420 Q15 390 30 440" fill="#0ea5e9" opacity="0.8" />
            <path d="M30 440 Q30 360 10 350 Q20 370 30 440" fill="#0284c7" opacity="0.9" />
            <path d="M30 440 Q50 380 70 390 Q45 375 30 440" fill="#38bdf8" />
          </motion.g>

          {/* Plant 2 (Between windows) */}
          <motion.g
            animate={{ rotate: [2, -2, 2] }}
            transition={{ duration: 5.5, repeat: Infinity, ease: 'easeInOut' }}
            style={{ transformOrigin: '160px 480px' }}
          >
            <rect x="148" y="440" width="24" height="25" rx="3" fill="#cbd5e1" />
            {/* Fern leaves */}
            <path d="M160 440 Q140 380 120 400" stroke="#0284c7" strokeWidth="4" strokeLinecap="round" fill="none" opacity="0.8" />
            <path d="M160 440 Q160 360 150 340" stroke="#38bdf8" strokeWidth="4" strokeLinecap="round" fill="none" />
            <path d="M160 440 Q180 390 200 410" stroke="#0ea5e9" strokeWidth="4" strokeLinecap="round" fill="none" opacity="0.9" />
          </motion.g>
        </g>

        {/* 4. DIGITAL INTERACTIVE CHALKBOARD / WHITEBOARD (Back Wall) */}
        <g id="classroom-chalkboard">
          <rect x="420" y="100" width="500" height="250" rx="16" fill="url(#boardGlow)" stroke="#bae6fd" strokeWidth="6" className="shadow-sm" />
          <rect x="428" y="108" width="484" height="234" rx="10" stroke="#38bdf8" strokeWidth="1.5" fill="none" opacity="0.4" />
        </g>
      </svg>

      {/* WHITEBOARD SCREEN GLOW & WRITING CONTENT (HTML inside absolute div) */}
      <div className="absolute left-[432px] top-[110px] w-[476px] h-[228px] overflow-hidden rounded-lg p-6 flex flex-col justify-between pointer-events-none select-none font-mono text-left">
        {/* Animated whiteboard text overlay */}
        <div>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 1, 1, 0, 0], y: [0, 0, 0, -5, -5] }}
            transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
            className="text-sky-600 text-sm font-black tracking-wide"
          >
            &gt; Class 101: Student Social Ecosystems
          </motion.p>
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: ['0%', '100%', '100%', '0%', '0%'] }}
            transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
            className="h-[2px] bg-gradient-to-r from-sky-400 to-sky-600 my-2 overflow-hidden"
          />
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0, 1, 0, 0] }}
            transition={{ duration: 8, repeat: Infinity, delay: 2.2 }}
            className="space-y-1.5 mt-2"
          >
            <p className="text-xs text-slate-700 font-bold">Let UniNest = (Connect + SyncedSchedules) * CampusEvents</p>
            <p className="text-xs text-slate-700 font-bold">Finding schedule overlaps... DONE (94% Match rate)</p>
            <p className="text-xs text-sky-500 font-extrabold">Status: Campus World is Online! 🚀</p>
          </motion.div>
        </div>

        {/* Graphic display on chalkboard */}
        <div className="flex justify-between items-end border-t border-sky-100 pt-2">
          <div className="flex gap-2">
            <span className="w-1.5 h-6 bg-sky-400 rounded animate-pulse" />
            <span className="w-1.5 h-8 bg-sky-500 rounded animate-pulse [animation-delay:0.2s]" />
            <span className="w-1.5 h-10 bg-sky-600 rounded animate-pulse [animation-delay:0.4s]" />
          </div>
          <p className="text-[10px] text-sky-400 font-bold uppercase tracking-widest">UniNest digital board v1.2</p>
        </div>
      </div>

      {/* --- CLASSROOM ACTORS (Absolute overlay) --- */}
      
      {/* 1. Professor Penguin (Standing on Right, lecturing) */}
      <div className="absolute right-[12%] bottom-[16%] w-24 h-24 z-10">
        <Penguin type="professor" activity="teach" expression="happy" direction="left" />
      </div>

      {/* 2. Front Row Skyblue Desk */}
      <div className="absolute left-[38%] bottom-[2%] w-[180px] h-[100px] z-20">
        {/* Student 1 (sitting, study laptop) */}
        <div className="absolute left-[15px] top-[-38px] w-20 h-20">
          <Penguin activity="study" expression="studious" clothes="uniform" direction="right" />
        </div>
        {/* Student 2 (sitting, raising wing) */}
        <div className="absolute right-[15px] top-[-38px] w-20 h-20">
          <Penguin activity="excited" expression="excited" clothes="uniform" direction="left" />
        </div>
        {/* Desk SVG overlay */}
        <svg className="w-full h-full drop-shadow-md" viewBox="0 0 180 100">
          {/* Sky blue desk top */}
          <polygon points="10,60 170,60 180,82 0,82" fill="#38bdf8" />
          <polygon points="0,82 180,82 176,87 4,87" fill="#0ea5e9" />
          {/* Desk legs */}
          <line x1="20" y1="82" x2="20" y2="100" stroke="#94a3b8" strokeWidth="4" />
          <line x1="160" y1="82" x2="160" y2="100" stroke="#94a3b8" strokeWidth="4" />
        </svg>
      </div>

      {/* 3. Back Row Skyblue Desk */}
      <div className="absolute left-[58%] bottom-[14%] w-[160px] h-[90px] z-15">
        {/* Student 3 (sitting study) */}
        <div className="absolute left-[20px] top-[-38px] w-18 h-18">
          <Penguin activity="study" expression="normal" clothes="uniform" direction="right" />
        </div>
        {/* Student 4 (talking) */}
        <div className="absolute right-[20px] top-[-38px] w-18 h-18">
          <Penguin activity="talking" expression="happy" clothes="uniform" direction="left" />
        </div>
        {/* Desk SVG overlay */}
        <svg className="w-full h-full drop-shadow-sm" viewBox="0 0 160 90">
          <polygon points="8,54 152,54 160,74 0,74" fill="#0ea5e9" />
          <line x1="18" y1="74" x2="18" y2="90" stroke="#94a3b8" strokeWidth="3" />
          <line x1="142" y1="74" x2="142" y2="90" stroke="#94a3b8" strokeWidth="3" />
        </svg>
      </div>

      {/* 4. FLOATING DUST PARTICLES */}
      <div className="absolute inset-0 pointer-events-none z-30 overflow-hidden">
        {dustParticles.map((dust) => (
          <motion.div
            key={dust.id}
            initial={{ x: `${dust.x}%`, y: `${dust.y}%`, opacity: 0.1 }}
            animate={{
              y: [`${dust.y}%`, `${dust.y - 12}%`, `${dust.y}%`],
              x: [`${dust.x}%`, `${dust.x + 3}%`, `${dust.x}%`],
              opacity: [0.1, 0.7, 0.1],
            }}
            transition={{
              duration: dust.duration,
              delay: dust.delay,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
            className="absolute rounded-full bg-sky-200/50 filter blur-[0.5px]"
            style={{
              width: dust.size,
              height: dust.size,
            }}
          />
        ))}
      </div>

      {/* Classroom overlay elements (sun flare, vignetting) */}
      <div className="absolute inset-0 pointer-events-none bg-gradient-to-tr from-transparent via-transparent to-sky-400/5 mix-blend-overlay" />
      <div className="absolute inset-0 pointer-events-none shadow-[inset_0_0_80px_rgba(56,189,248,0.1)]" />
    </div>
  );
}
