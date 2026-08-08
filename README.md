# Partner Hub 3.0 — motor Python y corte de julio

Partner Hub conserva las vistas Partner, Aniversarios y Cumpleaños, los KPIs, la jerarquía, los filtros dependientes, la búsqueda, el detalle del partner, “Juntémonos Más” y la exportación para impresión. El archivo `data/Query.xlsx` es ahora la fuente única y `data/partners.js` se genera automáticamente.

## Corte validado

- Fecha detectada en `MES`: **31 de julio de 2026**.
- Campos detectados: **32/32**.
- Filas fuente y partners activos publicados: **13,724**.
- Empleados duplicados: **0**.
- Fechas inválidas: **0**.
- Regiones: **11**; DM: **74**; tiendas: **961**.
- Contra el corte anterior: 544 incorporaciones al conjunto, 719 salidas y variación neta de −175.

El motor publica únicamente filas cuyo campo `STATUS_ EMP (ACTIVO/BAJA)` contiene un estado activo. Las bajas siguen auditándose, pero no aparecen en el directorio operativo.

## Actualización local

Requiere Python 3.11 o superior.

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python actualizar_partner_hub.py --expected-month 7 --expected-year 2026
python -m unittest discover -s tests -v
python -m http.server 8000
```

Abre `http://localhost:8000`.

Cada ejecución crea `build/auditoria_query.json`. El proceso falla si falta cualquiera de los 32 encabezados, si hay empleados activos duplicados, si las fechas no son válidas o si el mes/año no coincide con lo esperado.

## Navegación optimizada

- Python genera el índice Región → DM → Tienda junto con los datos.
- Los selectores ya no reconstruyen la jerarquía recorriendo las 13 mil filas en cada apertura.
- Solo se renderiza la sección visible; aniversarios y cumpleaños se calculan al entrar a su pestaña.
- Las búsquedas usan una pausa breve para evitar renders por cada pulsación.
- Las pestañas conservan su URL (`#partner`, `#anniv`, `#birth`) y admiten flechas, Inicio y Fin desde teclado.
- El mes inicial de celebraciones se toma del corte del Query: julio.
- El estado superior muestra la fecha real de actualización.

## Workflow de GitHub

`.github/workflows/actualizar-partner-hub.yml` ejecuta pruebas, regenera datos, produce la auditoría y publica GitHub Pages.

1. Reemplaza `data/Query.xlsx` con el nuevo archivo mensual, conservando el nombre.
2. Sube el cambio a `main`.
3. En **Settings → Pages**, selecciona **GitHub Actions** como fuente.
4. También puedes ejecutar el workflow manualmente y escribir el número de mes esperado.

## Estructura

```text
.
├── .github/workflows/actualizar-partner-hub.yml
├── engine/partner_engine/       # lectura, validación e índice de navegación
├── data/Query.xlsx              # fuente única
├── data/partners.js             # salida generada; no editar
├── tests/                       # pruebas del motor
├── app.js / index.html / styles.css
└── build/auditoria_query.json   # informe generado
```

