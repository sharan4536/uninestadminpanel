import React, { useState, useEffect, useRef, Fragment, ChangeEvent, FormEvent } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapContainer, TileLayer, Marker, Circle, useMapEvents } from 'react-leaflet';
import { 
  Plus, 
  Search, 
  Megaphone, 
  MapPin, 
  Eye, 
  MousePointer2, 
  Calendar as CalendarIcon,
  Trash2,
  MoreVertical,
  Upload,
  X,
  Target,
  BarChart3,
  MousePointerClick,
  Edit
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Badge } from '../../../components/ui/badge';
import { 
  getAllAdsRealtime,
  deleteAdvertisement, 
  createAdvertisement,
  updateAdvertisement,
  type Advertisement 
} from '../../../utils/firebase/firestore';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '../../../components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../../../components/ui/dialog';
import { Label } from '../../../components/ui/label';
import { Timestamp } from 'firebase/firestore';
import { auth, storage } from '../../../utils/firebase/client';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { toast } from 'sonner';
import { UNIVERSITY_LIST } from '../../../config/universities';

// Fix Leaflet marker icon
// @ts-ignore
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Component to handle map clicks
function MapClickHandler({ onClick }: { onClick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click: (e) => {
      onClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

// Component to dynamically update map center
function MapUpdater({ center }: { center: [number, number] }) {
  const map = useMapEvents({});
  useEffect(() => {
    map.setView(center, map.getZoom());
  }, [center, map]);
  return null;
}

export function AdManagement() {
  const [ads, setAds] = useState<Advertisement[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [bannerPreview, setBannerPreview] = useState<string | null>(null);
  const [editingAd, setEditingAd] = useState<Advertisement | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Ad Creation State
  const [newAd, setNewAd] = useState({
    title: '',
    brandName: '',
    description: '',
    imageUrl: '',
    ctaLink: '',
    lat: 12.969728,
    lng: 79.160694,
    radius: 500,
    type: 'in-campus' as 'in-campus' | 'out-campus',
    targetUniversityId: ''
  });

  useEffect(() => {
    setLoading(true);
    const unsubscribe = getAllAdsRealtime((data) => {
      setAds(data);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleBannerUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Preview immediately
    const reader = new FileReader();
    reader.onloadend = () => setBannerPreview(reader.result as string);
    reader.readAsDataURL(file);

    if (storage) {
      try {
        setUploading(true);
        const path = `ad_banners/${Date.now()}_${file.name}`;
        const storageRef = ref(storage, path);
        console.log('[AdUpload] Attempting upload to:', path);
        
        const snapshot = await uploadBytes(storageRef, file, { contentType: file.type });
        console.log('[AdUpload] Upload complete!');
        
        const url = await getDownloadURL(snapshot.ref);
        console.log('[AdUpload] Download URL obtained:', url);
        
        setNewAd(prev => ({ ...prev, imageUrl: url }));
        toast.success('Ad image uploaded!');
      } catch (err: any) {
        console.error('[AdUpload] Cloud upload failed:', err?.code, err?.message);
        
        // Fallback: use base64 data URL
        const fallbackReader = new FileReader();
        fallbackReader.onloadend = () => {
          const dataUrl = fallbackReader.result as string;
          setNewAd(prev => ({ ...prev, imageUrl: dataUrl }));
          toast.warning('Cloud upload failed — using embedded image instead.');
        };
        fallbackReader.readAsDataURL(file);
      } finally {
        setUploading(false);
      }
    } else {
      // Fallback: use base64 data URL
      const fallbackReader = new FileReader();
      fallbackReader.onloadend = () => {
        const dataUrl = fallbackReader.result as string;
        setNewAd(prev => ({ ...prev, imageUrl: dataUrl }));
        toast.warning('Firebase Storage unavailable — using embedded image.');
      };
      fallbackReader.readAsDataURL(file);
    }

    if (fileInputRef.current) fileInputRef.current.value = '';
  };
  const handleCreateAd = async (e: FormEvent) => {
    e.preventDefault();
    if (!newAd.title || !newAd.brandName) {
      toast.error('Please fill in all mandatory fields (Title and Brand Name)');
      return;
    }

    const adPayload: Omit<Advertisement, 'id' | 'createdAt' | 'stats'> = {
      title: newAd.title,
      brandName: newAd.brandName,
      description: newAd.description,
      imageUrl: newAd.imageUrl,
      ctaLink: newAd.ctaLink,
      ctaText: 'Visit Now',
      type: newAd.type,
      location: {
        lat: newAd.lat,
        lng: newAd.lng,
        name: newAd.brandName
      },
      radius: newAd.radius,
      startDate: editingAd?.startDate || Timestamp.now(),
      endDate: editingAd?.endDate || Timestamp.fromDate(new Date(Date.now() + 30 * 24 * 3600 * 1000)),
      status: editingAd?.status || 'active',
      createdBy: editingAd?.createdBy || auth.currentUser?.uid || 'admin',
      targetUniversityId: newAd.targetUniversityId || undefined
    };

    try {
      if (editingAd) {
        await updateAdvertisement(editingAd.id!, adPayload);
        toast.success('Ad campaign updated successfully!');
      } else {
        await createAdvertisement(adPayload);
        toast.success('Ad campaign launched successfully!');
      }
      setIsAddDialogOpen(false);
      resetForm();
    } catch (err) {
      toast.error('Failed to save advertisement');
    }
  };

  const openEditDialog = (ad: Advertisement) => {
    setEditingAd(ad);
    setNewAd({
      title: ad.title,
      brandName: ad.brandName,
      description: ad.description || '',
      imageUrl: ad.imageUrl,
      ctaLink: ad.ctaLink || '',
      lat: ad.location.lat,
      lng: ad.location.lng,
      radius: ad.radius,
      type: ad.type,
      targetUniversityId: ad.targetUniversityId || ''
    });
    setBannerPreview(ad.imageUrl);
    setIsAddDialogOpen(true);
  };

  const resetForm = () => {
    setNewAd({
      title: '', brandName: '', description: '', imageUrl: '', ctaLink: '',
      lat: 12.969728, lng: 79.160694, radius: 500, type: 'in-campus', targetUniversityId: ''
    });
    setBannerPreview(null);
    setEditingAd(null);
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Delete this ad?')) {
      await deleteAdvertisement(id);
      toast.success('Ad deleted');
    }
  };

  const filteredAds = ads.filter(a => 
    (a.title || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
    (a.brandName || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* ── Interactive Map Section (Top) ────────────────────────────────── */}
      <Card className="border-none shadow-xl rounded-[32px] overflow-hidden bg-white">
        <CardHeader className="bg-slate-900 text-white p-6">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <CardTitle className="text-xl font-bold flex items-center gap-2">
                <Target size={22} className="text-orange-400" />
                Live Ad Placement Map
              </CardTitle>
              <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">Tap anywhere to drop a new ad campaign</p>
              <div className="mt-2">
                <select 
                  className="bg-slate-800 border border-slate-700 text-white text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-orange-500"
                  value={newAd.targetUniversityId}
                  onChange={(e) => {
                    const uniId = e.target.value;
                    const uni = UNIVERSITY_LIST.find(u => u.id === uniId);
                    if (uni) {
                      setNewAd(p => ({ ...p, targetUniversityId: uniId, lat: uni.mapCenter[0], lng: uni.mapCenter[1] }));
                    } else {
                      setNewAd(p => ({ ...p, targetUniversityId: '' }));
                    }
                  }}
                >
                  <option value="">All Universities / Global</option>
                  {UNIVERSITY_LIST.map(uni => (
                    <option key={uni.id} value={uni.id}>{uni.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="text-right">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Selected Lat</p>
                <p className="text-sm font-mono text-orange-400">{newAd.lat.toFixed(6)}</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Selected Lng</p>
                <p className="text-sm font-mono text-orange-400">{newAd.lng.toFixed(6)}</p>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0 relative h-[400px]">
          <MapContainer 
            center={[newAd.lat, newAd.lng]} 
            zoom={15} 
            className="h-full w-full z-0"
          >
            <MapUpdater center={[newAd.lat, newAd.lng]} />
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            <MapClickHandler onClick={(lat, lng) => setNewAd(p => ({ ...p, lat, lng }))} />
            
            {/* New Ad Preview Marker */}
            <Marker position={[newAd.lat, newAd.lng]} />
            <Circle 
              center={[newAd.lat, newAd.lng]} 
              radius={newAd.radius} 
              pathOptions={{ fillColor: '#f97316', color: '#f97316', fillOpacity: 0.15 }} 
            />

            {/* Existing Ads Markers */}
            {ads.map(ad => (
              <Fragment key={ad.id}>
                <Marker position={[ad.location.lat, ad.location.lng]} opacity={0.5} />
                <Circle 
                  center={[ad.location.lat, ad.location.lng]} 
                  radius={ad.radius} 
                  pathOptions={{ fillColor: '#38bdf8', color: '#38bdf8', fillOpacity: 0.05, weight: 1 }} 
                />
              </Fragment>
            ))}
          </MapContainer>
          
          {/* Map Floating Controls */}
          {!isAddDialogOpen && (
            <div className="absolute bottom-6 right-6 z-[1000] space-y-4 w-64">
              <div className="bg-white/90 backdrop-blur-md p-4 rounded-3xl shadow-2xl border border-white/50">
                <Label className="text-[10px] font-bold uppercase text-slate-500 mb-3 block">Adjust Radius: {newAd.radius}m</Label>
                <input 
                  type="range" 
                  min="100" 
                  max="5000" 
                  step="100"
                  value={newAd.radius}
                  onChange={(e) => setNewAd(p => ({ ...p, radius: Number(e.target.value) }))}
                  className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-orange-500"
                />
                <div className="flex justify-between mt-1 text-[10px] font-bold text-slate-400">
                  <span>100m</span>
                  <span>5km</span>
                </div>
              </div>
              <Button 
                onClick={() => setIsAddDialogOpen(true)}
                className="w-full py-6 bg-orange-500 hover:bg-orange-600 text-white rounded-3xl font-bold shadow-xl shadow-orange-200 flex items-center justify-center gap-2"
              >
                <Plus size={20} /> Create Ad Here
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Analytics & Search Row ──────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="md:col-span-2 border-none shadow-sm rounded-3xl bg-white p-2">
          <div className="flex items-center gap-4 px-4 py-2">
            <Search className="text-slate-400" size={20} />
            <Input 
              className="border-none bg-transparent focus-visible:ring-0 text-slate-600 font-medium" 
              placeholder="Search by brand or campaign title..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </Card>
        <div className="flex items-center gap-4">
           <div className="flex-1 bg-white p-4 rounded-3xl border border-slate-50 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total Ads</p>
                <p className="text-xl font-black text-slate-900">{ads.length}</p>
              </div>
              <div className="p-3 bg-sky-50 text-sky-600 rounded-2xl">
                <Megaphone size={20} />
              </div>
           </div>
        </div>
      </div>

      {/* ── Ads Listing ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4">
        {loading ? (
          Array(3).fill(0).map((_, i) => (
            <div key={i} className="h-32 w-full bg-white animate-pulse rounded-3xl" />
          ))
        ) : filteredAds.length > 0 ? (
          filteredAds.map(ad => (
            <Card key={ad.id} className="border-none shadow-sm rounded-[32px] overflow-hidden bg-white hover:shadow-xl transition-all duration-300 group">
              <CardContent className="p-0 flex flex-col md:flex-row">
                {/* Visual */}
                <div className="w-full md:w-64 h-48 md:h-auto overflow-hidden relative shrink-0">
                  {ad.imageUrl ? (
                    <img src={ad.imageUrl} alt={ad.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                  ) : (
                    <div className="w-full h-full bg-slate-50 flex items-center justify-center text-slate-300">
                      <Target size={40} />
                    </div>
                  )}
                  <div className="absolute top-4 left-4">
                    <Badge className="bg-white/90 backdrop-blur-md text-slate-900 border-none font-bold shadow-sm">
                      {ad.type === 'in-campus' ? '🏫 Campus' : '🌍 Outside'}
                    </Badge>
                  </div>
                </div>

                {/* Content */}
                <div className="flex-1 p-6 flex flex-col justify-between">
                  <div>
                    <div className="flex justify-between items-start">
                      <div className="space-y-1">
                        <h3 className="text-xl font-extrabold text-slate-900">{ad.title}</h3>
                        <p className="text-sm font-bold text-orange-500 uppercase tracking-wider">{ad.brandName}</p>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="rounded-full">
                            <MoreVertical size={20} className="text-slate-400" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="rounded-2xl p-2 w-48 shadow-2xl border-none">
                          <DropdownMenuItem onClick={() => openEditDialog(ad)} className="rounded-xl p-3">
                            <Edit size={16} className="mr-3" /> Edit Campaign
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => handleDelete(ad.id!)}
                            className="text-rose-600 focus:text-rose-600 rounded-xl p-3"
                          >
                            <Trash2 size={16} className="mr-3" /> Delete Ad
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    <p className="text-sm text-slate-500 mt-2 line-clamp-2">{ad.description}</p>
                  </div>

                  <div className="mt-6 flex flex-wrap items-center gap-6 border-t border-slate-50 pt-4">
                    <div className="flex items-center gap-2">
                      <div className="p-2 bg-sky-50 text-sky-600 rounded-xl"><Eye size={14} /></div>
                      <div>
                        <p className="text-sm font-black text-slate-900">{(ad.stats?.impressions || 0).toLocaleString()}</p>
                        <p className="text-[9px] font-bold text-slate-400 uppercase">Impressions</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="p-2 bg-orange-50 text-orange-600 rounded-xl"><MousePointerClick size={14} /></div>
                      <div>
                        <p className="text-sm font-black text-slate-900">{(ad.stats?.clicks || 0).toLocaleString()}</p>
                        <p className="text-[9px] font-bold text-slate-400 uppercase">Clicks</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl"><BarChart3 size={14} /></div>
                      <div>
                        <p className="text-sm font-black text-emerald-600">
                          {ad.stats?.impressions > 0 ? ((ad.stats.clicks / ad.stats.impressions) * 100).toFixed(1) : '0.0'}%
                        </p>
                        <p className="text-[9px] font-bold text-slate-400 uppercase">CTR</p>
                      </div>
                    </div>
                    <div className="flex-1 flex justify-end gap-2 text-xs font-bold text-slate-400">
                      <MapPin size={12} /> {ad.radius}m Radius
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <div className="col-span-full py-20 flex flex-col items-center justify-center text-center">
             <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center text-slate-200 mb-4">
              <Megaphone size={40} />
            </div>
            <h3 className="text-xl font-bold text-slate-900">No campaigns found</h3>
            <p className="text-slate-500 mt-1">Tap the map above to launch your first ad</p>
          </div>
        )}
      </div>

      {/* Ad Creation Dialog (Simplified since map handles location) */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="sm:max-w-[500px] rounded-3xl p-0 border-none overflow-hidden">
          <div className="bg-orange-500 p-6 text-white">
            <DialogTitle className="text-xl font-bold">{editingAd ? 'Edit Ad Campaign' : 'New Ad Campaign'}</DialogTitle>
            <p className="text-white/80 text-sm mt-1">
              {editingAd ? `Modifying campaign at ${newAd.lat.toFixed(4)}, ${newAd.lng.toFixed(4)}` : `Launching at ${newAd.lat.toFixed(4)}, ${newAd.lng.toFixed(4)}`}
            </p>
          </div>
          <form onSubmit={handleCreateAd} className="p-6 space-y-6 bg-white">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase text-slate-400">Ad Image</Label>
                <div 
                  onClick={() => fileInputRef.current?.click()}
                  className="relative h-32 rounded-2xl border-2 border-dashed border-slate-100 flex flex-col items-center justify-center cursor-pointer hover:bg-slate-50 transition-all overflow-hidden"
                >
                   {bannerPreview || newAd.imageUrl ? (
                      <img src={bannerPreview || newAd.imageUrl} className="w-full h-full object-cover" />
                   ) : (
                      <div className="text-center">
                        <Upload size={20} className="mx-auto text-slate-300 mb-2" />
                        <p className="text-[10px] font-bold text-slate-400">UPLOAD BANNER</p>
                      </div>
                   )}
                </div>
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleBannerUpload} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label className="text-xs font-bold uppercase text-slate-400">Campaign Title</Label>
                  <Input value={newAd.title} onChange={e => setNewAd(p => ({...p, title: e.target.value}))} placeholder="Biryani Sale" className="rounded-xl" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-bold uppercase text-slate-400">Brand Name</Label>
                  <Input value={newAd.brandName} onChange={e => setNewAd(p => ({...p, brandName: e.target.value}))} placeholder="Zaitoon" className="rounded-xl" />
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-bold uppercase text-slate-400">Website URL (Learn More)</Label>
                <Input value={newAd.ctaLink} onChange={e => setNewAd(p => ({...p, ctaLink: e.target.value}))} placeholder="https://..." className="rounded-xl" />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-bold uppercase text-slate-400">Description</Label>
                <Input value={newAd.description} onChange={e => setNewAd(p => ({...p, description: e.target.value}))} placeholder="Short promo text..." className="rounded-xl" />
              </div>
            </div>

            <div className="flex gap-4">
              <Button type="button" variant="ghost" onClick={() => { setIsAddDialogOpen(false); resetForm(); }} className="flex-1 rounded-2xl h-12">Cancel</Button>
              <Button 
                type="submit" 
                disabled={uploading}
                className="flex-[2] bg-orange-500 hover:bg-orange-600 text-white rounded-2xl font-bold h-12 shadow-lg shadow-orange-100 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {uploading ? 'Uploading...' : (editingAd ? 'Save Changes' : 'Launch Campaign')}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
