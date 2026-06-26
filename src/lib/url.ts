export function resolveUrl(path: string, base?: string): string {
  const b = base ?? (typeof import.meta !== "undefined" ? (import.meta.env.BASE_URL || "/") : "/");
  const cleanBase = b.endsWith("/") ? b : b + "/";
  const cleanPath = path.startsWith("/") ? path.slice(1) : path;
  return `${cleanBase}${cleanPath}`;
}
