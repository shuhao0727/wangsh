export const formatAcademicYear = (startYear: number): string =>
  `${startYear}-${startYear + 1}`;

export const getCurrentAcademicYear = (date = new Date()): string => {
  const calendarYear = date.getFullYear();
  const startYear = date.getMonth() < 7 ? calendarYear - 1 : calendarYear;
  return formatAcademicYear(startYear);
};

export const isValidAcademicYear = (value: string): boolean => {
  const match = /^(\d{4})-(\d{4})$/.exec(value.trim());
  if (!match) return false;
  const start = Number(match[1]);
  const end = Number(match[2]);
  return start >= 2000 && start <= 2099 && end === start + 1;
};
