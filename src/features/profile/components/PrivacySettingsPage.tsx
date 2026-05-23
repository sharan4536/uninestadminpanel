import React, { useState, useEffect } from 'react';
import { Button } from '../../../components/ui/button';
import { Switch } from '../../../components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../../components/ui/dialog';
import { toast } from 'sonner';
import { isFirebaseConfigured, auth } from '../../../utils/firebase/client';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { deleteUser } from 'firebase/auth';
import { ExternalLink, Trash2, Mail, FileText, ShieldAlert } from 'lucide-react';
import { db } from '../../../utils/firebase/client';

interface PrivacySettings {
  ghostMode: boolean;
  locationVisible: boolean;
  onlineStatusVisible: boolean;
  discoverVisible: boolean;
  timetableVisible: boolean;
}

export function PrivacySettingsPage() {
  const [settings, setSettings] = useState<PrivacySettings>({
    ghostMode: localStorage.getItem('ghostMode') === 'on',
    locationVisible: localStorage.getItem('locationVisible') !== 'off',
    onlineStatusVisible: localStorage.getItem('onlineStatusVisible') !== 'off',
    discoverVisible: localStorage.getItem('discoverVisible') !== 'off',
    timetableVisible: localStorage.getItem('timetableVisible') !== 'off',
  });
  const [loading, setLoading] = useState(false);

  type PolicyType = 'privacy' | 'terms' | 'community' | null;
  const [openPolicy, setOpenPolicy] = useState<PolicyType>(null);

  const getPolicyUrl = (type: PolicyType) => {
    switch(type) {
      case 'privacy': return '/privacy.html';
      case 'terms': return '/terms.html';
      case 'community': return '/community.html';
      default: return '';
    }
  };

  const getPolicyTitle = (type: PolicyType) => {
    switch(type) {
      case 'privacy': return 'Privacy Policy';
      case 'terms': return 'Terms & Conditions';
      case 'community': return 'Community Guidelines';
      default: return '';
    }
  };

  useEffect(() => {
    const loadSettings = async () => {
      if (!isFirebaseConfigured || !auth.currentUser) return;

      try {
        const userRef = doc(db, 'users', auth.currentUser.uid);
        const snap = await getDoc(userRef);
        if (snap.exists() && snap.data().privacySettings) {
          const dbSettings = snap.data().privacySettings;
          setSettings((prev) => ({ ...prev, ...dbSettings }));
        }
      } catch (error) {
        console.error('Error loading privacy settings:', error);
      }
    };

    loadSettings();
  }, []);

  const handleToggle = async (key: keyof PrivacySettings) => {
    const newSettings = { ...settings, [key]: !settings[key] };
    setSettings(newSettings);
    localStorage.setItem(key, newSettings[key] ? 'on' : 'off');

    // Save to Firestore
    if (isFirebaseConfigured && auth.currentUser) {
      try {
        const userRef = doc(db, 'users', auth.currentUser.uid);
        await updateDoc(userRef, {
          privacySettings: newSettings,
          updatedAt: new Date(),
        });
        
        try {
          const profileRef = doc(db, 'profiles', auth.currentUser.uid);
          await updateDoc(profileRef, {
            privacySettings: newSettings
          });
        } catch (e) {
          // If profile doc doesn't exist yet, it's fine, we catch it
        }

        toast.success('Settings updated');
      } catch (error) {
        console.error('Error saving privacy settings:', error);
        toast.error('Failed to update settings');
      }
    }
  };

  const handleDeleteAccount = async () => {
    if (!auth.currentUser) return;
    const confirmed = window.confirm(
      "Are you sure you want to delete your account? This action cannot be undone."
    );
    if (!confirmed) return;

    try {
      await deleteUser(auth.currentUser);
      toast.success('Account deleted successfully.');
      // The auth state change listener will handle the redirect to login
    } catch (error: any) {
      console.error('Error deleting account:', error);
      if (error.code === 'auth/requires-recent-login') {
        toast.error('Please log out and log back in to delete your account.');
      } else {
        toast.error('Failed to delete account. Please try again.');
      }
    }
  };

  const settingsList = [
    {
      key: 'ghostMode' as const,
      title: 'Ghost Mode',
      description: 'Completely hidden from all features. No location, status, or activity visible.',
      isMain: true,
    },
    {
      key: 'locationVisible' as const,
      title: 'Location Visibility',
      description: 'Friends can see your location on the map. Does not affect Ghost Mode.',
    },
    {
      key: 'onlineStatusVisible' as const,
      title: 'Online Status',
      description: 'Show when you\'re active in the app and your last seen time.',
    },
    {
      key: 'discoverVisible' as const,
      title: 'Show in Discover',
      description: 'Appear in buddy matching and event suggestions for other users.',
    },
    {
      key: 'timetableVisible' as const,
      title: 'Timetable Visibility',
      description: 'Friends can see your class schedule and "You\'re Free" indicators.',
    },
  ];

  return (
    <div className="space-y-6 pb-20">
      {/* Header */}
      <div className="sticky top-0 bg-white/95 backdrop-blur-sm px-4 py-4 border-b border-gray-100 z-10 text-center">
        <h1 className="text-xl font-semibold text-gray-900">Privacy & Visibility</h1>
        <p className="text-sm text-gray-500 mt-1">Control how you appear in UniNest</p>
      </div>

      <div className="px-4 space-y-3">
        {settingsList.map((item) => (
          <Card
            key={item.key}
            className={`${
              item.isMain
                ? 'border-sky-200 bg-sky-50/50'
                : 'border-gray-100 bg-white'
            }`}
          >
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <h3 className={`${item.isMain ? 'font-bold' : 'font-semibold'} text-sm text-gray-900`}>
                    {item.title}
                  </h3>
                  <p className="text-xs text-gray-600 mt-1 leading-relaxed">
                    {item.description}
                  </p>
                </div>
                <Switch
                  checked={settings[item.key]}
                  onCheckedChange={() => handleToggle(item.key)}
                  disabled={loading}
                />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Explanation */}
      <div className="mx-4 p-4 bg-gray-50 rounded-lg border border-gray-100">
        <p className="text-xs text-gray-600 leading-relaxed">
          <strong>Ghost Mode</strong> is the ultimate privacy toggle. When on, you won't appear
          anywhere in the app – not on the map, in buddy matching, event feeds, or any other feature.
          All other settings are ignored. Turn off Ghost Mode to respect individual privacy toggles.
        </p>
      </div>

      {/* Support & Policies Section */}
      <div className="px-4 mt-8">
        <h2 className="text-sm font-bold text-gray-900 mb-3 px-1 uppercase tracking-wide">Support & Policies</h2>
        <div className="bg-white rounded-[1.5rem] border border-gray-100 overflow-hidden shadow-sm">
          <button
            type="button"
            onClick={() => setOpenPolicy('privacy')}
            className="w-full flex items-center justify-between px-4 py-3.5 text-left hover:bg-gray-50 transition border-b border-gray-50"
          >
            <div className="flex items-center gap-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-sky-50 text-sky-600">
                <ShieldAlert className="h-4 w-4" />
              </span>
              <span className="text-sm font-semibold text-gray-800">Privacy Policy</span>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setOpenPolicy('terms')}
            className="w-full flex items-center justify-between px-4 py-3.5 text-left hover:bg-gray-50 transition border-b border-gray-50"
          >
            <div className="flex items-center gap-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-sky-50 text-sky-600">
                <FileText className="h-4 w-4" />
              </span>
              <span className="text-sm font-semibold text-gray-800">Terms & Conditions</span>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setOpenPolicy('community')}
            className="w-full flex items-center justify-between px-4 py-3.5 text-left hover:bg-gray-50 transition border-b border-gray-50"
          >
            <div className="flex items-center gap-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-sky-50 text-sky-600">
                <FileText className="h-4 w-4" />
              </span>
              <span className="text-sm font-semibold text-gray-800">Community Guidelines</span>
            </div>
          </button>

          <a
            href="mailto:support@uninest.edu"
            className="flex items-center justify-between px-4 py-3.5 text-left hover:bg-gray-50 transition border-b border-gray-50"
          >
            <div className="flex items-center gap-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                <Mail className="h-4 w-4" />
              </span>
              <span className="text-sm font-semibold text-gray-800">Contact Support</span>
            </div>
            <ExternalLink className="h-4 w-4 text-gray-400" />
          </a>

          <button
            type="button"
            onClick={handleDeleteAccount}
            className="w-full flex items-center justify-between px-4 py-3.5 text-left hover:bg-rose-50 transition"
          >
            <div className="flex items-center gap-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-rose-50 text-rose-600">
                <Trash2 className="h-4 w-4" />
              </span>
              <div>
                <span className="text-sm font-semibold text-rose-600 block">Delete Account</span>
                <span className="text-xs text-slate-500 block">Permanently erase your data</span>
              </div>
            </div>
          </button>
        </div>
      </div>

      <Dialog open={!!openPolicy} onOpenChange={(open) => !open && setOpenPolicy(null)}>
        <DialogContent className="max-w-3xl w-[90vw] h-[85vh] flex flex-col p-0 overflow-hidden bg-white rounded-[2rem] border-0 shadow-2xl">
          <DialogHeader className="px-6 py-4 border-b border-slate-100 flex-shrink-0">
            <DialogTitle className="text-xl font-bold font-['Plus_Jakarta_Sans']">{getPolicyTitle(openPolicy)}</DialogTitle>
          </DialogHeader>
          <div className="flex-1 bg-slate-50/50 p-0 overflow-hidden">
            {openPolicy && (
              <iframe 
                src={getPolicyUrl(openPolicy)} 
                className="w-full h-full border-0 bg-white"
                title={getPolicyTitle(openPolicy)}
              />
            )}
          </div>
          <div className="px-6 py-4 border-t border-slate-100 flex justify-end flex-shrink-0 bg-white">
            <Button onClick={() => setOpenPolicy(null)} className="rounded-xl px-8 h-10 font-bold bg-[#006286] hover:bg-[#004e6c] text-white">
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
