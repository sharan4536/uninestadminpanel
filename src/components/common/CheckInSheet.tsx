import React, { useState } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '../ui/drawer';
import { toast } from 'sonner';
import { createCheckIn } from '../../utils/firebase/firestore';
import { Coffee, LibraryBig, Sofa, Trophy, GraduationCap, MapPin, UtensilsCrossed, Building2, Theater } from 'lucide-react';
import { useUniversity } from '../../hooks/useUniversity';

interface CheckInSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Map icon name strings from university config to actual Lucide components */
const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Coffee, LibraryBig, Sofa, Trophy, GraduationCap, MapPin,
  UtensilsCrossed, Building2, Theater,
};

export function CheckInSheet({ open, onOpenChange }: CheckInSheetProps) {
  const university = useUniversity();
  const PRESETS = university.checkinPresets.map(p => ({
    ...p,
    Icon: ICON_MAP[p.icon] || MapPin,
  }));

  const [selected, setSelected] = useState<string | null>(null);
  const [other, setOther] = useState('');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const reset = () => {
    setSelected(null);
    setOther('');
    setNote('');
  };

  const handleSubmit = async () => {
    const location = selected === 'Other' ? other.trim() : selected;
    if (!location) {
      toast.error('Pick a location');
      return;
    }
    setSubmitting(true);
    try {
      await createCheckIn(location, note.trim() || undefined);
      toast.success(`Checked in at ${location}`, { description: 'Auto-expires in 1 hour.' });
      reset();
      onOpenChange(false);
    } catch {
      toast.error('Could not check in. Try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Drawer open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) reset(); }}>
      <DrawerContent data-testid="checkin-sheet">
        <div className="mx-auto w-full max-w-md px-5 py-6">
          <DrawerHeader className="px-0">
            <DrawerTitle className="text-base font-semibold">Check in</DrawerTitle>
            <p className="mt-1 text-xs text-slate-500">Auto-expires in 1 hour · only friends can see you.</p>
          </DrawerHeader>

          <div className="mt-3 grid grid-cols-2 gap-2.5">
            {PRESETS.map(({ id, label, Icon, tint }) => (
              <button
                key={id}
                type="button"
                onClick={() => setSelected(id)}
                className={`flex items-center gap-2 rounded-2xl border px-3 py-3 text-left text-sm font-semibold transition ${
                  selected === id
                    ? 'border-sky-500 bg-sky-500 text-white shadow-sm'
                    : `${tint} hover:brightness-105`
                }`}
                data-testid={`checkin-preset-${id.toLowerCase().replace(/\s+/g, '-')}`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="truncate">{label}</span>
              </button>
            ))}
            <button
              type="button"
              onClick={() => setSelected('Other')}
              className={`col-span-2 flex items-center gap-2 rounded-2xl border px-3 py-3 text-left text-sm font-semibold transition ${
                selected === 'Other'
                  ? 'border-sky-500 bg-sky-500 text-white shadow-sm'
                  : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
              }`}
              data-testid="checkin-preset-other"
            >
              <MapPin className="h-4 w-4 shrink-0" />
              <span>Other…</span>
            </button>
          </div>

          {selected === 'Other' && (
            <div className="mt-3">
              <Input
                placeholder="Where are you?"
                value={other}
                onChange={(e) => setOther(e.target.value)}
                maxLength={40}
                data-testid="checkin-other-input"
              />
            </div>
          )}

          <div className="mt-3">
            <Input
              placeholder="Add a note (optional)"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={60}
              data-testid="checkin-note-input"
            />
          </div>

          <Button
            onPointerDown={(e) => {
              e.preventDefault(); // Prevent input blur which swallows click on mobile
              if (submitting || !selected || (selected === 'Other' && !other.trim())) return;
              handleSubmit();
            }}
            onClick={(e) => {
              // Fallback for keyboard accessibility (Enter key)
              if (e.detail === 0) {
                handleSubmit();
              }
            }}
            disabled={submitting || !selected || (selected === 'Other' && !other.trim())}
            className="mt-5 h-11 w-full rounded-full bg-sky-500 text-white hover:bg-sky-600 disabled:opacity-50"
            data-testid="checkin-submit-btn"
          >
            {submitting ? 'Checking in…' : 'Check in'}
          </Button>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
