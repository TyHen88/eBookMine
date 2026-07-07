import { forwardRef } from "react";
import type { ButtonHTMLAttributes } from "react";

/**
 * The app's single button vocabulary. `buttonClass()` is the source of truth —
 * `<Button>`/`<IconButton>` wrap it for `<button>`s, and links (`<Link>`/`<a>`)
 * reuse the same class string so a link and a button look identical.
 */
export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg" | "icon" | "icon-sm";

const base =
  "inline-flex items-center justify-center gap-2 rounded-xl font-medium whitespace-nowrap transition-all duration-200 " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/50 focus-visible:ring-offset-2 " +
  "focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-950 " +
  "disabled:pointer-events-none disabled:opacity-50 active:scale-[.97]";

const variants: Record<ButtonVariant, string> = {
  primary:
    "bg-gradient-to-r from-brand-600 to-brand-500 text-white shadow-md shadow-brand-500/25 " +
    "hover:-translate-y-0.5 hover:shadow-lg hover:shadow-brand-500/40",
  secondary:
    "border border-slate-300 bg-white/70 text-slate-700 backdrop-blur-sm " +
    "hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700 " +
    "dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-200 " +
    "dark:hover:border-brand-700 dark:hover:bg-brand-900/40 dark:hover:text-brand-200",
  ghost:
    "text-slate-600 hover:bg-brand-50 hover:text-brand-700 " +
    "dark:text-slate-300 dark:hover:bg-brand-900/40 dark:hover:text-brand-200",
  danger:
    "bg-red-600 text-white shadow-sm shadow-red-600/25 hover:bg-red-500 hover:shadow-md hover:shadow-red-600/40",
};

const sizes: Record<ButtonSize, string> = {
  sm: "px-3 py-1.5 text-sm",
  md: "px-4 py-2 text-sm",
  lg: "px-6 py-3 text-base",
  icon: "h-9 w-9",
  "icon-sm": "h-8 w-8",
};

export function buttonClass(opts?: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
}) {
  const { variant = "primary", size = "md", className = "" } = opts ?? {};
  return [base, variants[variant], sizes[size], className]
    .filter(Boolean)
    .join(" ");
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant, size, className, type = "button", ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      className={buttonClass({ variant, size, className })}
      {...props}
    />
  )
);
Button.displayName = "Button";

/** Square, icon-only button. Defaults to the ghost variant. Pass `aria-label`. */
export const IconButton = forwardRef<
  HTMLButtonElement,
  ButtonProps & { size?: Extract<ButtonSize, "icon" | "icon-sm"> }
>(({ variant = "ghost", size = "icon", className, type = "button", ...props }, ref) => (
  <button
    ref={ref}
    type={type}
    className={buttonClass({ variant, size, className })}
    {...props}
  />
));
IconButton.displayName = "IconButton";
