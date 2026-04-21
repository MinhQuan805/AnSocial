'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type PaginationState,
  type SortingState,
  type VisibilityState,
} from '@tanstack/react-table';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Columns3,
  Filter,
  RefreshCw,
  Settings2,
} from 'lucide-react';

import {
  SingleSelectDropdownField,
  type SingleSelectDropdownOption,
} from '@/components/app/console/forms/single-select-dropdown-field';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AUTO_ROOT_ARRAY_PATH,
  discoverArrayCandidates,
  formatTableCellValue,
  inferNotionType,
  normalizeHttpRowsForTable,
  type NotionFieldType,
  type TablePrimitive,
  type TableRowData,
} from '@/lib/utils/http-response-table';
import { parseProviderPayload } from '@/lib/insights/http-provider-parsers';

const PREVIEW_ROW_LIMIT = 100;
const DEFAULT_FLATTEN_DEPTH = 6;
const MAPPING_TEMPLATE_STORAGE_KEY = 'ana_http_mapping_templates_v1';

const NOTION_TYPE_OPTIONS: SingleSelectDropdownOption[] = [
  { value: 'text', label: 'Text' },
  { value: 'number', label: 'Number' },
  { value: 'checkbox', label: 'Checkbox' },
  { value: 'email', label: 'Email' },
  { value: 'phone', label: 'Phone' },
  { value: 'url', label: 'URL' },
  { value: 'date', label: 'Date' },
  { value: 'files', label: 'Files & Media' },
  { value: 'multi_select', label: 'Multi-select' },
  { value: 'select', label: 'Select' },
  { value: 'relation', label: 'Relation' },
];

interface ColumnMeta {
  key: string;
  suggestedType: NotionFieldType;
}

interface HttpResponseNotionTableProps {
  responseData: unknown;
  requestUrl?: string;
}

interface ProviderMappingTemplate {
  rootArrayPath: string;
  maxFlattenDepth: number;
  excludeFieldInput: string;
  explodeTimeSeries: boolean;
  columnOrder: string[];
  selectedByColumn: Record<string, boolean>;
  mappedNameByColumn: Record<string, string>;
  notionTypeByColumn: Record<string, NotionFieldType>;
  relationTargetByColumn: Record<string, string>;
}

function getSourceKeyFromUrl(requestUrl?: string): string | null {
  if (!requestUrl || requestUrl.trim().length === 0) {
    return null;
  }

  try {
    const parsed = new URL(requestUrl);
    const host = parsed.hostname.trim().toLowerCase();
    return host.length > 0 ? host : null;
  } catch {
    const compact = requestUrl.trim().toLowerCase();
    return compact.length > 0 ? compact.slice(0, 120) : null;
  }
}

function readTemplateMap(): Record<string, ProviderMappingTemplate> {
  if (typeof window === 'undefined') {
    return {};
  }

  const raw = window.localStorage.getItem(MAPPING_TEMPLATE_STORAGE_KEY);
  if (!raw) {
    return {};
  }

  try {
    const parsed = JSON.parse(raw) as Record<string, ProviderMappingTemplate>;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeTemplateMap(map: Record<string, ProviderMappingTemplate>): void {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(MAPPING_TEMPLATE_STORAGE_KEY, JSON.stringify(map));
}

function parseExcludeKeywords(input: string): string[] {
  return input
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter((item) => item.length > 0);
}

function getSortLabel(sorting: SortingState, columnKey: string): 'Sort' | 'Asc' | 'Desc' {
  const current = sorting.find((item) => item.id === columnKey);
  if (!current) {
    return 'Sort';
  }

  return current.desc ? 'Desc' : 'Asc';
}

export function HttpResponseNotionTable({ responseData, requestUrl }: HttpResponseNotionTableProps) {
  const sourceKey = useMemo(() => getSourceKeyFromUrl(requestUrl), [requestUrl]);
  const templateAppliedRef = useRef<string | null>(null);
  const parsedProviderData = useMemo(
    () => parseProviderPayload({ requestUrl, payload: responseData }),
    [requestUrl, responseData]
  );

  const arrayCandidates = useMemo(
    () => discoverArrayCandidates(parsedProviderData.payload),
    [parsedProviderData.payload]
  );

  const [searchValue, setSearchValue] = useState('');
  const [rootArrayPath, setRootArrayPath] = useState<string>(AUTO_ROOT_ARRAY_PATH);
  const [maxFlattenDepth, setMaxFlattenDepth] = useState(DEFAULT_FLATTEN_DEPTH);
  const [excludeFieldInput, setExcludeFieldInput] = useState('');
  const [explodeTimeSeries, setExplodeTimeSeries] = useState(true);

  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnOrder, setColumnOrder] = useState<string[]>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  });

  const [selectedByColumn, setSelectedByColumn] = useState<Record<string, boolean>>({});
  const [mappedNameByColumn, setMappedNameByColumn] = useState<Record<string, string>>({});
  const [notionTypeByColumn, setNotionTypeByColumn] = useState<Record<string, NotionFieldType>>({});
  const [relationTargetByColumn, setRelationTargetByColumn] = useState<Record<string, string>>({});

  const excludeKeywords = useMemo(() => parseExcludeKeywords(excludeFieldInput), [excludeFieldInput]);

  const normalizedData = useMemo(
    () =>
      normalizeHttpRowsForTable(parsedProviderData.payload, {
        rootArrayPath: rootArrayPath === AUTO_ROOT_ARRAY_PATH ? undefined : rootArrayPath,
        maxFlattenDepth,
        previewRowLimit: PREVIEW_ROW_LIMIT,
        explodeTimeSeries,
        excludeFieldKeywords: excludeKeywords,
        arrayCandidates,
      }),
    [
      arrayCandidates,
      excludeKeywords,
      explodeTimeSeries,
      maxFlattenDepth,
      parsedProviderData.payload,
      rootArrayPath,
    ]
  );

  const filteredRows = useMemo(() => {
    const query = searchValue.trim().toLowerCase();
    if (!query) {
      return normalizedData.rows;
    }

    return normalizedData.rows.filter((row) =>
      normalizedData.columnKeys.some((key) =>
        formatTableCellValue(row[key]).toLowerCase().includes(query)
      )
    );
  }, [normalizedData.columnKeys, normalizedData.rows, searchValue]);

  const columnKeysSignature = useMemo(
    () => normalizedData.columnKeys.join('|'),
    [normalizedData.columnKeys]
  );

  const columnMeta = useMemo<ColumnMeta[]>(() => {
    return normalizedData.columnKeys.map((key) => {
      const values = normalizedData.rows.map((row) => row[key]);
      return {
        key,
        suggestedType: inferNotionType(values),
      };
    });
  }, [normalizedData.columnKeys, normalizedData.rows]);

  useEffect(() => {
    if (rootArrayPath === AUTO_ROOT_ARRAY_PATH) {
      return;
    }

    const exists =
      rootArrayPath === '$' || arrayCandidates.some((candidate) => candidate.path === rootArrayPath);
    if (!exists) {
      setRootArrayPath(AUTO_ROOT_ARRAY_PATH);
    }
  }, [arrayCandidates, rootArrayPath]);

  useEffect(() => {
    const currentKeys = columnMeta.map((item) => item.key);

    setColumnOrder((previous) => {
      const stillAvailable = previous.filter((key) => currentKeys.includes(key));
      const newKeys = currentKeys.filter((key) => !stillAvailable.includes(key));
      return [...stillAvailable, ...newKeys];
    });

    setSelectedByColumn((previous) => {
      const next: Record<string, boolean> = {};
      for (const key of currentKeys) {
        next[key] = previous[key] ?? true;
      }
      return next;
    });

    setMappedNameByColumn((previous) => {
      const next: Record<string, string> = {};
      for (const key of currentKeys) {
        next[key] = previous[key] ?? key;
      }
      return next;
    });

    setNotionTypeByColumn((previous) => {
      const next: Record<string, NotionFieldType> = {};
      for (const item of columnMeta) {
        next[item.key] = previous[item.key] ?? item.suggestedType;
      }
      return next;
    });

    setRelationTargetByColumn((previous) => {
      const next: Record<string, string> = {};
      for (const key of currentKeys) {
        next[key] = previous[key] ?? '';
      }
      return next;
    });

    setColumnVisibility((previous) => {
      const next: VisibilityState = {};
      for (const key of currentKeys) {
        next[key] = key in previous ? previous[key] : true;
      }
      return next;
    });
  }, [columnMeta]);

  useEffect(() => {
    const validColumns = new Set(normalizedData.columnKeys);
    setSorting((previous) => previous.filter((item) => validColumns.has(item.id as string)));
    setPagination((previous) => ({ ...previous, pageIndex: 0 }));
  }, [filteredRows.length, normalizedData.columnKeys]);

  useEffect(() => {
    templateAppliedRef.current = null;
  }, [columnKeysSignature, sourceKey]);

  useEffect(() => {
    if (!sourceKey || normalizedData.columnKeys.length === 0) {
      return;
    }

    if (templateAppliedRef.current === sourceKey) {
      return;
    }

    const templateMap = readTemplateMap();
    const template = templateMap[sourceKey];
    if (!template) {
      if (parsedProviderData.hints.defaultRootArrayPath) {
        setRootArrayPath(parsedProviderData.hints.defaultRootArrayPath);
      }

      if (parsedProviderData.hints.excludeFieldKeywords?.length) {
        setExcludeFieldInput(parsedProviderData.hints.excludeFieldKeywords.join(','));
      }

      if (typeof parsedProviderData.hints.explodeTimeSeries === 'boolean') {
        setExplodeTimeSeries(parsedProviderData.hints.explodeTimeSeries);
      }

      templateAppliedRef.current = sourceKey;
      return;
    }

    const validColumns = new Set(normalizedData.columnKeys);
    const mergedOrder = [
      ...template.columnOrder.filter((column) => validColumns.has(column)),
      ...normalizedData.columnKeys.filter((column) => !template.columnOrder.includes(column)),
    ];

    setRootArrayPath(template.rootArrayPath || AUTO_ROOT_ARRAY_PATH);
    setMaxFlattenDepth(
      Number.isFinite(template.maxFlattenDepth)
        ? Math.max(1, Math.min(12, template.maxFlattenDepth))
        : DEFAULT_FLATTEN_DEPTH
    );
    setExcludeFieldInput(template.excludeFieldInput || '');
    setExplodeTimeSeries(Boolean(template.explodeTimeSeries));
    setColumnOrder(mergedOrder);

    setSelectedByColumn(() => {
      const next: Record<string, boolean> = {};
      for (const key of normalizedData.columnKeys) {
        next[key] = key in template.selectedByColumn ? template.selectedByColumn[key] : true;
      }
      return next;
    });

    setMappedNameByColumn(() => {
      const next: Record<string, string> = {};
      for (const key of normalizedData.columnKeys) {
        next[key] = template.mappedNameByColumn[key] ?? key;
      }
      return next;
    });

    setNotionTypeByColumn(() => {
      const next: Record<string, NotionFieldType> = {};
      for (const key of normalizedData.columnKeys) {
        next[key] =
          template.notionTypeByColumn[key] ??
          inferNotionType(normalizedData.rows.map((row) => row[key]));
      }
      return next;
    });

    setRelationTargetByColumn(() => {
      const next: Record<string, string> = {};
      for (const key of normalizedData.columnKeys) {
        next[key] = template.relationTargetByColumn[key] ?? '';
      }
      return next;
    });

    templateAppliedRef.current = sourceKey;
  }, [normalizedData.columnKeys, normalizedData.rows, parsedProviderData.hints, sourceKey]);

  useEffect(() => {
    if (!sourceKey || normalizedData.columnKeys.length === 0) {
      return;
    }

    const templateMap = readTemplateMap();
    templateMap[sourceKey] = {
      rootArrayPath,
      maxFlattenDepth,
      excludeFieldInput,
      explodeTimeSeries,
      columnOrder,
      selectedByColumn,
      mappedNameByColumn,
      notionTypeByColumn,
      relationTargetByColumn,
    };
    writeTemplateMap(templateMap);
  }, [
    columnOrder,
    excludeFieldInput,
    explodeTimeSeries,
    mappedNameByColumn,
    maxFlattenDepth,
    normalizedData.columnKeys.length,
    notionTypeByColumn,
    relationTargetByColumn,
    rootArrayPath,
    selectedByColumn,
    sourceKey,
  ]);

  const rootArrayOptions = useMemo<SingleSelectDropdownOption[]>(() => {
    const options: SingleSelectDropdownOption[] = [
      {
        value: AUTO_ROOT_ARRAY_PATH,
        label: 'Auto detect root array',
        description: `Using ${normalizedData.appliedRootArrayPath}`,
      },
    ];

    for (const candidate of arrayCandidates) {
      options.push({
        value: candidate.path,
        label: candidate.path,
        description: `${candidate.length} rows`,
      });
    }

    if (options.every((item) => item.value !== '$')) {
      options.push({
        value: '$',
        label: '$',
        description: 'Root payload',
      });
    }

    return options;
  }, [arrayCandidates, normalizedData.appliedRootArrayPath]);

  const columns = useMemo<ColumnDef<TableRowData>[]>(() => {
    return columnOrder.map((columnKey) => ({
      id: columnKey,
      accessorFn: (row) => row[columnKey],
      sortingFn: 'alphanumeric',
      enableHiding: true,
    }));
  }, [columnOrder]);

  // eslint-disable-next-line react-hooks/incompatible-library -- TanStack Table hook is intended here.
  const table = useReactTable({
    data: filteredRows,
    columns,
    state: {
      sorting,
      columnOrder,
      columnVisibility,
      pagination,
    },
    onSortingChange: setSorting,
    onColumnOrderChange: setColumnOrder,
    onColumnVisibilityChange: setColumnVisibility,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  const selectedCount = columnOrder.filter((key) => selectedByColumn[key]).length;
  const allSelected = columnOrder.length > 0 && selectedCount === columnOrder.length;
  const sortCount = sorting.length;

  const cycleSorting = (columnKey: string) => {
    setSorting((previous) => {
      const current = previous.find((item) => item.id === columnKey);
      if (!current) {
        return [{ id: columnKey, desc: false }];
      }

      if (!current.desc) {
        return [{ id: columnKey, desc: true }];
      }

      return [];
    });
  };

  const moveColumn = (columnKey: string, direction: -1 | 1) => {
    setColumnOrder((previous) => {
      const index = previous.indexOf(columnKey);
      if (index < 0) {
        return previous;
      }

      const targetIndex = index + direction;
      if (targetIndex < 0 || targetIndex >= previous.length) {
        return previous;
      }

      const next = [...previous];
      [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
      return next;
    });
  };

  const resetToolbarOptions = () => {
    setSearchValue('');
    setRootArrayPath(AUTO_ROOT_ARRAY_PATH);
    setMaxFlattenDepth(DEFAULT_FLATTEN_DEPTH);
    setExcludeFieldInput('');
    setExplodeTimeSeries(true);
    setSorting([]);
  };

  if (normalizedData.columnKeys.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-zinc-300 bg-zinc-50 p-6 text-sm text-zinc-500">
        Response is empty or cannot be rendered into rows.
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      <div className="overflow-hidden rounded-xl border border-border/70 bg-card">
        <div className="flex flex-wrap items-center gap-2 border-b border-border/70 p-3">
          <Input
            value={searchValue}
            onChange={(event) => setSearchValue(event.target.value)}
            placeholder="Search values..."
            className="h-8 w-[190px] lg:w-[240px]"
          />

          <div className="w-[220px] sm:w-[260px]">
            <SingleSelectDropdownField
              value={rootArrayPath}
              options={rootArrayOptions}
              onChange={setRootArrayPath}
              triggerClassName="h-8 bg-background"
              searchable
              searchPlaceholder="Search array path..."
            />
          </div>

          <label className="inline-flex h-8 items-center gap-2 rounded-md border border-input bg-background px-2 text-xs text-muted-foreground">
            Depth
            <input
              type="number"
              min={1}
              max={12}
              value={maxFlattenDepth}
              onChange={(event) => {
                const next = Number.parseInt(event.target.value, 10);
                if (!Number.isFinite(next)) {
                  return;
                }

                setMaxFlattenDepth(Math.max(1, Math.min(12, next)));
              }}
              className="h-6 w-12 rounded-md border border-input bg-background px-1.5 text-right text-foreground"
            />
          </label>

          <Input
            value={excludeFieldInput}
            onChange={(event) => setExcludeFieldInput(event.target.value)}
            placeholder="Ignore keys: paging,summary"
            className="h-8 w-[220px] lg:w-[260px]"
          />

          <label className="inline-flex h-8 items-center gap-2 rounded-md border border-input bg-background px-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={explodeTimeSeries}
              onChange={(event) => setExplodeTimeSeries(event.target.checked)}
            />
            Explode time-series
          </label>

          <Button variant="outline" size="sm" className="h-8" onClick={resetToolbarOptions}>
            <RefreshCw className="h-3.5 w-3.5" />
            Reset
          </Button>

          <div className="ml-auto flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 font-normal">
                  <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />
                  Sort
                  {sortCount > 0 ? (
                    <span className="rounded-sm bg-muted px-1.5 py-0.5 font-mono text-[10px] leading-none text-muted-foreground">
                      {sortCount}
                    </span>
                  ) : null}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                <DropdownMenuLabel>Sort by</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {columnOrder.length === 0 ? (
                  <DropdownMenuItem disabled>No sortable columns</DropdownMenuItem>
                ) : (
                  columnOrder.map((columnKey) => {
                    const sortLabel = getSortLabel(sorting, columnKey);
                    return (
                      <DropdownMenuCheckboxItem
                        key={`sort-${columnKey}`}
                        checked={sortLabel !== 'Sort'}
                        onCheckedChange={() => cycleSorting(columnKey)}
                      >
                        <span className="truncate">{mappedNameByColumn[columnKey] ?? columnKey}</span>
                        {sortLabel !== 'Sort' ? (
                          <span className="ml-auto pl-2 text-[11px] text-muted-foreground">
                            {sortLabel}
                          </span>
                        ) : null}
                      </DropdownMenuCheckboxItem>
                    );
                  })
                )}
                {sortCount > 0 ? (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => setSorting([])}>Reset sorting</DropdownMenuItem>
                  </>
                ) : null}
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 font-normal">
                  <Settings2 className="h-3.5 w-3.5 text-muted-foreground" />
                  View
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>Toggle columns</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {table
                  .getAllColumns()
                  .filter((column) => column.getCanHide())
                  .map((column) => (
                    <DropdownMenuCheckboxItem
                      key={column.id}
                      checked={column.getIsVisible()}
                      onCheckedChange={(value) => column.toggleVisibility(Boolean(value))}
                    >
                      {mappedNameByColumn[column.id] ?? column.id}
                    </DropdownMenuCheckboxItem>
                  ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-b border-border/70 px-3 py-2">
          <Badge className="gap-1 border-border/70 bg-background text-foreground">
            <Columns3 className="h-3.5 w-3.5" />
            {selectedCount}/{columnOrder.length} fields selected
          </Badge>
          <Badge className="border-border/70 bg-background text-foreground">
            {filteredRows.length} preview rows
          </Badge>
          <Badge className="border-border/70 bg-background text-foreground">
            Root: {normalizedData.appliedRootArrayPath}
          </Badge>
          <Badge className="border-border/70 bg-background text-foreground">
            Flatten depth: {maxFlattenDepth}
          </Badge>
          {sortCount > 0 ? (
            <Badge className="border-border/70 bg-background text-foreground">Sort: {sortCount}</Badge>
          ) : null}
          <Badge className="border-border/70 bg-background text-foreground">
            Provider: {parsedProviderData.provider}
          </Badge>
          {sourceKey ? (
            <Badge className="border-border/70 bg-background text-foreground">Template: {sourceKey}</Badge>
          ) : null}
          {excludeKeywords.length > 0 ? (
            <Badge className="border-border/70 bg-background text-foreground">
              <Filter className="h-3.5 w-3.5" />
              {excludeKeywords.length} exclude filters
            </Badge>
          ) : null}
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border/70 bg-card">
        <div className="flex min-w-max gap-2 p-3">
          {columnOrder.map((columnKey, index) => {
            const sortLabel = getSortLabel(sorting, columnKey);
            const isSelected = Boolean(selectedByColumn[columnKey]);
            const notionType = notionTypeByColumn[columnKey] ?? 'text';

            return (
              <div
                key={columnKey}
                className={`w-[250px] rounded-lg border p-2.5 ${
                  isSelected ? 'border-border bg-background' : 'border-border/70 bg-muted/30'
                }`}
              >
                <label className="mb-2 inline-flex items-center gap-2 text-sm font-medium text-foreground">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={(event) => {
                      const checked = event.target.checked;
                      setSelectedByColumn((previous) => ({
                        ...previous,
                        [columnKey]: checked,
                      }));
                    }}
                  />
                  <span className="truncate" title={columnKey}>
                    {columnKey}
                  </span>
                </label>

                <Input
                  value={mappedNameByColumn[columnKey] ?? columnKey}
                  onChange={(event) => {
                    const nextValue = event.target.value;
                    setMappedNameByColumn((previous) => ({
                      ...previous,
                      [columnKey]: nextValue,
                    }));
                  }}
                  className="mb-2 h-8 bg-background"
                  placeholder="Notion field name"
                  disabled={!isSelected}
                />

                <SingleSelectDropdownField
                  value={notionType}
                  options={NOTION_TYPE_OPTIONS}
                  onChange={(nextValue) => {
                    setNotionTypeByColumn((previous) => ({
                      ...previous,
                      [columnKey]: nextValue as NotionFieldType,
                    }));
                  }}
                  triggerClassName="h-8 bg-background"
                  disabled={!isSelected}
                />

                {notionType === 'relation' ? (
                  <Input
                    value={relationTargetByColumn[columnKey] ?? ''}
                    onChange={(event) => {
                      const nextValue = event.target.value;
                      setRelationTargetByColumn((previous) => ({
                        ...previous,
                        [columnKey]: nextValue,
                      }));
                    }}
                    className="mt-2 h-8 bg-background"
                    placeholder="Relation database id"
                    disabled={!isSelected}
                  />
                ) : null}

                <div className="mt-2 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon-sm"
                      onClick={() => moveColumn(columnKey, -1)}
                      disabled={index === 0}
                      title="Move left"
                    >
                      <ChevronLeft className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon-sm"
                      onClick={() => moveColumn(columnKey, 1)}
                      disabled={index === columnOrder.length - 1}
                      title="Move right"
                    >
                      <ChevronRight className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  {sortLabel !== 'Sort' ? (
                    <Badge className="border-border/70 bg-muted px-2 py-0 text-[11px] text-muted-foreground">
                      {sortLabel}
                    </Badge>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>

        <div className="border-t border-border/70 bg-muted/20 px-3 py-2">
          <label className="inline-flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={(event) => {
                const checked = event.target.checked;
                setSelectedByColumn((previous) => {
                  const next = { ...previous };
                  for (const key of columnOrder) {
                    next[key] = checked;
                  }
                  return next;
                });
              }}
            />
            Select all columns
          </label>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-border/70 bg-card">
        <Table className="min-w-max">
          <TableHeader className="bg-muted/35">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  const columnId = header.column.id;
                  const sortState = header.column.getIsSorted();

                  return (
                    <TableHead key={header.id} className="min-w-[180px]">
                      {header.isPlaceholder ? null : (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8 px-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
                          onClick={() => header.column.toggleSorting(sortState === 'asc')}
                        >
                          <span className="max-w-[130px] truncate" title={columnId}>
                            {mappedNameByColumn[columnId] ?? columnId}
                          </span>
                          {sortState === 'asc' ? (
                            <ArrowUp className="h-3.5 w-3.5" />
                          ) : sortState === 'desc' ? (
                            <ArrowDown className="h-3.5 w-3.5" />
                          ) : (
                            <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground/60" />
                          )}
                        </Button>
                      )}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>

          <TableBody>
            {table.getRowModel().rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={Math.max(table.getVisibleLeafColumns().length, 1)}
                  className="h-20 text-center text-muted-foreground"
                >
                  No records.
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => {
                    const columnId = cell.column.id;
                    const displayValue = formatTableCellValue(cell.getValue() as TablePrimitive);
                    const isSelected = selectedByColumn[columnId];

                    return (
                      <TableCell
                        key={cell.id}
                        className={`max-w-[280px] truncate text-sm ${
                          isSelected ? 'text-foreground' : 'text-muted-foreground/70'
                        }`}
                        title={displayValue}
                      >
                        {displayValue || '-'}
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-col-reverse items-center justify-between gap-3 rounded-xl border border-border/70 bg-card px-3 py-2 sm:flex-row">
        <p className="flex-1 text-xs text-muted-foreground">
          {table.getFilteredRowModel().rows.length} rows after filter, {selectedCount} fields selected.
        </p>

        <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-4">
          <label className="inline-flex items-center gap-2 whitespace-nowrap text-xs text-muted-foreground">
            Rows per page
            <select
              value={String(table.getState().pagination.pageSize)}
              onChange={(event) => table.setPageSize(Number.parseInt(event.target.value, 10))}
              className="h-8 rounded-md border border-input bg-background px-2 text-sm text-foreground"
            >
              {[10, 20, 30, 50].map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </label>

          <p className="whitespace-nowrap text-sm text-muted-foreground">
            Page {table.getState().pagination.pageIndex + 1} of {Math.max(table.getPageCount(), 1)}
          </p>

          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            className="hidden sm:inline-flex"
            onClick={() => table.setPageIndex(0)}
            disabled={!table.getCanPreviousPage()}
            title="First page"
          >
            <ChevronsLeft className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
            title="Previous page"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
            title="Next page"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            className="hidden sm:inline-flex"
            onClick={() => table.setPageIndex(Math.max(table.getPageCount() - 1, 0))}
            disabled={!table.getCanNextPage()}
            title="Last page"
          >
            <ChevronsRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {normalizedData.totalRows > PREVIEW_ROW_LIMIT ? (
        <p className="text-xs text-muted-foreground">
          Showing first {PREVIEW_ROW_LIMIT} rows for preview.
        </p>
      ) : null}
    </div>
  );
}
