import React, { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '../../../components/ui/sheet';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { MapPin, Clock, Calendar, Users, PartyPopper, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { Avatar, AvatarFallback, AvatarImage } from '../../../components/ui/avatar';
import { getFriends, getProfile, UserProfile } from '../../../utils/firebase/firestore';

type HangoutPlannerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialSelectedFriendId?: string;
  initialDate?: string;
  initialTime?: string;
};

const HANGOUT_CATEGORIES = ['Study', 'Movie', 'Food', 'Sports', 'Fun'];

export function HangoutPlanner({ open, onOpenChange, initialSelectedFriendId, initialDate, initialTime }: HangoutPlannerProps) {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('Fun');
  const [location, setLocation] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [saving, setSaving] = useState(false);
  const [friends, setFriends] = useState<UserProfile[]>([]);
  const [friendNames, setFriendNames] = useState<Record<string, string>>({});
  const [selectedFriends, setSelectedFriends] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (open) {
      // Reset form to defaults first
      setTitle('');
      setCategory('Fun');
      setLocation('');
      setDate('');
      setTime('');
      setSelectedFriends(new Set());

      // Pre-select the friend if provided
      if (initialSelectedFriendId) {
        setSelectedFriends(new Set([initialSelectedFriendId]));
      }
      if (initialDate) setDate(initialDate);
      if (initialTime) setTime(initialTime);
      
      const unsubscribe = getFriends(async (friendList) => {
        setFriends(friendList);
        // Load registered names from profiles collection
        const names: Record<string, string> = {};
        await Promise.all(friendList.map(async (f) => {
          try {
            const profile = await getProfile(f.uid);
            if (profile?.name) names[f.uid] = profile.name;
          } catch {}
        }));
        setFriendNames(names);
      });
      return () => unsubscribe && unsubscribe();
    }
  }, [open, initialSelectedFriendId]);

  const toggleFriend = (id: string) => {
    setSelectedFriends((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
      return newSet;
    });
  };

  const handleCreate = async () => {
    if (!title || !location || !date || !time) {
      toast.error('Please fill in all details for the hangout.');
      return;
    }
    if (selectedFriends.size === 0) {
      toast.error('Please invite at least one friend!');
      return;
    }

    setSaving(true);
    
    try {
      const { createHangout, createConversation, sendMessage } = await import('../../../utils/firebase/firestore');
      const { auth } = await import('../../../utils/firebase/client');
      
      const invitedArr = Array.from(selectedFriends);
      const hangoutId = await createHangout({
        title,
        category,
        location,
        date,
        time,
        creatorId: auth.currentUser!.uid,
        invitedFriends: invitedArr
      });

      if (hangoutId) {
        toast.success('Hangout planned successfully!');
        onOpenChange(false);
        
        // Auto-send a DM to invited friends so it jumps to top of chat
        invitedArr.forEach((friendId) => {
          createConversation(friendId).then((convId) => {
            if (convId) {
              sendMessage(convId, `🎉 I invited you to a hangout: "${title}"! Check the top of this chat to respond.`);
            }
          }).catch(console.warn);
        });

        // Reset form
        setTitle('');
        setCategory('Fun');
        setLocation('');
        setDate('');
        setTime('');
        setSelectedFriends(new Set());
      } else {
        toast.error('Failed to create hangout. Please try again.');
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'An error occurred.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[85vh] rounded-t-[32px] bg-slate-50/90 p-0 backdrop-blur-xl sm:h-[90vh]">
        <div className="flex h-full flex-col">
          <SheetHeader className="border-b border-white/50 bg-white/40 px-6 py-4">
            <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-slate-300" />
            <SheetTitle className="flex items-center gap-2 text-2xl font-extrabold text-slate-800">
              <PartyPopper className="h-6 w-6 text-sky-500" />
              Plan a Hangout
            </SheetTitle>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Title */}
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">What are we doing?</Label>
              <Input 
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="E.g., Late night study, Pizza run..."
                className="h-12 rounded-2xl border-slate-200 bg-white px-4 text-base shadow-sm focus:border-sky-500"
              />
            </div>

            {/* Category */}
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">Vibe</Label>
              <div className="flex flex-wrap gap-2">
                {HANGOUT_CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setCategory(cat)}
                    className={`rounded-full px-4 py-2 text-sm font-semibold transition-all ${
                      category === cat
                        ? 'bg-sky-500 text-white shadow-md shadow-sky-200'
                        : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Location */}
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">Where?</Label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                <Input 
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="Select location..."
                  className="h-12 rounded-2xl border-slate-200 bg-white pl-10 text-base shadow-sm focus:border-sky-500"
                />
              </div>
            </div>

            {/* Date & Time */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">Date</Label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                  <Input 
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="h-12 rounded-2xl border-slate-200 bg-white pl-10 text-base shadow-sm focus:border-sky-500"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">Time</Label>
                <div className="relative">
                  <Clock className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                  <Input 
                    type="time"
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                    className="h-12 rounded-2xl border-slate-200 bg-white pl-10 text-base shadow-sm focus:border-sky-500"
                  />
                </div>
              </div>
            </div>
            
            {/* Invites */}
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">Invite Friends</Label>
              {friends.length === 0 ? (
                <div className="flex items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 py-8">
                  <div className="flex flex-col items-center text-slate-500">
                    <Users className="mb-2 h-8 w-8 opacity-40" />
                    <span className="text-sm font-medium">Add friends to invite them</span>
                  </div>
                </div>
              ) : (
                <div className="flex overflow-x-auto gap-3 py-2 no-scrollbar">
                  {friends.map((friend) => (
                    <button
                      key={friend.uid}
                      type="button"
                      onClick={() => toggleFriend(friend.uid)}
                      className={`relative flex flex-col items-center min-w-[72px] gap-2 p-2 rounded-2xl transition-all ${selectedFriends.has(friend.uid) ? 'bg-sky-50 shadow-sm ring-1 ring-sky-200' : 'hover:bg-slate-50'}`}
                    >
                      <div className="relative">
                        <Avatar className={`h-12 w-12 transition-transform ${selectedFriends.has(friend.uid) ? 'scale-105 ring-2 ring-sky-500 ring-offset-2' : ''}`}>
                          <AvatarImage src={friend.photoURL} className="object-cover" />
                          <AvatarFallback className="bg-sky-100 text-sky-700 font-bold">{(friendNames[friend.uid] || friend.name || friend.displayName || friend.email || 'U').charAt(0)}</AvatarFallback>
                        </Avatar>
                        {selectedFriends.has(friend.uid) && (
                          <div className="absolute -bottom-1 -right-1 rounded-full bg-white">
                            <CheckCircle2 className="h-5 w-5 text-sky-500 fill-white" />
                          </div>
                        )}
                      </div>
                      <span className={`text-[10px] font-bold text-center truncate w-16 ${selectedFriends.has(friend.uid) ? 'text-sky-700' : 'text-slate-600'}`}>{friendNames[friend.uid] || friend.name || friend.displayName || friend.email?.split('@')[0]}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="pt-4 pb-8">
              <Button 
                onClick={handleCreate}
                disabled={saving}
                className="w-full h-14 rounded-2xl bg-sky-500 hover:bg-sky-600 text-lg font-bold text-white shadow-lg shadow-sky-500/30"
              >
                {saving ? 'Planning...' : 'Create Hangout'}
              </Button>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
