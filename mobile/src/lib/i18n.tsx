import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { setApiLanguage } from './api';
import * as F from './format';
import { KO } from './ko';
import { detectLang, type Lang } from './lang';
import { langStorage } from './storage';
import type { InvoiceLine, PaymentMethod, ScheduleDay, WashStatus } from './types';

export type { Lang } from './lang';
type Params = Record<string, string | number>;

/**
 * Text in the chosen language. Keys are the English text; Korean comes from ko.ts and anything
 * without a translation (names people typed, new texts) is shown as it is. "{name}" is filled from params.
 */
export function translate(lang: Lang, text: string, params?: Params): string {
  const out = lang === 'ko' ? (KO[text] ?? text) : text;
  return params ? out.replace(/\{(\w+)\}/g, (m, k: string) => (k in params ? String(params[k]) : m)) : out;
}

const initial = detectLang();
setApiLanguage(initial);

function build(lang: Lang) {
  const t = (text: string, params?: Params) => translate(lang, text, params);
  const fmt = {
    day: (date: string) => F.formatDay(date, lang),
    month: (month: string) => F.formatMonth(month, lang),
    krw: (amount: number) => F.formatKRW(amount, lang),
    weekday: (weekday: number) => F.weekdayName(weekday, lang),
    weekdayLong: (weekday: number) => F.weekdayLong(weekday, lang),
    chip: (date: string) => F.dateChip(date, lang),
    schedule: (schedule: ScheduleDay[]) => F.scheduleSummary(schedule, lang),
    weather: (f: F.ForecastFacts) => F.forecastSummary(f, lang),
    status: (status: WashStatus) => t(F.STATUS_LABEL[status]),
    method: (method: PaymentMethod) => t(F.PAYMENT_METHOD_LABEL[method]),
    /** Plan and extra names: the ones the shop started with are translated, others stay as typed. */
    name: (name: string) => t(name),
    billLine: (l: InvoiceLine) => {
      if (!l.kind || !l.name || !l.washes) return l.label;
      const name = t(l.name);
      if (l.kind === 'extra') return `${name} × ${l.washes}`;
      return l.washesPerMonth && l.washes < l.washesPerMonth
        ? t('{name} plan ({washes} of {total} washes)', { name, washes: l.washes, total: l.washesPerMonth })
        : t('{name} plan', { name });
    },
    /** "1 car" / "2 cars" — English plurals; Korean has one form. */
    count: (n: number, one: string, many: string) => t(n === 1 ? one : many, { n }),
  };
  return { t, fmt };
}

interface I18nState extends ReturnType<typeof build> {
  lang: Lang;
  ready: boolean;
  setLang: (lang: Lang) => void;
}

const I18nContext = createContext<I18nState | null>(null);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>(initial);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    langStorage.get().then((saved) => {
      if (saved) {
        setApiLanguage(saved);
        setLangState(saved);
      }
      setReady(true);
    });
  }, []);

  const setLang = useCallback((next: Lang) => {
    setApiLanguage(next);
    setLangState(next);
    void langStorage.set(next);
  }, []);

  const value = useMemo<I18nState>(() => ({ lang, ready, setLang, ...build(lang) }), [lang, ready, setLang]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used inside I18nProvider');
  return ctx;
}
