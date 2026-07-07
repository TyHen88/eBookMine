import type {
  InputHTMLAttributes,
  SelectHTMLAttributes,
  ReactNode,
} from "react";
import { SearchIcon } from "./icons";

export * from "./icons";
export * from "./Button";

/** Shared control surface (inputs, selects) — one consistent focus treatment. */
const controlBase =
  "w-full rounded-xl border border-slate-300 bg-white/80 px-4 py-2.5 text-sm text-slate-800 " +
  "placeholder:text-slate-400 outline-none backdrop-blur-sm transition-all duration-200 " +
  "focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15 " +
  "dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-100";

export function Input({
  className = "",
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`${controlBase} ${className}`} {...props} />;
}

/** Input with a leading search glyph — used by every library search box. */
export function SearchInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="relative flex-1">
      <SearchIcon
        size={18}
        className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
      />
      <Input className="pl-11" {...props} />
    </div>
  );
}

export function Select({
  className = "",
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={`${controlBase} cursor-pointer py-2.5 pr-9 font-medium ${className}`}
      {...props}
    >
      {children}
    </select>
  );
}

/** A soft pill used for tags (brand tone) and categories (neutral tone). */
export function Chip({
  children,
  tone = "brand",
  className = "",
}: {
  children: ReactNode;
  tone?: "brand" | "neutral";
  className?: string;
}) {
  const tones = {
    brand:
      "bg-brand-50 text-brand-700 ring-brand-500/15 dark:bg-brand-900/40 dark:text-brand-200 dark:ring-brand-400/20",
    neutral:
      "bg-slate-100 text-slate-600 ring-slate-500/10 dark:bg-slate-800 dark:text-slate-300 dark:ring-white/10",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${tones[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

/** Indigo loading spinner in three sizes. */
export function Spinner({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const dim =
    size === "lg" ? "h-9 w-9" : size === "sm" ? "h-5 w-5" : "h-7 w-7";
  return (
    <div
      className={`${dim} animate-spin rounded-full border-2 border-brand-500/30 border-t-brand-600`}
      role="status"
      aria-label="Loading"
    />
  );
}

/** Two-option grid/list toggle. Generic over its option values. */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: ReactNode; title?: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="inline-flex rounded-xl border border-slate-300 bg-white/70 p-0.5 backdrop-blur-sm dark:border-slate-700 dark:bg-slate-900/60">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            title={o.title}
            aria-pressed={active}
            onClick={() => onChange(o.value)}
            className={`flex h-8 w-9 items-center justify-center rounded-[10px] transition-all duration-200 ${
              active
                ? "bg-gradient-to-r from-brand-600 to-brand-500 text-white shadow-sm shadow-brand-500/30"
                : "text-slate-500 hover:text-brand-600 dark:text-slate-400 dark:hover:text-brand-300"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
