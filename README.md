# Partner Hub — consulta de equipo y tiendas

Las vistas **Partner**, **Aniversarios** y **Cumpleaños** se alimentan de `data/Query.xlsx`. El motor Python cruza cada fila con `data/Directorio.xlsx` por CeCo, prepara los filtros Región → DM → Tienda y genera los datos para el sitio. El encabezado muestra el tamaño y la fecha de la carga validada.

## Contrato de los archivos

| Archivo | Columnas mínimas (en cualquier orden) | Uso |
| --- | --- | --- |
| `data/Query.xlsx`, hoja `query` | `NUM_EMP`, `NOMBRE`, `F_INGRESO`, `F_BAJA`, `CCOSTO`, `TURNO`, `NOM_PUESTO`, `F.NAC` | Partners activos y celebraciones |
| `data/Directorio.xlsx`, hoja `Directorio` | `CC`, `CC Nombre`, `Región`, `Estatus`, `DM` | Nombre oficial de tienda, región y DM |

Python normaliza espacios, mayúsculas y acentos de los encabezados. Toma los **últimos cinco dígitos** de `CCOSTO` como CeCo y exige coincidencia exacta con `CC`. Los códigos con letras o fracciones, un CeCo sin tienda o cerrada, y las fichas duplicadas contradictorias detienen la generación. Una ficha idéntica repetida se cuenta y publica una sola vez. Las filas con `F_BAJA` se excluyen. Si el nombre de tienda del Query difiere del Directorio, se usa el oficial y se cuenta en la auditoría.

La página publica nombre, fecha de ingreso, CeCo, tienda, turno, puesto, región, DM y **solo día y mes** de cumpleaños. No publica número de empleado, fecha completa de nacimiento ni género. El buscador permite consultar nombre, tienda, puesto, turno y CeCo.

## Actualizar y comprobar

Requiere Python 3.11 o superior:

```bash
pip install -r requirements.txt
python -m unittest discover -s tests -v
python actualizar_partner_hub.py
python engine/package_site.py --source . --output build/site
python -m http.server 8000
```

Abre `http://localhost:8000`. Reemplaza **ambos** libros en `data/` y vuelve a ejecutar el generador. `build/auditoria_query.json` registra conteos, diferencias y hashes SHA-256 de ambas fuentes. `package_site.py` rechaza una publicación si `data/partners.js` o la auditoría no corresponden a los libros actuales. Si se necesita comprobar un mes o año de carga: `python actualizar_partner_hub.py --expected-month 9 --expected-year 2026`.

El corte del archivo generado es la **fecha de ejecución**; no se infiere a partir de datos personales. El mes inicial de las vistas de celebraciones sigue ese corte. En GitHub, el workflow se ejecuta al modificar Query, Directorio, motor o interfaz, regenera la auditoría y publica GitHub Pages. También permite indicar un mes esperado al lanzarlo manualmente. Para una carga privada se necesita control de acceso en el hosting: el contenido de GitHub Pages puede ser consultado por quien tenga acceso a la página.
