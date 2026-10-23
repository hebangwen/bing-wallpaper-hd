export function t(key, substitutions) {
  const message = chrome.i18n.getMessage(key, substitutions);
  return message || key;
}

export function currentLocale() {
  return chrome.i18n.getUILanguage() || "zh-CN";
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

  document.documentElement.lang = currentLocale();
}
