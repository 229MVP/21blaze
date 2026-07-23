function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function formatCompletedDate(
  isoDate: string,
  now: Date = new Date(),
): string {
  const completed = new Date(isoDate);

  if (!Number.isFinite(completed.getTime())) {
    return 'Unknown date';
  }

  const timeLabel = completed.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });

  if (isSameDay(completed, now)) {
    return `Today, ${timeLabel}`;
  }

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);

  if (isSameDay(completed, yesterday)) {
    return `Yesterday, ${timeLabel}`;
  }

  const dayDiff =
    (startOfDay(now).getTime() - startOfDay(completed).getTime()) /
    (24 * 60 * 60 * 1000);

  if (dayDiff < 6 && dayDiff > 0) {
    const weekday = completed.toLocaleDateString(undefined, { weekday: 'short' });
    return `${weekday}, ${timeLabel}`;
  }

  return completed.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}
