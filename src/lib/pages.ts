// Pagination for the list pages (/blog/, /diary/). Page 1 is the section's own URL, page n is <base>page/<n>/:
// a plain number right under /blog/ could collide with an article id ("2021/06/19/133849").

// How many entries one list page holds.
export const BLOG_PAGE_SIZE = 20;
export const DIARY_PAGE_SIZE = 30;

export type Page<T> = { items: T[]; current: number; last: number };

export const paginate = <T>(items: T[], current: number, size: number): Page<T> => {
  const last = Math.max(1, Math.ceil(items.length / size));
  if (!Number.isInteger(current) || current < 1 || current > last) throw new Error(`page ${current} is out of 1..${last}`);
  return { items: items.slice((current - 1) * size, current * size), current, last };
};

export const pagePath = (base: string, n: number): string => (n === 1 ? base : `${base}page/${n}/`);

// The numbers getStaticPaths builds under <base>page/ (page 1 is the base's own index page).
export const laterPages = (count: number, size: number): number[] =>
  Array.from({ length: Math.max(0, Math.ceil(count / size) - 1) }, (_, i) => i + 2);
