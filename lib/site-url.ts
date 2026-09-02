export const PUBLIC_SITE_ORIGIN = 'https://minutes-museum.dharshanlab.chatgpt.site';

export function siteUrl(path: string) {
  if (typeof window === 'undefined' || !window.location.hostname.endsWith('.chatgpt.site')) return path;
  return `${PUBLIC_SITE_ORIGIN}${path.startsWith('/') ? path : `/${path}`}`;
}
