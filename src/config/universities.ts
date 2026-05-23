/**
 * University Configuration Registry
 * ----------------------------------
 * Central config for all supported universities.
 * Adding a new university = adding a new config object here.
 *
 * This file is the SINGLE SOURCE OF TRUTH for:
 *  - Map center & campus label
 *  - Timetable parser type & time slots
 *  - Check-in location presets
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CheckinPreset {
  id: string;
  label: string;
  /** Lucide icon component name (resolved at runtime in CheckInSheet) */
  icon: string;
  /** Tailwind classes for the unselected state */
  tint: string;
}

export interface UniversityConfig {
  /** Firestore-safe unique key, e.g. 'vit-vellore' */
  id: string;
  /** Full display name */
  name: string;
  /** Short abbreviation for badges / tags */
  shortName: string;
  /** Email domains for auto-detection during signup, e.g. ['vitstudent.ac.in'] */
  domains?: string[];

  // ── Map ──────────────────────────────────────────────────────────────────
  mapCenter: [number, number];
  mapZoom: number;
  campusLabel: string;

  // ── Timetable ────────────────────────────────────────────────────────────
  /** Which parser plugin to use */
  timetableType: 'ffcs' | 'srm-academia' | 'generic-csv' | 'manual-only' | 'ai-pdf';
  /** Time slot labels shown in the grid view */
  timeSlots: string[];
  /** Weekday labels */
  days: string[];

  // ── Check-in ─────────────────────────────────────────────────────────────
  checkinPresets: CheckinPreset[];

  // ── Semester (optional) ──────────────────────────────────────────────────
  defaultSemesterStart?: string;
  defaultSemesterEnd?: string;
}

// ---------------------------------------------------------------------------
// University Configs
// ---------------------------------------------------------------------------

export const VIT_VELLORE: UniversityConfig = {
  id: 'vit-vellore',
  name: 'VIT Vellore',
  shortName: 'VIT',
  domains: ['vitstudent.ac.in'],

  mapCenter: [12.970926, 79.163833],
  mapZoom: 16,
  campusLabel: 'VIT Campus',

  timetableType: 'ffcs',
  timeSlots: [
    '8:00 AM', '9:00 AM', '10:00 AM', '11:00 AM', '12:00 PM',
    '1:00 PM', '2:00 PM', '3:00 PM', '4:00 PM', '5:00 PM', '6:00 PM',
  ],
  days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],

  checkinPresets: [
    { id: 'Mess', label: 'Mess', icon: 'Coffee', tint: 'bg-amber-50 text-amber-700 border-amber-100' },
    { id: 'Library', label: 'Library', icon: 'LibraryBig', tint: 'bg-sky-50 text-sky-700 border-sky-100' },
    { id: 'Foodys', label: 'Foodys', icon: 'Sofa', tint: 'bg-indigo-50 text-indigo-700 border-indigo-100' },
    { id: 'Sports Ground', label: 'Sports Ground', icon: 'Trophy', tint: 'bg-emerald-50 text-emerald-700 border-emerald-100' },
    { id: 'SJT', label: 'SJT', icon: 'GraduationCap', tint: 'bg-violet-50 text-violet-700 border-violet-100' },
    { id: 'PRP', label: 'PRP', icon: 'GraduationCap', tint: 'bg-violet-50 text-violet-700 border-violet-100' },
    { id: 'TT', label: 'TT', icon: 'GraduationCap', tint: 'bg-violet-50 text-violet-700 border-violet-100' },
    { id: 'MGB', label: 'MGB', icon: 'GraduationCap', tint: 'bg-violet-50 text-violet-700 border-violet-100' },
    { id: 'MB', label: 'MB', icon: 'GraduationCap', tint: 'bg-violet-50 text-violet-700 border-violet-100' },
  ],
};

export const VIT_CHENNAI: UniversityConfig = {
  id: 'vit-chennai',
  name: 'VIT Chennai',
  shortName: 'VITC',
  domains: ['vitstudent.ac.in'],

  mapCenter: [12.8406, 80.1534],
  mapZoom: 16,
  campusLabel: 'VIT Chennai Campus',

  timetableType: 'ffcs',
  timeSlots: [
    '8:00 AM', '9:00 AM', '10:00 AM', '11:00 AM', '12:00 PM',
    '1:00 PM', '2:00 PM', '3:00 PM', '4:00 PM', '5:00 PM', '6:00 PM',
  ],
  days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],

  checkinPresets: [
    { id: 'Mess', label: 'Mess', icon: 'Coffee', tint: 'bg-amber-50 text-amber-700 border-amber-100' },
    { id: 'Library', label: 'Library', icon: 'LibraryBig', tint: 'bg-sky-50 text-sky-700 border-sky-100' },
    { id: 'Foodys', label: 'Foodys', icon: 'Sofa', tint: 'bg-indigo-50 text-indigo-700 border-indigo-100' },
    { id: 'Sports Ground', label: 'Sports Ground', icon: 'Trophy', tint: 'bg-emerald-50 text-emerald-700 border-emerald-100' },
    { id: 'SJT', label: 'SJT', icon: 'GraduationCap', tint: 'bg-violet-50 text-violet-700 border-violet-100' },
    { id: 'TT', label: 'TT', icon: 'GraduationCap', tint: 'bg-violet-50 text-violet-700 border-violet-100' },
    { id: 'Technology Tower', label: 'Technology Tower', icon: 'GraduationCap', tint: 'bg-violet-50 text-violet-700 border-violet-100' },
    { id: 'AB1', label: 'AB1', icon: 'GraduationCap', tint: 'bg-violet-50 text-violet-700 border-violet-100' },
    { id: 'AB2', label: 'AB2', icon: 'GraduationCap', tint: 'bg-violet-50 text-violet-700 border-violet-100' },
    { id: 'Amphitheatre', label: 'Amphitheatre', icon: 'Dribbble', tint: 'bg-indigo-50 text-indigo-700 border-indigo-100' },
    { id: 'Hostel Block', label: 'Hostel Block', icon: 'Building', tint: 'bg-slate-50 text-slate-700 border-slate-100' },
  ],
};



export const ALLIANCE_BANGALORE: UniversityConfig = {
  id: 'alliance-bangalore',
  name: 'Alliance University, Bangalore',
  shortName: 'Alliance',
  domains: ['ced.alliance.edu.in', 'alliance.edu.in'],

  mapCenter: [12.7304796, 77.7067921], // Alliance University Bangalore coordinates
  mapZoom: 16,
  campusLabel: 'Alliance Campus',

  timetableType: 'ai-pdf', // Or specific alliance type if we add it to the enum
  timeSlots: [
    '8:00 AM', '9:00 AM', '10:00 AM', '11:05 AM', '12:05 PM',
    '1:10 PM', '2:10 PM', '3:10 PM', '4:15 PM', '5:15 PM',
  ],
  days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],

  checkinPresets: [
    { id: 'Engineering Block', label: 'Engineering Block', icon: 'GraduationCap', tint: 'bg-violet-50 text-violet-700 border-violet-100' },
    { id: 'Cricket Ground', label: 'Cricket Ground', icon: 'Trophy', tint: 'bg-emerald-50 text-emerald-700 border-emerald-100' },
    { id: 'Football', label: 'Football', icon: 'Trophy', tint: 'bg-emerald-50 text-emerald-700 border-emerald-100' },
    { id: 'Foodcourt', label: 'Foodcourt', icon: 'Coffee', tint: 'bg-amber-50 text-amber-700 border-amber-100' },
    { id: 'Moot court', label: 'Moot court', icon: 'Gavel', tint: 'bg-indigo-50 text-indigo-700 border-indigo-100' },
    { id: 'Library', label: 'Library', icon: 'LibraryBig', tint: 'bg-sky-50 text-sky-700 border-sky-100' },
    { id: 'Admin Block', label: 'Admin Block', icon: 'Building2', tint: 'bg-slate-50 text-slate-700 border-slate-100' },
    { id: 'Allfreshco', label: 'Allfreshco', icon: 'Utensils', tint: 'bg-amber-50 text-amber-700 border-amber-100' },
    { id: 'Activity Center', label: 'Activity Center', icon: 'Dribbble', tint: 'bg-indigo-50 text-indigo-700 border-indigo-100' },
  ],
};

export const GITAM_VIZAG: UniversityConfig = {
  id: 'gitam-vizag',
  name: 'GITAM University, Visakhapatnam',
  shortName: 'GITAM',
  domains: ['gitam.in', 'gitam.edu'],

  mapCenter: [17.7812, 83.3773],
  mapZoom: 16,
  campusLabel: 'GITAM Campus',

  timetableType: 'ai-pdf',
  timeSlots: [
    '8:30 AM', '9:20 AM', '10:10 AM', '11:00 AM', '11:50 AM',
    '12:40 PM', '1:30 PM', '2:20 PM', '3:10 PM', '4:00 PM',
  ],
  days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],

  checkinPresets: [
    { id: 'Food Court', label: 'Food Court', icon: 'Coffee', tint: 'bg-amber-50 text-amber-700 border-amber-100' },
    { id: 'Knowledge Resource Centre', label: 'Library', icon: 'LibraryBig', tint: 'bg-sky-50 text-sky-700 border-sky-100' },
    { id: 'Open Air Theatre', label: 'OAT', icon: 'Sofa', tint: 'bg-indigo-50 text-indigo-700 border-indigo-100' },
    { id: 'Indoor Stadium', label: 'Stadium', icon: 'Trophy', tint: 'bg-emerald-50 text-emerald-700 border-emerald-100' },
    { id: 'Gandhi Block', label: 'Gandhi Block', icon: 'GraduationCap', tint: 'bg-violet-50 text-violet-700 border-violet-100' },
    { id: 'Canteen', label: 'Canteen', icon: 'Utensils', tint: 'bg-amber-50 text-amber-700 border-amber-100' },
    { id: 'Seminar Hall', label: 'Seminar Hall', icon: 'Building2', tint: 'bg-slate-50 text-slate-700 border-slate-100' },
    { id: 'Playground', label: 'Playground', icon: 'Trophy', tint: 'bg-emerald-50 text-emerald-700 border-emerald-100' },
    { id: 'Main Gate', label: 'Main Gate', icon: 'Building', tint: 'bg-slate-50 text-slate-700 border-slate-100' },
  ],
};

export const GITAM_BANGALORE: UniversityConfig = {
  id: 'gitam-bangalore',
  name: 'GITAM University, Bengaluru',
  shortName: 'GITAMB',
  domains: ['gitam.in', 'gitam.edu'],

  mapCenter: [13.2115, 77.5960],
  mapZoom: 16,
  campusLabel: 'GITAM Bengaluru Campus',

  timetableType: 'ai-pdf',
  timeSlots: [
    '8:30 AM', '9:20 AM', '10:10 AM', '11:00 AM', '11:50 AM',
    '12:40 PM', '1:30 PM', '2:20 PM', '3:10 PM', '4:00 PM',
  ],
  days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],

  checkinPresets: [
    { id: 'Gitam cafe', label: 'Gitam cafe', icon: 'Coffee', tint: 'bg-amber-50 text-amber-700 border-amber-100' },
    { id: 'Campus cafe', label: 'Campus cafe', icon: 'Utensils', tint: 'bg-amber-50 text-amber-700 border-amber-100' },
    { id: 'Benches infront of bank', label: 'Benches infront of bank', icon: 'Sofa', tint: 'bg-slate-50 text-slate-700 border-slate-100' },
    { id: 'Benches infront of vinay sadan', label: 'Benches infront of vinay sadan', icon: 'Sofa', tint: 'bg-slate-50 text-slate-700 border-slate-100' },
    { id: 'Kempegowda lawn', label: 'Kempegowda lawn', icon: 'Trees', tint: 'bg-emerald-50 text-emerald-700 border-emerald-100' },
    { id: 'Vinayaka temple', label: 'Vinayaka temple', icon: 'Church', tint: 'bg-orange-50 text-orange-700 border-orange-100' },
    { id: 'Sb lobby', label: 'Sb lobby', icon: 'Building', tint: 'bg-sky-50 text-sky-700 border-sky-100' },
    { id: 'Venture development centre', label: 'Venture development centre', icon: 'Lightbulb', tint: 'bg-amber-50 text-amber-700 border-amber-100' },
    { id: 'Library', label: 'Library', icon: 'LibraryBig', tint: 'bg-sky-50 text-sky-700 border-sky-100' },
  ],
};

export const GITAM_HYDERABAD: UniversityConfig = {
  id: 'gitam-hyderabad',
  name: 'GITAM University, Hyderabad',
  shortName: 'GITAMH',
  domains: ['gitam.in', 'gitam.edu'],

  mapCenter: [17.5255, 78.2255],
  mapZoom: 16,
  campusLabel: 'GITAM Hyderabad Campus',

  timetableType: 'ai-pdf',
  timeSlots: [
    '8:30 AM', '9:20 AM', '10:10 AM', '11:00 AM', '11:50 AM',
    '12:40 PM', '1:30 PM', '2:20 PM', '3:10 PM', '4:00 PM',
  ],
  days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],

  checkinPresets: [
    { id: 'Food Court', label: 'Food Court', icon: 'Coffee', tint: 'bg-amber-50 text-amber-700 border-amber-100' },
    { id: 'Library', label: 'Library', icon: 'LibraryBig', tint: 'bg-sky-50 text-sky-700 border-sky-100' },
    { id: 'Sports Ground', label: 'Sports Ground', icon: 'Trophy', tint: 'bg-emerald-50 text-emerald-700 border-emerald-100' },
    { id: 'Academic Block', label: 'Academic Block', icon: 'GraduationCap', tint: 'bg-violet-50 text-violet-700 border-violet-100' },
    { id: 'Cafeteria', label: 'Cafeteria', icon: 'Utensils', tint: 'bg-amber-50 text-amber-700 border-amber-100' },
    { id: 'Amphitheatre', label: 'Amphitheatre', icon: 'Dribbble', tint: 'bg-indigo-50 text-indigo-700 border-indigo-100' },
    { id: 'IT Block', label: 'IT Block', icon: 'GraduationCap', tint: 'bg-violet-50 text-violet-700 border-violet-100' },
    { id: 'Hostel Area', label: 'Hostel Area', icon: 'Building', tint: 'bg-slate-50 text-slate-700 border-slate-100' },
  ],
};

export const DSU_KUDLU_GATE: UniversityConfig = {
  id: 'dsu-kudlu-gate',
  name: 'Dayananda Sagar University, Kanakapura Road',
  shortName: 'DSU',
  domains: ['dsu.edu.in'],

  mapCenter: [12.8010, 77.5710],
  mapZoom: 16,
  campusLabel: 'DSU Kanakapura Road Campus',

  timetableType: 'ai-pdf',
  timeSlots: [
    '8:30 AM', '9:30 AM', '10:30 AM', '11:30 AM', '12:30 PM',
    '1:30 PM', '2:30 PM', '3:30 PM', '4:30 PM',
  ],
  days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],

  checkinPresets: [
    { id: 'Library', label: 'Library', icon: 'LibraryBig', tint: 'bg-sky-50 text-sky-700 border-sky-100' },
    { id: 'Cafeteria', label: 'Cafeteria', icon: 'Coffee', tint: 'bg-amber-50 text-amber-700 border-amber-100' },
    { id: 'Auditorium', label: 'Auditorium', icon: 'Dribbble', tint: 'bg-indigo-50 text-indigo-700 border-indigo-100' },
    { id: 'Engineering Block', label: 'Engineering Block', icon: 'GraduationCap', tint: 'bg-violet-50 text-violet-700 border-violet-100' },
    { id: 'Sports Ground', label: 'Sports Ground', icon: 'Trophy', tint: 'bg-emerald-50 text-emerald-700 border-emerald-100' },
    { id: 'Admin Block', label: 'Admin Block', icon: 'Building2', tint: 'bg-slate-50 text-slate-700 border-slate-100' },
    { id: 'Hostel', label: 'Hostel', icon: 'Building', tint: 'bg-slate-50 text-slate-700 border-slate-100' },
  ],
};

export const DSCE_KUMARASWAMY: UniversityConfig = {
  id: 'dsce-kumaraswamy',
  name: 'Dayananda Sagar College of Engineering',
  shortName: 'DSCE',
  domains: ['dsu.edu.in'],

  mapCenter: [12.90695, 77.56623],
  mapZoom: 16,
  campusLabel: 'DSCE Kumaraswamy Layout Campus',

  timetableType: 'ai-pdf',
  timeSlots: [
    '8:30 AM', '9:30 AM', '10:30 AM', '11:30 AM', '12:30 PM',
    '1:30 PM', '2:30 PM', '3:30 PM', '4:30 PM',
  ],
  days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],

  checkinPresets: [
    { id: 'Main Canteen', label: 'Main Canteen', icon: 'Coffee', tint: 'bg-amber-50 text-amber-700 border-amber-100' },
    { id: 'Central Library', label: 'Central Library', icon: 'LibraryBig', tint: 'bg-sky-50 text-sky-700 border-sky-100' },
    { id: 'CSE Block', label: 'CSE Block', icon: 'GraduationCap', tint: 'bg-violet-50 text-violet-700 border-violet-100' },
    { id: 'Mechanical Block', label: 'Mechanical Block', icon: 'GraduationCap', tint: 'bg-violet-50 text-violet-700 border-violet-100' },
    { id: 'Auditorium', label: 'Auditorium', icon: 'Dribbble', tint: 'bg-indigo-50 text-indigo-700 border-indigo-100' },
    { id: 'Sports Ground', label: 'Sports Ground', icon: 'Trophy', tint: 'bg-emerald-50 text-emerald-700 border-emerald-100' },
    { id: 'Placement Block', label: 'Placement Block', icon: 'Building2', tint: 'bg-slate-50 text-slate-700 border-slate-100' },
    { id: 'Parking Lot', label: 'Parking Lot', icon: 'Building', tint: 'bg-slate-50 text-slate-700 border-slate-100' },
    { id: 'Hostel', label: 'Hostel', icon: 'Building', tint: 'bg-slate-50 text-slate-700 border-slate-100' },
  ],
};

export const DSATM_KANAKAPURA: UniversityConfig = {
  id: 'dsatm-kanakapura',
  name: 'Dayananda Sagar Academy of Technology & Management',
  shortName: 'DSATM',
  domains: ['dsu.edu.in'],

  mapCenter: [12.8785, 77.5597],
  mapZoom: 16,
  campusLabel: 'DSATM Kanakapura Road Campus',

  timetableType: 'ai-pdf',
  timeSlots: [
    '8:30 AM', '9:30 AM', '10:30 AM', '11:30 AM', '12:30 PM',
    '1:30 PM', '2:30 PM', '3:30 PM', '4:30 PM',
  ],
  days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],

  checkinPresets: [
    { id: 'Friends Adda', label: 'Friends Adda', icon: 'Coffee', tint: 'bg-amber-50 text-amber-700 border-amber-100' },
    { id: 'Food Truck', label: 'Food Truck', icon: 'Utensils', tint: 'bg-orange-50 text-orange-700 border-orange-100' },
    { id: 'Cafeteria', label: 'Cafeteria', icon: 'Coffee', tint: 'bg-amber-50 text-amber-700 border-amber-100' },
    { id: 'SOE', label: 'SOE', icon: 'GraduationCap', tint: 'bg-violet-50 text-violet-700 border-violet-100' },
  ],
};

// ---------------------------------------------------------------------------
// Registry & Lookup
// ---------------------------------------------------------------------------

export const UNIVERSITY_REGISTRY: Record<string, UniversityConfig> = {
  'vit-vellore': VIT_VELLORE,
  'vit-chennai': VIT_CHENNAI,
  'alliance-bangalore': ALLIANCE_BANGALORE,
  'gitam-vizag': GITAM_VIZAG,
  'gitam-bangalore': GITAM_BANGALORE,
  'gitam-hyderabad': GITAM_HYDERABAD,
  'dsu-kudlu-gate': DSU_KUDLU_GATE,
  'dsce-kumaraswamy': DSCE_KUMARASWAMY,
  'dsatm-kanakapura': DSATM_KANAKAPURA,
};

/** Ordered list for the university picker UI */
export const UNIVERSITY_LIST: UniversityConfig[] = [
  VIT_VELLORE,
  VIT_CHENNAI,
  ALLIANCE_BANGALORE,
  GITAM_VIZAG,
  GITAM_BANGALORE,
  GITAM_HYDERABAD,
  DSU_KUDLU_GATE,
  DSCE_KUMARASWAMY,
  DSATM_KANAKAPURA,
];

export const DEFAULT_UNIVERSITY_ID = 'vit-vellore';

/**
 * Look up a university config by ID.
 * Falls back to VIT Vellore if ID is unknown or undefined.
 */
export function getUniversityConfig(id?: string | null): UniversityConfig {
  if (!id) return VIT_VELLORE;
  // Direct match by system ID
  if (UNIVERSITY_REGISTRY[id]) return UNIVERSITY_REGISTRY[id];
  // Fuzzy match: try matching by display name or shortName (case-insensitive)
  const lower = id.toLowerCase().trim();
  for (const uni of UNIVERSITY_LIST) {
    if (
      uni.name.toLowerCase() === lower ||
      uni.shortName.toLowerCase() === lower ||
      uni.id.toLowerCase() === lower
    ) {
      return uni;
    }
  }
  return VIT_VELLORE;
}

/**
 * Try to auto-detect university from an email domain.
 * Returns the config if matched, or null.
 */
export function detectUniversityFromEmail(email: string): UniversityConfig | null {
  const domain = email.split('@')[1]?.toLowerCase();
  if (!domain) return null;
  for (const uni of UNIVERSITY_LIST) {
    if (uni.domains && uni.domains.some(d => domain.endsWith(d))) return uni;
  }
  return null;
}
