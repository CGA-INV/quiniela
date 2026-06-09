-- =====================================================================
-- Avance automático del bracket (32avos → final)
--
-- Añade pen_winner: en eliminatorias empatadas (definidas por penales),
-- guarda el nombre del equipo que avanzó, para poder llenar la siguiente
-- llave. Null en partidos de grupo y en eliminatorias decididas por marcador.
--
-- La lógica del bracket vive en lib/bracket.ts + lib/bracket-apply.ts y corre
-- al cerrar cada partido (server action), no en la base de datos. Esta
-- migración solo agrega la columna que esa lógica necesita.
--
-- Pegar en Supabase SQL Editor -> Run. Idempotente.
-- =====================================================================

alter table public.matches
  add column if not exists pen_winner text;
