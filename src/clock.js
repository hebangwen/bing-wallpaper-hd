function pad(value) {
  return String(value).padStart(2, "0");
}

export function formatTime(
  date,
  { hour24 = true, showSeconds = true, am = "AM", pm = "PM" } = {},
) {
  const minutes = showSeconds
    ? `${pad(date.getMinutes())}:${pad(date.getSeconds())}`
    : pad(date.getMinutes());

  if (hour24) {
    return `${pad(date.getHours())}:${minutes}`;
  }

  const hours = date.getHours();
  return `${hours < 12 ? am : pm} ${hours % 12 || 12}:${minutes}`;
}

export function formatDateLine(date, style = "long", locale = "zh-CN") {
  if (style === "hidden") return "";

  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();

  if (style === "numeric") {
    return `${year}-${pad(month)}-${pad(day)}`;
  }

  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
  }).format(date);
}
