import { useState, useRef, useEffect } from "react";

interface DropdownProps {
  value: string;
  options: string[];
  onChange: (value: string) => void;
  formatLabel?: (value: string) => string;
}

export function Dropdown({
  value,
  options,
  onChange,
  formatLabel = (v) => v,
}: DropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // 点击外部关闭
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  const handleSelect = (option: string) => {
    onChange(option);
    setIsOpen(false);
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
          {options.map((option) => (
            <button
              key={option}
              className={`dropdown-item ${option === value ? "active" : ""}`}
              onClick={() => handleSelect(option)}
              type="button"
            >
              {formatLabel(option)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
