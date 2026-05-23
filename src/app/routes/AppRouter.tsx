import React, { Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { Navigation } from '../../components/common/Navigation';

// Lazy loaded features
const HomePage = React.lazy(() => import('../../features/home/components/HomePage').then(m => ({ default: m.HomePage })));
const ProfilePage = React.lazy(() => import('../../features/profile/components/ProfilePage').then(m => ({ default: m.ProfilePage })));
const DiscoverPage = React.lazy(() => import('../../features/events/components/DiscoverPage').then(m => ({ default: m.DiscoverPage })));
const MessagesPage = React.lazy(() => import('../../features/messaging/components/MessagesPage').then(m => ({ default: m.MessagesPage })));
const TimetablePage = React.lazy(() => import('../../features/timetable/components/TimetablePage').then(m => ({ default: m.TimetablePage })));
const StudyGroupsPage = React.lazy(() => import('../../features/events/components/StudyGroupsPage').then(m => ({ default: m.StudyGroupsPage })));
const FriendProfilePage = React.lazy(() => import('../../features/profile/components/FriendProfilePage').then(m => ({ default: m.FriendProfilePage })));

// Admin feature
const AdminPanel = import.meta.env.VITE_IS_ADMIN_APP === 'true'
  ? React.lazy(() => import('../../features/admin/components/AdminPanel').then(m => ({ default: m.AdminPanel })))
  : () => null;

function PageSkeleton() {
  return (
    <div className="w-full space-y-6 animate-pulse p-4 md:p-0">
      <div className="h-12 bg-slate-200 rounded-2xl w-3/4 mx-auto" />
      <div className="space-y-4">
        <div className="h-48 bg-slate-100 rounded-[32px] w-full" />
        <div className="grid grid-cols-2 gap-4">
          <div className="h-32 bg-slate-100 rounded-3xl w-full" />
          <div className="h-32 bg-slate-100 rounded-3xl w-full" />
        </div>
        <div className="h-64 bg-slate-100 rounded-[32px] w-full" />
      </div>
    </div>
  );
}

function MainLayout({ currentUser, handleLogout, handleProfileUpdate }: any) {
  const navigate = useNavigate();
  // Map old string-based navigation to routes
  const onNavigate = (path: string) => {
    navigate(`/${path}`);
  };

  const onOpenProfile = (user: any) => {
    navigate(`/friend/${user.id}`, { state: { user } });
  };

  return (
    <div className="flex h-[100dvh] w-full flex-col overflow-hidden bg-background text-foreground selection:bg-sky-100 selection:text-sky-900 md:flex-row pt-[env(safe-area-inset-top)] pb-[calc(5rem+env(safe-area-inset-bottom))] md:pb-0">
      <Navigation
        currentPage={window.location.pathname.slice(1) || 'home'}
        setCurrentPage={onNavigate}
        onLogout={handleLogout}
        currentUser={currentUser}
      />
      <main className="relative flex-1 flex flex-col bg-background no-scrollbar overflow-y-auto overflow-x-hidden">
        <div className="w-full max-w-4xl mx-auto px-0 md:px-8 py-0 md:py-8">
          <Suspense fallback={<PageSkeleton />}>
            <Routes>
              <Route path="/" element={<Navigate to="/home" replace />} />
              <Route path="/home" element={<HomePage currentUser={currentUser} onOpenProfile={onOpenProfile} onNavigate={onNavigate} />} />
              <Route path="/profile" element={<ProfilePage currentUser={currentUser} onProfileUpdate={handleProfileUpdate} onLogout={handleLogout} onNavigate={onNavigate} />} />
              <Route path="/discover" element={<DiscoverPage currentUser={currentUser} onOpenProfile={onOpenProfile} onMessage={() => navigate('/messages')} />} />
              <Route path="/timetable" element={<TimetablePage currentUser={currentUser} />} />
              <Route path="/messages" element={<MessagesPage currentUser={currentUser} onOpenProfile={onOpenProfile} onNavigate={onNavigate} />} />
              <Route path="/studygroups" element={<StudyGroupsPage currentUser={currentUser} onBack={() => navigate(-1)} />} />
              <Route path="/friend/:id" element={<FriendProfilePage onBack={() => navigate(-1)} onMessage={() => navigate('/messages')} />} />
              <Route path="/admin" element={<AdminPanel />} />
              <Route path="*" element={<Navigate to="/home" replace />} />
            </Routes>
          </Suspense>
        </div>
      </main>
    </div>
  );
}

import { UserProfile } from '../../utils/firebase/firestore';

interface AppRouterProps {
  currentUser: UserProfile | null;
  handleLogout: () => void;
  handleProfileUpdate: (updatedUser: UserProfile) => void;
}

export function AppRouter({ currentUser, handleLogout, handleProfileUpdate }: AppRouterProps) {
  return (
    <BrowserRouter>
      <MainLayout currentUser={currentUser} handleLogout={handleLogout} handleProfileUpdate={handleProfileUpdate} />
    </BrowserRouter>
  );
}
