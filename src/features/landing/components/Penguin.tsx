import React from 'react';
import { motion } from 'framer-motion';

export type PenguinType = 'student' | 'professor';
export type PenguinClothes = 'hoodie' | 'scarf' | 'uniform' | 'none';
export type PenguinActivity = 
  | 'idle' 
  | 'walking' 
  | 'skateboard' 
  | 'bicycle' 
  | 'study' 
  | 'teach' 
  | 'talking' 
  | 'excited' 
  | 'throw_cap';
export type PenguinExpression = 'happy' | 'excited' | 'studious' | 'surprised' | 'normal';

interface PenguinProps {
  type?: PenguinType;
  clothes?: PenguinClothes;
  activity?: PenguinActivity;
  expression?: PenguinExpression;
  direction?: 'left' | 'right';
  className?: string;
  capColor?: string;
}

export function Penguin({
  type = 'student',
  clothes = 'none',
  activity = 'idle',
  expression = 'normal',
  direction = 'right',
  className = '',
  capColor = '#1e1b4b', // Deep indigo
}: PenguinProps) {

  // Animate body bobbing & wing waving based on activity
  const bodyBob = {
    idle: {
      y: [0, -2, 0],
      transition: { duration: 2, repeat: Infinity, ease: "easeInOut" as const }
    },
    walking: {
      y: [0, -6, 0],
      rotate: [-1.5, 1.5, -1.5],
      transition: { duration: 0.6, repeat: Infinity, ease: "easeInOut" as const }
    },
    skateboard: {
      y: [0, -1, 0],
      rotate: [-1, 2, -1],
      transition: { duration: 1.2, repeat: Infinity, ease: "easeInOut" as const }
    },
    bicycle: {
      y: [0, -3, 0],
      rotate: [-1, 1, -1],
      transition: { duration: 0.5, repeat: Infinity, ease: "easeInOut" as const }
    },
    study: {
      y: [0, -1, 0],
      transition: { duration: 3, repeat: Infinity, ease: "easeInOut" as const }
    },
    teach: {
      y: [0, -3, 0],
      rotate: [-0.5, 0.5, -0.5],
      transition: { duration: 1.8, repeat: Infinity, ease: "easeInOut" as const }
    },
    talking: {
      y: [0, -3, 0],
      transition: { duration: 1.5, repeat: Infinity, ease: "easeInOut" as const }
    },
    excited: {
      y: [0, -14, 0],
      scaleY: [1, 0.9, 1.1, 1],
      transition: { duration: 0.8, repeat: Infinity, ease: "easeInOut" as const }
    },
    throw_cap: {
      y: [0, -8, 0],
      transition: { duration: 0.8, ease: "easeOut" as const }
    }
  };

  // Wing movement
  const leftWingAnim = {
    idle: { rotate: [0, 8, 0], transition: { duration: 2, repeat: Infinity } },
    walking: { rotate: [-10, 15, -10], transition: { duration: 0.6, repeat: Infinity } },
    skateboard: { rotate: 25, transition: { duration: 0.5 } },
    bicycle: { rotate: 15, transition: { duration: 0.5 } },
    study: { rotate: -15, y: 2, transition: { duration: 0.5 } }, // Resting on desk/laptop
    teach: { rotate: [0, 35, 0], transition: { duration: 1.8, repeat: Infinity } },
    talking: { rotate: [0, 20, 0], transition: { duration: 0.8, repeat: Infinity } },
    excited: { rotate: [-50, -20, -50], transition: { duration: 0.4, repeat: Infinity } },
    throw_cap: { rotate: [-80, -20], transition: { duration: 0.5 } },
  };

  const rightWingAnim = {
    idle: { rotate: [0, -8, 0], transition: { duration: 2, repeat: Infinity } },
    walking: { rotate: [10, -15, 10], transition: { duration: 0.6, repeat: Infinity } },
    skateboard: { rotate: -25, transition: { duration: 0.5 } },
    bicycle: { rotate: -15, transition: { duration: 0.5 } },
    study: { rotate: 15, y: 2, transition: { duration: 0.5 } },
    teach: { rotate: [60, 45, 60], transition: { duration: 1.2, repeat: Infinity } }, // Pointing at board with chalk
    talking: { rotate: [0, -20, 0], transition: { duration: 0.8, repeat: Infinity } },
    excited: { rotate: [50, 20, 50], transition: { duration: 0.4, repeat: Infinity } },
    throw_cap: { rotate: [60, 80], transition: { duration: 0.5 } }
  };

  // Feet movement
  const leftFootAnim = {
    idle: { rotate: 0 },
    walking: { rotate: [-20, 20, -20], transition: { duration: 0.6, repeat: Infinity } },
    skateboard: { rotate: 5 },
    bicycle: { rotate: [0, 360, 0], transition: { duration: 0.5, repeat: Infinity } },
    study: { rotate: 0 },
    teach: { rotate: 0 },
    talking: { rotate: 0 },
    excited: { y: [0, 2, 0], transition: { duration: 0.4, repeat: Infinity } },
    throw_cap: { rotate: 10 }
  };

  const rightFootAnim = {
    idle: { rotate: 0 },
    walking: { rotate: [20, -20, 20], transition: { duration: 0.6, repeat: Infinity } },
    skateboard: { rotate: -5 },
    bicycle: { rotate: [180, 540, 180], transition: { duration: 0.5, repeat: Infinity } },
    study: { rotate: 0 },
    teach: { rotate: 0 },
    talking: { rotate: 0 },
    excited: { y: [0, 2, 0], transition: { duration: 0.4, repeat: Infinity } },
    throw_cap: { rotate: -10 }
  };

  const currentBody = bodyBob[activity] || bodyBob.idle;
  const currentLeftWing = leftWingAnim[activity] || leftWingAnim.idle;
  const currentRightWing = rightWingAnim[activity] || rightWingAnim.idle;
  const currentLeftFoot = leftFootAnim[activity] || leftFootAnim.idle;
  const currentRightFoot = rightFootAnim[activity] || rightFootAnim.idle;

  return (
    <div className={`relative flex flex-col items-center select-none ${className}`}>
      {/* Outer wrapper to handle left/right direction mirroring */}
      <motion.div 
        style={{ transform: direction === 'left' ? 'scaleX(-1)' : 'scaleX(1)' }}
        className="w-full h-full relative"
      >
        <svg viewBox="0 0 100 100" className="w-full h-full filter drop-shadow-[0_8px_16px_rgba(0,0,0,0.12)]">
          {/* Ambient Ground Shadow */}
          <motion.ellipse 
            cx="50" 
            cy="94" 
            rx={activity === 'excited' ? "22" : "32"} 
            ry="4" 
            fill="rgba(0,18,34,0.15)"
            animate={activity === 'excited' ? { scale: [1, 0.7, 1.2, 1] } : {}}
            transition={{ duration: 0.8, repeat: Infinity }}
          />

          {/* Skateboarding visual additions */}
          {activity === 'skateboard' && (
            <g className="skateboard-layer">
              {/* Board shadow */}
              <ellipse cx="50" cy="94" rx="35" ry="3" fill="rgba(0,0,0,0.2)" />
              {/* Deck */}
              <rect x="12" y="89" width="76" height="5" rx="2" fill="#2db7f2" />
              <path d="M12 90 L8 86 H18 Z" fill="#006286" />
              <path d="M88 90 L92 86 H82 Z" fill="#006286" />
              {/* Wheels */}
              <circle cx="25" cy="95" r="4.5" fill="#1e293b" />
              <circle cx="25" cy="95" r="2" fill="#e2e8f0" />
              <circle cx="75" cy="95" r="4.5" fill="#1e293b" />
              <circle cx="75" cy="95" r="2" fill="#e2e8f0" />
            </g>
          )}

          {/* Bicycle visual additions */}
          {activity === 'bicycle' && (
            <g className="bicycle-layer" stroke="#2db7f2" strokeWidth="2.5" fill="none">
              {/* Wheels */}
              <circle cx="20" cy="90" r="9" stroke="#1e293b" strokeWidth="3" />
              <circle cx="80" cy="90" r="9" stroke="#1e293b" strokeWidth="3" />
              {/* Frame */}
              <path d="M20 90 L40 90 L50 75 L80 90 M50 75 L38 65" />
              {/* Handlebar */}
              <path d="M38 65 H32 M38 65 L42 61" stroke="#475569" />
              {/* Seat */}
              <path d="M50 75 H44" stroke="#475569" strokeWidth="4" />
            </g>
          )}

          {/* MAIN PENGUIN CONTAINER (Bobs & tilts) */}
          <motion.g animate={currentBody}>
            
            {/* Webbed Feet */}
            <motion.path 
              d="M32 90 C32 90 24 92 24 95 H42 L40 90 Z" 
              fill="#fb923c" // Orange feet
              style={{ transformOrigin: '37px 90px' }}
              animate={currentLeftFoot}
            />
            <motion.path 
              d="M68 90 C68 90 76 92 76 95 H58 L60 90 Z" 
              fill="#fb923c"
              style={{ transformOrigin: '63px 90px' }}
              animate={currentRightFoot}
            />

            {/* Main Outer Body */}
            {/* Soft dark royal/navy blue body gradient */}
            <defs>
              <linearGradient id="bodyGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#0f172a" />
                <stop offset="60%" stopColor="#1e293b" />
                <stop offset="100%" stopColor="#0f172a" />
              </linearGradient>
              <linearGradient id="bellyGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#ffffff" />
                <stop offset="100%" stopColor="#f1f5f9" />
              </linearGradient>
            </defs>
            <path 
              d="M50 12 C30 12 24 28 24 55 C24 82 32 90 50 90 C68 90 76 82 76 55 C76 28 70 12 50 12 Z" 
              fill="url(#bodyGrad)" 
            />

            {/* White Belly */}
            <path 
              d="M50 32 C38 32 30 42 30 60 C30 78 37 87 50 87 C63 87 70 78 70 60 C70 42 62 32 50 32 Z" 
              fill="url(#bellyGrad)" 
            />

            {/* Left Arm / Flipper */}
            <motion.path 
              d="M25 45 C15 45 10 55 12 65 C13 69 17 67 19 63 C22 57 25 51 25 45 Z" 
              fill="url(#bodyGrad)"
              style={{ transformOrigin: '25px 45px' }}
              animate={currentLeftWing}
            />

            {/* Right Arm / Flipper */}
            {/* Holds chalk if teaching */}
            <motion.path 
              d="M75 45 C85 45 90 55 88 65 C87 69 83 67 81 63 C78 57 75 51 75 45 Z" 
              fill="url(#bodyGrad)"
              style={{ transformOrigin: '75px 45px' }}
              animate={currentRightWing}
            />
            {activity === 'teach' && (
              <motion.rect 
                x="88" 
                y="52" 
                width="3" 
                height="8" 
                rx="0.5" 
                fill="#ffffff" 
                rotate={45} 
                animate={{ y: [0, -1, 0] }} 
                transition={{ duration: 1.2, repeat: Infinity }} 
              />
            )}

            {/* --- CLOTHING LAYERS --- */}

            {/* UniNest Blue Hoodie */}
            {clothes === 'hoodie' && (
              <g className="clothing-hoodie">
                {/* Hoodie Main Body Overlay */}
                <path 
                  d="M24 55 C24 78 30 88 50 88 C70 88 76 78 76 55 C76 46 72 40 68 36 C64 42 58 45 50 45 C42 45 36 42 32 36 C28 40 24 46 24 55 Z" 
                  fill="#006286" // Royal/Navy
                />
                {/* Pocket */}
                <path d="M38 72 C38 72 42 66 50 66 C58 66 62 72 62 72 L60 84 H40 Z" fill="#2db7f2" opacity="0.8" />
                {/* Left/Right drawstrings */}
                <line x1="45" y1="46" x2="45" y2="58" stroke="#ffffff" strokeWidth="1.5" strokeLinecap="round" />
                <line x1="55" y1="46" x2="55" y2="58" stroke="#ffffff" strokeWidth="1.5" strokeLinecap="round" />
                {/* "U" Logo on chest */}
                <path d="M48 54 V57 C48 58 49 59 50 59 C51 59 52 58 52 57 V54" stroke="#ffffff" strokeWidth="1.8" fill="none" strokeLinecap="round" />
              </g>
            )}

            {/* Winter Scarf */}
            {clothes === 'scarf' && (
              <g className="clothing-scarf">
                {/* Wrap */}
                <path d="M30 35 C38 38 62 38 70 35 C73 34 74 38 70 41 C62 44 38 44 30 41 C27 38 27 34 30 35 Z" fill="#22c55e" /> {/* green */}
                {/* Stripes on wrap */}
                <path d="M36 37 L34 42 M46 38 L44 43 M56 38 L54 43 M66 37 L64 42" stroke="#ffffff" strokeWidth="1.5" />
                {/* Hanging tassel tail */}
                <motion.path 
                  d="M62 38 L68 62 H60 L56 38 Z" 
                  fill="#22c55e"
                  animate={{ rotate: activity === 'walking' ? [0, 8, -5, 0] : [0, 2, -2, 0] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                  style={{ transformOrigin: '60px 38px' }}
                />
              </g>
            )}

            {/* Classroom Uniform */}
            {clothes === 'uniform' && (
              <g className="clothing-uniform">
                {/* Blue Vest */}
                <path 
                  d="M24 55 C24 78 30 88 50 88 C70 88 76 78 76 55 C76 46 73 40 70 37 L50 55 L30 37 C27 40 24 46 24 55 Z" 
                  fill="#1e3a8a" // Royal blue uniform vest
                />
                {/* Shirt Collar V-neck */}
                <path d="M50 55 L58 36 H42 Z" fill="#ffffff" />
                {/* Mini Red Tie */}
                <path d="M49 40 H51 L53 52 L50 56 L47 52 Z" fill="#ef4444" />
              </g>
            )}

            {/* --- FACE DETAILS --- */}

            {/* Eyes & Blinking */}
            <g className="eyes">
              {/* Left Eye */}
              <motion.g 
                style={{ transformOrigin: '40px 26px' }}
                animate={{ scaleY: [1, 1, 0.05, 1, 1] }}
                transition={{ duration: 3.5, repeat: Infinity, repeatDelay: 2 }}
              >
                <circle cx="40" cy="26" r="4.5" fill="#0f172a" />
                {/* Pixar Eye shine reflection */}
                <circle cx="38.5" cy="24.5" r="1.5" fill="#ffffff" />
              </motion.g>

              {/* Right Eye */}
              <motion.g 
                style={{ transformOrigin: '60px 26px' }}
                animate={{ scaleY: [1, 1, 0.05, 1, 1] }}
                transition={{ duration: 3.5, repeat: Infinity, repeatDelay: 2 }}
              >
                <circle cx="60" cy="26" r="4.5" fill="#0f172a" />
                {/* Pixar Eye shine reflection */}
                <circle cx="58.5" cy="24.5" r="1.5" fill="#ffffff" />
              </motion.g>
            </g>

            {/* Professor Glasses */}
            {type === 'professor' && (
              <g className="professor-glasses" stroke="#94a3b8" strokeWidth="1.8" fill="none">
                <circle cx="40" cy="26" r="7.5" fill="rgba(255,255,255,0.1)" />
                <circle cx="60" cy="26" r="7.5" fill="rgba(255,255,255,0.1)" />
                <line x1="47.5" y1="26" x2="52.5" y2="26" />
                {/* Glasses temple pieces */}
                <path d="M32.5 26 L26 24" />
                <path d="M67.5 26 L74 24" />
              </g>
            )}

            {/* Blush cheeks */}
            <g className="blush-cheeks" opacity="0.45">
              <circle cx="34" cy="32" r="3.5" fill="#fda4af" />
              <circle cx="66" cy="32" r="3.5" fill="#fda4af" />
            </g>

            {/* Beak */}
            {expression === 'happy' || expression === 'excited' ? (
              // Open happy beak
              <path d="M43 30 Q50 42 57 30 Q50 34 43 30 Z" fill="#fb923c" stroke="#ea580c" strokeWidth="1" />
            ) : expression === 'surprised' ? (
              // Surprised O beak
              <circle cx="50" cy="32" r="4" fill="#fb923c" stroke="#ea580c" strokeWidth="1" />
            ) : (
              // Normal beak
              <path d="M42 29 L58 29 L50 37 Z" fill="#f97316" />
            )}

            {/* Graduation Cap (Specifically for throw cap or during hero transition) */}
            {activity === 'throw_cap' && (
              <motion.g 
                className="graduation-cap-overlay"
                initial={{ y: 0, rotate: 0 }}
                animate={{ 
                  y: [-1, -40, -80, -100, -120, -110, -70, 0], 
                  rotate: [0, 90, 270, 480, 720, 900, 1080, 1080],
                  opacity: [1, 1, 1, 1, 0.8, 0.5, 0, 0] 
                }}
                transition={{ duration: 2.2, ease: "easeOut" }}
                style={{ transformOrigin: '50px -10px' }}
              >
                {/* Mortarboard Diamond */}
                <polygon points="50,-20 74,-12 50,-4 26,-12" fill={capColor} stroke="#ffffff" strokeWidth="0.5" />
                {/* Cap base skull cap */}
                <path d="M37,-12 V-5 C37,-2 41,0 50,0 C59,0 63,-2 63,-5 V-12 Z" fill={capColor} />
                {/* Tassel */}
                <path d="M50,-12 L32,-8 V-1" stroke="#eab308" strokeWidth="1" fill="none" />
                <ellipse cx="32" cy="-0.5" rx="1.5" ry="2" fill="#eab308" />
              </motion.g>
            )}

            {/* Static Graduation Cap worn by Professor (optional display) */}
            {type === 'professor' && (
              <g className="professor-cap">
                <polygon points="50,2 72,8 50,14 28,8" fill="#1e1b4b" stroke="#ffffff" strokeWidth="0.5" />
                <path d="M38,8 V12 C38,14 42,16 50,16 C58,16 62,14 62,12 V8 Z" fill="#1e1b4b" />
                <path d="M50,8 L34,12 V18" stroke="#fbbf24" strokeWidth="0.8" fill="none" />
                <circle cx="34" cy="18" r="1" fill="#fbbf24" />
              </g>
            )}

            {/* Laptop for study activity */}
            {activity === 'study' && (
              <g className="laptop-overlay">
                {/* Light glow reflection on belly */}
                <ellipse cx="50" cy="74" rx="12" ry="5" fill="#2db7f2" opacity="0.3" filter="blur(2px)" />
                {/* Laptop base */}
                <path d="M32 80 H68 L72 87 H28 Z" fill="#64748b" />
                {/* Screen */}
                <rect x="36" y="65" width="28" height="15" rx="1.5" fill="#475569" />
                <rect x="38" y="67" width="24" height="11" rx="0.5" fill="#0f172a" />
                {/* Coding screen glow */}
                <rect x="39" y="68" width="22" height="9" fill="#0284c7" opacity="0.6" />
                <line x1="42" y1="71" x2="48" y2="71" stroke="#2db7f2" strokeWidth="1" />
                <line x1="42" y1="73" x2="45" y2="73" stroke="#22c55e" strokeWidth="1" />
              </g>
            )}

          </motion.g>
        </svg>
      </motion.div>
    </div>
  );
}
