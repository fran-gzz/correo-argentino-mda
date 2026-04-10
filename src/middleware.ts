import type { MiddlewareHandler } from "astro";

const PRIVATE_ROUTES = [
  "/buscador-usuarios",
  "/oficinas-telegrafia",
  "/cubics",
  "/configuracion",
];

export const onRequest: MiddlewareHandler = async (context, next) => {
  const path = context.url.pathname;
  const isPrivateRoute = PRIVATE_ROUTES.some((route) =>
    path === route || path.startsWith(`${route}/`),
  );

  if (!isPrivateRoute) {
    return next();
  }

  // TODO: Leer cookie/sesion real de Supabase Auth.
  // TODO: Reemplazar esta validacion placeholder por getUser/getSession en server.
  const hasSupabaseSession = false;

  if (!hasSupabaseSession) {
    return context.redirect("/login");
  }

  return next();
};
