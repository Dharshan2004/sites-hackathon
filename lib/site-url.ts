export const PUBLIC_SITE_ORIGIN = 'https://minutes-museum.dharshanlab.chatgpt.site';

export function siteUrl(path: string) {
  return path.startsWith('/') ? path : `/${path}`;
}
