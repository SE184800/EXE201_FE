import { useEffect, useRef, useState } from 'react';
import Icon from './Icon';
import { todayInVietnam } from '../validation/registration';

type Props = {
  value: string; // ISO format: YYYY-MM-DD
  onChange: (value: string) => void;
  onBlur: () => void;
  disabled: boolean;
  invalid: boolean;
  describedBy?: string;
};

// Formats YYYY-MM-DD -> DD/MM/YYYY for user-friendly display
function isoToDisplay(iso: string): string {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

// Parses DD/MM/YYYY or YYYY-MM-DD -> YYYY-MM-DD
function parseInputToIso(text: string): string | null {
  const trimmed = text.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }
  const match = trimmed.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  if (match) {
    const [, d, m, y] = match;
    const day = d.padStart(2, '0');
    const month = m.padStart(2, '0');
    return `${y}-${month}-${day}`;
  }
  return null;
}

const MONTH_NAMES = [
  'Tháng 1',
  'Tháng 2',
  'Tháng 3',
  'Tháng 4',
  'Tháng 5',
  'Tháng 6',
  'Tháng 7',
  'Tháng 8',
  'Tháng 9',
  'Tháng 10',
  'Tháng 11',
  'Tháng 12',
];

const WEEKDAYS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

export default function BirthDateInput({
  value,
  onChange,
  onBlur,
  disabled,
  invalid,
  describedBy,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [displayText, setDisplayText] = useState(() => isoToDisplay(value));

  const todayStr = todayInVietnam();
  const maxYear = Number(todayStr.slice(0, 4));
  const minYear = 1900;

  // View state for the calendar popover
  const [viewYear, setViewYear] = useState(() => {
    if (value && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return Number(value.slice(0, 4));
    }
    // Default to an adult birth year (2000) for fast selection
    return Math.min(2000, maxYear - 18);
  });

  const [viewMonth, setViewMonth] = useState(() => {
    if (value && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return Number(value.slice(5, 7)) - 1;
    }
    return 0; // January
  });

  // Keep display text in sync when external value changes
  const [prevValue, setPrevValue] = useState(value);
  if (value !== prevValue) {
    setPrevValue(value);
    setDisplayText(isoToDisplay(value));
    if (value && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
      setViewYear(Number(value.slice(0, 4)));
      setViewMonth(Number(value.slice(5, 7)) - 1);
    }
  }

  // Click outside and Escape handler
  useEffect(() => {
    if (!isOpen) return;

    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        onBlur();
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onBlur]);

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const text = e.target.value;
    setDisplayText(text);
    const parsedIso = parseInputToIso(text);
    if (parsedIso) {
      onChange(parsedIso);
      setViewYear(Number(parsedIso.slice(0, 4)));
      setViewMonth(Number(parsedIso.slice(5, 7)) - 1);
    } else if (!text.trim()) {
      onChange('');
    }
  }

  function handleInputBlur() {
    // If user typed something invalid, revert to last valid value display
    const parsedIso = parseInputToIso(displayText);
    if (parsedIso) {
      onChange(parsedIso);
      setDisplayText(isoToDisplay(parsedIso));
    } else if (!displayText.trim()) {
      onChange('');
      setDisplayText('');
    } else {
      setDisplayText(isoToDisplay(value));
    }
    if (!isOpen) {
      onBlur();
    }
  }

  function handleSelectDate(day: number) {
    const formattedMonth = String(viewMonth + 1).padStart(2, '0');
    const formattedDay = String(day).padStart(2, '0');
    const iso = `${viewYear}-${formattedMonth}-${formattedDay}`;

    // Verify boundary
    if (iso > todayStr || iso < `${minYear}-01-01`) return;

    onChange(iso);
    setDisplayText(isoToDisplay(iso));
    setIsOpen(false);
    onBlur();
  }

  function handlePrevMonth() {
    if (viewMonth === 0) {
      if (viewYear > minYear) {
        setViewYear(viewYear - 1);
        setViewMonth(11);
      }
    } else {
      setViewMonth(viewMonth - 1);
    }
  }

  function handleNextMonth() {
    if (viewMonth === 11) {
      if (viewYear < maxYear) {
        setViewYear(viewYear + 1);
        setViewMonth(0);
      }
    } else {
      setViewMonth(viewMonth + 1);
    }
  }

  function handleClear(e: React.MouseEvent) {
    e.stopPropagation();
    onChange('');
    setDisplayText('');
    inputRef.current?.focus();
  }

  // Calculate grid cells for current view
  // Monday is start of week in Vietnam: 0 = Mon, 6 = Sun
  const firstDayOfMonth = new Date(viewYear, viewMonth, 1).getDay();
  const startOffset = (firstDayOfMonth + 6) % 7;
  const daysInCurrentMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate();

  // Year options for dropdown: from maxYear down to 1900
  const yearOptions: number[] = [];
  for (let y = maxYear; y >= minYear; y--) {
    yearOptions.push(y);
  }

  return (
    <div className="birth-date-container" ref={containerRef}>
      <input
        ref={inputRef}
        id="dateOfBirth"
        name="dateOfBirth"
        type="text"
        className="birth-date-input-field"
        placeholder="DD/MM/YYYY (chọn lịch hoặc nhập)"
        value={displayText}
        disabled={disabled}
        aria-invalid={invalid}
        aria-describedby={describedBy}
        autoComplete="bday"
        onClick={() => !disabled && setIsOpen(true)}
        onChange={handleInputChange}
        onBlur={handleInputBlur}
      />

      <div className="birth-date-actions">
        {value && !disabled && (
          <button
            type="button"
            className="birth-date-clear-btn"
            onClick={handleClear}
            title="Xóa ngày đã chọn"
            aria-label="Xóa ngày sinh"
          >
            ✕
          </button>
        )}
        <button
          type="button"
          className={`birth-date-btn ${isOpen ? 'active' : ''}`}
          disabled={disabled}
          onClick={() => !disabled && setIsOpen(!isOpen)}
          title="Mở lịch chọn ngày sinh"
          aria-label="Mở lịch chọn ngày sinh"
          aria-expanded={isOpen}
        >
          <Icon name="calendar" />
        </button>
      </div>

      {isOpen && (
        <div className="calendar-popover" role="dialog" aria-label="Lịch chọn ngày tháng năm sinh">
          {/* Calendar Header with Fast Month/Year Selectors & Nav Arrows */}
          <div className="calendar-header">
            <button
              type="button"
              className="calendar-nav-btn"
              onClick={handlePrevMonth}
              disabled={viewYear === minYear && viewMonth === 0}
              aria-label="Tháng trước"
            >
              ‹
            </button>

            <div className="calendar-selectors">
              <select
                className="calendar-select"
                value={viewMonth}
                onChange={(e) => setViewMonth(Number(e.target.value))}
                aria-label="Chọn tháng"
              >
                {MONTH_NAMES.map((name, index) => (
                  <option key={name} value={index}>
                    {name}
                  </option>
                ))}
              </select>

              <select
                className="calendar-select"
                value={viewYear}
                onChange={(e) => setViewYear(Number(e.target.value))}
                aria-label="Chọn năm"
              >
                {yearOptions.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              className="calendar-nav-btn"
              onClick={handleNextMonth}
              disabled={viewYear === maxYear && viewMonth === 11}
              aria-label="Tháng sau"
            >
              ›
            </button>
          </div>

          {/* Weekday Labels (T2 -> CN) */}
          <div className="calendar-weekdays">
            {WEEKDAYS.map((day) => (
              <span key={day} className="calendar-weekday">
                {day}
              </span>
            ))}
          </div>

          {/* Month Day Grid */}
          <div className="calendar-grid">
            {/* Days from previous month */}
            {Array.from({ length: startOffset }, (_, i) => {
              const prevDay = daysInPrevMonth - startOffset + 1 + i;
              return (
                <div key={`prev-${prevDay}`} className="calendar-day-cell is-outside">
                  {prevDay}
                </div>
              );
            })}

            {/* Days in current month */}
            {Array.from({ length: daysInCurrentMonth }, (_, i) => {
              const day = i + 1;
              const formattedMonth = String(viewMonth + 1).padStart(2, '0');
              const formattedDay = String(day).padStart(2, '0');
              const iso = `${viewYear}-${formattedMonth}-${formattedDay}`;

              const isSelected = iso === value;
              const isToday = iso === todayStr;
              const isFuture = iso > todayStr;
              const isTooOld = iso < `${minYear}-01-01`;
              const isDisabled = isFuture || isTooOld;

              return (
                <button
                  key={`cur-${day}`}
                  type="button"
                  className={`calendar-day-cell ${isSelected ? 'is-selected' : ''} ${
                    isToday ? 'is-today' : ''
                  }`}
                  disabled={isDisabled}
                  onClick={() => handleSelectDate(day)}
                  title={isDisabled ? 'Ngày không hợp lệ' : iso}
                >
                  {day}
                </button>
              );
            })}

            {/* Fill trailing cells for a consistent 5 or 6 row layout */}
            {Array.from({
              length: (7 - ((startOffset + daysInCurrentMonth) % 7)) % 7,
            }, (_, i) => (
              <div key={`next-${i + 1}`} className="calendar-day-cell is-outside">
                {i + 1}
              </div>
            ))}
          </div>

          {/* Calendar Footer Actions */}
          <div className="calendar-footer">
            <button
              type="button"
              className="calendar-footer-btn"
              onClick={() => {
                const adultYear = Math.min(2000, maxYear - 18);
                setViewYear(adultYear);
                setViewMonth(0);
              }}
            >
              Đến năm 2000
            </button>

            <button
              type="button"
              className="calendar-footer-btn calendar-close-action"
              onClick={() => setIsOpen(false)}
            >
              Đóng
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
