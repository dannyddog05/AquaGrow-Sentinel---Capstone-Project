/**
 * Reusable text/email input for auth screens with consistent label and red error state.
 */
export default function AuthInput({
  id,
  label,
  type = 'text',
  value,
  onChange,
  placeholder,
  autoComplete,
  error,
  rightSlot,
  disabled,
}) {
  return (
    <div className="mb-4 w-full text-left">
      <label htmlFor={id} className="block text-[13px] font-semibold text-ink mb-1.5">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          autoComplete={autoComplete}
          disabled={disabled}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          className={`w-full h-11 rounded-lg border bg-white px-3.5 text-[15px] text-ink placeholder:text-mut/70 transition-colors focus:outline-none focus:ring-2 ${
            rightSlot ? 'pr-11' : ''
          } ${
            error
              ? 'border-[#d64545] focus:border-[#d64545] focus:ring-[#d64545]/20'
              : 'border-line focus:border-brand focus:ring-brand/20'
          }`}
        />
        {rightSlot && (
          <div className="absolute inset-y-0 right-0 flex items-center pr-2.5">
            {rightSlot}
          </div>
        )}
      </div>
      {error && (
        <p id={`${id}-error`} role="alert" className="mt-1.5 flex items-center gap-1.5 text-[12px] font-medium text-[#d64545]">
          <span
            aria-hidden="true"
            className="inline-grid place-items-center w-3.5 h-3.5 rounded-full border border-[#d64545] text-[10px] font-bold leading-none flex-none"
          >
            !
          </span>
          <span>{error}</span>
        </p>
      )}
    </div>
  );
}

