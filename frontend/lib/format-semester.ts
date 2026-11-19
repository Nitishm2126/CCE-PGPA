export function formatSemester(
  semesterId?: string | number | null,
  semesterName?: string | null
): string {
  // 1. If semesterName is provided, check if it's already a clean name
  if (semesterName && typeof semesterName === "string" && semesterName.trim()) {
    const trimmed = semesterName.trim();
    if (/^semester\s+[1-8]$/i.test(trimmed)) {
      return trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase();
    }
    if (/^sem-?[1-8]$/i.test(trimmed)) {
      const num = trimmed.replace(/\D/g, "");
      return `Semester ${num}`;
    }
    if (/^[1-8]$/.test(trimmed)) {
      return `Semester ${trimmed}`;
    }
    const semNameMatch = trimmed.match(/([1-8])(?:\D*)$/);
    if (/^s?0+(-0+)+0*([1-8])/i.test(trimmed) || /[-_]0*([1-8])$/i.test(trimmed)) {
      return `Semester ${semNameMatch ? semNameMatch[1] : trimmed}`;
    }
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}/i.test(trimmed) && !trimmed.startsWith("s0000000")) {
      return trimmed;
    }
  }

  // 2. Parse semesterId
  if (!semesterId) return "Semester";
  const str = String(semesterId).trim();

  if (/^semester\s+[1-8]$/i.test(str)) {
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
  }
  if (/^sem-?[1-8]$/i.test(str)) {
    return `Semester ${str.replace(/\D/g, "")}`;
  }

  if (/^[1-8]$/.test(str)) {
    return `Semester ${str}`;
  }

  // Match UUIDs ending with 1-8, e.g. s0000000-0000-0000-0000-000000000003
  const lastCharMatch = str.match(/([1-8])$/);
  if (lastCharMatch && (/^[0-9a-f-]{36}$/i.test(str) || /^s[0-9a-f-]{35}$/i.test(str) || /^s?0+(-0+)*-0*([1-8])$/i.test(str))) {
    return `Semester ${lastCharMatch[1]}`;
  }

  const endDigitMatch = str.match(/[-_]0*([1-8])$/);
  if (endDigitMatch) {
    return `Semester ${endDigitMatch[1]}`;
  }

  const semWordMatch = str.match(/sem(?:ester)?[-_\s]*([1-8])/i);
  if (semWordMatch) {
    return `Semester ${semWordMatch[1]}`;
  }

  // Fallback: If it's a UUID or internal identifier, NEVER display it to users!
  if (/^[0-9a-f-]{30,}$/i.test(str) || str.startsWith("s0000000")) {
    const anyDigit = str.match(/[1-8]/g);
    if (anyDigit && anyDigit.length > 0) {
      return `Semester ${anyDigit[anyDigit.length - 1]}`;
    }
    return "Semester";
  }

  return str;
}
