import { useEffect } from 'react';
import { type AppLanguage, translate, useLanguage } from '@/lib/language';

const originalText = new WeakMap<Text, string>();
const originalAttributes = new WeakMap<Element, Record<string, string>>();
const translatableAttributes = ['placeholder', 'title', 'aria-label'] as const;

function shouldSkip(element: Element | null) {
  return Boolean(element?.closest('script,style,textarea,[data-no-translate]'));
}

function translateTextNode(node: Text, language: AppLanguage) {
  if (!node.nodeValue || !node.nodeValue.trim() || shouldSkip(node.parentElement)) return;
  const leading = node.nodeValue.match(/^\s*/)?.[0] || '';
  const trailing = node.nodeValue.match(/\s*$/)?.[0] || '';
  const raw = node.nodeValue.trim();
  const previous = originalText.get(node);
  const previousTarget = previous ? translate(previous, language) : '';
  const source = previous && (raw === previous || raw === previousTarget) ? previous : raw;
  const target = language === 'en' ? source : translate(source, language);
  originalText.set(node, source);
  if (raw !== target) node.nodeValue = `${leading}${target}${trailing}`;
}

function translateAttributes(element: Element, language: AppLanguage) {
  if (shouldSkip(element)) return;
  const stored = originalAttributes.get(element) || {};
  let changed = false;
  for (const name of translatableAttributes) {
    const value = element.getAttribute(name);
    if (!value?.trim()) continue;
    const source = stored[name] || value;
    const target = language === 'en' ? source : translate(source, language);
    stored[name] = source;
    if (value !== target) {
      element.setAttribute(name, target);
      changed = true;
    }
  }
  if (changed) originalAttributes.set(element, stored);
}

function scan(root: ParentNode, language: AppLanguage) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();
  while (node) {
    translateTextNode(node as Text, language);
    node = walker.nextNode();
  }
  if (root instanceof Element) translateAttributes(root, language);
  root.querySelectorAll?.('[placeholder],[title],[aria-label]').forEach(element => translateAttributes(element, language));
}

export function LanguageDomTranslator() {
  const { language } = useLanguage();

  useEffect(() => {
    const apply = () => scan(document.body, language);
    const observer = new MutationObserver(mutations => {
      for (const mutation of mutations) {
        if (mutation.type === 'characterData' && mutation.target instanceof Text) translateTextNode(mutation.target, language);
        mutation.addedNodes.forEach(node => {
          if (node instanceof Text) translateTextNode(node, language);
          else if (node instanceof Element) scan(node, language);
        });
        if (mutation.type === 'attributes' && mutation.target instanceof Element) translateAttributes(mutation.target, language);
      }
    });
    apply();
    observer.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: [...translatableAttributes] });
    return () => observer.disconnect();
  }, [language]);

  return null;
}
