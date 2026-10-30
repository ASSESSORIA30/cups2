-- ASSESSORIA 3.0 · Energy Intelligence
-- Modelo de datos para persistencia en servidor e integración con el CRM.
-- (La versión actual guarda los datos en el navegador con IndexedDB; esta es la
-- estructura equivalente para migrar a PostgreSQL / Vercel Postgres / Supabase.)

CREATE TABLE import_batch (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  file_name     text NOT NULL,
  sheet         text NOT NULL,
  imported_at   timestamptz NOT NULL DEFAULT now(),
  imported_by   text,
  total_rows    int, imported int, header_count int,
  missing_cols  text[], extra_cols text[], duplicates text[], invalid_cups text[],
  is_demo       boolean NOT NULL DEFAULT false
);

-- Un registro por CUPS y lote. `raw` conserva las 97 columnas originales sin pérdida.
CREATE TABLE supply_point (
  cups              text NOT NULL,
  batch_id          uuid NOT NULL REFERENCES import_batch(id),
  source_row        int  NOT NULL,
  cups_valid        boolean NOT NULL,
  direccion text, provincia text, localidad text, codigo_postal text,
  distribuidora text, comercializadora text,
  tarifa_raw text, tarifa text CHECK (tarifa IN ('2.0TD','3.0TD','6.1TD','6.2TD','6.3TD','6.4TD')),
  pot_contratada    numeric[6],          -- kW P1..P6
  pot_max_bie numeric, pot_max_apm numeric, pot_anual numeric,
  pot_mensual       numeric[12],         -- kW, máxima mensual agregada (sin periodo)
  ea_anual numeric, ea_mensual numeric[12],   -- kWh
  er_anual numeric, er_mensual numeric[12],   -- kVArh
  derechos_extension numeric, derechos_acceso numeric,
  tipo_pm smallint, ctrl_potencia text, tension_v numeric,
  contratable boolean, motivo_no_contratable text, info_impagos text,
  f_ult_lectura date, f_ult_cambio_comer date, f_ult_mov_contrato date,
  f_caducidad_bie date, f_caducidad_apm date, f_limite_derechos date,
  raw               jsonb NOT NULL,      -- todas las columnas originales
  PRIMARY KEY (cups, batch_id)
);
CREATE INDEX ON supply_point (tarifa);
CREATE INDEX ON supply_point (localidad);

-- Datos aportados después (facturas / curvas): nunca se mezclan con el SIPS.
CREATE TABLE period_max_reading (
  cups text NOT NULL, month smallint CHECK (month BETWEEN 1 AND 12),
  period smallint CHECK (period BETWEEN 1 AND 6), kw numeric NOT NULL,
  source text NOT NULL, created_at timestamptz DEFAULT now(),
  PRIMARY KEY (cups, month, period)
);
CREATE TABLE invoice_energy_by_period (
  cups text NOT NULL, period smallint, kwh numeric NOT NULL,
  source text NOT NULL, created_at timestamptz DEFAULT now(),
  PRIMARY KEY (cups, period)
);

CREATE TABLE offer (
  id uuid PRIMARY KEY, comercializadora text NOT NULL, nombre text NOT NULL,
  tarifa text NOT NULL, energia numeric[6], potencia numeric[6],
  sas_applies boolean, sas_eur_kwh numeric, servicios jsonb,
  alquiler_eur_mes numeric, iee_pct numeric, iva_pct numeric,
  valid_from date, valid_to date, condiciones text, origen text
);

-- CRM: una oportunidad por CUPS. external_id enlaza con el CRM de Assessoria 3.0.
CREATE TABLE opportunity (
  cups text PRIMARY KEY, external_id text UNIQUE,
  marked boolean DEFAULT false,
  status text CHECK (status IN ('nueva','contactada','propuesta','negociacion','ganada','perdida')),
  owner text, current_offer_id uuid REFERENCES offer(id),
  updated_at timestamptz DEFAULT now()
);
CREATE TABLE opportunity_event (
  id uuid PRIMARY KEY, cups text REFERENCES opportunity(cups),
  kind text CHECK (kind IN ('nota','llamada','propuesta')),
  subtype text, author text, body text, est_saving_eur numeric,
  created_at timestamptz DEFAULT now()
);
