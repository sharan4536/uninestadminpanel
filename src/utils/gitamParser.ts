import { ParsedClass } from './timetableParser';

// 📅 Day order (Mon → Fri priority)
const DAY_ORDER = [
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
  "SUNDAY",
];

// 📅 Normalize day names
const DAY_MAP: Record<string, string> = {
  MONDAY: "MONDAY",
  TUESDAY: "TUESDAY",
  WEDNESDAY: "WEDNESDAY",
  THURSDAY: "THURSDAY",
  FRIDAY: "FRIDAY",
  SATURDAY: "SATURDAY",
  SUNDAY: "SUNDAY",
};

// Example: Friday: 09:00:00 - 09:50:00
const SCHEDULE_REGEX =
  /^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday):\s*([0-9:]+)\s*-\s*([0-9:]+)/i;

// ⏱ Convert HH:mm:ss → HH:mm
function normalizeTime(time: string): string {
  return time.slice(0, 5);
}

// ⏱ Convert time → minutes
function toMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

// 🔗 Merge continuous classes + classify
function mergeContinuousClasses(classes: ParsedClass[]): ParsedClass[] {
  const sorted = [...classes].sort((a, b) => {
    if (a.day !== b.day) return DAY_ORDER.indexOf(a.day) - DAY_ORDER.indexOf(b.day);
    return toMinutes(a.startTime) - toMinutes(b.startTime);
  });

  const merged: ParsedClass[] = [];

  for (let i = 0; i < sorted.length; i++) {
    let current = { ...sorted[i] };

    while (
      i + 1 < sorted.length &&
      sorted[i + 1].day === current.day &&
      sorted[i + 1].courseCode === current.courseCode &&
      sorted[i + 1].location === current.location &&
      sorted[i + 1].startTime === current.endTime
    ) {
      current.endTime = sorted[i + 1].endTime;
      i++;
    }

    const duration =
      toMinutes(current.endTime) - toMinutes(current.startTime);

    current.classType = duration >= 100 ? "Lab" : "Theory";

    merged.push(current);
  }

  return merged;
}

// 🔄 Final sort (Mon → Fri, morning → evening)
function sortTimetable(classes: ParsedClass[]): ParsedClass[] {
  return [...classes].sort((a, b) => {
    const dayDiff =
      DAY_ORDER.indexOf(a.day) - DAY_ORDER.indexOf(b.day);
    if (dayDiff !== 0) return dayDiff;

    return toMinutes(a.startTime) - toMinutes(b.startTime);
  });
}

// 🎯 MAIN GITAM PARSER
export function parseGitamTimetable(rawText: string): ParsedClass[] {
  const lines = rawText
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(l => l.length > 0);

  const results: ParsedClass[] = [];

  let currentCourseCode = "";
  let currentCourseName = "";
  let currentRoom = "";
  let currentFaculty = "";

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // 🧾 Detect course row
    // Support both tab-separated and multiple spaces (fallback for copy-paste)
    let tokens = line.split("\t");
    if (tokens.length < 3) {
      tokens = line.split(/\s{2,}/);
    }

    // Skip the header row and rows that don't look like course entries
    if (tokens.length >= 7 &&
      !tokens[0].toLowerCase().includes("course") &&
      /^[A-Z0-9-]+$/i.test(tokens[0])) {
      currentCourseCode = tokens[0].trim();
      currentCourseName = tokens[1].trim();
      currentRoom = tokens[2].trim();
      currentFaculty = tokens[6]?.trim() || "";
      continue;
    }

    // 📅 Detect schedule line
    // Allow for potential leading whitespace or markers
    const match = line.match(/(?:^|\s)(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday):\s*([0-9:]+)\s*-\s*([0-9:]+)/i);

    if (match) {
      const day = match[1].toUpperCase();
      const start = normalizeTime(match[2]);
      const end = normalizeTime(match[3]);

      results.push({
        day,
        startTime: start,
        endTime: end,
        courseCode: currentCourseCode || "UNKNOWN",
        courseName: currentCourseName,
        classType: "Theory", // will be updated in merge step
        location: currentRoom,
        faculty: currentFaculty,
      });
    }
  }

  // 🔥 FINAL PIPELINE
  return sortTimetable(mergeContinuousClasses(results));
}
