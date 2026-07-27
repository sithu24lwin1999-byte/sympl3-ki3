import { Languages } from 'lucide-react';
import { useLanguage } from '@/lib/language';
import { cn } from '@/lib/utils';

export function LanguageSwitcher({ compact = false, className = '' }: { compact?: boolean; className?: string }) {
  const { language, setLanguage, options } = useLanguage();

  return (
    <label className={cn('flex h-10 items-center gap-2 rounded-full border border-[#e7e3da] bg-[#f8f7f3] px-3 text-xs font-bold text-slate-600', className)}>
      <Languages className="h-4 w-4 text-[#71806a]" />
      {!compact && <span className="hidden xl:inline">Language</span>}
      <select
        aria-label="Change language"
        value={language}
        onChange={event => setLanguage(event.target.value as typeof language)}
        className="max-w-24 bg-transparent font-bold text-slate-700 outline-none"
      >
        {options.map(option => <option key={option.value} value={option.value}>{compact ? option.shortLabel : option.label}</option>)}
      </select>
    </label>
  );
}
