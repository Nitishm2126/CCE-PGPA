export function formatSemester(
  semesterId?: string | number | null,
  semesterName?: string | null
): string {
  if (semesterName && semesterName.trim()) {
    const trimmed = semesterName.trim();
    if (/^[1-8]$/.test(trimmed)) {
      return `Semester ${trimmed}`;
    }
    return trimmed;
  }
  if (!semesterId) return "Semester";
  const str = String(semesterId).trim();

  // Match UUIDs ending with 1-8, e.g. s0000000-0000-0000-0000-000000000003
  const uuidMatch = str.match(/^s?0+(-0+)+0*([1-8])$/i);
  if (uuidMatch) {
    return `Semester ${uuidMatch[2]}`;
  }

  const endDigitMatch = str.match(/[-_]0*([1-8])$/);
  if (endDigitMatch) {
    return `Semester ${endDigitMatch[1]}`;
  }

  if (/^[1-8]$/.test(str)) {
    return `Semester ${str}`;
  }

  if (/^semester\s+[1-8]$/i.test(str)) {
    return str;
  }

  return str;
}
