// The site's base path (s15/ship, D-368): '/' on the dev server, '/fars/' on GitHub Pages (vite `base`). Every fetch of a
// public/ file goes through it; node (tests, tools) has no import.meta.env and reads '/'.
export const BASE: string = ((import.meta as any).env?.BASE_URL as string | undefined) ?? '/';
