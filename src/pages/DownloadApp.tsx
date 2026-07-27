import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Download, ExternalLink, MonitorSmartphone, Share2, Smartphone, Store } from 'lucide-react';
import { Button, Card, Badge } from '@/components/ui';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';

type BeforeInstallPromptEvent = Event & {
  readonly platforms?: string[];
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
  prompt: () => Promise<void>;
};

function useInstallPrompt() {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const onPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setInstallPrompt(null);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const install = async () => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    await installPrompt.userChoice.catch(() => undefined);
    setInstallPrompt(null);
  };

  return { canInstall: Boolean(installPrompt), installed, install };
}

export default function DownloadApp() {
  const { canInstall, installed, install } = useInstallPrompt();
  const appUrl = useMemo(() => {
    if (typeof window === 'undefined') return '';
    return `${window.location.origin}${window.location.pathname}#/`;
  }, []);

  return (
    <div className="min-h-screen bg-[#f5f4ef] px-5 py-6 text-slate-900 sm:px-8">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4">
        <Link to="/" className="flex items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#71806a] text-white shadow-sm">
            <Store className="h-6 w-6" />
          </span>
          <span>
            <span className="block text-lg font-black tracking-tight">KI3 POS</span>
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">App Download</span>
          </span>
        </Link>
        <LanguageSwitcher compact className="shrink-0" />
      </div>

      <main className="mx-auto mt-10 grid w-full max-w-5xl gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <Card className="border-[#e5e1d7] p-7 sm:p-9">
          <Badge className="mb-5">No App Store Required</Badge>
          <h1 className="text-3xl font-black tracking-tight sm:text-5xl">Download or install KI3 POS from this link</h1>
          <p className="mt-4 max-w-2xl text-base font-medium leading-7 text-slate-500">
            Use this public page for owners and employees who need the POS app without publishing it on Play Store or App Store.
          </p>

          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <Button onClick={install} disabled={!canInstall || installed} className="h-13 gap-2">
              <Download className="h-4 w-4" />
              {installed ? 'Installed' : canInstall ? 'Install KI3 POS' : 'Open in Chrome to Install'}
            </Button>
            <a href={appUrl} className="inline-flex h-13 items-center justify-center gap-2 rounded-xl border border-[#ddd9ce] bg-white px-5 py-2.5 text-sm font-semibold transition-colors hover:bg-[#f6f5f0]">
              <ExternalLink className="h-4 w-4" />
              Open Web App
            </a>
          </div>

          <div className="mt-7 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold leading-6 text-amber-900">
            Android APK direct download can be enabled after a real APK is built and uploaded. This computer currently needs Java JDK and Android SDK/Android Studio before APK build.
          </div>
        </Card>

        <div className="grid gap-4">
          <Card className="border-[#e5e1d7]">
            <div className="flex gap-4">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#efeee8] text-[#667860]">
                <Smartphone className="h-5 w-5" />
              </span>
              <div>
                <h2 className="text-lg font-black">Android</h2>
                <p className="mt-1 text-sm font-medium leading-6 text-slate-500">
                  Open this page in Chrome and press Install KI3 POS. When APK is ready, an APK download button can be added here.
                </p>
              </div>
            </div>
          </Card>

          <Card className="border-[#e5e1d7]">
            <div className="flex gap-4">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#efeee8] text-[#667860]">
                <Share2 className="h-5 w-5" />
              </span>
              <div>
                <h2 className="text-lg font-black">iPhone / iPad</h2>
                <p className="mt-1 text-sm font-medium leading-6 text-slate-500">
                  Open with Safari, tap Share, then choose Add to Home Screen. Apple does not allow simple public IPA download installs like Android APK.
                </p>
              </div>
            </div>
          </Card>

          <Card className="border-[#e5e1d7]">
            <div className="flex gap-4">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#efeee8] text-[#667860]">
                <MonitorSmartphone className="h-5 w-5" />
              </span>
              <div>
                <h2 className="text-lg font-black">Desktop</h2>
                <p className="mt-1 text-sm font-medium leading-6 text-slate-500">
                  Chrome and Edge can install KI3 POS as a desktop app from the browser install icon.
                </p>
              </div>
            </div>
          </Card>
        </div>
      </main>
    </div>
  );
}
