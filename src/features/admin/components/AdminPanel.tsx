import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  Calendar, 
  Megaphone, 
  Bell, 
  BarChart3, 
  Users, 
  Settings,
  Eye,
  DollarSign,
  Menu,
  X,
  Radio,
  Flag
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../components/ui/card';
import { Badge } from '../../../components/ui/badge';
import { 
  type Advertisement,
  type CampusEvent,
  type AdminNotification
} from '../../../utils/firebase/firestore';
import { EventManagement } from './EventManagement';
import { AdManagement } from './AdManagement';
import { NotificationManagement } from './NotificationManagement';
import { UserManagement } from './UserManagement';
import { PulseManagement } from './PulseManagement';
import { ReportManagement } from './ReportManagement';
import { SystemSettings } from './SystemSettings';
import { AnalyticsDashboard } from './AnalyticsDashboard';

export function AdminPanel() {
  const [activeTab, setActiveTab] = useState('analytics');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const SidebarItem = ({ id, label, icon: Icon }: { id: string, label: string, icon: any }) => (
    <button
      onClick={() => {
        setActiveTab(id);
        setIsMobileMenuOpen(false);
      }}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
        activeTab === id 
          ? 'bg-sky-500 text-white shadow-lg shadow-sky-200' 
          : 'text-slate-600 hover:bg-slate-50'
      }`}
    >
      <Icon size={20} strokeWidth={activeTab === id ? 2.5 : 2} />
      <span className="font-medium">{label}</span>
    </button>
  );

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden relative">
      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-slate-100 flex flex-col p-6 gap-8 transition-transform duration-300 lg:relative lg:translate-x-0
        ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="flex items-center justify-between px-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-sky-500 flex items-center justify-center text-white shadow-sm">
              <Settings size={20} />
            </div>
            <span className="text-lg font-bold text-slate-800 tracking-tight">Admin Console</span>
          </div>
          <button 
            className="lg:hidden p-2 text-slate-400 hover:text-slate-600"
            onClick={() => setIsMobileMenuOpen(false)}
          >
            <X size={20} />
          </button>
        </div>

        <nav className="flex flex-col gap-2">
          <SidebarItem id="analytics" label="Dashboard" icon={BarChart3} />
          <SidebarItem id="events" label="Events" icon={Calendar} />
          <SidebarItem id="ads" label="Advertisements" icon={Megaphone} />
          <SidebarItem id="notifications" label="Notifications" icon={Bell} />
          <SidebarItem id="pulses" label="User Pulses" icon={Radio} />
          <SidebarItem id="reports" label="Reports" icon={Flag} />
          <SidebarItem id="users" label="User Management" icon={Users} />
          <SidebarItem id="settings" label="System Settings" icon={Settings} />
        </nav>

        <div className="mt-auto flex flex-col gap-3">
          <div className="rounded-xl overflow-hidden border border-sky-100 shadow-sm bg-sky-50/30 p-1">
            <img src="/images/running_penguins.jpg" className="w-full h-16 object-cover rounded-lg" alt="UniNest Mascot" />
          </div>
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">System Status</p>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-sm font-medium text-slate-700">Systems Online</span>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-4 lg:p-8">
        <header className="flex flex-col gap-4 mb-8 lg:flex-row lg:justify-between lg:items-center">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl lg:text-2xl font-bold text-slate-900 capitalize">{activeTab}</h1>
              <p className="text-sm text-slate-500">Manage your campus ecosystem</p>
            </div>
            <button 
              className="lg:hidden p-2 bg-white border border-slate-100 rounded-xl text-slate-600 shadow-sm"
              onClick={() => setIsMobileMenuOpen(true)}
            >
              <Menu size={20} />
            </button>
          </div>
          {/* Search and create controls are provided by each sub-tab */}
        </header>

        {activeTab === 'events' && <EventManagement />}
        {activeTab === 'ads' && <AdManagement />}
        {activeTab === 'notifications' && <NotificationManagement />}
        {activeTab === 'users' && <UserManagement />}
        {activeTab === 'pulses' && <PulseManagement />}
        {activeTab === 'reports' && <ReportManagement />}
        {activeTab === 'settings' && <SystemSettings />}

        {activeTab === 'analytics' && <AnalyticsDashboard />}
      </main>
    </div>
  );
}

