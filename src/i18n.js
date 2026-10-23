const FALLBACK_LOCALE = "zh-CN";
const SUPPORTED = new Set(["zh-CN", "en"]);

let messages = {};
let locale = FALLBACK_LOCALE;

export function normalizeLanguage(value) {
  return value === "auto" || SUPPORTED.has(value) ? value : "auto";
}

export function resolveLanguage(setting, uiLanguage = "zh-CN") {
  if (setting === "zh-CN" || setting === "en") return setting;
  return String(uiLanguage).toLowerCase().startsWith("zh") ? "zh-CN" : "en";
}

function directoryFor(language) {
  return language === "en" ? "en" : "zh_CN";
}

// 运行时读取 messages.json，语言由设置决定，而不是浏览器界面语言。
export async function initI18n(setting = "auto") {
  locale = resolveLanguage(normalizeLanguage(setting), chrome.i18n.getUILanguage());

  try {
    const response = await fetch(chrome.runtime.getURL(`_locales/${directoryFor(locale)}/messages.json`));
    const data = await response.json();
    messages = Object.fromEntries(
      Object.entries(data).map(([key, value]) => [key, value.message]),
    );
  } catch {
    messages = {};
  }

  if (typeof document !== "undefined") {
    document.documentElement.lang = locale;
  }
  return locale;
}

export function formatMessage(template, substitutions = []) {
  const list = Array.isArray(substitutions) ? substitutions : [substitutions];
  return String(template).replace(/\$(\d)/g, (_, index) => {
    const value = list[Number(index) - 1];
    return value === undefined ? "" : String(value);
  });
}

export function t(key, substitutions) {
  const template = messages[key];
  if (!template) return key;
  return formatMessage(template, substitutions);
}

export function currentLocale() {
  return locale;
}

export function applyI18n(root = document) {
  for (const node of root.querySelectorAll("[data-i18n]")) {
    node.textContent = t(node.dataset.i18n);
  }
  for (const node of root.querySelectorAll("[data-i18n-placeholder]")) {
    node.placeholder = t(node.dataset.i18nPlaceholder);
  }
  for (const node of root.querySelectorAll("[data-i18n-title]")) {
    node.title = t(node.dataset.i18nTitle);
  }
  for (const node of root.querySelectorAll("[data-i18n-aria-label]")) {
    node.setAttribute("aria-label", t(node.dataset.i18nAriaLabel));
  }

  document.documentElement.lang = locale;
}
