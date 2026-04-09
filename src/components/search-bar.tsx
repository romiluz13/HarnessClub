"use client";

/**
 * Global search bar with autocomplete suggestions.
 * Cmd/Ctrl+K keyboard shortcut. Debounced input.
 * Per rerender-transitions: use startTransition for search updates.
 * Per AGENTS.md: cursor-pointer, 44px targets, WCAG focus indicators.
 */

import { useState, useEffect, useRef, useCallback, startTransition } from "react";
import { useRouter } from "next/navigation";
import { Search, X, Loader2 } from "lucide-react";

interface Suggestion {
  skillId: string;
  name: string;
}

export function SearchBar() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);

  // Cmd/Ctrl+K to focus
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
      if (e.key === "Escape") {
        setOpen(false);
        inputRef.current?.blur();
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Debounced autocomplete fetch
  const fetchSuggestions = useCallback(async (q: string) => {
    if (q.length < 2) {
      setSuggestions([]);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}&autocomplete=true&limit=6`);
      if (res.ok) {
        const data = await res.json();
        startTransition(() => {
          setSuggestions(data.suggestions || []);
        });
      }
    } catch {
      // silently fail autocomplete
    } finally {
      setLoading(false);
    }
  }, []);

  const handleChange = (value: string) => {
    setQuery(value);
    setSelectedIndex(-1);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchSuggestions(value), 250);
  };

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (query.trim()) {
      setOpen(false);
      router.push(`/dashboard/assets?q=${encodeURIComponent(query.trim())}`);
    }
  };

  const handleSelect = (suggestion: Suggestion) => {
    setOpen(false);
    setQuery(suggestion.name);
    router.push(`/dashboard/assets/${suggestion.skillId}`);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open || suggestions.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, -1));
    } else if (e.key === "Enter" && selectedIndex >= 0) {
      e.preventDefault();
      handleSelect(suggestions[selectedIndex]);
    }
  };

  return (
    <div ref={containerRef} className="relative w-full max-w-md">
      <form onSubmit={handleSubmit}>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(e) => handleChange(e.target.value)}
            onFocus={() => setOpen(true)}
            onKeyDown={handleKeyDown}
            placeholder="Search assets... (⌘K)"
            className="w-full rounded-lg border border-gray-200 bg-gray-50 py-2 pl-10 pr-10 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors"
            aria-label="Search assets"
            aria-expanded={open && suggestions.length > 0}
            aria-controls="search-suggestions"
            aria-activedescendant={selectedIndex >= 0 ? `search-suggestion-${suggestions[selectedIndex]?.skillId}` : undefined}
            role="combobox"
            aria-autocomplete="list"
            autoComplete="off"
          />
          {loading && <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-gray-400" />}
          {!loading && query && (
            <button
              type="button"
              onClick={() => { setQuery(""); setSuggestions([]); }}
              className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer text-gray-400 hover:text-gray-600"
              aria-label="Clear search"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </form>

      {/* Suggestions dropdown */}
      {open && suggestions.length > 0 && (
        <ul id="search-suggestions" className="absolute left-0 right-0 top-11 z-50 rounded-lg border border-gray-200 bg-white py-1 shadow-lg" role="listbox">
          {suggestions.map((s, i) => (
            <li
              id={`search-suggestion-${s.skillId}`}
              key={s.skillId}
              role="option"
              aria-selected={i === selectedIndex}
              className={`flex cursor-pointer items-center gap-2 px-3 py-2 text-sm transition-colors ${
                i === selectedIndex ? "bg-blue-50 text-blue-700" : "text-gray-700 hover:bg-gray-50"
              }`}
              onClick={() => handleSelect(s)}
              onMouseEnter={() => setSelectedIndex(i)}
            >
              <Search className="h-3 w-3 text-gray-400 flex-shrink-0" />
              <span className="truncate">{s.name}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
