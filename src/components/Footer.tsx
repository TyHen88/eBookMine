/**
 * Site footer: short app description + developer credit.
 */
export default function Footer() {
  return (
    <footer className="mt-12 border-t border-slate-200 dark:border-slate-800">
      <div className="mx-auto max-w-6xl px-4 py-8 text-center text-sm text-slate-500 dark:text-slate-400">
        <p className="text-base font-semibold text-slate-700 dark:text-slate-200">
          📚 eBookMine
        </p>
        <p className="mx-auto mt-1 max-w-md">
          A free online eBook library — read, search, and explore books anytime,
          anywhere. Open to everyone. 📖
        </p>
        <p className="mt-4">
          Developed by{" "}
          <span className="font-medium text-slate-700 dark:text-slate-200">
            Hen Ty
          </span>
          <span className="mx-2">·</span>
          <a
            href="tel:010297859"
            className="font-medium text-brand-600 hover:underline dark:text-brand-400"
          >
            📞 010 297 859
          </a>
        </p>
      </div>
    </footer>
  );
}
