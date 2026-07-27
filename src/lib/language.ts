import { useEffect, useState } from 'react';

export type AppLanguage = 'en' | 'my' | 'ko';

export const languageOptions: Array<{ value: AppLanguage; label: string; shortLabel: string }> = [
  { value: 'en', label: 'English', shortLabel: 'EN' },
  { value: 'my', label: 'Myanmar', shortLabel: 'MY' },
  { value: 'ko', label: 'Korean', shortLabel: 'KO' },
];

const storageKey = 'ki3-language';

function isAppLanguage(value: string | null): value is AppLanguage {
  return value === 'en' || value === 'my' || value === 'ko';
}

export function currentLanguage(): AppLanguage {
  if (typeof window === 'undefined') return 'en';
  const saved = window.localStorage.getItem(storageKey);
  return isAppLanguage(saved) ? saved : 'en';
}

export function saveLanguage(language: AppLanguage) {
  window.localStorage.setItem(storageKey, language);
  document.documentElement.lang = language;
  window.dispatchEvent(new CustomEvent('ki3-language-change', { detail: language }));
}

export function useLanguage() {
  const [language, setLanguage] = useState<AppLanguage>(() => currentLanguage());

  useEffect(() => {
    document.documentElement.lang = language;
    const update = () => setLanguage(currentLanguage());
    window.addEventListener('storage', update);
    window.addEventListener('ki3-language-change', update);
    return () => {
      window.removeEventListener('storage', update);
      window.removeEventListener('ki3-language-change', update);
    };
  }, [language]);

  return { language, setLanguage: saveLanguage, options: languageOptions };
}

const dictionary: Record<string, Record<AppLanguage, string>> = {
  Dashboard: { en: 'Dashboard', my: 'Dashboard', ko: '대시보드' },
  'Shops (Tenants)': { en: 'Shops (Tenants)', my: 'ဆိုင်များ', ko: '매장 관리' },
  'Global Reports': { en: 'Global Reports', my: 'အစီရင်ခံစာများ', ko: '전체 보고서' },
  'System Settings': { en: 'System Settings', my: 'System Settings', ko: '시스템 설정' },
  'Order Monitor': { en: 'Order Monitor', my: 'Order Monitor', ko: '주문 모니터' },
  Inventory: { en: 'Inventory', my: 'ပစ္စည်းစာရင်း', ko: '재고' },
  Employees: { en: 'Employees', my: 'ဝန်ထမ်းများ', ko: '직원' },
  'Business Operations': { en: 'Business Operations', my: 'လုပ်ငန်းဆောင်ရွက်မှု', ko: '운영 관리' },
  'Branches & Finance': { en: 'Branches & Finance', my: 'ဆိုင်ခွဲနှင့်ငွေစာရင်း', ko: '지점 및 재무' },
  'Accounting & Reports': { en: 'Accounting & Reports', my: 'စာရင်းကိုင်နှင့် Report', ko: '회계 및 보고서' },
  'Core Modules': { en: 'Core Modules', my: 'Core Modules', ko: '핵심 모듈' },
  Settings: { en: 'Settings', my: 'Settings', ko: '설정' },
  'Point of Sale': { en: 'Point of Sale', my: 'အရောင်း POS', ko: 'POS 판매' },
  'My Orders': { en: 'My Orders', my: 'ကျွန်ုပ်၏ Order များ', ko: '내 주문' },
  'Record Expense': { en: 'Record Expense', my: 'အသုံးစရိတ်ထည့်ရန်', ko: '비용 입력' },
  Reports: { en: 'Reports', my: 'Reports', ko: '보고서' },
  Subscription: { en: 'Subscription', my: 'Subscription', ko: '구독' },
  'Sign Out': { en: 'Sign Out', my: 'ထွက်ရန်', ko: '로그아웃' },
  'Global Search...': { en: 'Global Search...', my: 'ရှာရန်...', ko: '전체 검색...' },
  Notifications: { en: 'Notifications', my: 'အသိပေးချက်များ', ko: '알림' },
  'KI3 POS Administration': { en: 'KI3 POS Administration', my: 'KI3 POS စီမံခန့်ခွဲမှု', ko: 'KI3 POS 관리자' },
  'My Shop': { en: 'My Shop', my: 'ကျွန်ုပ်၏ဆိုင်', ko: '내 매장' },
  'Loading plan': { en: 'Loading plan', my: 'Plan ဖတ်နေသည်', ko: '요금제 로딩 중' },
  'Loading subscription...': { en: 'Loading subscription...', my: 'Subscription ဖတ်နေသည်...', ko: '구독 정보 로딩 중...' },
  'All stock levels look good': { en: 'All stock levels look good', my: 'Stock အခြေအနေကောင်းပါသည်', ko: '재고 상태가 양호합니다' },
  'Review tenant plans and shop activity.': { en: 'Review tenant plans and shop activity.', my: 'ဆိုင် plan နှင့် activity များစစ်ပါ။', ko: '매장 요금제와 활동을 확인하세요.' },
  'Return to the point of sale.': { en: 'Return to the point of sale.', my: 'POS သို့ပြန်သွားပါ။', ko: 'POS 화면으로 돌아갑니다.' },
  'Open inventory to review stock levels.': { en: 'Open inventory to review stock levels.', my: 'Stock စစ်ရန် Inventory ကိုဖွင့်ပါ။', ko: '재고 화면에서 수량을 확인하세요.' },
  Back: { en: 'Back', my: 'နောက်သို့', ko: '뒤로' },
  Online: { en: 'Online', my: 'Online', ko: '온라인' },
  'Offline queue': { en: 'Offline queue', my: 'Offline queue', ko: '오프라인 대기열' },
  Orders: { en: 'Orders', my: 'Order များ', ko: '주문' },
  Expense: { en: 'Expense', my: 'အသုံးစရိတ်', ko: '비용' },
  Held: { en: 'Held', my: 'Hold ထားသည်', ko: '보류' },
  'Close Shift': { en: 'Close Shift', my: 'Shift ပိတ်ရန်', ko: '근무 종료' },
  'Open Shift': { en: 'Open Shift', my: 'Shift ဖွင့်ရန်', ko: '근무 시작' },
};

export function translate(label: string, language: AppLanguage) {
  return dictionary[label]?.[language] || label;
}
