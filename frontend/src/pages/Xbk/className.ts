const GRADE_PATTERN = /(高一|高二|高三|初一|初二|初三)/;

const normalizeClassName = (className?: string | null) => String(className || "").trim();

const compactClassName = (className?: string | null) =>
  normalizeClassName(className).replace(/\s+/g, "");

const isSimpleClassCode = (className: string) =>
  /^[A-Za-z0-9]+$/.test(className) || /^[（(]?\d+[）)]?$/.test(className);

export const formatXbkClassName = (
  grade?: string | null,
  className?: string | null,
) => {
  const raw = normalizeClassName(className);
  if (!raw) return "-";

  const compact = compactClassName(raw);
  if (!compact) return "-";
  if (GRADE_PATTERN.test(compact)) return compact;

  const bareNumber = compact.match(/^[（(]?(\d+)[）)]?$/);
  if (bareNumber) {
    return grade ? `${grade}${bareNumber[1]}班` : `${bareNumber[1]}班`;
  }

  const numberedClass = compact.match(/^[（(]?(\d+)[）)]?班$/);
  if (numberedClass) {
    return grade ? `${grade}${numberedClass[1]}班` : `${numberedClass[1]}班`;
  }

  if (compact.endsWith("班")) {
    const withoutSuffix = compact.slice(0, -1);
    if (grade && withoutSuffix && isSimpleClassCode(withoutSuffix)) {
      return `${grade}${compact}`;
    }
    return compact;
  }

  if (isSimpleClassCode(compact)) {
    return grade ? `${grade}${compact}班` : `${compact}班`;
  }

  return raw;
};

export const sortXbkClassNames = (classNames: string[]) =>
  [...classNames].sort((a, b) =>
    formatXbkClassName(undefined, a).localeCompare(
      formatXbkClassName(undefined, b),
      "zh-CN",
      { numeric: true },
    ),
  );
