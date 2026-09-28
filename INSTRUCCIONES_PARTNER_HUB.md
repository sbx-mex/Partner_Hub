# Partner Hub — entrega puntual (28 sep 2026)

La estructura del ZIP corresponde a la raíz de `sbx-mex/Partner_Hub` (`main`). Copia los archivos sobre una rama de trabajo. El libro `data/Query.xlsx` sólo cambia la presentación de `L1:M1`; conserva el corte real **30-ago-2026**. No se incluye `data/Directorio.xlsx`, porque no se debe inventar una actualización de DM o región.

## Aplicación

1. Copia los archivos del ZIP al repositorio, excepto `INSTRUCCIONES_PARTNER_HUB.md` y `reports/validacion_corte.json` si sólo deseas código.
2. Ejecuta `python tools/cleanup_obsolete.py` para retirar cuatro auditorías históricas.
3. Revisa `reports/validacion_corte.json`: faltan tres CeCo (25 filas), hay 21 CeCo de estado no abierto (194 filas) y cinco cruces de nombre ambiguos (55 filas). Corrige `Query.xlsx` o `Directorio.xlsx` desde sus fuentes autorizadas. Ninguna fila se reasigna automáticamente a otro DM o región.
4. Actualiza `Query!M1` sólo cuando el archivo Query corresponda de verdad a un nuevo corte.
5. Ejecuta `python -m unittest discover -s tests -v`, `python -m tools.audit_sources --output build/validacion_corte.json`, `python actualizar_partner_hub.py` y `python engine/package_site.py --source . --output build/site`, en ese orden. No publiques mientras la auditoría regrese código 1.

El ejemplo `01938262` cruza con **38262**, Centro Max, Bajío, Christian Medina Capetillo. **38362** es Boulevard Centenario, Noroeste, en cierre temporal. La salida `data/partners.js` existente no corresponde a los libros actuales y no se incluye en esta entrega.

## Archivos obsoletos a retirar

- `AUDITORIA_JULIO.md`
- `AUDITORIA_REGION_FILTROS.txt`
- `data/audit-june.json`
- `data/audit-query.json`

El repositorio es público y ya contiene el Query con datos personales. Esta entrega corrige el cruce y la validación; trasladar fuentes y publicación a un entorno con acceso controlado sigue siendo necesario para confidencialidad.
