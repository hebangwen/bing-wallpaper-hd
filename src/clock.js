const WEEKDAYS = ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"];

function pad(value) {
  return String(value).padStart(2, "0");
}

export function formatTime(date, { hour24 = true, showSeconds = true } = {}) {
  const minutes = showSeconds
    ? `${pad(date.getMinutes())}:${pad(date.getSeconds())}`
    : pad(date.getMinutes());

  if (hour24) {
    return `${pad(date.getHours())}:${minutes}`;
  }

  const hours = date.getHours();
  const period = hours < 12 ? "上午" : "下午";
  return `${period} ${hours % 12 || 12}:${minutes}`;
}

export function formatDateLine(date, style = "long") {
  if (style === "hidden") return "";

  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();

  if (style === "numeric") {
    return `${year}-${pad(month)}-${pad(day)}`;
  }

  return `${year}年${month}月${day}日 ${WEEKDAYS[date.getDay()]}`;
}
