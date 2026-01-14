import { useState, useRef, useEffect, useMemo } from "react";

interface DropdownProps {
  value: string;
  options: string[];
  onChange: (value: string) => void;
  formatLabel?: (value: string) => string;
  searchable?: boolean;
}

export function Dropdown({
  value,
  options,
  onChange,
  formatLabel = (v) => v,
  searchable = false,
}: DropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // 点击外部关闭
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setSearch("");
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  // 打开时聚焦搜索框
  useEffect(() => {
    if (isOpen && searchable && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen, searchable]);

  // 过滤选项
  const filteredOptions = useMemo(() => {
    if (!search.trim()) return options;
    const lowerSearch = search.toLowerCase();
    return options.filter((opt) => opt.toLowerCase().includes(lowerSearch));
  }, [options, search]);

  const handleSelect = (option: string) => {
    onChange(option);
    setIsOpen(false);
    setSearch("");
  };

  return (
    <div className="dropdown" ref={dropdownRef}>
      <button
        className="dropdown-trigger"
        onClick={() => setIsOpen(!isOpen)}
        type="button"
      >
        <span>{formatLabel(value)}</span>
        <svg className="dropdown-arrow" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {isOpen && (
        <div className="dropdown-menu">
          {searchable && (
            <div className="dropdown-search">
              <input
                ref={inputRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          )}
          <div className="dropdown-options">
            {filteredOptions.length === 0 ? (
              <div className="dropdown-empty">No matches</div>
            ) : (
              filteredOptions.map((option) => (
                <button
                  key={option}
                  className={`dropdown-item ${option === value ? "active" : ""}`}
                  onClick={() => handleSelect(option)}
                  type="button"
                >
                  {formatLabel(option)}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
