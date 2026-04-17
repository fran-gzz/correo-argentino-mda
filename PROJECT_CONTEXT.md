# PROJECT_CONTEXT

## Producto
Portal de la Mesa de Ayuda Interna

## Descripcion
Portal interno para soporte corporativo logistico y postal de Correo Argentino.
Centraliza herramientas de operacion diaria para reducir tiempos de atencion,
disminuir errores de carga y mejorar la trazabilidad de casos N1/N2.

## Objetivo principal
Centralizar y agilizar tareas de operadores N1/N2 con herramientas para:
- tipificacion de tickets
- busqueda de personal
- monitoreo de terminales
- gestion de carga laboral

## Publico objetivo
Operadores N1 y N2 de mesa de ayuda interna, con foco en soporte corporativo
de operaciones logisticas y postales.

## Stack real del repositorio
- Framework: Astro (output server) + adapter Vercel
- UI: Tailwind CSS + DaisyUI
- Integraciones: MDX + astro-icon + theme-change
- Datos y auth: Supabase + Supabase Auth (dependencias instaladas)
- Middleware: existe control de rutas privadas en src/middleware.ts, con guard
  de login aun deshabilitado por bandera de implementacion.

---

## Sistema de diseno y UX aprobado

### Tipografia y legibilidad
- Tipografia sans-serif moderna y legible para UI operativa.
- Tipografia monoespaciada para datos tecnicos: IPs, rutas, IDs y texto rigido.
- Jerarquia clara para escaneo rapido en contexto de soporte.

### Tema y color
- Soporte nativo claro/oscuro con selector global de tema.
- Acentos institucionales: amarillo y azul.
- Estados semanticos consistentes: exito, error y advertencia.

### Interaccion operativa
- Botones de copia rapida al portapapeles con feedback inmediato.
- Interacciones de baja friccion, sin ruido visual ni animaciones pesadas.
- Navegacion orientada a resolver tareas en pocos clics.

### Lenguaje de interfaz
- Idioma principal: espanol.
- Estilo de escritura: sentence case para titulos y textos de UI.

---

## Sitemap funcional objetivo (11 vistas)

1. / - Dashboard principal: resumen operativo y accesos rapidos.
2. /titulos-tickets - Tipificacion de tickets con acciones de copia.
3. /buscador-usuarios - Busqueda de personal para validaciones de soporte.
4. /directorio-oficinas - Directorio operativo de oficinas y datos tecnicos.
5. /guia-soportes - Matriz de derivacion por tema y area de soporte.
6. /cronograma - Planificacion y calendario de tareas del equipo.
7. /cubics - Monitoreo y consulta de terminales remotas.
8. /mapa-sucursales - Vista geografica de cobertura y sucursales.
9. /inventario-terminales - Estado y asignacion del parque de terminales.
10. /enlaces-importantes - Hub de accesos externos e internos criticos.
11. /configuracion - Preferencias de usuario y ajustes del portal.

---

## Estado actual vs roadmap objetivo

| Vista objetivo | Ruta roadmap | Estado actual en repo | Gap actual |
|---|---|---|---|
| Dashboard principal | / | Implementada como Home publico | Alinear copy y widgets al foco operativo N1/N2 |
| Titulos de tickets | /titulos-tickets | Implementada | Ajustar contenido al nuevo objetivo documental |
| Buscador de usuarios | /buscador-usuarios | Implementada | Revisar criterios finales de datos y permisos |
| Directorio de oficinas | /directorio-oficinas | Existe /oficinas-telegrafia | Definir si se renombra ruta o se mantiene alias documental |
| Guia de soportes | /guia-soportes | Implementada | Completar cobertura de casos por area |
| Cronograma | /cronograma | No implementada | Ruta pendiente |
| Cubics | /cubics | Implementada | Expandir para monitoreo operativo segun roadmap |
| Mapa de sucursales | /mapa-sucursales | No implementada | Ruta pendiente |
| Inventario de terminales | /inventario-terminales | No implementada | Ruta pendiente |
| Enlaces importantes | /enlaces-importantes | No implementada | Ruta pendiente |
| Configuracion | /configuracion | Implementada | Ajustar opciones finales de preferencia |

Notas de trazabilidad:
- Rutas adicionales hoy presentes fuera del roadmap de 11 vistas:
  /documentacion, /design-system y /login.
- Esta actualizacion documental no crea ni modifica rutas funcionales.

---

## Reglas de intervencion

1. Mantener consistencia modular visual en contenedores, tarjetas y limpieza
   de interfaz.
2. Si se agrega una ruta o vista nueva, registrar el cambio en el orquestador
   principal de rutas y en la navegacion superior/lateral dinamica.
   Estado actual: el orquestador principal esta en src/layouts/BaseLayout.astro
   (arreglo navItems).
3. Componentes nuevos deben consumir referencias semanticas de color del sistema
   (tokens DaisyUI o variables de tema), evitando colores hardcodeados.

---

## Estado del proyecto

- Base funcional inicial disponible en rutas principales.
- Documentacion actualizada al nuevo marco de producto en fecha 2026-04-17.
- Pendiente implementacion de rutas roadmap no existentes y activacion real
  de guard de autenticacion.