import { ParsedClass } from './timetableParser';

const DAY_ORDER = ["MONDAY","TUESDAY","WEDNESDAY","THURSDAY","FRIDAY","SATURDAY","SUNDAY"];
const DAYS = ["MONDAY","TUESDAY","WEDNESDAY","THURSDAY","FRIDAY","SATURDAY"];

const SKIP_KEYWORDS = [
  "TEA BREAK","LUNCH","SELF STUDY","OFFICE HOUR","LIBRARY HOUR",
  "MENTORSHIP","BREAK","RECESS","FREE HOUR","FREE PERIOD",
];

const COURSE_RE = /^([A-Z0-9][-A-Z0-9]{2,})\s*[-–]\s*(.+)$/i;
const TIME_AM_PM = /(\d{1,2}:\d{2}\s*(?:AM|PM))/gi;

function normTime(t: string): string {
  let s = t.trim().replace(/\./g, ':');
  const m = s.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!m) return s;
  let h = +m[1]; const mm = m[2]; const ap = m[3].toUpperCase();
  if (ap === 'PM' && h !== 12) h += 12;
  if (ap === 'AM' && h === 12) h = 0;
  return `${String(h).padStart(2,'0')}:${mm}`;
}

function toMin(t: string) { const [h,m] = t.split(':').map(Number); return h*60+m; }

function isSkip(s: string) {
  const u = s.toUpperCase();
  return SKIP_KEYWORDS.some(k => u.includes(k));
}

/** Parse one cell's text into a course entry (or null if it's a break/empty). */
function parseCell(cellText: string): { code: string; name: string; faculty?: string } | null {
  const lines = cellText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (!lines.length) return null;

  let code = ''; let name = ''; let faculty = '';
  let facultyLines: string[] = [];
  let inFaculty = false;

  for (const line of lines) {
    if (isSkip(line)) return null;
    if (line.match(/^Batch-/i)) continue;

    if (inFaculty) {
      facultyLines.push(line.replace(/[{}]/g, ''));
      if (line.includes('}')) inFaculty = false;
      continue;
    }

    if (line.startsWith('{')) {
      inFaculty = !line.includes('}');
      facultyLines.push(line.replace(/[{}]/g, ''));
      continue;
    }

    const cm = line.match(COURSE_RE);
    if (cm) { code = cm[1]; name = cm[2]; continue; }

    if (line.toUpperCase() === 'CTS') {
      if (!code) { code = 'CTS'; name = 'Career Training & Skills'; }
      continue;
    }
  }

  if (!code) return null;
  if (facultyLines.length) {
    faculty = facultyLines.join(', ').replace(/\s*,\s*/g, ', ').trim();
  }
  return { code, name, faculty: faculty || undefined };
}

function merge(classes: ParsedClass[]): ParsedClass[] {
  const sorted = [...classes].sort((a,b) => {
    const dd = DAY_ORDER.indexOf(a.day) - DAY_ORDER.indexOf(b.day);
    return dd || toMin(a.startTime) - toMin(b.startTime);
  });
  const out: ParsedClass[] = [];
  for (let i = 0; i < sorted.length; i++) {
    let c = { ...sorted[i] };
    while (i+1 < sorted.length && sorted[i+1].day === c.day
      && sorted[i+1].courseCode === c.courseCode && sorted[i+1].startTime === c.endTime) {
      c.endTime = sorted[++i].endTime;
    }
    const dur = toMin(c.endTime) - toMin(c.startTime);
    c.classType = dur >= 100 ? 'Lab' : 'Theory';
    out.push(c);
  }
  return out;
}

/**
 * Strategy 1: Tab-separated table (the most common DSU copy-paste format).
 *
 * When you copy from a web/Excel table, tabs separate columns and newlines
 * live inside cells.  We reconstruct rows by joining lines until we hit
 * the next time-slot marker.
 */
function parseTabTable(raw: string): ParsedClass[] {
  // Rebuild rows: a new row starts when a line contains a time-range
  // pattern like "08:30 AM" AND a tab character (the end-time sits on
  // the same tab-line as the first cell).
  const allLines = raw.split(/\r?\n/);
  const rows: { startTime: string; endTime: string; cells: string[] }[] = [];

  let accum = '';
  let pendingStart = '';
  let pendingEnd = '';
  let collectingTimeTo = false;

  for (let i = 0; i < allLines.length; i++) {
    const line = allLines[i];
    const stripped = line.trim();

    // Detect "HH:MM AM" standalone (start-time line)
    if (/^\d{1,2}:\d{2}\s*(?:AM|PM)$/i.test(stripped) && !collectingTimeTo) {
      // Flush previous row
      if (pendingStart && accum) {
        const cells = accum.split('\t').map(c => c.trim()).filter(Boolean);
        rows.push({ startTime: normTime(pendingStart), endTime: normTime(pendingEnd), cells });
      }
      pendingStart = stripped;
      pendingEnd = '';
      accum = '';
      collectingTimeTo = true;
      continue;
    }

    // "to" line between start and end time
    if (collectingTimeTo && /^to$/i.test(stripped)) continue;

    // End-time line (may have a tab → first cell on same line)
    if (collectingTimeTo && /^\d{1,2}:\d{2}\s*(?:AM|PM)/i.test(stripped)) {
      collectingTimeTo = false;
      // The line might be "09:25 AM\tBatch-B2\n..."
      const tabIdx = line.indexOf('\t');
      if (tabIdx > -1) {
        pendingEnd = line.substring(0, tabIdx).trim();
        accum = line.substring(tabIdx + 1);
      } else {
        pendingEnd = stripped;
      }
      continue;
    }

    collectingTimeTo = false;

    // Regular content line — append to accumulator
    if (accum) accum += '\n' + line;
    else accum = line;
  }

  // Flush last row
  if (pendingStart && accum) {
    const cells = accum.split('\t').map(c => c.trim()).filter(Boolean);
    rows.push({ startTime: normTime(pendingStart), endTime: normTime(pendingEnd), cells });
  }

  // Now parse each row's cells
  const results: ParsedClass[] = [];
  for (const row of rows) {
    for (let d = 0; d < Math.min(row.cells.length, DAYS.length); d++) {
      const parsed = parseCell(row.cells[d]);
      if (parsed) {
        results.push({
          day: DAYS[d],
          startTime: row.startTime,
          endTime: row.endTime,
          courseCode: parsed.code,
          courseName: parsed.name,
          classType: 'Theory',
          faculty: parsed.faculty,
        });
      }
    }
  }
  return results;
}

/**
 * Strategy 2: Sequential line-based (no tabs present).
 * Detect time ranges then assign courses to days sequentially.
 */
function parseSequential(raw: string): ParsedClass[] {
  const lines = raw.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const results: ParsedClass[] = [];
  let curStart = '', curEnd = '', dayIdx = 0;
  let inFaculty = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Multi-line faculty — skip until closing brace
    if (inFaculty) { if (line.includes('}')) inFaculty = false; continue; }

    // Time start line
    if (/^\d{1,2}:\d{2}\s*(?:AM|PM)$/i.test(line)) {
      if (i+2 < lines.length && /^to$/i.test(lines[i+1]) && /^\d{1,2}:\d{2}\s*(?:AM|PM)/i.test(lines[i+2])) {
        curStart = normTime(line);
        const endLine = lines[i+2].split('\t')[0].trim();
        curEnd = normTime(endLine);
        dayIdx = 0; i += 2; continue;
      }
    }
    if (!curStart) continue;

    // Faculty line
    if (line.startsWith('{')) { inFaculty = !line.includes('}'); continue; }

    // Batch prefix
    if (/^Batch-/i.test(line)) continue;

    // Skip keywords (each one = a day slot consumed)
    if (isSkip(line)) { dayIdx++; continue; }

    // Course line
    const cm = line.match(COURSE_RE);
    if (cm && dayIdx < DAYS.length) {
      let fac: string | undefined;
      const nl = lines[i+1] || '';
      if (nl.startsWith('{')) {
        const parts: string[] = [nl.replace(/[{}]/g, '')];
        if (!nl.includes('}')) { for (let j = i+2; j < lines.length; j++) {
          parts.push(lines[j].replace(/[{}]/g, '')); if (lines[j].includes('}')) { i = j; break; }
        }} else { i++; }
        fac = parts.join(', ').replace(/\s*,\s*/g,', ').trim();
      }
      results.push({ day: DAYS[dayIdx], startTime: curStart, endTime: curEnd,
        courseCode: cm[1], courseName: cm[2], classType: 'Theory', faculty: fac });
      dayIdx++;
      continue;
    }

    // CTS as course
    if (line.toUpperCase() === 'CTS' && dayIdx < DAYS.length) {
      // peek: if next line is also CTS, skip it (redundant)
      if (i+1 < lines.length && lines[i+1].toUpperCase() === 'CTS') i++;
      let fac: string | undefined;
      const nl = lines[i+1] || '';
      if (nl.startsWith('{')) {
        fac = nl.replace(/[{}]/g, '').trim();
        if (!nl.includes('}')) { for (let j = i+2; j < lines.length; j++) {
          fac += ', ' + lines[j].replace(/[{}]/g, '').trim();
          if (lines[j].includes('}')) { i = j; break; }
        }} else { i++; }
      }
      results.push({ day: DAYS[dayIdx], startTime: curStart, endTime: curEnd,
        courseCode: 'CTS', courseName: 'Career Training & Skills', classType: 'Theory', faculty: fac });
      dayIdx++;
    }
  }
  return results;
}

/** Main entry — tries tab-table first, falls back to sequential. */
export function parseDSUTimetable(rawText: string): ParsedClass[] {
  console.log('[DSU Parser] Input length:', rawText.length, 'has tabs:', rawText.includes('\t'));

  const tabResult = parseTabTable(rawText);
  console.log('[DSU Parser] Tab strategy:', tabResult.length, 'classes');

  const seqResult = parseSequential(rawText);
  console.log('[DSU Parser] Sequential strategy:', seqResult.length, 'classes');

  const best = tabResult.length >= seqResult.length ? tabResult : seqResult;
  console.log('[DSU Parser] Using:', best.length, 'classes');

  const final = merge(best);
  return final.sort((a,b) => {
    const dd = DAY_ORDER.indexOf(a.day) - DAY_ORDER.indexOf(b.day);
    return dd || toMin(a.startTime) - toMin(b.startTime);
  });
}
