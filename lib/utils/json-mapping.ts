export type JsonPathPart = string | number;

export type JsonMappingField = {
  path: JsonPathPart[];
  label: string;
  expression: string;
  sample: string;
};

const JS_IDENTIFIER_PATTERN = /^[A-Za-z_$][A-Za-z0-9_$]*$/;
const MAPPING_EXPRESSION_MIME = "application/x-ana-mapping-expression";

function escapePathSegment(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

function formatPathLabel(path: JsonPathPart[]): string {
  return path.reduce<string>((accumulator, part, index) => {
    if (typeof part === "number") {
      return `${accumulator}[${part}]`;
    }

    const segment = String(part);

    if (JS_IDENTIFIER_PATTERN.test(segment)) {
      return index === 0 ? segment : `${accumulator}.${segment}`;
    }

    return `${accumulator}["${segment}"]`;
  }, "");
}

export function buildJsonMappedExpression(path: JsonPathPart[]): string {
  const expression = path.reduce<string>((accumulator, part) => {
    if (typeof part === "number") {
      return `${accumulator}[${part}]`;
    }

    const segment = String(part);

    if (JS_IDENTIFIER_PATTERN.test(segment)) {
      return `${accumulator}.${segment}`;
    }

    return `${accumulator}['${escapePathSegment(segment)}']`;
  }, "$json");

  return `{{ ${expression} }}`;
}

function formatSampleValue(value: unknown): string {
  if (value === null) {
    return "null";
  }

  if (value === undefined) {
    return "undefined";
  }

  if (typeof value === "string") {
    return value.length > 56 ? `${value.slice(0, 53)}...` : value;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  if (Array.isArray(value)) {
    return `Array(${value.length})`;
  }

  return "Object";
}

export function extractJsonMappingFields(
  payload: unknown,
  options?: {
    maxDepth?: number;
    maxFields?: number;
    maxArrayItems?: number;
  },
): JsonMappingField[] {
  const maxDepth = options?.maxDepth ?? 6;
  const maxFields = options?.maxFields ?? 120;
  const maxArrayItems = options?.maxArrayItems ?? 2;
  const fields: JsonMappingField[] = [];
  const seen = new Set<string>();

  const pushField = (path: JsonPathPart[], value: unknown) => {
    if (path.length === 0) {
      return;
    }

    const label = formatPathLabel(path);
    if (!label || seen.has(label)) {
      return;
    }

    seen.add(label);
    fields.push({
      path,
      label,
      expression: buildJsonMappedExpression(path),
      sample: formatSampleValue(value),
    });
  };

  const visit = (value: unknown, path: JsonPathPart[], depth: number) => {
    if (fields.length >= maxFields || depth > maxDepth) {
      return;
    }

    if (Array.isArray(value)) {
      if (value.length === 0) {
        return;
      }

      const limit = Math.min(maxArrayItems, value.length);
      for (let index = 0; index < limit; index += 1) {
        visit(value[index], [...path, index], depth + 1);
        if (fields.length >= maxFields) {
          break;
        }
      }

      return;
    }

    if (value && typeof value === "object") {
      for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
        visit(nested, [...path, key], depth + 1);
        if (fields.length >= maxFields) {
          break;
        }
      }
      return;
    }

    pushField(path, value);
  };

  visit(payload, [], 0);
  return fields;
}

export function setMappingExpressionData(dataTransfer: DataTransfer, expression: string): void {
  dataTransfer.setData(MAPPING_EXPRESSION_MIME, expression);
  dataTransfer.setData("text/plain", expression);
}

export function getMappingExpressionData(dataTransfer: DataTransfer): string | null {
  const mapped = dataTransfer.getData(MAPPING_EXPRESSION_MIME).trim();
  if (mapped.length > 0) {
    return mapped;
  }

  const fallback = dataTransfer.getData("text/plain").trim();
  if (fallback.startsWith("{{") && fallback.endsWith("}}")) {
    return fallback;
  }

  return null;
}

export function insertTextAtSelection(
  currentValue: string,
  textToInsert: string,
  selectionStart: number | null,
  selectionEnd: number | null,
): string {
  const start = selectionStart ?? currentValue.length;
  const end = selectionEnd ?? start;

  return `${currentValue.slice(0, start)}${textToInsert}${currentValue.slice(end)}`;
}