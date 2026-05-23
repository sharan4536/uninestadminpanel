import React, { useState, useEffect, useMemo } from 'react';
import {
  Users,
  Calendar,
  Megaphone,
  Eye,
  MousePointer2,
  TrendingUp,
  Activity,
  Clock,
  UserCheck,
  Zap,
  ArrowUpRight,
  ArrowDownRight,
  BarChart3,
  PieChart,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { Badge } from '../../../components/ui/badge';
import {
  getUpcomingEventsRealtime,
  getAllAdsRealtime,
  type CampusEvent,
  type Advertisement,
} from '../../../utils/firebase/firestore';
import { auth, db, isFirebaseConfigured } from '../../../utils/firebase/client';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';

// ── tiny bar-chart renderer (no library needed) ───────────────────────
function MiniBarChart({ data, color = '#38bdf8', height = 120 }: { data: number[]; color?: string; height?: number }) {
  const max = Math.max(...data, 1);
  const barW = Math.max(4, Math.min(28, Math.floor(260 / data.length) - 2));
  return (
    <div className="flex items-end gap-[3px] justify-center" style={{ height }}>
      {data.map((v, i) => (
        <div
          key={i}
          className="rounded-t-md transition-all duration-500"
          style={{
            width: barW,
            height: `${Math.max(4, (v / max) * 100)}%`,
            background: `linear-gradient(to top, ${color}, ${color}88)`,
            opacity: i === data.length - 1 ? 1 : 0.6 + (i / data.length) * 0.4,
          }}
        />
      ))}
    </div>
  );
}

// ── donut chart ───────────────────────────────────────────────────────
function DonutChart({ segments, size = 140 }: { segments: { value: number; color: string; label: string }[]; size?: number }) {
  const total = segments.reduce((s, seg) => s + seg.value, 0) || 1;
  let cumulative = 0;
  const r = size / 2 - 12;
  const cx = size / 2;
  const cy = size / 2;
  const strokeW = 18;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {segments.map((seg, i) => {
        const pct = seg.value / total;
        const dashArray = 2 * Math.PI * r;
        const dashOffset = dashArray * (1 - pct);
        const rotation = cumulative * 360 - 90;
        cumulative += pct;
        return (
          <circle
            key={i}
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke={seg.color}
            strokeWidth={strokeW}
            strokeDasharray={dashArray}
            strokeDashoffset={dashOffset}
            strokeLinecap="round"
            transform={`rotate(${rotation} ${cx} ${cy})`}
            className="transition-all duration-700"
          />
        );
      })}
      <text x={cx} y={cy - 6} textAnchor="middle" className="text-xl font-bold fill-slate-800">
        {total}
      </text>
      <text x={cx} y={cy + 12} textAnchor="middle" className="text-[10px] font-semibold fill-slate-400 uppercase tracking-wider">
        Total
      </text>
    </svg>
  );
}

// ── sparkline ─────────────────────────────────────────────────────────
function Sparkline({ data, color = '#38bdf8', width = 100, height = 32 }: { data: number[]; color?: string; width?: number; height?: number }) {
  if (data.length < 2) return null;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const points = data.map((v, i) => `${(i / (data.length - 1)) * width},${height - ((v - min) / range) * (height - 4) - 2}`).join(' ');
  return (
    <svg width={width} height={height} className="inline-block">
      <polyline fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" points={points} />
    </svg>
  );
}

// ── main component ────────────────────────────────────────────────────
export function AnalyticsDashboard() {
  const [events, setEvents] = useState<CampusEvent[]>([]);
  const [ads, setAds] = useState<Advertisement[]>([]);
  const [totalUsers, setTotalUsers] = useState(0);
  const [activeUsers, setActiveUsers] = useState(0);
  const [userGrowth, setUserGrowth] = useState<number[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);

  // Real-time listeners
  useEffect(() => {
    const unsubs: (() => void)[] = [];

    unsubs.push(getUpcomingEventsRealtime(setEvents));
    unsubs.push(getAllAdsRealtime(setAds));

    // Users listener
    if (isFirebaseConfigured && auth.currentUser) {
      const usersRef = collection(db, 'users');
      unsubs.push(
        onSnapshot(usersRef, (snap) => {
          setTotalUsers(snap.size);
          const now = Date.now();
          let active24 = 0;
          const growthBuckets = new Array(7).fill(0); // last 7 days
          snap.forEach((d) => {
            const data = d.data() as any;
            const lastActive = data.lastActive?.toDate?.();
            if (lastActive && now - lastActive.getTime() < 24 * 3600 * 1000) active24++;
            const created = data.createdAt?.toDate?.();
            if (created) {
              const dayIndex = 6 - Math.min(6, Math.floor((now - created.getTime()) / (24 * 3600 * 1000)));
              growthBuckets[dayIndex]++;
            }
          });
          setActiveUsers(active24);
          // Make cumulative
          for (let i = 1; i < growthBuckets.length; i++) growthBuckets[i] += growthBuckets[i - 1];
          setUserGrowth(growthBuckets);
        }, () => {})
      );
    }

    // Auto-refresh timestamp every 30s
    const timer = setInterval(() => setRefreshKey((k) => k + 1), 30000);

    return () => {
      unsubs.forEach((u) => u());
      clearInterval(timer);
    };
  }, []);

  // Derived metrics
  const totalImpressions = useMemo(() => ads.reduce((s, a) => s + (a.stats?.impressions || 0), 0), [ads]);
  const totalClicks = useMemo(() => ads.reduce((s, a) => s + (a.stats?.clicks || 0), 0), [ads]);
  const ctr = totalImpressions > 0 ? ((totalClicks / totalImpressions) * 100).toFixed(1) : '0.0';
  const activeAds = useMemo(() => ads.filter((a) => a.status === 'active').length, [ads]);

  const totalAttending = useMemo(() => events.reduce((s, e) => s + (e.stats?.attending || 0), 0), [events]);
  const totalViews = useMemo(() => events.reduce((s, e) => s + (e.stats?.views || 0), 0), [events]);
  const featuredCount = useMemo(() => events.filter((e) => e.isFeatured).length, [events]);

  const impressionsByAd = useMemo(
    () =>
      ads
        .map((a) => ({ name: a.title || a.brandName, impressions: a.stats?.impressions || 0, clicks: a.stats?.clicks || 0 }))
        .sort((a, b) => b.impressions - a.impressions)
        .slice(0, 6),
    [ads]
  );

  const eventsByAttendance = useMemo(
    () =>
      events
        .map((e) => ({ name: e.title, attending: e.stats?.attending || 0, views: e.stats?.views || 0 }))
        .sort((a, b) => b.attending - a.attending)
        .slice(0, 5),
    [events]
  );

  const tagDistribution = useMemo(() => {
    const counts: Record<string, number> = {};
    events.forEach((e) => (e.tags || []).forEach((t) => (counts[t] = (counts[t] || 0) + 1)));
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6);
  }, [events]);

  const adTypeSegments = useMemo(() => {
    const inCampus = ads.filter((a) => a.type === 'in-campus').length;
    const outCampus = ads.filter((a) => a.type === 'out-campus').length;
    return [
      { value: inCampus, color: '#38bdf8', label: 'In-Campus' },
      { value: outCampus, color: '#a78bfa', label: 'Out-Campus' },
    ];
  }, [ads]);

  const eventDonutSegments = useMemo(
    () => [
      { value: featuredCount, color: '#f59e0b', label: 'Featured' },
      { value: events.filter((e) => e.isTrending).length, color: '#f43f5e', label: 'Trending' },
      { value: events.filter((e) => e.isSponsored).length, color: '#38bdf8', label: 'Sponsored' },
      { value: Math.max(0, events.length - featuredCount - events.filter((e) => e.isTrending).length - events.filter((e) => e.isSponsored).length), color: '#e2e8f0', label: 'Regular' },
    ],
    [events, featuredCount]
  );

  return (
    <div className="space-y-6">
      {/* Live indicator */}
      <div className="flex items-center gap-2 text-xs font-semibold text-emerald-600">
        <span className="relative flex h-2.5 w-2.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
        </span>
        Live — auto-updating in real-time
      </div>

      {/* ── KPI Row ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard icon={Users} label="Total Users" value={totalUsers} sub={`${activeUsers} active now`} color="sky" spark={userGrowth} />
        <KPICard icon={Calendar} label="Campus Events" value={events.length} sub={`${totalAttending} attending`} color="amber" />
        <KPICard icon={Eye} label="Ad Impressions" value={totalImpressions} sub={`${ctr}% CTR`} color="violet" />
        <KPICard icon={MousePointer2} label="Ad Clicks" value={totalClicks} sub={`${activeAds} active campaigns`} color="emerald" />
      </div>

      {/* ── Charts Row 1 ───────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Ad Performance Bar Chart */}
        <Card className="lg:col-span-2 border-none shadow-sm rounded-3xl">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <BarChart3 size={18} className="text-sky-500" /> Ad Performance
              </CardTitle>
              <Badge className="bg-sky-50 text-sky-600 border-none text-[10px]">Live</Badge>
            </div>
          </CardHeader>
          <CardContent>
            {impressionsByAd.length > 0 ? (
              <div className="space-y-3">
                {impressionsByAd.map((ad, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <span className="text-xs font-medium text-slate-600 w-28 truncate">{ad.name}</span>
                    <div className="flex-1 h-6 bg-slate-50 rounded-full overflow-hidden relative">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{
                          width: `${Math.max(4, (ad.impressions / Math.max(...impressionsByAd.map((a) => a.impressions), 1)) * 100)}%`,
                          background: 'linear-gradient(90deg, #38bdf8, #818cf8)',
                        }}
                      />
                    </div>
                    <span className="text-xs font-bold text-slate-700 w-16 text-right">{ad.impressions.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-32 flex items-center justify-center text-sm text-slate-400">No ad data yet</div>
            )}
          </CardContent>
        </Card>

        {/* Ad Type Distribution */}
        <Card className="border-none shadow-sm rounded-3xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <PieChart size={18} className="text-violet-500" /> Ad Types
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center">
            <DonutChart segments={adTypeSegments} />
            <div className="flex gap-4 mt-4">
              {adTypeSegments.map((seg) => (
                <div key={seg.label} className="flex items-center gap-1.5 text-xs">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: seg.color }} />
                  <span className="text-slate-600 font-medium">{seg.label}</span>
                  <span className="font-bold text-slate-800">{seg.value}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Charts Row 2 ───────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Event Attendance Leaderboard */}
        <Card className="lg:col-span-2 border-none shadow-sm rounded-3xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <TrendingUp size={18} className="text-amber-500" /> Event Leaderboard
            </CardTitle>
          </CardHeader>
          <CardContent>
            {eventsByAttendance.length > 0 ? (
              <div className="space-y-3">
                {eventsByAttendance.map((ev, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <span className="flex items-center justify-center h-7 w-7 rounded-full bg-amber-50 text-amber-600 text-xs font-bold shrink-0">
                      {i + 1}
                    </span>
                    <span className="text-sm font-medium text-slate-700 flex-1 truncate">{ev.name}</span>
                    <div className="flex items-center gap-3 text-xs">
                      <span className="flex items-center gap-1 text-emerald-600 font-bold">
                        <UserCheck size={12} /> {ev.attending}
                      </span>
                      <span className="flex items-center gap-1 text-slate-400">
                        <Eye size={12} /> {ev.views}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-32 flex items-center justify-center text-sm text-slate-400">No events yet</div>
            )}
          </CardContent>
        </Card>

        {/* Event Categories Donut */}
        <Card className="border-none shadow-sm rounded-3xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <Activity size={18} className="text-rose-500" /> Event Categories
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center">
            <DonutChart segments={eventDonutSegments} />
            <div className="flex flex-wrap justify-center gap-3 mt-4">
              {eventDonutSegments.filter((s) => s.value > 0).map((seg) => (
                <div key={seg.label} className="flex items-center gap-1.5 text-xs">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: seg.color }} />
                  <span className="text-slate-600 font-medium">{seg.label}</span>
                  <span className="font-bold text-slate-800">{seg.value}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Tag Cloud + Quick Stats ────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Popular Tags */}
        <Card className="border-none shadow-sm rounded-3xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <Zap size={18} className="text-sky-500" /> Trending Tags
            </CardTitle>
          </CardHeader>
          <CardContent>
            {tagDistribution.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {tagDistribution.map(([tag, count], i) => (
                  <Badge
                    key={tag}
                    className="text-sm py-1.5 px-3 border-none font-semibold"
                    style={{
                      background: ['#dbeafe', '#fef3c7', '#fce7f3', '#ddd6fe', '#d1fae5', '#ffedd5'][i] || '#f1f5f9',
                      color: ['#2563eb', '#d97706', '#db2777', '#7c3aed', '#059669', '#ea580c'][i] || '#475569',
                    }}
                  >
                    #{tag} <span className="ml-1 opacity-70">×{count}</span>
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-400">No tags found</p>
            )}
          </CardContent>
        </Card>

        {/* Engagement Summary */}
        <Card className="border-none shadow-sm rounded-3xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <Clock size={18} className="text-emerald-500" /> Engagement Summary
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <EngagementRow label="Event Views" value={totalViews} icon={Eye} color="sky" />
            <EngagementRow label="Event Attendees" value={totalAttending} icon={UserCheck} color="emerald" />
            <EngagementRow label="Ad Impressions" value={totalImpressions} icon={Eye} color="violet" />
            <EngagementRow label="Ad Clicks" value={totalClicks} icon={MousePointer2} color="amber" />
            <EngagementRow label="Featured Events" value={featuredCount} icon={TrendingUp} color="rose" />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────

function KPICard({ icon: Icon, label, value, sub, color, spark }: { icon: any; label: string; value: number; sub: string; color: string; spark?: number[] }) {
  const palette: Record<string, { bg: string; text: string; ring: string }> = {
    sky: { bg: 'bg-sky-50', text: 'text-sky-600', ring: 'ring-sky-100' },
    amber: { bg: 'bg-amber-50', text: 'text-amber-600', ring: 'ring-amber-100' },
    violet: { bg: 'bg-violet-50', text: 'text-violet-600', ring: 'ring-violet-100' },
    emerald: { bg: 'bg-emerald-50', text: 'text-emerald-600', ring: 'ring-emerald-100' },
    rose: { bg: 'bg-rose-50', text: 'text-rose-600', ring: 'ring-rose-100' },
  };
  const c = palette[color] || palette.sky;

  return (
    <Card className={`border-none shadow-sm rounded-3xl ring-1 ${c.ring} transition-transform hover:scale-[1.02]`}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className={`p-2.5 rounded-2xl ${c.bg}`}>
            <Icon size={20} className={c.text} />
          </div>
          {spark && spark.length > 1 && <Sparkline data={spark} color={c.text.replace('text-', '').includes('sky') ? '#38bdf8' : '#a78bfa'} />}
        </div>
        <p className="mt-3 text-2xl font-extrabold text-slate-900 tracking-tight">{value.toLocaleString()}</p>
        <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mt-0.5">{label}</p>
        <p className="text-xs text-slate-500 mt-1">{sub}</p>
      </CardContent>
    </Card>
  );
}

function EngagementRow({ label, value, icon: Icon, color }: { label: string; value: number; icon: any; color: string }) {
  const palette: Record<string, string> = {
    sky: 'bg-sky-50 text-sky-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    violet: 'bg-violet-50 text-violet-600',
    amber: 'bg-amber-50 text-amber-600',
    rose: 'bg-rose-50 text-rose-600',
  };

  return (
    <div className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-slate-50 transition-colors">
      <div className={`p-2 rounded-xl ${palette[color]}`}>
        <Icon size={16} />
      </div>
      <span className="flex-1 text-sm font-medium text-slate-700">{label}</span>
      <span className="text-sm font-bold text-slate-900">{value.toLocaleString()}</span>
    </div>
  );
}
