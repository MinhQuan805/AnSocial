'use client';

import { useMemo, useState } from 'react';
import { X, Search, ChevronDown } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

export type SelectOption = {
  key: string;
  label: string;
  description: string;
  uiGroup: string;
};

interface MultiSelectDropdownFieldProps {
  label: string;
  options: SelectOption[];
  value: string[];
  onChange: (selected: string[]) => void;
  placeholder?: string;
}

export function MultiSelectDropdownField({
  label,
  options,
  value,
  onChange,
  placeholder = 'Search...',
}: MultiSelectDropdownFieldProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [open, setOpen] = useState(false);

  // Group options by uiGroup
  const groupedOptions = useMemo(() => {
    const groups: Record<string, SelectOption[]> = {};

    for (const option of options) {
      if (!groups[option.uiGroup]) {
        groups[option.uiGroup] = [];
      }
      groups[option.uiGroup].push(option);
    }

    return Object.entries(groups).map(([groupName, items]) => ({
      groupName,
      items,
    }));
  }, [options]);

  // Filter options based on search query
  const filteredGroups = useMemo(() => {
    if (!searchQuery.trim()) {
      return groupedOptions;
    }

    const query = searchQuery.toLowerCase();
    return groupedOptions
      .map((group) => ({
        ...group,
        items: group.items.filter(
          (item) =>
            item.label.toLowerCase().includes(query) ||
            item.description.toLowerCase().includes(query) ||
            item.key.toLowerCase().includes(query)
        ),
      }))
      .filter((group) => group.items.length > 0);
  }, [groupedOptions, searchQuery]);

  // Get selected option details
  const selectedOptions = useMemo(
    () => options.filter((opt) => value.includes(opt.key)),
    [options, value]
  );

  const handleToggle = (key: string) => {
    const newValue = value.includes(key) ? value.filter((item) => item !== key) : [...value, key];
    onChange(newValue);
  };

  const handleRemoveChip = (e: React.MouseEvent, key: string) => {
    e.stopPropagation();
    onChange(value.filter((item) => item !== key));
  };

  return (
    <div className="space-y-2">
      <Label className="text-sm">{label}</Label>

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <div className="cursor-pointer">
            {/* Dropdown trigger button */}
            <div
              className={cn(
                'flex min-h-11 items-start justify-between gap-2 rounded-md border px-3 py-2 text-sm transition-colors',
                open
                  ? 'border-primary/50 bg-primary/10'
                  : 'border-zinc-200 bg-white hover:border-zinc-300'
              )}
            >
              <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
                {selectedOptions.length === 0 ? (
                  <span className="text-zinc-500">{placeholder}</span>
                ) : (
                  selectedOptions.map((opt) => (
                    <div
                      key={opt.key}
                      className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2.5 py-1 text-xs text-primary"
                    >
                      <span className="truncate">{opt.label}</span>
                      <button
                        type="button"
                        onClick={(e) => handleRemoveChip(e, opt.key)}
                        className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-full hover:bg-primary/25 focus:outline-hidden"
                        aria-label={`Remove ${opt.label}`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))
                )}
              </div>
              <ChevronDown
                className={cn(
                  'mt-1 h-4 w-4 shrink-0 text-zinc-400 transition-transform',
                  open && 'rotate-180'
                )}
              />
            </div>
          </div>
        </PopoverTrigger>

        <PopoverContent className="w-full p-4" align="start" side="bottom">
          <div className="space-y-3">
            {/* Search input */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
              <Input
                type="text"
                placeholder={placeholder}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
                autoFocus
              />
            </div>

            {/* Grouped checkboxes */}
            <div className="max-h-[320px] overflow-auto">
              {filteredGroups.length === 0 ? (
                <div className="flex items-center justify-center py-8 text-sm text-zinc-400">
                  No options match your search
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredGroups.map((group) => (
                    <div key={group.groupName}>
                      <div className="mb-2 text-xs font-semibold uppercase text-zinc-500">
                        {group.groupName}
                      </div>
                      <div className="space-y-2">
                        {group.items.map((item) => (
                          <label
                            key={item.key}
                            className="flex cursor-pointer items-start gap-3 rounded-md p-2 hover:bg-zinc-50"
                          >
                            <input
                              type="checkbox"
                              checked={value.includes(item.key)}
                              onChange={() => handleToggle(item.key)}
                              className="mt-0.5 h-4 w-4 rounded border-zinc-300 text-primary focus:ring-primary"
                            />
                            <div className="min-w-0 flex-1">
                              <div className="text-sm font-medium text-zinc-900">{item.label}</div>
                              <div className="text-xs text-zinc-500">{item.description}</div>
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
