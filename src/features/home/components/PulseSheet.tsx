import React, { useState } from 'react';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Drawer, DrawerContent } from '../../../components/ui/drawer';
import { toast } from 'sonner';
import { createPulse } from '../../../utils/firebase/firestore';
import {
  GraduationCap,
  Utensils,
  BookOpen,
  PartyPopper,
  Dribbble,
  Unlock,
  Lock,
  Info,
  Clock,
  Zap,
  Users,
} from 'lucide-react';

interface PulseSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type Vibe = 'class' | 'food' | 'library' | 'fun' | 'sports';

const VIBES: { id: Vibe; label: string; icon: React.ReactNode }[] = [
  { id: 'class', label: 'Class', icon: <GraduationCap className="w-5 h-5" /> },
  { id: 'food', label: 'Food', icon: <Utensils className="w-5 h-5" /> },
  { id: 'library', label: 'Library', icon: <BookOpen className="w-5 h-5" /> },
  { id: 'fun', label: 'Fun', icon: <PartyPopper className="w-5 h-5" /> },
  { id: 'sports', label: 'Sports', icon: <Dribbble className="w-5 h-5" /> },
];

const CROWD_RANGES = [
  { min: 1, max: 3, label: 'Intimate' },
  { min: 3, max: 6, label: 'Standard' },
  { min: 6, max: 10, label: 'Massive' },
];

export function PulseSheet({ open, onOpenChange }: PulseSheetProps) {
  const [pulseText, setPulseText] = useState('');
  const [vibe, setVibe] = useState<Vibe>('class');
  const [crowdMin, setCrowdMin] = useState(1);
  const [crowdMax, setCrowdMax] = useState(5);
  const [isPublic, setIsPublic] = useState(true);
  const [duration, setDuration] = useState<15 | 30 | 60>(30);
  const [isLoading, setIsLoading] = useState(false);

  const handleCreatePulse = async () => {
    if (!pulseText.trim()) {
      toast.error("Tell us what you're doing!");
      return;
    }

    setIsLoading(true);
    try {
      const metadata = {
        vibe,
        crowdMin,
        crowdMax,
        isPublic,
      };
      await createPulse(pulseText, duration, metadata);
      toast.success(`Your ${vibe} pulse is live!`);
      
      // Close the sheet first, then reset state after a brief delay
      // so the user sees the success feedback before the drawer animates out
      onOpenChange(false);
      setTimeout(() => {
        setPulseText('');
        setVibe('class');
        setCrowdMin(1);
        setCrowdMax(5);
        setIsPublic(true);
        setDuration(30);
      }, 400);
    } catch (error) {
      toast.error('Failed to create pulse');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const getVibeIcon = (vibeId: Vibe) => {
    return VIBES.find(v => v.id === vibeId)?.icon || <Zap className="w-5 h-5" />;
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[85vh] px-0 pb-0 overflow-hidden flex flex-col">
        {/* Hide default range thumb so the custom visual knobs sit cleanly on top */}
        <style>{`
          input[type="range"][data-testid="pulse-crowd-min"]::-webkit-slider-thumb,
          input[type="range"][data-testid="pulse-crowd-max"]::-webkit-slider-thumb {
            -webkit-appearance: none;
            appearance: none;
            width: 28px;
            height: 28px;
            background: transparent;
            cursor: pointer;
          }
          input[type="range"][data-testid="pulse-crowd-min"]::-moz-range-thumb,
          input[type="range"][data-testid="pulse-crowd-max"]::-moz-range-thumb {
            width: 28px;
            height: 28px;
            background: transparent;
            border: none;
            cursor: pointer;
          }
        `}</style>
        <div className="flex flex-col h-full overflow-hidden">
          <div className="shrink-0 flex flex-col items-center pt-3 pb-1 px-6">
            <div className="w-12 h-1.5 bg-gray-200 rounded-full mb-3"></div>
            <div className="w-full text-center mb-2">
               <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-primary">CREATE PULSE</span>
            </div>
          </div>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto px-6 pb-4 space-y-6">
                <div className="space-y-1">
                  <h3 className="text-2xl font-extrabold tracking-tighter text-on-background">What are you doing?</h3>
                  <p className="text-outline text-sm leading-relaxed">Share what you're up to right now.</p>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-extrabold tracking-widest uppercase text-on-surface-variant">ACTIVITY</label>
                  <Input
                    placeholder="E.g., Grabbing coffee at the cafe"
                    value={pulseText}
                    onChange={(e) => setPulseText(e.target.value.slice(0, 80))}
                    maxLength={80}
                    className="rounded-2xl border-surface-container focus:ring-primary h-12"
                  />
                  <p className="text-xs text-outline mt-1">{pulseText.length}/80</p>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-extrabold tracking-widest uppercase text-on-surface-variant">DURATION</label>
                  <div className="flex gap-3">
                    {[15, 30, 60].map((mins) => (
                      <button
                        key={mins}
                        onClick={() => setDuration(mins as 15 | 30 | 60)}
                        className={`flex-1 py-3 rounded-2xl font-semibold text-sm transition-all ${
                          duration === mins
                            ? 'bg-primary text-white shadow-lg shadow-primary/25'
                            : 'bg-surface-container-lowest border border-surface-container text-on-surface hover:bg-surface-container'
                        }`}
                      >
                        {mins === 30 ? 'FOOD' : `${mins}m`}
                      </button>
                    ))}
                  </div>
                </div>
                
                <hr className="border-surface-container" />


                <div className="space-y-2">
                  <h4 className="text-xs font-extrabold tracking-widest uppercase text-on-surface-variant">SELECT VIBE</h4>
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {VIBES.map((v) => (
                      <button
                        key={v.id}
                        onClick={() => setVibe(v.id as Vibe)}
                        className={`flex-shrink-0 px-4 py-3 rounded-2xl flex flex-col items-center gap-1.5 transition-all ${
                          vibe === v.id
                            ? 'bg-gradient-to-r from-primary to-primary/80 text-white shadow-lg shadow-primary/25'
                            : 'bg-surface-container-lowest border border-surface-container text-on-surface hover:bg-surface-container/50'
                        }`}
                      >
                        {v.icon}
                        <span className="text-xs font-semibold">{v.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between items-end">
                    <h4 className="text-xs font-extrabold tracking-widest uppercase text-on-surface-variant">CROWD CAPACITY</h4>
                    <span className="text-xl font-black text-primary tracking-tighter">{crowdMin}-{crowdMax}</span>
                  </div>

                  <div className="space-y-3">
                    <div className="relative w-full h-10 flex items-center group">
                      <div className="absolute w-full h-2 bg-surface-container-high rounded-full"></div>
                      <div
                        className="absolute h-2 bg-primary rounded-full"
                        style={{
                          left: `${(crowdMin / 10) * 100}%`,
                          right: `${100 - (crowdMax / 10) * 100}%`,
                        }}
                      ></div>

                      <input
                        type="range"
                        min="1"
                        max="10"
                        value={crowdMin}
                        onChange={(e) => {
                          const newMin = Math.min(Number(e.target.value), crowdMax);
                          setCrowdMin(newMin);
                        }}
                        className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-8 w-full appearance-none bg-transparent cursor-pointer z-20"
                        style={{ WebkitAppearance: 'none', outline: 'none' }}
                        data-testid="pulse-crowd-min"
                      />

                      <input
                        type="range"
                        min="1"
                        max="10"
                        value={crowdMax}
                        onChange={(e) => {
                          const newMax = Math.max(Number(e.target.value), crowdMin);
                          setCrowdMax(newMax);
                        }}
                        className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-8 w-full appearance-none bg-transparent cursor-pointer z-30"
                        style={{ WebkitAppearance: 'none', outline: 'none' }}
                        data-testid="pulse-crowd-max"
                      />

                      {/* Visual knobs (purely decorative — native range handles the events) */}
                      <div
                        className="pointer-events-none absolute top-1/2 -translate-y-1/2 w-6 h-6 bg-white border-4 border-primary rounded-full shadow-md z-10"
                        style={{ left: `calc(${(crowdMin / 10) * 100}% - 12px)` }}
                      ></div>

                      <div
                        className="pointer-events-none absolute top-1/2 -translate-y-1/2 w-6 h-6 bg-white border-4 border-primary rounded-full shadow-md z-10"
                        style={{ left: `calc(${(crowdMax / 10) * 100}% - 12px)` }}
                      ></div>
                    </div>

                    <div className="flex justify-between text-[10px] font-bold text-outline uppercase tracking-widest">
                      <span>Intimate</span>
                      <span>Standard</span>
                      <span>Massive</span>
                    </div>
                  </div>
                </div>

                <div className="bg-surface-container-low rounded-2xl p-4 flex items-center justify-between border border-primary/10">
                  <div className="flex gap-4 items-center">
                    <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center border border-primary/20">
                      {isPublic ? <Unlock className="w-5 h-5 text-primary" /> : <Lock className="w-5 h-5 text-primary" />}
                    </div>
                    <div>
                      <p className="font-bold text-on-background text-sm">{isPublic ? 'Public Pulse' : 'Private Pulse'}</p>
                      <p className="text-xs text-outline">{isPublic ? 'Visible to everyone in your nest' : 'Only visible to friends'}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setIsPublic(!isPublic)}
                    className={`w-14 h-8 rounded-full relative p-1 cursor-pointer transition-all ${
                      isPublic ? 'bg-primary shadow-inner' : 'bg-gray-300'
                    }`}
                  >
                    <div className={`w-6 h-6 bg-white rounded-full shadow-md transition-all ${isPublic ? 'translate-x-6' : ''}`}></div>
                  </button>
                </div>

          </div>

          {/* Action Buttons */}
          <div className="shrink-0 px-6 pb-4 pt-3 border-t border-surface-container flex gap-3">
            <button
              onClick={() => onOpenChange(false)}
              className="flex-1 py-3 rounded-2xl bg-surface-container-high text-on-surface font-bold text-sm tracking-tight transition-all active:scale-95"
            >
              Cancel
            </button>
            <button
              onClick={handleCreatePulse}
              disabled={isLoading || !pulseText.trim()}
              className="flex-1 py-3 rounded-2xl bg-gradient-to-r from-primary to-primary/80 text-white font-bold text-sm tracking-tight shadow-lg shadow-primary/25 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Creating...' : '⚡ Pulse'}
            </button>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
