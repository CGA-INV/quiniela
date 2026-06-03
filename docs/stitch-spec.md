# Quiniela Mundial 2026 — Spec funcional para Stitch

> Inventario completo de pantallas, componentes y funcionalidad de la app.
> Sirve como brief para regenerar la UI en Google Stitch (proyecto `2000073665622152600`)
> manteniendo TODA la funcionalidad existente. Stack: Next.js + Tailwind 4 + Supabase.

## Sistema visual actual (dark theme)

- **Framework:** Tailwind CSS 4. **Fonts:** Geist Sans (texto), Geist Mono (scores/códigos/timestamps).
- **Paleta:**
  - Fondo `#020617` (slate-950), texto `#f1f5f9` (slate-100)
  - Superficies: `#0f172a` (cards), `#1e293b` (elevado), `rgb(15 23 42 / .6)` (elev translúcido)
  - Primario/brand: `#10b981` (emerald) — CTAs, estados activos; glow `rgb(16 185 129 / .15)`
  - Live: `#f59e0b` (amber). Error: `#ef4444` (red).
  - Radios: cards `1rem`, bento `1.25rem`.
- **Animaciones:** punto pulsante "EN VIVO" (1.6s), chevron rota 200ms en `details[open]`, `active:scale-95` en botones.

## Sistema de puntos (visible en UI)

- **Exacto** (marcador exacto): 5 pts
- **Ganador** (acierta resultado): 3 pts
- **Empate** (acierta empate): 2 pts
- **Fallo:** 0 pts
- Pie de ranking: "5 pts marcador exacto · 3 pts ganador · 2 pts empate"

## Roles

| Rol | Acceso | Capacidades |
|-----|--------|-------------|
| Anónimo | `/`, `/login`, `/signup` | Landing + auth |
| Miembro | `/pools`, `/pools/[id]`, `/pools/[id]/matches/[matchId]` | Predecir, ver standings/ranking, subir comprobantes de pago |
| Admin de sala | + `/admin`, `/admin/matches` | Crear salas, gestionar miembros, generar invitaciones, cerrar partidos (no reabrir/modificar) |
| Super admin | + `/admin/activity` | Todo + reabrir/modificar/eliminar partidos, gestionar todas las salas, bitácora, eliminar usuarios |

---

## Pantallas

### `/` Landing (público)
- Hero centrado, full-height, gradiente slate-950→900.
- H1 "Quiniela Mundial 2026"; párrafo "Predice los marcadores, compite con tus amigos y gana puntos."
- CTAs: "Crear cuenta" (emerald), "Iniciar sesión" (bordeado).

### `/login` (público)
- Card centrada (max-w-sm). Inputs: email ("tu@correo.com"), password ("Contraseña", min 6).
- Botón "Entrar". Error en rojo (`?error=`). Link a signup: "¿No tienes cuenta? Regístrate con tu código".

### `/signup` (público)
- Card centrada. Inputs: nombre (2-40), email, password (min 6), **código de invitación** (uppercase, max 20).
- Botón "Crear cuenta". Pre-llena código con `?code=`. Link a login.

### `/pools` Mis salas (auth)
- Header H1 "Mis salas" + botones "Panel admin" (si admin) y "Salir".
- Alertas error/ok por query param.
- Lista de salas (cards clicables): nombre, "Quiniela activa", flecha →. Hover emerald.
- Vacío: "Aún no perteneces a ninguna sala. Espera a que el administrador te envíe una invitación por correo."

### `/pools/[id]` Detalle de sala — pantalla principal del juego (miembro)
Header sticky: back ←, nombre sala, badge "Sandbox" (amber si `is_sandbox`), código invitación (mono, oculto en móvil), nº miembros, link admin (si procede), logout.

Layout: desktop 2 columnas (main + sidebar 320px); móvil full-width con **bottom nav 4 tabs**.

**Bottom nav móvil (PoolMobileNav):** Inicio (home), Partidos (ball), Ranking (trophy), Pagos (cash). Activo = emerald + glow + barra. Badge amber en Pagos si hay pendientes. Safe-area inset.

**Tab Inicio:**
- 4 KPI cards (4 col lg / 2 col sm):
  1. Tu posición — `#${rank}` o "—", sub `de ${totalMembers}` (emerald)
  2. Tus puntos — total grande, sub `${exactos} exactos · ${ganador} ganador · ${empate} empate` o "sin puntos aún" (emerald)
  3. Próximo partido — "Home vs Away", sub `cierra ${timeUntil}` (amber)
  4. Por predecir — count, sub "no te quedes" / "todo al día"
- **Posiciones por grupo** (`<details>` abierto): grid responsive de GroupCards.
  - GroupCard: summary "Grupo {label}" + líder (flag+team+pts) + badge "EN VIVO" (pulsante) si live. Tabla: `# | Equipo | J | G | E | P | ± | Pts`. Top 2 en emerald, ± verde/rojo/slate.

**Tab Partidos:**
- Filtros: Todos / Abiertos / En juego / Finalizados (con count, activo emerald).
- Alerta bulk "${n} partido(s) abierto(s)" + botón "Guardar todo" (teal), arriba y abajo del form.
- Partidos agrupados por fase (Grupos, Octavos, …). Grid md:2col (live ocupa 2).
- **MatchCard:**
  - Fila info: badge nº partido (#N mono), grupo, fecha, countdown cierre (emerald / amber <1h), badge estado ("abierto"/"EN VIVO"/"cerrado"), marcador real (mono emerald).
  - Abierto: inputs `home_${id}` / `away_${id}` (number 0-20, w-12, mono, focus emerald).
  - Cerrado/live: marcador read-only o "–".
  - Equipos: local (nombre+flag derecha) vs visitante (flag+nombre izq). Flags 20/24px.
  - Venue: "📍 {venue} · {city}".
  - Pie si cerrado: "Ver predicciones de todos →" / "No participaste" + puntos (emerald si >0).

**Tab Ranking (sidebar sticky en lg):**
- Card `<details>` "Ranking" + "Tú: **${total}**" + "· #${rank}".
- Lista `ol` por puntos desc: posición (medallas 🥇🥈🥉), nombre + "(tú)" emerald, total bold, sub "${exactos} exacto(s) · ${ganador} ganador · ${empate} empate".
- Pie: "5 pts marcador exacto · 3 pts ganador · 2 pts empate".

**Tab Pagos (solo si hay `winner`, fin de fase de grupos):**
- Header trofeo "Fase de grupos terminada", "Ganador: **${name}** · ${pts} pts · ${exactos} exactos".
- **WinnerView** (si soy ganador): "Cobros pendientes", "${validados}/${n} validados". Por miembro: nombre + estado ("Sin subir comprobante"/"Esperando tu validación"/"Validado · fecha"), thumbnail comprobante (clic abre full), botón "Validar" / link "revertir".
- **PayerView** (si no soy ganador): "Tu pago a ${winner}", estado ("✓ Validado"/"En revisión"/"Sin subir"), thumbnail, file input + "Subir/Reemplazar comprobante". Aviso "JPG/PNG/WebP, máx 5MB". Mensaje éxito si validado.

### `/pools/[id]/matches/[matchId]` Detalle de partido (miembro, tras cierre)
- Header: back "← {pool}", meta (nº, fase, grupo, fecha).
- Showcase: card grande, local (nombre+flag derecha, 2xl), **marcador centro** (mono 4xl: `H–A` emerald si finished, o badge "esperando resultado" amber), visitante (flag+nombre izq).
- Venue "📍 {venue} · {city}".
- Stats (si finished): 5 cards — Exactos (emerald), Ganador (emerald-300), Empate (blue), Fallaron (slate), No participó (slate).
- **Tabla Predicciones** (predijeron primero, luego por pts desc): nombre (bold si yo) + "(tú)", predicción `H–A` mono o "no participó" itálica, puntos. Fila coloreada: exacto emerald/10, ganador emerald/20, empate blue/20, fallo slate, sin pred slate/50.

### `/admin` Gestión de salas (admin de sala / super)
AdminNav sticky: back, título, badge rol ("Super admin"/"Admin de sala"), logout. Tabs: Salas (activo), Partidos, Usuarios (super), Bitácora (super).
- **Crear sala:** input "Nombre (ej: La Oficina, Pruebas)" (max 60), botón "Crear sala", checkbox "Sala de pruebas" (amber, calendario propio).
- **Lista de salas** (grid lg:2col). PoolCard:
  - Nombre + badge código invitación (mono).
  - Form generar invitación: input "Para quién (nota interna, opcional)" (max 80) + "Generar código".
  - Form agregar usuario existente (dropdown + "Agregar") si hay candidatos.
  - Miembros (${n}): nombre + badges "⚡ super"/"admin sala" + toggle "hacer/quitar admin" (super).
- **Invitaciones recientes** (grid): código mono, sala, email, estado ("disponible" emerald / "expirado" red / "usado" slate), "revocar" (red) si no usada.
- **Usuarios registrados** (super, colapsable): nombre + "(tú)", "eliminar" → confirm "Sí, eliminar todo" (destructivo).

### `/admin/matches` Gestión de partidos (admin / super)
AdminNav, breadcrumb Admin > Partidos. Banner permisos si admin de sala.
- **Agregar partido** (super, grid md:2col): stage (select: group/round_of_32/round_of_16/quarter/semi/third_place/final), group_label (max 2), match_no (1-999), home_team, away_team, venue, city, kickoff (datetime-local), scope (select: "📡 Global Mundial" / "🧪 Sandbox: {name}"). Botón "Guardar partido".
- **Importar bulk JSON** (super, colapsable): textarea + ejemplo. Campos req: stage, home_team, away_team, kickoff_at (ISO-8601 con tz). Botón "Importar".
- **Calendario (${n}):** filtros estado (Por jugar/En vivo/Finalizados/Todos) + scope (Global/Sandbox por sala).
  - Item: badge scope ("📡 Global" blue / "🧪 {pool}" amber), nº, fase, grupo, fecha, time-until, equipos+flags, venue, "${n} miembro(s) predijo".
  - Acciones finished: marcador (2xl emerald) + "Reabrir partido" (amber super) / "cerrado".
  - Acciones no-finished: inputs home/away (w-16) + "Actualizar" (live sin cerrar) + "Cerrar partido" (calcula puntos). "eliminar" (super).

### `/admin/activity` Bitácora (super)
AdminNav, breadcrumb Admin > Bitácora.
- Filtros: Todo, Códigos generados, Marcadores en vivo, Partidos cerrados, Reaperturas, Promociones, Códigos revocados, Salas creadas, Partidos eliminados, Usuarios eliminados.
- Entradas: icono color-coded (h-7) + descripción (actor bold + acción + metadata `code`/`H–A`) + timestamp relativo ("hace 5m") / absoluto ("12 Jun 14:30").
  - Ej: "**User** cerró **Home vs Away** `2–1`".

---

## Componentes globales
- **Header sticky** (auth): slate-950/70 backdrop-blur, border slate-800/60. Izq: back + título + badges. Der: admin link + logout.
- **PoolMobileNav** (móvil): 4 tabs con iconos, activo emerald+glow, badge pagos.
- **AdminNav:** header sticky + tabs (Salas/Partidos siempre; Usuarios/Bitácora super).

## Modelos de datos (campos mostrados)
- **pools:** id, name, invite_code, owner_id, is_sandbox, created_at
- **matches:** id, stage, group_label, home_team, away_team, kickoff_at, home_score, away_score, finished, match_no, venue, city, pool_id (null=global)
- **predictions:** match_id, user_id, pool_id, pred_home, pred_away, points
- **payments:** id, payer_id, payee_id, pool_id, proof_url, uploaded_at, validated_at
- **invitations:** id, pool_id, code, email, used_at, expires_at, created_at
- **profiles:** id, display_name
- **pool_members:** user_id, pool_id, is_admin
- **activity_log:** id, actor_id, action, meta(JSON), created_at

## Patrones de interacción
- Server actions de Next.js; feedback por query params (`?ok=`, `?error=`).
- Upload comprobante imagen (JPG/PNG/WebP, máx 5MB).
- Ranking server-side vía RPC `pool_ranking`; puntos calculados al cerrar partido.
- Responsive: móvil bottom-nav/stack, tablet 2col, desktop 3-4col + sidebars sticky.
