export type VarKV = { name: string; value: string; type: string };

export function diffVarTrace(stepNo: number, prev: Map<string, { value: string; type: string }>, nextItems: VarKV[]) {
  const next = new Map<string, { value: string; type: string }>();
  nextItems.forEach((v) => next.set(v.name, { value: v.value, type: v.type }));

  const lines: string[] = [];
  if (prev.size === 0 && next.size) {
    Array.from(next.entries()).forEach(([k, v]) => {
      lines.push(`#${stepNo} ${k} = ${v.value} (${v.type})`);
    });
  } else {
    const keys = Array.from(new Set<string>([...Array.from(prev.keys()), ...Array.from(next.keys())]));
    keys.forEach((k) => {
      const a = prev.get(k);
      const b = next.get(k);
      if (!a && b) lines.push(`#${stepNo} + ${k} = ${b.value} (${b.type})`);
      else if (a && !b) lines.push(`#${stepNo} - ${k} (was ${a.value})`);
      else if (a && b && (a.value !== b.value || a.type !== b.type)) lines.push(`#${stepNo} ${k}: ${a.value} -> ${b.value}`);
    });
  }

  return { next, lines };
}

