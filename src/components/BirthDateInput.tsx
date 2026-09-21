import { useEffect, useRef } from 'react';
import { todayInVietnam } from '../validation/registration';

type Props = {
  value: string;
  onChange: (value: string) => void;
  onBlur: () => void;
  disabled: boolean;
  invalid: boolean;
  describedBy?: string;
};

export default function BirthDateInput({ value, onChange, onBlur, disabled, invalid, describedBy }: Props) {
  const [year = '', month = '', day = ''] = value.split('-');
  const yearRef = useRef<HTMLInputElement>(null);
  const maxYear = Number(todayInVietnam().slice(0, 4));

  useEffect(() => {
    const input = yearRef.current;
    if (!input || disabled) return;
    function handleWheel(event: WheelEvent) {
      // A native listener is needed because React wheel listeners are passive.
      if (document.activeElement !== input || event.ctrlKey || event.deltaY === 0) return;
      event.preventDefault();
      const current = year.length === 4 ? Number(year) : maxYear;
      const next = Math.min(maxYear, Math.max(1900, current - Math.sign(event.deltaY) * 5));
      onChange(`${next}-${month}-${day}`);
    }
    input.addEventListener('wheel', handleWheel, { passive: false });
    return () => input.removeEventListener('wheel', handleWheel);
  }, [year, month, day, maxYear, disabled, onChange]);

  const shared = { disabled, 'aria-invalid': invalid, 'aria-describedby': describedBy };
  return (
    <div className="birth-date-input" onBlur={(event) => {
      if (!event.currentTarget.contains(event.relatedTarget)) onBlur();
    }}>
      <select {...shared} id="dateOfBirth" name="dateOfBirth" aria-label="Ngày sinh" autoComplete="bday-day"
        value={day} onChange={(event) => onChange(`${year}-${month}-${event.target.value}`)}>
        <option value="">Ngày</option>
        {Array.from({ length: 31 }, (_, i) => i + 1).map((number) => (
          <option key={number} value={String(number).padStart(2, '0')}>{number}</option>
        ))}
      </select>
      <span aria-hidden="true">/</span>
      <select {...shared} name="birthMonth" aria-label="Tháng sinh" autoComplete="bday-month"
        value={month} onChange={(event) => onChange(`${year}-${event.target.value}-${day}`)}>
        <option value="">Tháng</option>
        {Array.from({ length: 12 }, (_, i) => i + 1).map((number) => (
          <option key={number} value={String(number).padStart(2, '0')}>{number}</option>
        ))}
      </select>
      <span aria-hidden="true">/</span>
      <input {...shared} ref={yearRef} name="birthYear" aria-label="Năm sinh" autoComplete="bday-year"
        type="text" inputMode="numeric" maxLength={4} placeholder="Năm" value={year}
        onChange={(event) => onChange(`${event.target.value.replace(/\D/g, '')}-${month}-${day}`)} />
    </div>
  );
}
