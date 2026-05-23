import { ParsedClass } from './timetableParser';

// 🕒 Fixed session timings for Alliance University
const SESSION_TIMES: [string, string][] = [
  ["08:00", "08:55"],
  ["09:00", "09:55"],
  ["10:00", "10:55"],
  ["11:05", "12:00"],
  ["12:05", "13:00"],
  ["13:10", "14:05"],
  ["14:10", "15:05"],
  ["15:10", "16:05"],
  ["16:15", "17:10"],
  ["17:15", "18:10"],
];

// 📘 Course format: IDS ( THR )
const COURSE_REGEX = /^([A-Z-]+)(?:\s*\(\s*([A-Z-]+)\s*\))?$/;

const DAYS = [
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
  "SUNDAY",
];

// ⏱ Convert HH:mm → minutes
function toMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

// 🔗 Merge continuous classes + classify
function mergeContinuousClasses(classes: ParsedClass[]): ParsedClass[] {
  const merged: ParsedClass[] = [];

  for (let i = 0; i < classes.length; i++) {
    let current = { ...classes[i] };

    while (
      i + 1 < classes.length &&
      classes[i + 1].day === current.day &&
      classes[i + 1].courseCode === current.courseCode &&
      classes[i + 1].location === current.location &&
      classes[i + 1].startTime === current.endTime
    ) {
      current.endTime = classes[i + 1].endTime;
      i++;
    }

    const duration =
      toMinutes(current.endTime) - toMinutes(current.startTime);

    current.classType = duration >= 100 ? "Lab" : "Theory";

    merged.push(current);
  }

  return merged;
}

// 🎯 MAIN PARSER for Alliance University
export function parseAllianceTimetable(rawText: string): ParsedClass[] {
  const lines = rawText
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(l => l.length > 0);

  const results: ParsedClass[] = [];

  let currentDay: string | null = null;
  let sessionIndex = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].toUpperCase();

    // 📅 Detect Day
    if (DAYS.includes(line)) {
      currentDay = line;
      sessionIndex = 0;
      continue;
    }

    if (!currentDay) continue;

    // 📘 Detect Course
    const match = lines[i].match(COURSE_REGEX);

    if (match && sessionIndex < SESSION_TIMES.length) {
      const course = match[1];
      const faculty = match[2] || "";

      const location = lines[i + 1] || "";
      i++; // skip location line

      const [start, end] = SESSION_TIMES[sessionIndex];

      results.push({
        day: currentDay,
        startTime: start,
        endTime: end,
        courseCode: course,
        classType: "Theory", // temp (will update after merge)
        location,
        faculty,
      });

      sessionIndex++;
    }
  }

  // 🔥 Final step: merge + classify
  return mergeContinuousClasses(results);
}
