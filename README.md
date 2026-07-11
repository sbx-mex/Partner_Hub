# Partner Hub 2.0 – Cierre de junio 2026

Versión funcional actualizada con `Query.xlsx`, lista para GitHub Pages y PWA.

## Actualización de datos

- Pestañas leídas completamente: `Directorio`, `Instrucciones` y `Query`.
- Lectura por nombre de encabezado, sin posiciones fijas.
- Filas de datos detectadas en `Query`: **13,899**.
- Partners activos identificados: **13,899**.
- Duplicados exactos removidos: **0**.
- Partners activos publicados: **13,899**.
- Encabezados requeridos encontrados: **38/38**.

## Funcionalidad conservada

- Vista Partner con KPIs, jerarquía, buscador y filtros dependientes.
- Aniversarios y cumpleaños con filtros, paginación y exportación para impresión/PDF.
- Cálculo de antigüedad y edad desde `F_INGRESO` y `F.NAC`.
- Relaciones por centro de costos, DM, región y división conservadas desde la fuente.
- PWA y rutas relativas compatibles con GitHub Pages.

## Archivos de auditoría

- `AUDITORIA_JUNIO_2026.txt`
- `data/audit-june.json`

## Publicación en GitHub Pages

1. Subir el contenido de esta carpeta a la rama principal del repositorio.
2. Abrir **Settings → Pages**.
3. Seleccionar **Deploy from a branch**.
4. Elegir la rama principal y la carpeta raíz `/`.
