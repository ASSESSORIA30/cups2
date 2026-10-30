# ASSESSORIA 3.0 · Energy Intelligence

Plataforma SaaS (Next.js 16 · React 19 · TypeScript · Tailwind 4 · componentes estilo shadcn/ui sobre Radix · Apache ECharts · Motion · Lucide) para la radiografía energética de suministros a partir de la exportación SIPS `PuntoSuministro_*.xlsx`.

## Funcionalidades

| Módulo | Qué hace |
|---|---|
| **Importador** | Lee la hoja `Page1` con sus 97 columnas (tolerante a acentos y mayúsculas), formatos numéricos españoles y fechas. Conserva todas las columnas (`raw`), elimina CUPS duplicados (se queda con la última fila) y valida las letras de control. |
| **Radiografía** | Consumo anual en kWh/MWh, tarifa, P1–P6, Pot. anual, BIE, APM y 4 gráficos independientes, con origen, fecha y disponibilidad de los datos. |
| **Power Optimizer** | Diagnóstico, simulador con 6 controles, motor exacto (programación dinámica) y 3 escenarios reproducibles. Genera un PDF. |
| **Reactive Energy** | Relación R/A y cos φ mensual, riesgo según la tarifa, rango sin hipótesis o estimación con hipótesis explícita, y calculadora de compensación. |
| **Energy Market** | Alta, edición y duplicado de ofertas (energía, potencia, SAS, servicios, IEE/IVA, validez) y comparativa con calidad de dato explícita. Genera un PDF para el cliente. |
| **Radar comercial** | Tabla global con filtros, ordenación, puntuación configurable y exportación a XLSX/CSV. |
| **Alertas** | BIE/APM, derechos, no contratable, impagos, lecturas antiguas, consumos anómalos, potencias incoherentes y campos incompletos. Cada alerta indica su motivo, la columna de origen y su gravedad. |
| **Oportunidad / CRM** | Ficha de oportunidad, acciones recomendadas, marcar, responsable, estado, notas, llamadas, propuestas e informe PDF. |

## Rigor de los cálculos

- **Normativa 2026**: peajes CNMC (BOE-A-2025-26348) y cargos (Orden TED/1524/2025). ATR = peaje + cargo; coincide con los ATR publicados por las comercializadoras.
- **Excesos**: art. 9.4 de la Circular 3/2020, modificado por la Circular 1/2025.
  - Tipo 4-5 con maxímetro: tep (€/kW·día) × (Pd − Pc) × días.
  - Tipo 1-3: requiere la curva cuartohoraria, por lo que no se cuantifica sin ella.
  - ICP: no hay excesos; la potencia no puede quedar por debajo de la demanda.
- **Reglas de contratación**: P1 ≤ … ≤ P6 en 3.0TD/6.xTD; en 3.0TD al menos un periodo > 15 kW; en 2.0TD ≤ 15 kW; tope por BIE. Los derechos de acometida siguen el RD 1048/2013.
- **Sin inventar datos por periodo**: el Excel solo trae máximas mensuales agregadas.
  - Para cada periodo se calcula una cota superior con el calendario de temporadas peninsular.
  - Los excesos se valoran en el peor caso, así que el ahorro mostrado es un mínimo.
  - Introduciendo maxímetros por periodo de las facturas, el cálculo usa la medida.
- **Comparador**: sin kWh por periodo muestra el rango garantizado (mínimo y máximo); con datos de facturas, el coste exacto.

Todos los precios se pueden editar en **Ajustes** cuando se publique una nueva resolución.

## Desarrollo

```bash
npm install
npm run dev          # http://localhost:3000
npx vitest run       # 18 pruebas (importación real, normativa, optimizador vs fuerza bruta, reactiva, comparador, alertas, PDF)
npm run build
```

`tests/fixtures/make_fixture.py` genera el Excel de pruebas a partir de las cabeceras reales.

## Despliegue en Vercel

1. Sube el repositorio a GitHub e impórtalo en Vercel (framework detectado: Next.js).
2. No hace falta configurar nada más: Vercel ejecuta `npm install` y `next build` (Node ≥ 20.9).
3. Opcional: define `SIPS_USER` y `SIPS_PASSWORD` en *Environment Variables* (consulta `.env.example`).

## Conector SIPS

`/api/sips` lee las credenciales solo de las variables de entorno del servidor. La descarga automática está **pendiente**: el flujo de login y exportación del portal no es público y no se pudo acceder a él desde el entorno de desarrollo.

Mientras tanto, exporta el Excel desde el portal e impórtalo; es el mismo formato. Para implementarla, completa la función `POST` devolviendo filas con las 97 cabeceras, y el importador las procesará igual.

## Persistencia y CRM

Los datos se guardan en IndexedDB, en el navegador de cada usuario. `docs/schema.sql` define el modelo equivalente en PostgreSQL (lotes de importación, suministros con `raw` jsonb, datos de facturas separados del SIPS, ofertas, oportunidades y eventos con `external_id` para el CRM de Assessoria 3.0).

## Datos de demostración

El botón *Cargar datos de demostración* genera 42 suministros **sintéticos**, que se marcan como DEMO en toda la interfaz y en los PDF. Al importar un Excel real se sustituyen.
