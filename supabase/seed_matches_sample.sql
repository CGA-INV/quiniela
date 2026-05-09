-- =====================================================================
-- Seed de partidos de prueba (12 partidos de fase de grupos)
-- Pegar en Supabase SQL Editor -> Run.
-- Equipos y estadios son ejemplos — reemplaza con datos reales del sorteo.
-- =====================================================================

insert into public.matches
  (match_no, stage, group_label, home_team, away_team, kickoff_at, venue, city)
values
  -- Grupo A
  (1,  'group', 'A', 'México',         'Canadá',         '2026-06-11 19:00-05', 'Estadio Azteca',          'Ciudad de México'),
  (2,  'group', 'A', 'Estados Unidos', 'Argentina',      '2026-06-12 19:00-05', 'SoFi Stadium',            'Los Ángeles'),
  (17, 'group', 'A', 'México',         'Estados Unidos', '2026-06-17 19:00-05', 'Estadio BBVA',            'Monterrey'),
  (18, 'group', 'A', 'Canadá',         'Argentina',      '2026-06-18 19:00-05', 'BMO Field',               'Toronto'),

  -- Grupo B
  (3,  'group', 'B', 'España',         'Brasil',         '2026-06-13 13:00-05', 'MetLife Stadium',         'Nueva York/Nueva Jersey'),
  (4,  'group', 'B', 'Alemania',       'Japón',          '2026-06-13 16:00-05', 'AT&T Stadium',            'Dallas'),
  (19, 'group', 'B', 'España',         'Alemania',       '2026-06-19 13:00-05', 'NRG Stadium',             'Houston'),
  (20, 'group', 'B', 'Brasil',         'Japón',          '2026-06-19 16:00-05', 'Lincoln Financial Field', 'Filadelfia'),

  -- Grupo C
  (5,  'group', 'C', 'Francia',        'Inglaterra',     '2026-06-14 13:00-05', 'Mercedes-Benz Stadium',   'Atlanta'),
  (6,  'group', 'C', 'Italia',         'Países Bajos',   '2026-06-14 16:00-05', 'Hard Rock Stadium',       'Miami'),
  (21, 'group', 'C', 'Francia',        'Italia',         '2026-06-20 13:00-05', 'Levi''s Stadium',         'San Francisco'),
  (22, 'group', 'C', 'Inglaterra',     'Países Bajos',   '2026-06-20 16:00-05', 'Gillette Stadium',        'Boston')
on conflict do nothing;
