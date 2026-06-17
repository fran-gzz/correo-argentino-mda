export type Role = "admin" | "supervisor" | "team_leader" | "referent" | "agent";

export const ROLE_HIERARCHY: Record<Role, number> = {
  agent: 1,
  referent: 2,
  team_leader: 3,
  supervisor: 4,
  admin: 5,
};

export function normalizeRole(role: string): Role {
  const clean = role.toLowerCase().replace(/[-_]/g, " ").trim();
  if (clean === "admin") return "admin";
  if (clean === "supervisor") return "supervisor";
  if (clean === "team leader" || clean === "team_leader" || clean === "team-leader") return "team_leader";
  if (clean === "referent" || clean === "referente") return "referent";
  return "agent";
}

export interface RoutePermission {
  path: string;
  roles: Role[];
}

export const routePermissions: RoutePermission[] = [
  { path: "/admin/usuarios", roles: ["admin"] },
  { path: "/admin/auditoria", roles: ["admin"] },
  { path: "/admin", roles: ["admin", "supervisor", "team_leader"] },
  { path: "/supervision/asistencia", roles: ["admin", "supervisor", "team_leader"] },
  { path: "/supervision/cronograma", roles: ["admin", "supervisor"] },
  { path: "/supervision", roles: ["admin", "supervisor", "team_leader", "referent"] },
];

export function hasPermission(path: string, userRole: string): boolean {
  const role = normalizeRole(userRole);
  const normalizedPath = path.toLowerCase();
  
  const matchedRoute = routePermissions
    .filter(route => normalizedPath.startsWith(route.path.toLowerCase()))
    .sort((a, b) => b.path.length - a.path.length)[0];

  if (!matchedRoute) {
    return true;
  }

  const userRank = ROLE_HIERARCHY[role] || 0;
  return matchedRoute.roles.some(allowedRole => {
    const allowedRank = ROLE_HIERARCHY[allowedRole];
    return userRank >= allowedRank;
  });
}

