export const AUTO_ROOT_ARRAY_PATH = '__auto__';

const DEFAULT_PREVIEW_LIMIT = 100;
const DEFAULT_FLATTEN_DEPTH = 6;
const DEFAULT_ARRAY_ITEM_LIMIT = 12;

const PREFERRED_ARRAY_KEYS = ['data', 'items', 'results', 'records', 'rows'];

export type NotionFieldType =
  | 'text'
  | 'number'
  | 'checkbox'
  | 'email'
  | 'phone'
  | 'url'
  | 'date'
  | 'relation'
  | 'files'
  | 'multi_select'
  | 'select';

export type TablePrimitive = string | number | boolean | null;
export type TableRowData = Record<string, TablePrimitive>;

export interface ArrayCandidate {
  path: string;
  length: number;
  score: number;
}

export interface NormalizeHttpRowsOptions {
  rootArrayPath?: string;
  maxFlattenDepth?: number;
  previewRowLimit?: number;
  explodeTimeSeries?: boolean;
  arrayItemLimit?: number;
  excludeFieldKeywords?: string[];
  arrayCandidates?: ArrayCandidate[];
}

export interface NormalizeHttpRowsResult {
  rows: TableRowData[];
  columnKeys: string[];
  totalRows: number;
  appliedRootArrayPath: string;
  arrayCandidates: ArrayCandidate[];
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function safeJsonStringify(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function normalizeScalar(value: unknown): TablePrimitive {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }

  return safeJsonStringify(value);
}

function isPrimitive(value: unknown): boolean {
  return value === null || ['string', 'number', 'boolean'].includes(typeof value);
}

function scoreArrayCandidate(path: string, length: number): number {
  const lowerPath = path.toLowerCase();
  const depthPenalty = (path.match(/\./g) ?? []).length * 4;
  const preferredBoost = PREFERRED_ARRAY_KEYS.some((key) => lowerPath.endsWith(`.${key}`))
    ? 1000
    : 0;

  return preferredBoost + length * 10 - depthPenalty;
}

function parsePathTokens(path: string): Array<string | number> {
  const normalized = path.trim().replace(/^\$\.?/, '');
  if (!normalized) {
    return [];
  }

  const tokens: Array<string | number> = [];
  const regex = /([^.[\]]+)|\[(\d+)\]/g;

  let match: RegExpExecArray | null = regex.exec(normalized);
  while (match) {
    if (match[1]) {
      tokens.push(match[1]);
    } else if (match[2]) {
      tokens.push(Number.parseInt(match[2], 10));
    }

    match = regex.exec(normalized);
  }

  return tokens;
}

function getValueByPath(payload: unknown, path: string): unknown {
  if (path === '$') {
    return payload;
  }

  const tokens = parsePathTokens(path);
  let current: unknown = payload;

  for (const token of tokens) {
    if (typeof token === 'number') {
      if (!Array.isArray(current) || token < 0 || token >= current.length) {
        return undefined;
      }

      current = current[token];
      continue;
    }

    if (!isPlainObject(current) || !(token in current)) {
      return undefined;
    }

    current = current[token];
  }

  return current;
}

function shouldExcludeField(path: string, keywords: string[]): boolean {
  if (keywords.length === 0) {
    return false;
  }

  const lowerPath = path.toLowerCase();
  return keywords.some((keyword) => lowerPath.includes(keyword));
}

function flattenUnknownValue(
  value: unknown,
  output: TableRowData,
  path: string,
  depth: number,
  options: {
    maxFlattenDepth: number;
    arrayItemLimit: number;
    excludeFieldKeywords: string[];
  }
): void {
  if (shouldExcludeField(path, options.excludeFieldKeywords)) {
    return;
  }

  if (isPrimitive(value)) {
    output[path] = normalizeScalar(value);
    return;
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      output[path] = null;
      return;
    }

    if (depth >= options.maxFlattenDepth) {
      output[path] = safeJsonStringify(value);
      return;
    }

    if (value.every((item) => isPrimitive(item))) {
      output[path] = value
        .map((item) => normalizeScalar(item))
        .filter((item): item is string | number | boolean => item !== null)
        .map((item) => String(item))
        .join(', ');
      return;
    }

    const sliceLimit = Math.min(value.length, options.arrayItemLimit);
    for (let index = 0; index < sliceLimit; index += 1) {
      flattenUnknownValue(value[index], output, `${path}[${index}]`, depth + 1, options);
    }

    if (value.length > sliceLimit) {
      output[`${path}.__extra_count`] = value.length - sliceLimit;
    }

    return;
  }

  if (isPlainObject(value)) {
    const entries = Object.entries(value);

    if (entries.length === 0) {
      output[path] = safeJsonStringify(value);
      return;
    }

    if (depth >= options.maxFlattenDepth) {
      output[path] = safeJsonStringify(value);
      return;
    }

    for (const [rawKey, nestedValue] of entries) {
      const key = rawKey.trim();
      if (!key) {
        continue;
      }

      const nextPath = path ? `${path}.${key}` : key;
      flattenUnknownValue(nestedValue, output, nextPath, depth + 1, options);
    }

    return;
  }

  output[path] = safeJsonStringify(value);
}

function hasTimeMarker(value: Record<string, unknown>): boolean {
  return ['end_time', 'endTime', 'date', 'timestamp', 'time'].some((key) => key in value);
}

function isTimeSeriesArray(value: unknown): value is Array<Record<string, unknown>> {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every((item) => isPlainObject(item) && 'value' in item && hasTimeMarker(item))
  );
}

function expandTimeSeriesRows(rows: unknown[]): unknown[] {
  const output: unknown[] = [];

  for (const row of rows) {
    if (!isPlainObject(row)) {
      output.push(row);
      continue;
    }

    const timeSeriesEntry = Object.entries(row).find(([, value]) => isTimeSeriesArray(value));
    if (!timeSeriesEntry) {
      output.push(row);
      continue;
    }

    const [seriesKey, rawSeries] = timeSeriesEntry;
    const series = rawSeries as Array<Record<string, unknown>>;
    const base: Record<string, unknown> = { ...row };
    delete base[seriesKey];

    for (let index = 0; index < series.length; index += 1) {
      const point = series[index];
      const expandedRow: Record<string, unknown> = {
        ...base,
        [`${seriesKey}.index`]: index,
      };

      for (const [pointKey, pointValue] of Object.entries(point)) {
        const normalizedKey = pointKey === 'end_time' ? 'endTime' : pointKey;
        expandedRow[`${seriesKey}.${normalizedKey}`] = pointValue;
      }

      output.push(expandedRow);
    }
  }

  return output;
}

function toTableRow(
  candidate: unknown,
  options: {
    maxFlattenDepth: number;
    arrayItemLimit: number;
    excludeFieldKeywords: string[];
  }
): TableRowData {
  if (!isPlainObject(candidate)) {
    return {
      value: normalizeScalar(candidate),
    };
  }

  const output: TableRowData = {};
  for (const [rawKey, nestedValue] of Object.entries(candidate)) {
    const key = rawKey.trim();
    if (!key) {
      continue;
    }

    flattenUnknownValue(nestedValue, output, key, 1, options);
  }

  if (Object.keys(output).length === 0) {
    return {
      value: normalizeScalar(candidate),
    };
  }

  return output;
}

export function discoverArrayCandidates(payload: unknown, maxDepth = 8): ArrayCandidate[] {
  const candidatesByPath = new Map<string, ArrayCandidate>();

  const pushCandidate = (path: string, value: unknown[]) => {
    if (candidatesByPath.has(path)) {
      return;
    }

    const length = value.length;
    candidatesByPath.set(path, {
      path,
      length,
      score: scoreArrayCandidate(path, length),
    });
  };

  const walk = (node: unknown, path: string, depth: number) => {
    if (!isPlainObject(node) || depth > maxDepth) {
      return;
    }

    for (const [rawKey, nestedValue] of Object.entries(node)) {
      const key = rawKey.trim();
      if (!key) {
        continue;
      }

      const nextPath = path === '$' ? `$.${key}` : `${path}.${key}`;

      if (Array.isArray(nestedValue)) {
        pushCandidate(nextPath, nestedValue);
        if (depth < maxDepth && nestedValue.length > 0 && isPlainObject(nestedValue[0])) {
          walk(nestedValue[0], `${nextPath}[0]`, depth + 1);
        }
      } else if (isPlainObject(nestedValue)) {
        walk(nestedValue, nextPath, depth + 1);
      }
    }
  };

  if (Array.isArray(payload)) {
    pushCandidate('$', payload);
  }

  if (isPlainObject(payload)) {
    walk(payload, '$', 0);
  }

  return Array.from(candidatesByPath.values()).sort((left, right) => right.score - left.score);
}

function resolveRowsFromRoot(
  payload: unknown,
  rootArrayPath: string | undefined,
  candidates: ArrayCandidate[]
): { rows: unknown[]; path: string } {
  if (rootArrayPath && rootArrayPath !== AUTO_ROOT_ARRAY_PATH) {
    const explicit = getValueByPath(payload, rootArrayPath);
    if (Array.isArray(explicit)) {
      return {
        rows: explicit,
        path: rootArrayPath,
      };
    }

    if (rootArrayPath === '$' && Array.isArray(payload)) {
      return {
        rows: payload,
        path: '$',
      };
    }
  }

  if (candidates.length > 0) {
    const preferred = candidates.find((candidate) =>
      PREFERRED_ARRAY_KEYS.some((key) => candidate.path.toLowerCase().endsWith(`.${key}`))
    );

    const bestCandidate = preferred ?? candidates[0];
    const candidateRows = getValueByPath(payload, bestCandidate.path);
    if (Array.isArray(candidateRows)) {
      return {
        rows: candidateRows,
        path: bestCandidate.path,
      };
    }
  }

  if (Array.isArray(payload)) {
    return {
      rows: payload,
      path: '$',
    };
  }

  return {
    rows: [payload],
    path: '$',
  };
}

export function normalizeHttpRowsForTable(
  payload: unknown,
  options: NormalizeHttpRowsOptions = {}
): NormalizeHttpRowsResult {
  const arrayCandidates = options.arrayCandidates ?? discoverArrayCandidates(payload);
  const maxFlattenDepth = Math.max(1, options.maxFlattenDepth ?? DEFAULT_FLATTEN_DEPTH);
  const previewRowLimit = Math.max(1, options.previewRowLimit ?? DEFAULT_PREVIEW_LIMIT);
  const arrayItemLimit = Math.max(1, options.arrayItemLimit ?? DEFAULT_ARRAY_ITEM_LIMIT);
  const excludeFieldKeywords = (options.excludeFieldKeywords ?? [])
    .map((keyword) => keyword.trim().toLowerCase())
    .filter((keyword) => keyword.length > 0);

  const resolved = resolveRowsFromRoot(payload, options.rootArrayPath, arrayCandidates);
  const sourceRows = options.explodeTimeSeries ? expandTimeSeriesRows(resolved.rows) : resolved.rows;

  const flattenedRows = sourceRows.map((candidate) =>
    toTableRow(candidate, {
      maxFlattenDepth,
      arrayItemLimit,
      excludeFieldKeywords,
    })
  );

  const columnKeys: string[] = [];
  for (const row of flattenedRows) {
    for (const key of Object.keys(row)) {
      if (!columnKeys.includes(key)) {
        columnKeys.push(key);
      }
    }
  }

  const rows = flattenedRows.slice(0, previewRowLimit).map((row) => {
    const normalized: TableRowData = {};
    for (const key of columnKeys) {
      normalized[key] = key in row ? row[key] : null;
    }
    return normalized;
  });

  return {
    rows,
    columnKeys,
    totalRows: sourceRows.length,
    appliedRootArrayPath: resolved.path,
    arrayCandidates,
  };
}

export function formatTableCellValue(value: TablePrimitive): string {
  if (value === null || value === undefined) {
    return '';
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value.toLocaleString() : String(value);
  }

  if (typeof value === 'boolean') {
    return value ? 'true' : 'false';
  }

  return value;
}

function looksLikeEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function looksLikeUrl(value: string): boolean {
  return /^https?:\/\//i.test(value);
}

function looksLikePhone(value: string): boolean {
  return /^[+]?[0-9().\s-]{7,}$/.test(value);
}

function looksLikeDate(value: string): boolean {
  if (!/(\d{4}-\d{2}-\d{2}|\d{4}\/\d{2}\/\d{2}|\d{2}\/\d{2}\/\d{4})/.test(value)) {
    return false;
  }

  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp);
}

function looksLikeMediaUrl(value: string): boolean {
  if (!looksLikeUrl(value)) {
    return false;
  }

  return /\.(png|jpg|jpeg|gif|webp|mp4|mov|mkv)(?:\?|$)/i.test(value);
}

function looksLikeMultiSelectValue(value: string): boolean {
  return /[,;|]/.test(value);
}

export function inferNotionType(values: TablePrimitive[]): NotionFieldType {
  const nonEmptyValues = values.filter((value) => value !== null && value !== '');

  if (nonEmptyValues.length === 0) {
    return 'text';
  }

  if (nonEmptyValues.every((value) => typeof value === 'boolean')) {
    return 'checkbox';
  }

  if (nonEmptyValues.every((value) => typeof value === 'number')) {
    return 'number';
  }

  const strings = nonEmptyValues
    .filter((value): value is string => typeof value === 'string')
    .map((value) => value.trim())
    .filter((value) => value.length > 0);

  if (strings.length === 0) {
    return 'text';
  }

  if (strings.every(looksLikeEmail)) {
    return 'email';
  }

  if (strings.every(looksLikeMediaUrl)) {
    return 'files';
  }

  if (strings.every(looksLikeUrl)) {
    return 'url';
  }

  if (strings.every(looksLikePhone)) {
    return 'phone';
  }

  if (strings.every(looksLikeDate)) {
    return 'date';
  }

  if (strings.every(looksLikeMultiSelectValue)) {
    return 'multi_select';
  }

  return 'text';
}
