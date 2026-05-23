import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Badge } from '../../../components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '../../../components/ui/avatar';
import {
    CampusEvent,
    markEventInterest,
    EventAttendee,
    getEventAttendees,
    UserProfile,
    ClassItem,
    markPrivateInterest,
    getPrivateInterestCount,
    getFriends
} from '../../../utils/firebase/firestore';
import { auth, db } from '../../../utils/firebase/client';
import { Timestamp, doc, getDoc } from 'firebase/firestore';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../../../components/ui/dialog';

interface EventCardProps {
    event: CampusEvent;
    userTimetable: Record<string, ClassItem[]>; // To check if free
    onFindBuddy: (event: CampusEvent) => void;
    onOpenChat: (event: CampusEvent) => void;
}

export function EventCard({ event, userTimetable, onFindBuddy, onOpenChat }: EventCardProps) {
    const [attendingStatus, setAttendingStatus] = useState<'attending' | 'interested' | 'none'>('none');
    const [isGoingAlone, setIsGoingAlone] = useState<boolean>(false);
    const [attendees, setAttendees] = useState<EventAttendee[]>([]);
    const [isFree, setIsFree] = useState<boolean>(false);
    const [quietInterestCount, setQuietInterestCount] = useState<number>(0);
    const [isQuietlyInterested, setIsQuietlyInterested] = useState<boolean>(false);
    const [isPair, setIsPair] = useState<boolean>(false);
    const [linkedWith, setLinkedWith] = useState<string>('');
    const [myFriends, setMyFriends] = useState<UserProfile[]>([]);

    useEffect(() => {
        loadMyStatus();
        checkIfFree();
        loadAttendees();
        
        const unsub = getPrivateInterestCount(event.id, (count) => {
            setQuietInterestCount(count);
        });
        
        const unsubFriends = getFriends((list) => setMyFriends(list));

        return () => {
            unsub();
            if (unsubFriends) unsubFriends();
        };
    }, [event.id]);

    const loadMyStatus = async () => {
        if (!auth.currentUser) return;
        
        // Load public attending status
        const all = await getEventAttendees(event.id);
        const myEntry = all.find(a => a.userId === auth.currentUser?.uid);
        if (myEntry) {
            setAttendingStatus(myEntry.status);
            setIsGoingAlone(myEntry.isGoingAlone);
            setIsPair(myEntry.isPair || false);
            setLinkedWith(myEntry.linkedWith || '');
        }

        // Load private interest status
        try {
            const interestRef = doc(db, `eventInterest/${event.id}/interested/${auth.currentUser.uid}`);
            const interestSnap = await getDoc(interestRef);
            setIsQuietlyInterested(interestSnap.exists());
        } catch (e) { console.error(e); }
    };

    const loadAttendees = async () => {
        const list = await getEventAttendees(event.id);
        setAttendees(list);
    };

    const handleStatusChange = async (status: 'attending' | 'interested' | 'none') => {
        setAttendingStatus(status);
        await markEventInterest(event.id, status, isGoingAlone, isPair, linkedWith);
        loadAttendees(); // Refresh stats
    };

    const toggleGoingAlone = async () => {
        const newVal = !isGoingAlone;
        setIsGoingAlone(newVal);
        // If they turn off going alone, also turn off pair
        let pairVal = isPair;
        let linkVal = linkedWith;
        if (!newVal) {
            pairVal = false;
            setIsPair(false);
            linkVal = '';
            setLinkedWith('');
        }
        if (attendingStatus !== 'none') {
            await markEventInterest(event.id, attendingStatus, newVal, pairVal, linkVal);
        }
    };

    const togglePair = async () => {
        const newVal = !isPair;
        setIsPair(newVal);
        // If they turn on pair, they are "going" (in the pool)
        let aloneVal = isGoingAlone;
        if (newVal) {
            aloneVal = true;
            setIsGoingAlone(true);
        }
        if (attendingStatus !== 'none') {
            await markEventInterest(event.id, attendingStatus, aloneVal, newVal, linkedWith);
        }
    };

    const handleLinkedWithChange = async (friendId: string) => {
        setLinkedWith(friendId);
        if (attendingStatus !== 'none') {
            await markEventInterest(event.id, attendingStatus, isGoingAlone, isPair, friendId);
        }
    };

    // Timetable Sync Logic
    const checkIfFree = () => {
        if (!event.startTime) return;
        const start = event.startTime.toDate();
        const dayName = start.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase(); // MON, TUE...

        // Simple check: Is there a class at start time?
        // In a real app, check full duration overlap
        const classesToday = userTimetable[dayName] || [];

        // Convert event start to minutes
        const eventStartMins = start.getHours() * 60 + start.getMinutes();

        // Check if any class overlaps
        const hasConflict = classesToday.some(cls => {
            // Parse class time "08:00 AM"
            // reusing logic from DiscoverPage or similar would be better, but implementing simple parser here
            const [timeStr, ampm] = cls.time.split(' ');
            const [hh, mm] = timeStr.split(':').map(Number);
            let classStartMins = hh * 60 + mm;
            if (ampm === 'PM' && hh !== 12) classStartMins += 12 * 60;
            if (ampm === 'AM' && hh === 12) classStartMins = mm; // 12 AM is 0 mins ?? No, 00:xx

            // duration is in hours usually in this app context (e.g. 1)
            // Assuming duration is 50-60 mins blocks.
            const classEndMins = classStartMins + (cls.duration * 60);

            return (eventStartMins >= classStartMins && eventStartMins < classEndMins);
        });

        setIsFree(!hasConflict);
    };

    // Heat Calculation
    const heatScore = (event.stats.attending * 2) + event.stats.interested + (event.stats.views / 20);
    let heatLevel = '❄️ Cold';
    let heatColor = 'text-blue-400';
    if (heatScore > 50) { heatLevel = '🔥 Hot'; heatColor = 'text-orange-500'; }
    else if (heatScore > 20) { heatLevel = '⚡ Trending'; heatColor = 'text-yellow-500'; }
    else if (heatScore > 5) { heatLevel = '🌿 Warm'; heatColor = 'text-green-500'; }

    const formatTime = (t: Timestamp) => {
        return t.toDate().toLocaleString('en-US', {
            weekday: 'short', month: 'short', day: 'numeric',
            hour: 'numeric', minute: '2-digit'
        });
    };

    return (
        <div className="relative aspect-video w-full overflow-hidden group cursor-pointer border-b border-white mb-1 rounded-[30px] shadow-sm">
            {/* Show uploaded banner or a stylish gradient fallback */}
            {(event.bannerUrl || (event as any).imageUrl) ? (
              <img 
                src={event.bannerUrl || (event as any).imageUrl} 
                alt={event.title} 
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" 
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-indigo-600 via-sky-500 to-violet-600 group-hover:scale-105 transition-transform duration-700 flex items-center justify-center">
                <span className="text-6xl opacity-20">🎪</span>
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-transparent to-transparent opacity-80" />
            <div className="absolute inset-0 bg-gradient-to-b from-indigo-900/30 via-transparent to-transparent border border-white/20 rounded-[30px]" />
            
            <div className="absolute bottom-0 left-0 right-0 p-6 space-y-3">
                <div className="flex gap-2 font-sans">
                    {event.isSponsored && (
                        <span className="px-3 py-1 bg-amber-500/80 backdrop-blur-md rounded-full text-[9px] font-bold uppercase tracking-widest text-white">
                            Sponsored
                        </span>
                    )}
                    {event.vibeTags && event.vibeTags.map(tag => (
                        <span key={tag} className="px-3 py-1 bg-white/20 backdrop-blur-md rounded-full text-[9px] font-bold uppercase tracking-widest text-white">
                            {tag}
                        </span>
                    ))}
                    {isFree && (
                       <span className="px-3 py-1 bg-emerald-500/80 backdrop-blur-md rounded-full text-[9px] font-bold uppercase tracking-widest text-white">
                            You're Free
                        </span>
                    )}
                </div>
                <h3 className="text-xl font-extrabold text-white leading-tight font-sans" style={{fontFamily: "'Plus Jakarta Sans', sans-serif"}}>
                    {event.title}
                </h3>
                <div className="flex items-end justify-between">
                    <div className="flex items-center gap-2 text-white/80 pb-1">
                        <span className="text-base">📍</span>
                        <span className="text-[10px] font-medium">
                            {event.clubName} {event.isSponsored && '• Sponsored'} • {event.location} • {formatTime(event.startTime)}
                        </span>
                    </div>
                    <div className="flex items-center -space-x-3">
                        {attendees
                            .filter(a => (a.status === 'attending' || a.status === 'interested') && myFriends.some(f => f.uid === a.userId))
                            .slice(0, 3)
                            .map((att, i) => {
                                const friend = myFriends.find(f => f.uid === att.userId);
                                return (
                                    <div key={i} className="w-8 h-8 rounded-full border-2 border-white bg-slate-200 overflow-hidden relative" title={friend?.name || friend?.displayName}>
                                        <Avatar className="w-full h-full">
                                            <AvatarImage src={friend?.photoURL || undefined} className="object-cover" />
                                            <AvatarFallback className="bg-sky-100 text-sky-700 text-[10px] font-bold">
                                                {(friend?.name || friend?.displayName || att.userId).charAt(0).toUpperCase()}
                                            </AvatarFallback>
                                        </Avatar>
                                    </div>
                                );
                            })}
                    </div>
                </div>
            </div>

            {/* Interaction Icons overlaying right side */}
            <div className="absolute top-6 right-5 flex flex-col gap-3 items-center">
                <button 
                  onClick={(e) => {e.stopPropagation(); handleStatusChange(attendingStatus === 'interested' ? 'none' : 'interested');}}
                  className={`w-10 h-10 rounded-full backdrop-blur-xl flex items-center justify-center border transition-colors ${attendingStatus === 'interested' ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white/10 text-white border-white/20 hover:bg-white/20'}`}
                  title="Interested"
                >
                    <span className="text-lg">👍</span>
                </button>
                <button 
                  onClick={(e) => {e.stopPropagation(); markPrivateInterest(event.id, !isQuietlyInterested);}}
                  className={`w-10 h-10 rounded-full backdrop-blur-xl flex items-center justify-center border transition-colors ${isQuietlyInterested ? 'bg-sky-600 text-white border-sky-600' : 'bg-white/10 text-white border-white/20 hover:bg-white/20'}`}
                  title="Quietly Interested"
                >
                    <span className="text-lg">🤫</span>
                </button>
                <button 
                  onClick={(e) => {e.stopPropagation(); onFindBuddy(event);}}
                  className="w-10 h-10 rounded-full backdrop-blur-xl flex items-center justify-center border bg-white/10 text-white border-white/20 hover:bg-white/20 transition-colors shadow-sm"
                  title="Find Buddy"
                >
                    <span className="text-lg">🤝</span>
                </button>
            </div>

            {/* Top Left Badges */}
            <div className="absolute top-6 left-6 flex flex-col gap-2 items-start">
                <div className="w-8 h-8 rounded-full bg-black/40 backdrop-blur-md border-2 border-white/20 flex items-center justify-center text-[10px] font-bold text-white shadow-sm">
                    +{(event.stats.attending || 0) + (event.stats.interested || 0)}
                </div>
                {quietInterestCount > 0 && (
                  <div className="bg-black/40 backdrop-blur-md px-3 py-1.5 rounded-full text-white/90 text-xs font-semibold shadow-sm border border-white/10">
                    {quietInterestCount} quietly interested
                  </div>
                )}
            </div>
        </div>
    );
}
