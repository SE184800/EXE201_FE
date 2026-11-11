import React, { useEffect, useRef, useState } from 'react';
import Icon from './Icon';

export type DatePickerProps = {
  value: string; // ISO format: YYYY-MM-DD
  onChange: (val: string) => void;
  min?: string; // ISO: YYYY-MM-DD
  max?: string; // ISO: YYYY-MM-DD
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  id?: string;
  name?: string;
  required?: boolean;
  style?: React.CSSProperties;
};

function isoToDisplay(iso: string): string {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

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

function getVietnamToday(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
}

export default function DatePicker({
  value,
  onChange,
  min,
  max,
  placeholder = 'DD/MM/YYYY (chọn ngày)',
  disabled = false,
  className = '',
  id,
  name,
  required = false,
  style,
}: DatePickerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [displayText, setDisplayText] = useState(() => isoToDisplay(value));

  const todayIso = getVietnamToday();
  const currentYear = Number(todayIso.slice(0, 4));

  const [viewYear, setViewYear] = useState(() => {
    if (value && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return Number(value.slice(0, 4));
    }
    return currentYear;
  });

  const [viewMonth, setViewMonth] = useState(() => {
    if (value && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return Number(value.slice(5, 7)) - 1;
    }
    return new Date().getMonth();
  });

  // Keep display text in sync when value changes from outside
  useEffect(() => {
    setDisplayText(isoToDisplay(value));
    if (value && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
      setViewYear(Number(value.slice(0, 4)));
      setViewMonth(Number(value.slice(5, 7)) - 1);
    }
  }, [value]);

  useEffect(() => {
    if (!isOpen) return;

    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
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
  }, [isOpen]);

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const text = e.target.value;
    setDisplayText(text);
    const parsedIso = parseInputToIso(text);
    if (parsedIso) {
      if ((!min || parsedIso >= min) && (!max || parsedIso <= max)) {
        onChange(parsedIso);
        setViewYear(Number(parsedIso.slice(0, 4)));
        setViewMonth(Number(parsedIso.slice(5, 7)) - 1);
      }
    } else if (!text.trim()) {
      onChange('');
    }
  }

  function handleInputBlur() {
    const parsedIso = parseInputToIso(displayText);
    if (parsedIso) {
      if ((!min || parsedIso >= min) && (!max || parsedIso <= max)) {
        onChange(parsedIso);
        setDisplayText(isoToDisplay(parsedIso));
      } else {
        setDisplayText(isoToDisplay(value));
      }
    } else if (!displayText.trim()) {
      onChange('');
      setDisplayText('');
    } else {
      setDisplayText(isoToDisplay(value));
    }
  }

  function handleSelectDate(day: number) {
    const formattedMonth = String(viewMonth + 1).padStart(2, '0');
    const formattedDay = String(day).padStart(2, '0');
    const iso = `${viewYear}-${formattedMonth}-${formattedDay}`;

    if (min && iso < min) return;
    if (max && iso > max) return;

    onChange(iso);
    setDisplayText(isoToDisplay(iso));
    setIsOpen(false);
  }

  function handlePrevMonth() {
    if (viewMonth === 0) {
      setViewYear(viewYear - 1);
      setViewMonth(11);
    } else {
      setViewMonth(viewMonth - 1);
    }
  }

  function handleNextMonth() {
    if (viewMonth === 11) {
      setViewYear(viewYear + 1);
      setViewMonth(0);
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

  function handleSelectToday() {
    if (min && todayIso < min) return;
    if (max && todayIso > max) return;
    onChange(todayIso);
    setDisplayText(isoToDisplay(todayIso));
    setViewYear(Number(todayIso.slice(0, 4)));
    setViewMonth(Number(todayIso.slice(5, 7)) - 1);
    setIsOpen(false);
  }

  // First day of month: Monday = 0, Sunday = 6
  const firstDayOfMonth = new Date(viewYear, viewMonth, 1).getDay();
  const startOffset = (firstDayOfMonth + 6) % 7;
  const daysInCurrentMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate();

  // Range of years for dropdown
  const minYear = min ? Number(min.slice(0, 4)) : currentYear - 20;
  const maxYear = max ? Number(max.slice(0, 4)) : currentYear + 20;
  const yearOptions: number[] = [];
  for (let y = Math.max(maxYear, currentYear + 5); y >= Math.min(minYear, currentYear - 10); y--) {
    yearOptions.push(y);
  }

  return (
    <div
      className={`birth-date-container custom-date-picker-wrap ${className}`}
      ref={containerRef}
      style={{
        border: '1px solid #cbd5e1',
        borderRadius: '8px',
        padding: '0 10px',
        background: disabled ? '#f8fafc' : '#ffffff',
        ...style,
      }}
    >
      <input
        ref={inputRef}
        id={id}
        name={name}
        type="text"
        className="birth-date-input-field"
        placeholder={placeholder}
        value={displayText}
        disabled={disabled}
        required={required}
        onClick={() => !disabled && setIsOpen(true)}
        onChange={handleInputChange}
        onBlur={handleInputBlur}
        style={{
          fontSize: '13.5px',
          padding: '10px 0',
          cursor: disabled ? 'not-allowed' : 'pointer',
        }}
      />

      <div className="birth-date-actions">
        {value && !disabled && (
          <button
            type="button"
            className="birth-date-clear-btn"
            onClick={handleClear}
            title="Xóa ngày"
            aria-label="Xóa ngày"
          >
            ×
          </button>
        )}
        <button
          type="button"
          className={`birth-date-btn ${isOpen ? 'active' : ''}`}
          disabled={disabled}
          onClick={() => !disabled && setIsOpen(!isOpen)}
          title="Mở lịch chọn ngày"
          aria-label="Mở lịch chọn ngày"
        >
          <Icon name="calendar" />
        </button>
      </div>

      {isOpen && (
        <div className="calendar-popover" role="dialog" aria-label="Lịch chọn ngày">
          <div className="calendar-header">
            <button
              type="button"
              className="calendar-nav-btn"
              onClick={handlePrevMonth}
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
                {MONTH_NAMES.map((mName, idx) => (
                  <option key={mName} value={idx}>
                    {mName}
                  </option>
                ))}
              </select>

              <select
                className="calendar-select"
                value={viewYear}
                onChange={(e) => setViewYear(Number(e.target.value))}
                aria-label="Chọn năm"
              >
                {yearOptions.map((yr) => (
                  <option key={yr} value={yr}>
                    Năm {yr}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              className="calendar-nav-btn"
              onClick={handleNextMonth}
              aria-label="Tháng sau"
            >
              ›
            </button>
          </div>

          <div className="calendar-weekdays">
            {WEEKDAYS.map((w) => (
              <span key={w} className="calendar-weekday">
                {w}
              </span>
            ))}
          </div>

          <div className="calendar-grid">
            {Array.from({ length: startOffset }, (_, i) => {
              const prevDay = daysInPrevMonth - startOffset + 1 + i;
              return (
                <div key={`prev-${prevDay}`} className="calendar-day-cell is-outside">
                  {prevDay}
                </div>
              );
            })}

            {Array.from({ length: daysInCurrentMonth }, (_, i) => {
              const day = i + 1;
              const formattedMonth = String(viewMonth + 1).padStart(2, '0');
              const formattedDay = String(day).padStart(2, '0');
              const iso = `${viewYear}-${formattedMonth}-${formattedDay}`;

              const isSelected = iso === value;
              const isToday = iso === todayIso;
              const isDisabled = Boolean((min && iso < min) || (max && iso > max));

              return (
                <button
                  key={`cur-${day}`}
                  type="button"
                  className={`calendar-day-cell ${isSelected ? 'is-selected' : ''} ${
                    isToday ? 'is-today' : ''
                  }`}
                  disabled={isDisabled}
                  onClick={() => handleSelectDate(day)}
                >
                  {day}
                </button>
              );
            })}
          </div>

          <div
            className="calendar-footer"
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginTop: '10px',
              paddingTop: '8px',
              borderTop: '1px solid #f1f5f9',
            }}
          >
            <button
              type="button"
              className="calendar-today-btn"
              onClick={handleSelectToday}
              style={{
                fontSize: '11.5px',
                color: '#15803d',
                fontWeight: 600,
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '2px 4px',
              }}
            >
              Hôm nay
            </button>
            <button
              type="button"
              onClick={() => {
                onChange('');
                setDisplayText('');
                setIsOpen(false);
              }}
              style={{
                fontSize: '11.5px',
                color: '#64748b',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '2px 4px',
              }}
            >
              Xóa ngày
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
