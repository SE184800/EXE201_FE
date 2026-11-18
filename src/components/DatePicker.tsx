import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
} from 'react';
import { createPortal } from 'react-dom';

export type DatePickerProps = {
  id?: string;
  name?: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  min?: string;
  max?: string;
  disabled?: boolean;
  required?: boolean;
  invalid?: boolean;
  describedBy?: string;
  placeholder?: string;
  className?: string;
  style?: CSSProperties;
  defaultViewYear?: number;
  showTodayButton?: boolean;
  ariaLabel?: string;
  clearable?: boolean;
  hideClearButton?: boolean;
};

type ViewMode = 'days' | 'months' | 'years';

const WEEKDAYS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
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

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function toIsoDate(y: number, m: number, d: number): string {
  return `${y}-${pad2(m + 1)}-${pad2(d)}`;
}

function formatDisplay(iso: string): string {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function parseIsoParts(iso?: string): { y: number; m: number; d: number } | null {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const [yStr, mStr, dStr] = iso.split('-');
  const y = Number(yStr);
  const m = Number(mStr) - 1;
  const d = Number(dStr);
  const probe = new Date(y, m, d);
  if (probe.getFullYear() !== y || probe.getMonth() !== m || probe.getDate() !== d) return null;
  return { y, m, d };
}

function parseDisplayToIso(text: string): string | null {
  const match = text.trim().match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (!match) return null;
  const day = Number(match[1]);
  const month = Number(match[2]) - 1;
  const year = Number(match[3]);
  if (year < 1900 || year > 2100 || month < 0 || month > 11 || day < 1 || day > 31) return null;
  const dt = new Date(year, month, day);
  if (dt.getFullYear() !== year || dt.getMonth() !== month || dt.getDate() !== day) return null;
  return toIsoDate(year, month, day);
}

function getTodayIso(): string {
  try {
    return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
  } catch {
    const now = new Date();
    return toIsoDate(now.getFullYear(), now.getMonth(), now.getDate());
  }
}

export default function DatePicker({
  id,
  name,
  value,
  onChange,
  onBlur,
  min,
  max,
  disabled = false,
  required = false,
  invalid = false,
  describedBy,
  placeholder = 'DD/MM/YYYY',
  className = '',
  style,
  defaultViewYear,
  showTodayButton = true,
  ariaLabel,
  clearable = true,
  hideClearButton = false,
}: DatePickerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const todayIso = useMemo(() => getTodayIso(), []);
  const minParts = useMemo(() => parseIsoParts(min), [min]);
  const maxParts = useMemo(() => parseIsoParts(max), [max]);
  const minYear = minParts?.y ?? 1900;
  const maxYear = maxParts?.y ?? 2100;

  const getInitialView = () => {
    const valParts = parseIsoParts(value);
    if (valParts) return { y: valParts.y, m: valParts.m };
    if (defaultViewYear && defaultViewYear >= minYear && defaultViewYear <= maxYear) {
      return { y: defaultViewYear, m: 0 };
    }
    const todayParts = parseIsoParts(todayIso)!;
    const clampedY = Math.min(Math.max(todayParts.y, minYear), maxYear);
    let clampedM = todayParts.m;
    if (minParts && clampedY === minParts.y && clampedM < minParts.m) clampedM = minParts.m;
    if (maxParts && clampedY === maxParts.y && clampedM > maxParts.m) clampedM = maxParts.m;
    return { y: clampedY, m: clampedM };
  };

  const [open, setOpen] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('days');
  const [viewYear, setViewYear] = useState<number>(() => getInitialView().y);
  const [viewMonth, setViewMonth] = useState<number>(() => getInitialView().m);
  const [decadeStart, setDecadeStart] = useState<number>(() => Math.floor(getInitialView().y / 12) * 12);
  const [inputText, setInputText] = useState<string>(() => formatDisplay(value));
  const [popoverCoords, setPopoverCoords] = useState<{
    top: number;
    left: number;
    minWidth: number;
    placement: 'bottom' | 'top';
  } | null>(null);
  const [portalContainer, setPortalContainer] = useState<HTMLElement | null>(null);

  // Sync display input when external value changes
  useEffect(() => {
    setInputText(formatDisplay(value));
    const parts = parseIsoParts(value);
    if (parts) {
      setViewYear(parts.y);
      setViewMonth(parts.m);
      setDecadeStart(Math.floor(parts.y / 12) * 12);
    }
  }, [value]);

  function openPopover() {
    if (disabled) return;
    const init = getInitialView();
    setViewYear(init.y);
    setViewMonth(init.m);
    setDecadeStart(Math.floor(init.y / 12) * 12);
    setViewMode('days');
    setOpen(true);
  }

  function closePopover(triggerBlur = false) {
    setOpen(false);
    setViewMode('days');
    if (triggerBlur) onBlur?.();
  }

  // Compute smart viewport/dialog-safe coordinates for the portal popover
  useLayoutEffect(() => {
    if (!open || !containerRef.current) {
      setPopoverCoords(null);
      return;
    }

    const dialogEl = containerRef.current.closest('dialog') as HTMLElement | null;
    const targetHost = dialogEl || document.body;
    setPortalContainer(targetHost);

    const updatePosition = () => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const popWidth = 296;
      const estHeight = 344;
      const vw = window.innerWidth;
      const vh = window.innerHeight;

      const spaceBelow = vh - rect.bottom - 12;
      const spaceAbove = rect.top - 12;
      const placement: 'bottom' | 'top' =
        spaceBelow >= estHeight || spaceBelow >= spaceAbove ? 'bottom' : 'top';

      let viewportLeft = rect.left;
      if (viewportLeft + popWidth > vw - 12) {
        viewportLeft = Math.max(12, vw - popWidth - 12);
      }
      viewportLeft = Math.max(12, viewportLeft);

      const viewportTop =
        placement === 'bottom'
          ? Math.min(vh - estHeight - 8, rect.bottom + 6)
          : Math.max(8, rect.top - estHeight - 6);

      // Account for native <dialog> CSS transform creating a new fixed containing block
      let offsetX = 0;
      let offsetY = 0;
      if (dialogEl) {
        const styleObj = window.getComputedStyle(dialogEl);
        if (styleObj.transform !== 'none' || styleObj.filter !== 'none') {
          const dRect = dialogEl.getBoundingClientRect();
          offsetX = dRect.left + dialogEl.clientLeft;
          offsetY = dRect.top + dialogEl.clientTop;
        }
      }

      setPopoverCoords({
        top: viewportTop - offsetY,
        left: viewportLeft - offsetX,
        minWidth: Math.max(popWidth, Math.min(312, rect.width)),
        placement,
      });
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [open]);

  // Outside click and Escape key dismissal
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (containerRef.current?.contains(target) || popoverRef.current?.contains(target)) {
        return;
      }
      closePopover(true);
    };
    const onKeyDown = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        closePopover(false);
        inputRef.current?.focus();
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown, true);
    };
  }, [open]);

  function isDateDisabled(iso: string): boolean {
    if (min && iso < min) return true;
    if (max && iso > max) return true;
    return false;
  }

  function isMonthDisabled(year: number, month: number): boolean {
    const firstDay = toIsoDate(year, month, 1);
    const lastDay = toIsoDate(year, month, new Date(year, month + 1, 0).getDate());
    if (max && firstDay > max) return true;
    if (min && lastDay < min) return true;
    return false;
  }

  function isYearDisabled(year: number): boolean {
    if (year < minYear || year > maxYear) return true;
    return false;
  }

  function handleSelectIso(iso: string) {
    if (isDateDisabled(iso)) return;
    onChange(iso);
    setInputText(formatDisplay(iso));
    closePopover(true);
  }

  function handleTextChange(rawNext: string) {
    let next = rawNext.replace(/[^\d\/\-]/g, '');
    if (next.length > inputText.length) {
      if (/^\d{2}$/.test(next)) next = `${next}/`;
      else if (/^\d{2}\/\d{2}$/.test(next)) next = `${next}/`;
    }
    if (next.length > 10) next = next.slice(0, 10);
    setInputText(next);

    if (!next.trim()) {
      if (!required && value) onChange('');
      return;
    }

    const parsedIso = parseDisplayToIso(next);
    if (parsedIso && !isDateDisabled(parsedIso)) {
      onChange(parsedIso);
      const parts = parseIsoParts(parsedIso)!;
      setViewYear(parts.y);
      setViewMonth(parts.m);
      setDecadeStart(Math.floor(parts.y / 12) * 12);
    }
  }

  function handleInputBlur() {
    if (open) return;
    const trimmed = inputText.trim();
    if (!trimmed) {
      if (required && value) {
        setInputText(formatDisplay(value));
      } else if (!required && value) {
        onChange('');
      }
      onBlur?.();
      return;
    }
    const parsedIso = parseDisplayToIso(trimmed);
    if (parsedIso && !isDateDisabled(parsedIso)) {
      if (parsedIso !== value) onChange(parsedIso);
      setInputText(formatDisplay(parsedIso));
    } else {
      setInputText(formatDisplay(value));
    }
    onBlur?.();
  }

  function handleInputKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!open) openPopover();
    } else if (e.key === 'Enter' && open) {
      e.preventDefault();
      closePopover(false);
    }
  }

  function stepHeader(delta: number) {
    if (viewMode === 'days') {
      let nextM = viewMonth + delta;
      let nextY = viewYear;
      if (nextM < 0) {
        nextM = 11;
        nextY -= 1;
      } else if (nextM > 11) {
        nextM = 0;
        nextY += 1;
      }
      if (nextY >= minYear && nextY <= maxYear) {
        setViewYear(nextY);
        setViewMonth(nextM);
      }
    } else if (viewMode === 'months') {
      const nextY = viewYear + delta;
      if (nextY >= minYear && nextY <= maxYear) setViewYear(nextY);
    } else {
      setDecadeStart((prev) => prev + delta * 12);
    }
  }

  function canStepPrev(): boolean {
    if (viewMode === 'days') {
      const prevY = viewMonth === 0 ? viewYear - 1 : viewYear;
      return prevY >= minYear;
    }
    if (viewMode === 'months') return viewYear - 1 >= minYear;
    return decadeStart > minYear;
  }

  function canStepNext(): boolean {
    if (viewMode === 'days') {
      const nextY = viewMonth === 11 ? viewYear + 1 : viewYear;
      return nextY <= maxYear;
    }
    if (viewMode === 'months') return viewYear + 1 <= maxYear;
    return decadeStart + 11 < maxYear;
  }

  // Build 42-cell calendar grid (Monday-first: T2..CN)
  const dayCells = useMemo(() => {
    const firstOfMonth = new Date(viewYear, viewMonth, 1);
    const startOffset = (firstOfMonth.getDay() + 6) % 7;
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const prevMonthYear = viewMonth === 0 ? viewYear - 1 : viewYear;
    const prevMonthIndex = viewMonth === 0 ? 11 : viewMonth - 1;
    const daysInPrevMonth = new Date(prevMonthYear, prevMonthIndex + 1, 0).getDate();

    const cells: Array<{ day: number; month: number; year: number; outside: boolean; iso: string }> = [];

    for (let i = startOffset - 1; i >= 0; i--) {
      const d = daysInPrevMonth - i;
      cells.push({
        day: d,
        month: prevMonthIndex,
        year: prevMonthYear,
        outside: true,
        iso: toIsoDate(prevMonthYear, prevMonthIndex, d),
      });
    }

    for (let d = 1; d <= daysInMonth; d++) {
      cells.push({
        day: d,
        month: viewMonth,
        year: viewYear,
        outside: false,
        iso: toIsoDate(viewYear, viewMonth, d),
      });
    }

    const remaining = (7 - (cells.length % 7)) % 7;
    const nextMonthYear = viewMonth === 11 ? viewYear + 1 : viewYear;
    const nextMonthIndex = viewMonth === 11 ? 0 : viewMonth + 1;
    for (let d = 1; d <= remaining; d++) {
      cells.push({
        day: d,
        month: nextMonthIndex,
        year: nextMonthYear,
        outside: true,
        iso: toIsoDate(nextMonthYear, nextMonthIndex, d),
      });
    }

    return cells;
  }, [viewYear, viewMonth]);

  const yearCells = useMemo(() => {
    return Array.from({ length: 12 }, (_, idx) => decadeStart + idx);
  }, [decadeStart]);

  const canSelectToday = showTodayButton && !isDateDisabled(todayIso);

  const popoverNode =
    open && popoverCoords && portalContainer
      ? createPortal(
          <div
            ref={popoverRef}
            className="sm-dp-popover"
            role="dialog"
            aria-label="Chọn ngày trên lịch"
            data-placement={popoverCoords.placement}
            style={{
              position: 'fixed',
              top: `${popoverCoords.top}px`,
              left: `${popoverCoords.left}px`,
              width: `${popoverCoords.minWidth}px`,
              zIndex: 9999,
            }}
            onMouseDown={(e) => {
              // Prevent blurring the text input or triggering parent label clicks
              e.stopPropagation();
            }}
            onClick={(e) => {
              e.stopPropagation();
            }}
          >
            {/* Header bar */}
            <div className="sm-dp-header">
              <button
                type="button"
                className="sm-dp-nav-btn"
                disabled={!canStepPrev()}
                onClick={() => stepHeader(-1)}
                title={viewMode === 'years' ? '12 năm trước' : viewMode === 'months' ? 'Năm trước' : 'Tháng trước'}
                aria-label="Trước"
              >
                <svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <path d="M12.5 5L7.5 10l5 5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>

              <div className="sm-dp-mode-triggers">
                {viewMode !== 'years' ? (
                  <>
                    <button
                      type="button"
                      className={`sm-dp-mode-pill ${viewMode === 'months' ? 'is-active' : ''}`}
                      onClick={() => setViewMode(viewMode === 'months' ? 'days' : 'months')}
                      title="Chọn nhanh tháng"
                    >
                      <span>{MONTH_NAMES[viewMonth]}</span>
                      <span className="sm-dp-caret">▾</span>
                    </button>
                    <button
                      type="button"
                      className="sm-dp-mode-pill"
                      onClick={() => {
                        setDecadeStart(Math.floor(viewYear / 12) * 12);
                        setViewMode('years');
                      }}
                      title="Chọn nhanh năm"
                    >
                      <span>{viewYear}</span>
                      <span className="sm-dp-caret">▾</span>
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    className="sm-dp-mode-pill is-active"
                    onClick={() => setViewMode('days')}
                    title="Quay lại lịch ngày"
                  >
                    <span>
                      {decadeStart} – {decadeStart + 11}
                    </span>
                    <span className="sm-dp-caret">▴</span>
                  </button>
                )}
              </div>

              <button
                type="button"
                className="sm-dp-nav-btn"
                disabled={!canStepNext()}
                onClick={() => stepHeader(1)}
                title={viewMode === 'years' ? '12 năm sau' : viewMode === 'months' ? 'Năm sau' : 'Tháng sau'}
                aria-label="Sau"
              >
                <svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <path d="M7.5 5l5 5-5 5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>

            {/* Body views: Days / 12 Months / 12 Years */}
            {viewMode === 'days' && (
              <>
                <div className="sm-dp-weekdays">
                  {WEEKDAYS.map((wd) => (
                    <span key={wd} className={wd === 'CN' ? 'is-sunday' : ''}>
                      {wd}
                    </span>
                  ))}
                </div>
                <div className="sm-dp-days-grid">
                  {dayCells.map((cell) => {
                    const isSelected = value === cell.iso;
                    const isToday = todayIso === cell.iso;
                    const isDis = isDateDisabled(cell.iso);
                    return (
                      <button
                        key={cell.iso}
                        type="button"
                        disabled={isDis}
                        onClick={() => handleSelectIso(cell.iso)}
                        className={[
                          'sm-dp-day',
                          cell.outside ? 'is-outside' : '',
                          isSelected ? 'is-selected' : '',
                          isToday ? 'is-today' : '',
                        ]
                          .filter(Boolean)
                          .join(' ')}
                        aria-selected={isSelected}
                      >
                        {cell.day}
                      </button>
                    );
                  })}
                </div>
              </>
            )}

            {viewMode === 'months' && (
              <div className="sm-dp-ym-grid">
                {MONTH_NAMES.map((label, mIdx) => {
                  const isCurrentSelected = Boolean(parseIsoParts(value)?.y === viewYear && parseIsoParts(value)?.m === mIdx);
                  const isActiveView = viewMonth === mIdx;
                  const isDis = isMonthDisabled(viewYear, mIdx);
                  return (
                    <button
                      key={label}
                      type="button"
                      disabled={isDis}
                      onClick={() => {
                        setViewMonth(mIdx);
                        setViewMode('days');
                      }}
                      className={[
                        'sm-dp-ym-cell',
                        isCurrentSelected ? 'is-selected' : '',
                        isActiveView && !isCurrentSelected ? 'is-current' : '',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            )}

            {viewMode === 'years' && (
              <div className="sm-dp-ym-grid">
                {yearCells.map((yr) => {
                  const isCurrentSelected = parseIsoParts(value)?.y === yr;
                  const isActiveView = viewYear === yr;
                  const isDis = isYearDisabled(yr);
                  return (
                    <button
                      key={yr}
                      type="button"
                      disabled={isDis}
                      onClick={() => {
                        setViewYear(yr);
                        // Ensure viewMonth falls within min/max constraints of the chosen year
                        let targetM = viewMonth;
                        if (minParts && yr === minParts.y && targetM < minParts.m) targetM = minParts.m;
                        if (maxParts && yr === maxParts.y && targetM > maxParts.m) targetM = maxParts.m;
                        setViewMonth(targetM);
                        setViewMode('months');
                      }}
                      className={[
                        'sm-dp-ym-cell',
                        isCurrentSelected ? 'is-selected' : '',
                        isActiveView && !isCurrentSelected ? 'is-current' : '',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                    >
                      {yr}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Footer bar */}
            <div className="sm-dp-footer">
              <div className="sm-dp-footer-left">
                {canSelectToday && (
                  <button
                    type="button"
                    className="sm-dp-footer-link is-today-btn"
                    onClick={() => handleSelectIso(todayIso)}
                  >
                    Hôm nay
                  </button>
                )}
                {!required && value && (
                  <button
                    type="button"
                    className="sm-dp-footer-link is-clear-btn"
                    onClick={() => {
                      onChange('');
                      setInputText('');
                      closePopover(true);
                    }}
                  >
                    Xóa
                  </button>
                )}
              </div>
              <button
                type="button"
                className="sm-dp-footer-close"
                onClick={() => closePopover(false)}
              >
                Đóng
              </button>
            </div>
          </div>,
          portalContainer
        )
      : null;

  return (
    <div
      ref={containerRef}
      className={`sm-dp-wrap ${className}`.trim()}
      style={style}
      onClick={(e) => {
        // Prevent parent <label> forwarding click unexpectedly when opening via button
        if (e.target !== inputRef.current) e.preventDefault();
      }}
    >
      <div className={`sm-dp-box ${open ? 'is-open' : ''} ${invalid ? 'is-invalid' : ''} ${disabled ? 'is-disabled' : ''}`}>
        <input
          ref={inputRef}
          id={id}
          name={name}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          className="sm-dp-input"
          value={inputText}
          placeholder={placeholder}
          disabled={disabled}
          required={required}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          aria-label={ariaLabel}
          onChange={(e) => handleTextChange(e.target.value)}
          onBlur={handleInputBlur}
          onKeyDown={handleInputKeyDown}
          onClick={() => {
            if (!open && !disabled) openPopover();
          }}
        />
        {clearable && !hideClearButton && !required && value && !disabled && (
          <button
            type="button"
            tabIndex={-1}
            className="sm-dp-clear-btn"
            aria-label="Xóa ngày đã chọn"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onChange('');
              setInputText('');
            }}
          >
            ×
          </button>
        )}
        <button
          type="button"
          tabIndex={-1}
          disabled={disabled}
          className="sm-dp-trigger-btn"
          aria-label="Mở lịch chọn ngày"
          aria-expanded={open}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (open) closePopover(false);
            else openPopover();
          }}
        >
          <svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.7">
            <rect x="3" y="4.5" width="14" height="12.5" rx="2.2" />
            <path d="M6.5 2.5v3M13.5 2.5v3M3 8.5h14" strokeLinecap="round" />
          </svg>
        </button>
      </div>
      {popoverNode}
    </div>
  );
}
