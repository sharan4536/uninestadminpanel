import React, { useState, useEffect, useRef } from 'react';
import { 
  Plus, 
  Search, 
  MoreVertical, 
  Calendar as CalendarIcon, 
  MapPin, 
  Star, 
  TrendingUp, 
  ShieldCheck,
  Trash2,
  Edit,
  ExternalLink,
  Image as ImageIcon,
  Upload,
  X
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Badge } from '../../../components/ui/badge';
import { 
  getUpcomingEventsRealtime, 
  updateEventMetadata, 
  deleteEvent, 
  createEvent,
  type CampusEvent 
} from '../../../utils/firebase/firestore';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '../../../components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../../../components/ui/dialog';
import { Label } from '../../../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../components/ui/select';
import { Timestamp } from 'firebase/firestore';
import { UNIVERSITY_LIST } from '../../../config/universities';
import { auth, storage } from '../../../utils/firebase/client';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { toast } from 'sonner';

export function EventManagement() {
  const [events, setEvents] = useState<CampusEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterTab, setFilterTab] = useState<'all' | 'featured' | 'trending' | 'sponsored'>('all');
  const [targetUniversity, setTargetUniversity] = useState<string>('all');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [bannerPreview, setBannerPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [editingEvent, setEditingEvent] = useState<CampusEvent | null>(null);
  const [newEvent, setNewEvent] = useState({
    title: '',
    clubName: '',
    location: '',
    startTime: '',
    description: '',
    tags: '',
    bannerUrl: '',
    expiration: 'none',
    universityId: UNIVERSITY_LIST[0].id
  });

  useEffect(() => {
    setLoading(true);
    const unsubscribe = getUpcomingEventsRealtime((data) => {
      setEvents(data);
      setLoading(false);
    }, targetUniversity === 'all' ? undefined : targetUniversity);
    return () => unsubscribe();
  }, [targetUniversity]);

  const handleBannerUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Preview immediately
    const reader = new FileReader();
    reader.onloadend = () => setBannerPreview(reader.result as string);
    reader.readAsDataURL(file);

    if (storage) {
      try {
        setUploading(true);
        const path = `event_banners/${Date.now()}_${file.name}`;
        const storageRef = ref(storage, path);
        console.log('[BannerUpload] Attempting upload to:', path);
        
        const snapshot = await uploadBytes(storageRef, file, { contentType: file.type });
        console.log('[BannerUpload] Upload complete!');
        
        const url = await getDownloadURL(snapshot.ref);
        console.log('[BannerUpload] Download URL obtained:', url);
        
        setNewEvent(prev => ({ ...prev, bannerUrl: url }));
        toast.success('Banner uploaded!');
      } catch (err: any) {
        console.error('[BannerUpload] Cloud upload failed:', err?.code, err?.message);
        
        // Fallback: use base64 data URL so the banner still appears
        const fallbackReader = new FileReader();
        fallbackReader.onloadend = () => {
          const dataUrl = fallbackReader.result as string;
          setNewEvent(prev => ({ ...prev, bannerUrl: dataUrl }));
          toast.warning('Cloud upload failed — using embedded image instead. Banner may not persist across sessions.', {
            description: err?.message || 'Check Firebase Storage configuration',
          });
        };
        fallbackReader.readAsDataURL(file);
      } finally {
        setUploading(false);
      }
    } else {
      console.warn('[BannerUpload] Storage not available. storage:', !!storage, 'user:', !!auth.currentUser);
      // Fallback: use base64 data URL
      const fallbackReader = new FileReader();
      fallbackReader.onloadend = () => {
        const dataUrl = fallbackReader.result as string;
        setNewEvent(prev => ({ ...prev, bannerUrl: dataUrl }));
        toast.warning('Firebase Storage unavailable — using embedded image.');
      };
      fallbackReader.readAsDataURL(file);
    }

    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const openEditDialog = (event: CampusEvent) => {
    setEditingEvent(event);
    const startDate = event.startTime?.toDate?.();
    const legacyImageUrl = (event as any).imageUrl || '';
    setNewEvent({
      title: event.title,
      clubName: event.clubName,
      location: event.location || '',
      startTime: startDate ? new Date(startDate.getTime() - startDate.getTimezoneOffset() * 60000).toISOString().slice(0, 16) : '',
      description: event.description || '',
      tags: (event.tags || []).join(', '),
      bannerUrl: event.bannerUrl || legacyImageUrl,
      expiration: 'none',
      universityId: (event as any).universityId || (event as any).collegeId || UNIVERSITY_LIST[0].id
    });
    setBannerPreview(event.bannerUrl || legacyImageUrl);
    setIsAddDialogOpen(true);
  };

  const resetForm = () => {
    setNewEvent({ title: '', clubName: '', location: '', startTime: '', description: '', tags: '', bannerUrl: '', expiration: 'none', universityId: UNIVERSITY_LIST[0].id });
    setBannerPreview(null);
    setEditingEvent(null);
  };

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEvent.title || !newEvent.clubName || !newEvent.startTime) {
      toast.error('Please fill required fields');
      return;
    }

    // Prevent saving while upload is still in progress
    if (uploading) {
      toast.error('Please wait for the image upload to complete.');
      return;
    }

    // If user selected a banner (preview exists) but upload failed or hasn't set the URL yet
    if (bannerPreview && !newEvent.bannerUrl) {
      toast.error('Banner image is not ready. Please re-upload or remove it.');
      return;
    }

    const startDate = new Date(newEvent.startTime);
    const endDate = new Date(startDate);
    endDate.setHours(endDate.getHours() + 2); 

    const eventPayload: any = {
      title: newEvent.title,
      clubName: newEvent.clubName,
      clubId: newEvent.clubName.replace(/\s+/g, '_').toLowerCase(),
      location: newEvent.location,
      startTime: Timestamp.fromDate(startDate),
      endTime: Timestamp.fromDate(endDate),
      universityId: newEvent.universityId,
      description: newEvent.description,
      tags: newEvent.tags.split(',').map(t => t.trim()).filter(Boolean),
      bannerUrl: newEvent.bannerUrl || '',
      createdBy: auth.currentUser?.uid || 'admin',
    };

    if (newEvent.expiration !== 'none') {
      const expirationDate = new Date();
      expirationDate.setDate(expirationDate.getDate() + parseInt(newEvent.expiration, 10));
      eventPayload.expiresAt = Timestamp.fromDate(expirationDate);
    } else {
      // If none, make sure we remove expiresAt if editing
      eventPayload.expiresAt = null;
    }

    try {
      if (editingEvent) {
        await updateEventMetadata(editingEvent.id, eventPayload);
        toast.success('Event updated!');
      } else {
        await createEvent(eventPayload);
        toast.success('Event created!');
      }
      setIsAddDialogOpen(false);
      resetForm();
    } catch (err) {
      toast.error('Error saving event');
    }
  };

  const handleToggleMetadata = async (eventId: string, key: 'isFeatured' | 'isTrending' | 'isSponsored', currentVal: boolean) => {
    try {
      await updateEventMetadata(eventId, { [key]: !currentVal });
      toast.success(`Updated ${key}`);
    } catch (err) {
      toast.error('Update failed');
    }
  };

  const handleDelete = async (eventId: string) => {
    if (window.confirm('Are you sure?')) {
      try {
        await deleteEvent(eventId);
        toast.success('Event deleted');
      } catch (err) {
        toast.error('Delete failed');
      }
    }
  };

  const filteredEvents = events.filter(e => {
    const matchesSearch = (e.title || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
                          (e.clubName || '').toLowerCase().includes(searchTerm.toLowerCase());
    
    if (filterTab === 'all') return matchesSearch;
    if (filterTab === 'featured') return matchesSearch && e.isFeatured;
    if (filterTab === 'trending') return matchesSearch && e.isTrending;
    if (filterTab === 'sponsored') return matchesSearch && e.isSponsored;
    return matchesSearch;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-6">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-2xl font-bold text-slate-900">Campus Events</h2>
            <p className="text-sm text-slate-500">Create and manage your university activities</p>
          </div>
          <Dialog open={isAddDialogOpen} onOpenChange={(open) => { setIsAddDialogOpen(open); if (!open) { resetForm(); } }}>
            <DialogTrigger asChild>
              <Button className="rounded-xl gap-2 bg-sky-500 hover:bg-sky-600 shadow-lg shadow-sky-100 px-6 py-6">
                <Plus size={20} />
                <span className="font-bold">Add New Event</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[550px] rounded-3xl max-h-[90vh] overflow-y-auto p-0 border-none shadow-2xl">
              <div className="p-6 bg-slate-50 border-b border-slate-100 sticky top-0 z-10">
                <DialogTitle className="text-xl font-bold text-slate-900">{editingEvent ? 'Edit Event' : 'Launch New Event'}</DialogTitle>
                <p className="text-sm text-slate-500 mt-1">Fill in the details to publish your event</p>
              </div>
              <form onSubmit={handleCreateEvent} className="p-6 space-y-6">
                {/* Banner Upload */}
                <div className="space-y-3">
                  <Label className="text-sm font-bold text-slate-700">Event Cover Image</Label>
                  <div 
                    onClick={() => fileInputRef.current?.click()}
                    className="relative group cursor-pointer rounded-2xl border-2 border-dashed border-slate-200 hover:border-sky-400 transition-all duration-300 overflow-hidden bg-slate-50 min-h-[160px]"
                  >
                    {bannerPreview || newEvent.bannerUrl ? (
                      <div className="relative aspect-video">
                        <img 
                          src={bannerPreview || newEvent.bannerUrl} 
                          alt="Banner preview" 
                          className="w-full h-full object-cover" 
                        />
                        <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <div className="px-4 py-2 bg-white rounded-full text-slate-900 text-xs font-bold flex items-center gap-2">
                            <Upload size={14} /> Change Image
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-10 gap-3">
                        {uploading ? (
                          <div className="flex flex-col items-center gap-2">
                            <div className="animate-spin rounded-full h-10 w-10 border-4 border-sky-500 border-t-transparent" />
                            <p className="text-xs font-bold text-sky-600">Uploading to cloud...</p>
                          </div>
                        ) : (
                          <>
                            <div className="p-4 rounded-full bg-sky-50 text-sky-500">
                              <Upload size={28} />
                            </div>
                            <div className="text-center">
                              <p className="text-sm font-bold text-slate-700">Drop your banner here</p>
                              <p className="text-xs text-slate-400 mt-1">Recommended: 16:9 Aspect Ratio</p>
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                  <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleBannerUpload} />
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase text-slate-400">Target University</Label>
                  <Select value={newEvent.universityId} onValueChange={(val) => setNewEvent({...newEvent, universityId: val})}>
                    <SelectTrigger className="rounded-xl border-slate-200">
                      <SelectValue placeholder="Select University" />
                    </SelectTrigger>
                    <SelectContent className="bg-white">
                      {UNIVERSITY_LIST.map(uni => (
                        <SelectItem key={uni.id} value={uni.id}>{uni.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase text-slate-400">Event Title</Label>
                    <Input className="rounded-xl border-slate-200 focus:ring-sky-500" value={newEvent.title} onChange={e => setNewEvent({...newEvent, title: e.target.value})} placeholder="e.g. Annual Tech Fest" required />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase text-slate-400">Organizer / Club</Label>
                    <Input className="rounded-xl border-slate-200" value={newEvent.clubName} onChange={e => setNewEvent({...newEvent, clubName: e.target.value})} placeholder="e.g. GDSC VIT" required />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase text-slate-400">Venue</Label>
                    <Input className="rounded-xl border-slate-200" value={newEvent.location} onChange={e => setNewEvent({...newEvent, location: e.target.value})} placeholder="e.g. SJT Ground" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase text-slate-400">Date & Time</Label>
                    <Input className="rounded-xl border-slate-200" type="datetime-local" value={newEvent.startTime} onChange={e => setNewEvent({...newEvent, startTime: e.target.value})} required />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase text-slate-400">About Event</Label>
                  <textarea
                    value={newEvent.description}
                    onChange={e => setNewEvent({...newEvent, description: e.target.value})}
                    rows={3}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all resize-none"
                    placeholder="Provide a brief description..."
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase text-slate-400">Tags (Separated by commas)</Label>
                    <Input className="rounded-xl border-slate-200" value={newEvent.tags} onChange={e => setNewEvent({...newEvent, tags: e.target.value})} placeholder="tech, workshop, food, free" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase text-slate-400">Auto Expiration</Label>
                    <Select value={newEvent.expiration} onValueChange={(val) => setNewEvent({...newEvent, expiration: val})}>
                      <SelectTrigger className="rounded-xl border-slate-200">
                        <SelectValue placeholder="Select Expiration" />
                      </SelectTrigger>
                      <SelectContent className="bg-white">
                        <SelectItem value="none">No Expiration</SelectItem>
                        <SelectItem value="1">Expire in 1 day</SelectItem>
                        <SelectItem value="2">Expire in 2 days</SelectItem>
                        <SelectItem value="7">Expire in 7 days</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <Button type="submit" disabled={uploading} className="w-full h-14 bg-slate-900 hover:bg-black text-white rounded-2xl font-bold shadow-xl transition-all">
                  {uploading ? 'Processing...' : editingEvent ? 'Save Changes' : 'Publish Event'}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Toolbar Section */}
        <div className="flex flex-col md:flex-row md:items-center gap-4 bg-white p-2 rounded-2xl border border-slate-100">
          <div className="flex-1 flex gap-1 p-1 bg-slate-50 rounded-xl">
            {(['all', 'featured', 'trending', 'sponsored'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setFilterTab(tab)}
                className={`flex-1 py-2 px-4 rounded-lg text-sm font-bold capitalize transition-all ${
                  filterTab === tab ? 'bg-white text-sky-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          <div className="relative w-full md:w-56">
            <Select value={targetUniversity} onValueChange={setTargetUniversity}>
              <SelectTrigger className="rounded-xl border-slate-200 h-11 bg-slate-50">
                <SelectValue placeholder="All Universities" />
              </SelectTrigger>
              <SelectContent className="bg-white">
                <SelectItem value="all">All Universities</SelectItem>
                {UNIVERSITY_LIST.map(uni => (
                  <SelectItem key={uni.id} value={uni.id}>{uni.shortName}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="relative w-full md:w-80">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <Input 
              className="pl-11 bg-slate-50 border-none rounded-xl h-11 focus:ring-2 focus:ring-sky-500/20" 
              placeholder="Search by title or club..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Grid Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          // Skeleton Loading
          Array(6).fill(0).map((_, i) => (
            <div key={i} className="bg-white rounded-3xl p-4 space-y-4 border border-slate-50">
              <div className="w-full aspect-video bg-slate-100 animate-pulse rounded-2xl" />
              <div className="h-6 bg-slate-100 animate-pulse rounded-lg w-3/4" />
              <div className="h-4 bg-slate-100 animate-pulse rounded-lg w-1/2" />
            </div>
          ))
        ) : filteredEvents.length > 0 ? (
          filteredEvents.map((event) => (
            <Card key={event.id} className="group border-none shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 rounded-[32px] bg-white overflow-hidden">
              <div className="relative aspect-video overflow-hidden">
                {(event.bannerUrl || (event as any).imageUrl) ? (
                  <img 
                    src={event.bannerUrl || (event as any).imageUrl} 
                    alt={event.title} 
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
                  />
                ) : (
                  <div className="w-full h-full bg-slate-100 flex items-center justify-center text-slate-300">
                    <ImageIcon size={40} />
                  </div>
                )}
                <div className="absolute top-4 left-4 flex flex-wrap gap-2">
                  {event.isFeatured && <Badge className="bg-amber-500/90 backdrop-blur-md text-white border-none py-1 px-3">Featured</Badge>}
                  {event.isTrending && <Badge className="bg-rose-500/90 backdrop-blur-md text-white border-none py-1 px-3">Trending</Badge>}
                  {event.isSponsored && <Badge className="bg-sky-500/90 backdrop-blur-md text-white border-none py-1 px-3">Sponsored</Badge>}
                </div>
              </div>
              <CardContent className="p-6">
                <div className="flex justify-between items-start gap-4">
                  <div className="space-y-1 flex-1">
                    <h3 className="text-lg font-bold text-slate-900 line-clamp-1">{event.title}</h3>
                    <p className="text-sm font-medium text-sky-600">{event.clubName}</p>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="rounded-full hover:bg-slate-100">
                        <MoreVertical size={20} className="text-slate-400" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56 rounded-2xl p-2 shadow-2xl border-slate-100">
                      <DropdownMenuItem onClick={() => openEditDialog(event)} className="rounded-xl p-3">
                        <Edit size={16} className="mr-3" /> Edit Details
                      </DropdownMenuItem>
                      <div className="h-px bg-slate-100 my-2" />
                      <DropdownMenuItem onClick={() => handleToggleMetadata(event.id, 'isFeatured', !!event.isFeatured)} className="rounded-xl p-3">
                        <Star size={16} className={`mr-3 ${event.isFeatured ? 'fill-amber-400 text-amber-400' : ''}`} /> {event.isFeatured ? 'Unmark Featured' : 'Make Featured'}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleToggleMetadata(event.id, 'isTrending', !!event.isTrending)} className="rounded-xl p-3">
                        <TrendingUp size={16} className={`mr-3 ${event.isTrending ? 'text-rose-500' : ''}`} /> {event.isTrending ? 'Unmark Trending' : 'Make Trending'}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleToggleMetadata(event.id, 'isSponsored', !!event.isSponsored)} className="rounded-xl p-3">
                        <ShieldCheck size={16} className={`mr-3 ${event.isSponsored ? 'text-sky-500' : ''}`} /> {event.isSponsored ? 'Unmark Sponsored' : 'Make Sponsored'}
                      </DropdownMenuItem>
                      <div className="h-px bg-slate-100 my-2" />
                      <DropdownMenuItem className="text-rose-600 focus:text-rose-600 rounded-xl p-3" onClick={() => handleDelete(event.id)}>
                        <Trash2 size={16} className="mr-3" /> Delete Permanently
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                
                <div className="mt-4 pt-4 border-t border-slate-50 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-slate-400">
                    <CalendarIcon size={14} />
                    <span className="text-[11px] font-bold uppercase tracking-wider">
                      {event.createdAt?.toDate?.().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) || 'Just now'}
                    </span>
                  </div>
                  <div className="flex -space-x-2">
                    {Array(3).fill(0).map((_, i) => (
                      <div key={i} className="w-7 h-7 rounded-full border-2 border-white bg-slate-100 flex items-center justify-center text-[8px] font-bold text-slate-400">
                        {i === 2 ? `+${event.stats?.attending || 0}` : ''}
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <div className="col-span-full py-20 flex flex-col items-center justify-center text-center">
            <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center text-slate-200 mb-4">
              <CalendarIcon size={40} />
            </div>
            <h3 className="text-xl font-bold text-slate-900">No events found</h3>
            <p className="text-slate-500 mt-1">Try adjusting your filters or search term</p>
            <Button variant="outline" className="mt-6 rounded-xl border-slate-200" onClick={() => { setFilterTab('all'); setSearchTerm(''); }}>
              Clear all filters
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
