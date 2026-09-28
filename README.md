# Partner Hub — consulta de equipo y tiendas

Las vistas **Partner**, **Aniversarios** y **Cumpleaños** se alimentan de `data/Query.xlsx`. El motor Python cruza cada fila con `data/Directorio.xlsx` por CeCo, prepara los filtros Región → DM → Tienda y genera los datos para el sitio. El encabezado muestra el corte declarado en `Query!M1`.

## Contrato de los archivos

| Archivo | Columnas mínimas (en cualquier orden) | Uso |
| --- | --- | --- |
| `data/Query.xlsx`, hoja `query` | `NUM_EMP`, `NOMBRE`, `F_INGRESO`, `F_BAJA`, `CCOSTO`, `TURNO`, `NOM_PUESTO`, `F.NAC`; `L1` etiqueta y `M1` fecha de corte | Partners activos y celebraciones |
| `data/Directorio.xlsx`, hoja `Directorio` | `CC`, `CC Nombre`, `Región`, `Estatus`, `DM` | Nombre oficial de tienda, región y DM |

Python normaliza espacios, mayúsculas y acentos de los encabezados. Toma los **últimos cinco dígitos** de `CCOSTO` como CeCo y exige coincidencia exacta con `CC`. Por ejemplo, `01938262` → **38262** → Centro Max, Bajío, DM Christian Medina Capetillo. **38362** pertenece a Boulevard Centenario, Noroeste, con cierre temporal; no se debe usar para ese `CCOSTO`.

La fecha de corte se lee de `M1`; la fecha de ejecución no cambia el periodo. Se excluye `F_BAJA` hasta ese día y se conserva una baja posterior al corte. CeCos ausentes, tiendas no abiertas, datos contradictorios y nombres que coinciden exactamente con otro CeCo bloquean la publicación. Diferencias de denominación que no apuntan a otra tienda se cuentan y se usa el nombre oficial del Directorio. Región y DM siempre provienen del CeCo validado en el Directorio, nunca del nombre libre del Query.

La página publica nombre, fecha de ingreso, CeCo, tienda, turno, puesto, región, DM y **solo día y mes** de cumpleaños. No publica número de empleado, fecha completa de nacimiento ni género. El buscador permite consultar nombre, tienda, puesto, turno y CeCo.

## Actualizar y comprobar

Requiere Python 3.11 o superior:

```bash
pip install -r requirements.txt
python -m unittest discover -s tests -v
python -m tools.audit_sources --output build/validacion_corte.json
python actualizar_partner_hub.py
python engine/package_site.py --source . --output build/site
python -m http.server 8000
```

Abre `http://localhost:8000`. Reemplaza **ambos** libros en `data/`, actualiza `Query!M1` con la fecha real del extracto y ejecuta primero la auditoría. La auditoría sale con código 1 si hay cruces pendientes; el detalle por CeCo queda en `build/validacion_corte.json` sin datos de empleados. Corrige el libro fuente o Directorio y vuelve a correrla. `build/auditoria_query.json` registra conteos y hashes SHA-256 de ambas fuentes. `package_site.py` rechaza una publicación si los datos o el corte no corresponden a los libros actuales. Para exigir un mes y año concretos: `python actualizar_partner_hub.py --expected-month 8 --expected-year 2026`.

El mes inicial de las celebraciones sigue el corte M1. El workflow ejecuta pruebas y preflight antes de generar o publicar, y deja el reporte de auditoría como artefacto incluso si falla. También permite indicar un mes esperado al lanzarlo manualmente.

**Acceso:** este repositorio y GitHub Pages son públicos. `Query.xlsx` contiene datos personales; el motor minimiza la salida del sitio, pero no protege el libro fuente que ya está en el historial público. Para confidencialidad real, migra las fuentes y la publicación a almacenamiento privado con control de acceso y retira los archivos del historial público conforme a la política de tu organización.
