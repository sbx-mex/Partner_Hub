# Partner Hub 2.1 - Región y filtros dependientes

Versión funcional actualizada con `Query.xlsx`, preparada para GitHub Pages y PWA.

## Datos procesados

- Hoja fuente: `Query`.
- Encabezados identificados: **39/39**.
- Filas procesadas y publicadas: **13,899**.
- `REGION` se lee por el nombre exacto del encabezado, sin posiciones fijas.
- Regiones: **11**.
- DM: **77**.
- Tiendas: **951**.

## Correcciones y mejoras

- Corrección del filtro Región para usar exclusivamente `Query[REGION]`.
- Normalización de espacios, valores vacíos, orden alfabético y duplicados visuales.
- Filtros de selección única con estilo slicer.
- Búsqueda, opción `Todos`, botón `Limpiar` y scroll interno.
- Navegación dependiente `Región → DM → Tienda`.
- Persistencia de filtros con `localStorage`.
- Actualización inmediata de KPIs, jerarquías, aniversarios y cumpleaños.
- Diseño general y lógica existente conservados.

## Archivos de auditoría

- `AUDITORIA_REGION_FILTROS.txt`
- `data/audit-query.json`
- `data/audit-june.json`

## Fuente incluida

El archivo utilizado se conserva en `data/Query.xlsx`.

## Publicación en GitHub Pages

1. Sube el contenido de esta carpeta a la rama principal.
2. Abre **Settings → Pages**.
3. Selecciona **Deploy from a branch**.
4. Elige la rama principal y la carpeta raíz `/`.
