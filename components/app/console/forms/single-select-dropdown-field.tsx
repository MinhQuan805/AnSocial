'use client';

import { Fragment, useMemo, useState } from 'react';
import { ChevronDown, Search, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils/cn';

export type SingleSelectDropdownOption = {
  value: string;
  label: string;
  description?: string;
  group?: string;
  disabled?: boolean;
};

interface SingleSelectDropdownFieldProps {
  id?: string;
  label?: string;
  labelClassName?: string;
  value: string;
  options: SingleSelectDropdownOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  triggerClassName?: string;
  contentClassName?: string;
  /** Show a search input at the top of the dropdown to filter options by label/description */
  searchable?: boolean;
  /** Placeholder for the search input */
  searchPlaceholder?: string;
}

type OptionGroup = {
  key: string;
  title?: string;
  options: SingleSelectDropdownOption[];
};

const DEFAULT_GROUP_KEY = '__default__';

export function SingleSelectDropdownField({
  id,
  label,
  labelClassName,
  value,
  options,
  onChange,
  placeholder = 'Select an option',
  disabled = false,
  triggerClassName,
  contentClassName,
  searchable = false,
  searchPlaceholder = 'Search...',
}: SingleSelectDropdownFieldProps) {
  const [searchQuery, setSearchQuery] = useState('');

  const selectedOption = useMemo(
    () => options.find((option) => option.value === value),
    [options, value]
  );

  const filteredOptions = useMemo(() => {
    if (!searchable || !searchQuery.trim()) return options;
    const query = searchQuery.toLowerCase().trim();
    return options.filter(
      (option) =>
        option.label.toLowerCase().includes(query) ||
        (option.description?.toLowerCase().includes(query) ?? false) ||
        option.value.toLowerCase().includes(query)
    );
  }, [options, searchable, searchQuery]);

  const groupedOptions = useMemo<OptionGroup[]>(() => {
    const map = new Map<string, OptionGroup>();

    for (const option of filteredOptions) {
      const groupKey = option.group?.trim() || DEFAULT_GROUP_KEY;
      const existing = map.get(groupKey);
      if (existing) {
        existing.options.push(option);
        continue;
      }

      map.set(groupKey, {
        key: groupKey,
        title: groupKey === DEFAULT_GROUP_KEY ? undefined : option.group,
        options: [option],
      });
    }

    return Array.from(map.values());
  }, [filteredOptions]);

  return (
    <div className="space-y-2">
      {label ? (
        <Label htmlFor={id} className={labelClassName}>
          {label}
        </Label>
      ) : null}

      <DropdownMenu
        onOpenChange={(open) => {
          if (!open) setSearchQuery('');
        }}
      >
        <DropdownMenuTrigger asChild>
          <Button
            id={id}
            type="button"
            variant="outline"
            disabled={disabled}
            className={cn(
              'h-11 w-full justify-between gap-2',
              !selectedOption && 'text-muted-foreground',
              triggerClassName
            )}
          >
            <span className="truncate text-left">{selectedOption?.label ?? placeholder}</span>
            <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="start" className={cn('max-h-80', contentClassName)}>
          {searchable ? (
            <div className="sticky top-0 z-10 bg-popover px-2 pb-2 pt-1">
              <div className="relative">
                <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={searchPlaceholder}
                  className="h-8 w-full rounded-md border border-input bg-transparent pl-7 pr-7 text-sm outline-none placeholder:text-muted-foreground focus:ring-1 focus:ring-ring"
                  // Prevent dropdown from closing when typing
                  onKeyDown={(e) => e.stopPropagation()}
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
              {searchQuery && (
                <p className="mt-1 text-[10px] text-muted-foreground tabular-nums">
                  {filteredOptions.length} / {options.length} results
                </p>
              )}
            </div>
          ) : null}

          <DropdownMenuRadioGroup value={value} onValueChange={onChange}>
            {groupedOptions.length === 0 && searchQuery ? (
              <div className="px-3 py-4 text-center text-xs text-muted-foreground">
                No results for &quot;{searchQuery}&quot;
              </div>
            ) : null}
            {groupedOptions.map((group, groupIndex) => (
              <Fragment key={group.key}>
                {group.title ? <DropdownMenuLabel>{group.title}</DropdownMenuLabel> : null}
                <DropdownMenuGroup>
                  {group.options.map((option) => (
                    <DropdownMenuRadioItem
                      key={option.value}
                      value={option.value}
                      disabled={option.disabled}
                      className="py-2"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{option.label}</p>
                        {option.description ? (
                          <p className="truncate text-xs text-muted-foreground">
                            {option.description}
                          </p>
                        ) : null}
                      </div>
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuGroup>
                {groupIndex < groupedOptions.length - 1 ? <DropdownMenuSeparator /> : null}
              </Fragment>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
