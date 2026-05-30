import clsx from 'clsx';

/**
 * 폼 입력 컴포넌트 모음.
 * 라벨/힌트/필수표시 + 일관된 다크 테마 스타일을 한 곳에 모아,
 * 페이지마다 input className 을 복붙하지 않게 한다.
 */
const INPUT_CLASS =
  'w-full px-3 py-1.5 bg-zinc-900 border border-zinc-700 rounded text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-violet-500 disabled:opacity-50';

interface FieldShellProps {
  label: string;
  hint?: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}

function FieldShell({ label, hint, required, className, children }: FieldShellProps) {
  return (
    <div className={className}>
      <label className="text-xs text-zinc-400 mb-1 block">
        {label}
        {required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      {children}
      {hint && <p className="text-xs text-zinc-600 mt-1">{hint}</p>}
    </div>
  );
}

interface TextFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  hint?: string;
  required?: boolean;
  disabled?: boolean;
  type?: 'text' | 'datetime-local' | 'email';
  list?: string;
  className?: string;
}

export function TextField({
  label,
  value,
  onChange,
  placeholder,
  hint,
  required,
  disabled,
  type = 'text',
  list,
  className,
}: TextFieldProps) {
  return (
    <FieldShell label={label} hint={hint} required={required} className={className}>
      <input
        type={type}
        value={value}
        list={list}
        disabled={disabled}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className={INPUT_CLASS}
      />
    </FieldShell>
  );
}

interface NumberFieldProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  hint?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
}

export function NumberField({
  label,
  value,
  onChange,
  min,
  max,
  step,
  hint,
  required,
  disabled,
  className,
}: NumberFieldProps) {
  return (
    <FieldShell label={label} hint={hint} required={required} className={className}>
      <input
        type="number"
        value={Number.isFinite(value) ? value : ''}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value === '' ? NaN : Number(e.target.value))}
        className={INPUT_CLASS}
      />
    </FieldShell>
  );
}

interface SelectOption {
  value: string;
  label: string;
}

interface SelectFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: readonly SelectOption[];
  hint?: string;
  disabled?: boolean;
  className?: string;
}

export function SelectField({
  label,
  value,
  onChange,
  options,
  hint,
  disabled,
  className,
}: SelectFieldProps) {
  return (
    <FieldShell label={label} hint={hint} className={className}>
      <select
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className={clsx(INPUT_CLASS, 'cursor-pointer')}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </FieldShell>
  );
}

interface TextAreaFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  rows?: number;
  placeholder?: string;
  hint?: string;
  required?: boolean;
  className?: string;
}

export function TextAreaField({
  label,
  value,
  onChange,
  rows = 3,
  placeholder,
  hint,
  required,
  className,
}: TextAreaFieldProps) {
  return (
    <FieldShell label={label} hint={hint} required={required} className={className}>
      <textarea
        value={value}
        rows={rows}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className={clsx(INPUT_CLASS, 'resize-none')}
      />
    </FieldShell>
  );
}
