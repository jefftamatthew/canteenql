// Each family of SQL clauses has its own colour, used on step buttons, keyword
// highlighting and filter tags: FROM/JOIN blue, WHERE yellow, SELECT green,
// GROUP BY/HAVING/ORDER BY/LIMIT plum.

export type Family = 'blue' | 'yellow' | 'green' | 'plum';

export const PALETTE: Record<Family, { bg: string; fg: string; on: string; onFg: string; kw: string }> = {
  blue: { bg: '#DCE6F5', fg: '#233E72', on: '#2F4F8F', onFg: '#FFFFFF', kw: '#A9C2EE' },
  yellow: { bg: '#FBE7A1', fg: '#5C4600', on: '#F5CB3C', onFg: '#18233A', kw: '#F5CB3C' },
  green: { bg: '#D6EBE2', fg: '#1F5341', on: '#2C6E57', onFg: '#FFFFFF', kw: '#8FD4B6' },
  plum: { bg: '#EADFF2', fg: '#4E2A6B', on: '#6B3F8C', onFg: '#FFFFFF', kw: '#D2B4EA' },
};

export function familyOf(kind: string): Family {
  switch (kind) {
    case 'from':
    case 'join':
      return 'blue';
    case 'where':
      return 'yellow';
    case 'select':
      return 'green';
    default:
      return 'plum';
  }
}

/** Family for a keyword as written in SQL text. */
export function familyOfKeyword(word: string): Family {
  const w = word.toUpperCase().replace(/\s+/g, ' ');
  if (/^(SELECT|DISTINCT|AS|COUNT|SUM|AVG|MIN|MAX|ROUND)$/.test(w)) return 'green';
  if (/^((LEFT |INNER |CROSS )?JOIN|FROM|ON|USING)$/.test(w)) return 'blue';
  if (/^(WHERE|AND|OR|NOT|IN|LIKE|BETWEEN|IS|NULL)$/.test(w)) return 'yellow';
  return 'plum';
}

export const KEYWORD_RE =
  /\b(SELECT|DISTINCT|AS|COUNT|SUM|AVG|MIN|MAX|ROUND|FROM|(?:LEFT\s+|INNER\s+|CROSS\s+)?JOIN|ON|USING|WHERE|AND|OR|NOT|IN|LIKE|BETWEEN|IS|NULL|GROUP\s+BY|HAVING|ORDER\s+BY|ASC|DESC|LIMIT|OFFSET)\b/gi;
