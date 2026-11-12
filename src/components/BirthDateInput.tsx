import { useMemo } from 'react';
import DatePicker from './DatePicker';
import { getBirthDateRange } from '../validation/registration';

export type BirthDateInputProps = {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  disabled?: boolean;
  invalid?: boolean;
  describedBy?: string;
};

export default function BirthDateInput({
  id = 'dateOfBirth',
  value,
  onChange,
  onBlur,
  disabled = false,
  invalid = false,
  describedBy,
}: BirthDateInputProps) {
  const { minDate, maxDate } = useMemo(() => getBirthDateRange(), []);
  const maxYear = Number(maxDate.slice(0, 4)) || new Date().getFullYear() - 18;
  const defaultViewYear = Math.max(1995, maxYear - 8);

  return (
    <DatePicker
      id={id}
      value={value}
      min={minDate}
      max={maxDate}
      defaultViewYear={Math.min(defaultViewYear, maxYear)}
      showTodayButton={false}
      disabled={disabled}
      invalid={invalid}
      describedBy={describedBy}
      onChange={onChange}
      onBlur={onBlur}
      placeholder="DD/MM/YYYY (ví dụ: 15/08/1995)"
    />
  );
}
