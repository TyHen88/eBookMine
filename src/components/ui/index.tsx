import type {
  InputHTMLAttributes,
  SelectHTMLAttributes,
  ReactNode,
} from "react";
import { SearchIcon } from "./icons";

export * from "./icons";
export * from "./Button";
export { default as AiMarkdownView, formatInlineText } from "./AiMarkdownView";

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



/** Multi-Ring Orbital Glowing Spinner component. */
export function Spinner({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const dim =
    size === "lg" ? "h-10 w-10" : size === "sm" ? "h-5 w-5" : "h-7 w-7";
  const borderW = size === "lg" ? "border-3" : "border-2";

  return (
    <div className="relative flex items-center justify-center">
      {/* Outer ambient glow ring */}
      <div
        className={`${dim} animate-spin rounded-full ${borderW} border-brand-500/20 border-t-brand-600 border-r-indigo-500 shadow-md shadow-brand-500/20`}
        role="status"
        aria-label="Loading"
      />
      {/* Inner counter-rotating ring */}
      {size !== "sm" && (
        <div
          className="absolute h-4 w-4 animate-reverse-spin rounded-full border border-amber-400/40 border-b-amber-500"
        />
      )}
    </div>
  );
}

/** Modern glowing dual-ring book loader with clean label. */
export function BookLoader({ label = "Loading eBooks & AI..." }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center p-6 space-y-3 text-center">
      <div className="relative flex h-12 w-12 items-center justify-center">
        {/* Outer glowing spinning ring */}
        <div className="absolute inset-0 rounded-full border-2 border-brand-500/20 border-t-brand-600 animate-spin" />
        {/* Center icon badge */}
        <div className="flex h-8 w-8 items-center justify-center rounded-2xl bg-brand-50 text-brand-600 dark:bg-brand-950 dark:text-brand-400 shadow-sm">
          <svg className="h-4 w-4 animate-bounce" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
          </svg>
        </div>
      </div>
      <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 tracking-tight">
        {label}
      </p>
    </div>
  );
}

/** Shimmering card placeholder skeleton with staggered wave pulse. */
export function SkeletonCard({ index = 0 }: { index?: number }) {
  return (
    <div
      className="rounded-3xl border border-slate-200/80 bg-white/80 p-4 shadow-sm backdrop-blur-sm dark:border-slate-800/80 dark:bg-slate-900/80 animate-shimmer space-y-3"
      style={{ animationDelay: `${(index % 6) * 120}ms` }}
    >
      <div className="h-40 w-full rounded-2xl bg-slate-200/70 dark:bg-slate-800/70 animate-pulse" />
      <div className="h-4 w-3/4 rounded-lg bg-slate-200/70 dark:bg-slate-800/70 animate-pulse" />
      <div className="h-3 w-1/2 rounded-lg bg-slate-200/70 dark:bg-slate-800/70 animate-pulse" />
      <div className="h-9 w-full rounded-xl bg-slate-200/70 dark:bg-slate-800/70 animate-pulse" />
    </div>
  );
}
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
        const isTextLabel = typeof o.label === "string";
        return (
          <button
            key={o.value}
            type="button"
            title={o.title}
            aria-pressed={active}
            onClick={() => onChange(o.value)}
            className={`flex h-8 items-center justify-center rounded-[10px] transition-all duration-200 ${
              isTextLabel ? "px-3 text-xs font-semibold" : "w-9"
            } ${
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

