// The months for the date picker, as weeks running Monday to Sunday.

export interface CalendarMonth {
  /** YYYY-MM */
  id: string;
  label: string;
  /** Seven dates per week, with null for days falling in the months either side. */
  weeks: (string | null)[][];
}

const monthLabel = new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });

function buildMonth(year: number, monthIndex: number): CalendarMonth {
  const first = new Date(Date.UTC(year, monthIndex, 1));
  const daysInMonth = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  const id = first.toISOString().slice(0, 7);
  const leading = (first.getUTCDay() + 6) % 7;
  const cells: (string | null)[] = [
    ...Array.from({ length: leading }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => `${id}-${String(i + 1).padStart(2, '0')}`),
  ];
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks = Array.from({ length: cells.length / 7 }, (_, i) => cells.slice(i * 7, i * 7 + 7));
  return { id, label: monthLabel.format(first), weeks };
}

/** Every month from the one holding `first` to the one holding `last`, oldest first. */
export function calendarMonths(first: string, last: string): CalendarMonth[] {
  const months: CalendarMonth[] = [];
  let year = Number(first.slice(0, 4));
  let month = Number(first.slice(5, 7)) - 1;
  const lastId = last.slice(0, 7);
  for (;;) {
    const built = buildMonth(year, month);
    months.push(built);
    if (built.id >= lastId) return months;
    month += 1;
    if (month === 12) {
      month = 0;
      year += 1;
    }
  }
}
