import React, { useState, useEffect } from 'react';

interface SplashScreenProps {
  onComplete: () => void;
}

/**
 * Animated splash screen matching the app's light sky-blue palette.
 * Shows the UniNest logo/branding, then auto-transitions after ~2.8s.
 */
export function SplashScreen({ onComplete }: SplashScreenProps) {
  const [phase, setPhase] = useState<'enter' | 'hold' | 'exit'>('enter');

  useEffect(() => {
    const holdTimer = setTimeout(() => setPhase('hold'), 800);
    const exitTimer = setTimeout(() => setPhase('exit'), 2200);
    const completeTimer = setTimeout(() => onComplete(), 2800);

    return () => {
      clearTimeout(holdTimer);
      clearTimeout(exitTimer);
      clearTimeout(completeTimer);
    };
  }, [onComplete]);

  return (
    <div
      className={`fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden transition-all duration-500 ${
        phase === 'exit' ? 'opacity-0 scale-105' : 'opacity-100 scale-100'
      }`}
      style={{ background: '#f1f7fb' }}
    >
      {/* Animated background orbs — soft sky-blue tones */}
      <div className="absolute inset-0 overflow-hidden">
        <div
          className="absolute -top-32 -left-32 w-96 h-96 rounded-full blur-3xl"
          style={{
            background: 'radial-gradient(circle, rgba(45, 183, 242, 0.15), transparent)',
            animation: 'splash-orb-1 3s ease-in-out infinite alternate',
          }}
        />
        <div
          className="absolute -bottom-40 -right-40 w-[500px] h-[500px] rounded-full blur-3xl"
          style={{
            background: 'radial-gradient(circle, rgba(0, 98, 134, 0.10), transparent)',
            animation: 'splash-orb-2 4s ease-in-out infinite alternate',
          }}
        />
        <div
          className="absolute top-1/3 right-1/4 w-64 h-64 rounded-full blur-3xl"
          style={{
            background: 'radial-gradient(circle, rgba(56, 189, 248, 0.12), transparent)',
            animation: 'splash-orb-3 3.5s ease-in-out infinite alternate',
          }}
        />
      </div>

      {/* Subtle grid overlay */}
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage: `linear-gradient(rgba(0,98,134,.15) 1px, transparent 1px), linear-gradient(90deg, rgba(0,98,134,.15) 1px, transparent 1px)`,
          backgroundSize: '60px 60px',
        }}
      />

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center gap-6">
        {/* Logo icon */}
        <div
          className="relative"
          style={{
            animation: 'splash-logo-enter 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards',
            opacity: 0,
            transform: 'scale(0.5) translateY(20px)',
          }}
        >
          <div className="w-24 h-24 rounded-[28px] bg-white flex items-center justify-center shadow-[0_20px_60px_rgba(0,98,134,0.15)] border border-slate-100 relative overflow-hidden">
            {/* Shimmer effect */}
            <div
              className="absolute inset-0"
              style={{
                background: 'linear-gradient(105deg, transparent 40%, rgba(45,183,242,0.08) 45%, rgba(45,183,242,0.15) 50%, rgba(45,183,242,0.08) 55%, transparent 60%)',
                animation: 'splash-shimmer 2s ease-in-out infinite',
              }}
            />
            <img src="/logo.png?v=3" className="h-16 w-16 object-contain relative z-10" alt="UniNest" />
          </div>

          {/* Pulse rings */}
          <div
            className="absolute inset-0 rounded-[28px] border-2 border-sky-300/40"
            style={{ animation: 'splash-pulse-ring 1.5s ease-out infinite' }}
          />
          <div
            className="absolute inset-0 rounded-[28px] border-2 border-sky-200/30"
            style={{ animation: 'splash-pulse-ring 1.5s ease-out infinite 0.5s' }}
          />
        </div>

        {/* App name */}
        <div
          className="text-center"
          style={{
            animation: 'splash-text-enter 0.7s cubic-bezier(0.16, 1, 0.3, 1) 0.3s forwards',
            opacity: 0,
            transform: 'translateY(16px)',
          }}
        >
          <h1
            className="text-4xl font-extrabold tracking-tight"
            style={{ fontFamily: "'Plus Jakarta Sans', 'Inter', sans-serif" }}
          >
            <span className="text-[#293033]">Uni</span>
            <span className="text-[#2DB7F2]">Nest</span>
          </h1>
        </div>

        {/* Tagline */}
        <div
          style={{
            animation: 'splash-text-enter 0.6s cubic-bezier(0.16, 1, 0.3, 1) 0.6s forwards',
            opacity: 0,
            transform: 'translateY(12px)',
          }}
        >
          <p className="text-sm font-medium text-[#565C60] tracking-wide">
            Your campus. Your people. Your vibe.
          </p>
        </div>

        {/* Loading dots */}
        <div
          className="flex gap-1.5 mt-4"
          style={{
            animation: 'splash-text-enter 0.5s cubic-bezier(0.16, 1, 0.3, 1) 0.9s forwards',
            opacity: 0,
          }}
        >
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="w-2 h-2 rounded-full bg-[#2DB7F2]/50"
              style={{
                animation: `splash-dot-bounce 1.2s ease-in-out ${i * 0.15}s infinite`,
              }}
            />
          ))}
        </div>
      </div>

      {/* CSS Animations */}
      <style>{`
        @keyframes splash-orb-1 {
          from { transform: translate(0, 0) scale(1); }
          to { transform: translate(40px, 30px) scale(1.2); }
        }
        @keyframes splash-orb-2 {
          from { transform: translate(0, 0) scale(1); }
          to { transform: translate(-30px, -40px) scale(1.15); }
        }
        @keyframes splash-orb-3 {
          from { transform: translate(0, 0) scale(1); }
          to { transform: translate(20px, -20px) scale(1.1); }
        }
        @keyframes splash-logo-enter {
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes splash-text-enter {
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes splash-shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(200%); }
        }
        @keyframes splash-pulse-ring {
          0% { transform: scale(1); opacity: 0.6; }
          100% { transform: scale(1.6); opacity: 0; }
        }
        @keyframes splash-dot-bounce {
          0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
          40% { transform: scale(1.2); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
