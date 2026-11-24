import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import type { Db, Team, TeamMember, Variety } from '../types';
import { defense, favs, loadSpecies, loadVgDex, pidInfo, store, teams } from '../data';
import { buildMember, generateTeam, loadPool, suggestSwap, type GenOptions, type Pool, type Purpose, type Suggestion } from '../generator';
import { nav } from '../nav';
import { BackButton, GENS, ItemIcon, MiniMon, MoveClass, Picker, STAT_SHORT, Spinner, Sprite, TypeBadge, reducedMotion, type Opt } from './bits';
import { glyphPaths } from './glyphs';
import { copyText, decodeTeam, fromShowdown, loadEn, teamLink, toShowdown } from '../share';

const fold = (x: string) => x.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const gameName = (db: Db, vg: number) => db.meta.versionGroups.find((g) => g.id === vg)?.name ?? '';

function BallsIcon({ size = 46 }: { size?: number }) {
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} aria-hidden>
      {[[14, 30], [34, 30], [24, 13]].map(([cx, cy], i) => (
        <g key={i}>
          <circle cx={cx} cy={cy} r="10" fill="#f6f5f2" stroke="#0e1317" strokeWidth="2.4" />
          <path d={`M${cx - 10} ${cy}a10 10 0 0 1 20 0Z`} fill="currentColor" stroke="#0e1317" strokeWidth="2.4" />
          <circle cx={cx} cy={cy} r="3.2" fill="#f6f5f2" stroke="#0e1317" strokeWidth="2.2" />
        </g>
      ))}
    </svg>
  );
}

/* ---------- Lista de equipos ---------- */
export function TeamsPage({ db }: { db: Db }) {
  const list = teams.list();
  const create = () => { const t = teams.create(); nav.push(`equipo-${t.id}`); };
  const [importing, setImporting] = useState(false);
  const [text, setText] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const doImport = async () => {
    setBusy(true); setMsg('');
    try {
      const fromLink = /importar-[A-Za-z0-9_-]+/.test(text) ? await decodeTeam(db, text) : null;
      if (fromLink) { const t = teams.add(fromLink); nav.push(`equipo-${t.id}`); return; }
      const res = await fromShowdown(db, await loadEn(), text);
      if (!res) { setMsg('No se reconoció ningún Pokémon. Pegue el texto de Showdown o un enlace de JuasDex.'); return; }
      const t = teams.add(res.team);
      if (res.missing.length) store.set('importNote', `No se reconoció: ${res.missing.slice(0, 6).join(', ')}${res.missing.length > 6 ? '…' : ''}`);
      nav.push(`equipo-${t.id}`);
    } catch {
      setMsg('Diay, algo falló al leerlo. ¿Tiene conexión?');
    } finally { setBusy(false); }
  };
  return (
    <div className="detail teamspage">
      <header className="dex-top dex-top--detail">
        <div className="dex-top__inner nav-row"><BackButton onClick={() => nav.back()} /></div>
      </header>
      <section className="hero">
        <div className="screen">
          <div className="emblem emblem--teams"><span className="emblem__icon"><BallsIcon size={56} /></span></div>
          <div className="hero__info">
            <span className="hero__num">Constructor</span>
            <h2 className="hero__name">Equipos</h2>
            <span className="hero__genus">Arme equipos de 6 y vea sus debilidades y cobertura.</span>
          </div>
        </div>
      </section>
      <main className="body">
        <div className="stack-gap">
          <button className="gen-cta" onClick={() => nav.push('generar')}>
            <span className="gen-cta__icon" aria-hidden><svg viewBox="0 0 24 24" width="26" height="26"><path d="M12 3l2.2 5.6L20 9.3l-4.5 3.8 1.5 5.9L12 15.8 7 19l1.5-5.9L4 9.3l5.8-.7Z" fill="currentColor" /></svg></span>
            <span className="gen-cta__text"><strong>Generar equipo</strong><small>Conteste 3 preguntas y JuasDex lo arma por usted.</small></span>
            <svg className="gen-cta__go" viewBox="0 0 24 24" width="20" height="20" aria-hidden><path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
          <div className="btn-row">
            <button className="big-btn" onClick={create}>
              <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" /></svg>
              Nuevo equipo
            </button>
            <button className={`big-btn big-btn--alt${importing ? ' is-on' : ''}`} onClick={() => setImporting((x) => !x)}>
              <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden><path d="M12 4v11m-5-5 5 5 5-5M5 20h14" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
              Importar
            </button>
          </div>
          {importing && (
            <section className="panel import">
              <h3>Importar un equipo</h3>
              <p className="muted small">Pegue un enlace de JuasDex o el texto de un equipo de Pokémon Showdown.</p>
              <textarea className="text-area" value={text} onChange={(e) => setText(e.target.value)} rows={7} placeholder={'Venusaur @ Choice Specs\nAbility: Chlorophyll\nModest Nature\n- Sludge Bomb\n- Giga Drain'} />
              {msg && <p className="move-slot__warn">{msg}</p>}
              <div className="lf__foot">
                <button className="lf__link" onClick={() => { setImporting(false); setText(''); setMsg(''); }}>Cancelar</button>
                <button className="lf__done" disabled={!text.trim() || busy} onClick={doImport}>{busy ? 'Leyendo…' : 'Importar'}</button>
              </div>
            </section>
          )}
          {list.length === 0 && <div className="empty">Todavía no tiene equipos. ¡Arme el primero!</div>}
          {list.map((t) => (
            <button key={t.id} className="team-card" onClick={() => nav.push(`equipo-${t.id}`)}>
              <span className="team-card__top">
                <strong>{t.name}</strong>
                <span className="team-card__game">{t.randomizer ? <span className="rando-tag">Randomizer</span> : null}{gameName(db, t.vg)}</span>
              </span>
              <span className="team-card__mons">
                {t.members.map((m, i) => (
                  <span key={i} className="team-card__slot">{m ? <Sprite db={db} pid={m.pid} size={52} fallback={m.species} /> : null}</span>
                ))}
              </span>
            </button>
          ))}
        </div>
      </main>
    </div>
  );
}

/* ---------- Un equipo ---------- */
type View = { kind: 'team' } | { kind: 'pick'; slot: number } | { kind: 'edit'; slot: number };

export function TeamPage({ db, id }: { db: Db; id: number }) {
  const [team, setTeamState] = useState<Team | null>(() => teams.get(id));
  const [vgDex, setVgDex] = useState<Record<string, number[]> | null>(null);
  const [view, setView] = useState<View>({ kind: 'team' });
  const [confirmDel, setConfirmDel] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [shareMsg, setShareMsg] = useState('');
  const [sdText, setSdText] = useState('');
  const [note] = useState(() => { const n = store.get('importNote', ''); store.set('importNote', ''); return n; });

  useEffect(() => { loadVgDex().then(setVgDex).catch(() => undefined); }, []);
  useEffect(() => {
    if (!sharing || !team) return;
    loadEn().then((e) => setSdText(toShowdown(db, e, team))).catch(() => setSdText(''));
  }, [sharing, team, db]);
  useEffect(() => { document.querySelector('.sheet')?.scrollTo({ top: 0 }); }, [view]);

  if (!team) {
    return (
      <div className="detail teampage">
        <header className="dex-top dex-top--detail"><div className="dex-top__inner nav-row"><BackButton onClick={() => nav.back()} /></div></header>
        <main className="body"><div className="empty">Este equipo ya no existe.</div></main>
      </div>
    );
  }
  const setTeam = (t: Team) => { setTeamState(t); teams.save(t); };
  const setMember = (slot: number, m: TeamMember | null) => {
    const members = [...team.members];
    members[slot] = m;
    setTeam({ ...team, members });
  };

  const games = db.meta.versionGroups.filter((g) => (vgDex ? vgDex[g.id]?.length : true));
  const gameOpts: Opt[] = [...games].reverse().map((g) => ({ value: g.id, label: g.name, group: `Generación ${GENS[g.gen - 1]}` }));

  const fullPool = [...db.index.map(([sid]) => sid), ...Object.keys(db.forms).map(Number)].sort((a, b) => (db.forms[a]?.[0] ?? a) - (db.forms[b]?.[0] ?? b) || a - b);
  if (view.kind === 'pick') {
    return (
      <PickMon
        db={db}
        team={team}
        pool={team.randomizer ? fullPool : vgDex?.[team.vg] ?? null}
        onCancel={() => setView({ kind: 'team' })}
        onPick={async (pid) => {
          const species = db.forms[pid]?.[0] ?? pid;
          const sp = await loadSpecies(species, db.meta.chunk);
          const v = sp.varieties.find((x) => x.pid === pid) ?? sp.varieties[0];
          setMember(view.slot, { pid, species, types: v.types, origTypes: v.types, abil: v.abil[0]?.[0] ?? 0, nature: 0, item: 0, moves: [] });
          setView({ kind: 'edit', slot: view.slot });
        }}
      />
    );
  }
  if (view.kind === 'edit' && team.members[view.slot]) {
    return (
      <EditMember
        db={db}
        team={team}
        member={team.members[view.slot]!}
        onChange={(m) => setMember(view.slot, m)}
        onRemove={() => { setMember(view.slot, null); setView({ kind: 'team' }); }}
        onSwap={() => setView({ kind: 'pick', slot: view.slot })}
        onDone={() => setView({ kind: 'team' })}
      />
    );
  }

  const members = team.members.filter(Boolean) as TeamMember[];
  return (
    <div className="detail teampage">
      <header className="dex-top dex-top--detail">
        <div className="dex-top__inner nav-row"><BackButton onClick={() => nav.back()} /></div>
      </header>
      <section className="hero">
        <div className="screen">
          <div className="emblem emblem--teams"><span className="emblem__icon"><BallsIcon size={56} /></span></div>
          <div className="hero__info">
            <span className="hero__num">Equipo · {members.length} de 6</span>
            <input
              className="team-name"
              value={team.name}
              aria-label="Nombre del equipo"
              maxLength={30}
              onChange={(e) => setTeam({ ...team, name: e.target.value })}
              onBlur={(e) => { if (!e.target.value.trim()) setTeam({ ...team, name: 'Equipo sin nombre' }); }}
            />
          </div>
        </div>
      </section>

      <main className="body">
        <div className="stack-gap">
          <div className="field">
            <span>Juego (decide qué movimientos se pueden elegir)</span>
            <Picker title="Elija un juego" value={team.vg} options={gameOpts} onChange={(vg) => setTeam({ ...team, vg })} />
          </div>

          <button
            className={`rando${team.randomizer ? ' is-on' : ''}`}
            role="switch"
            aria-checked={Boolean(team.randomizer)}
            onClick={() => {
              const on = !team.randomizer;
              // Al apagarlo, cada Pokémon vuelve a sus tipos originales
              const members = on ? team.members : team.members.map((m) => (m ? { ...m, types: m.origTypes ?? m.types } : m));
              setTeam({ ...team, randomizer: on, members });
            }}
          >
            <span className="rando__text">
              <strong>Modo Randomizer</strong>
              <small>{team.randomizer ? 'Cualquier Pokémon, tipo, habilidad y movimiento, sin importar el juego.' : 'Para partidas randomizer: deja cambiar tipos, habilidades y movimientos libremente.'}</small>
            </span>
            <span className="rando__switch" aria-hidden><i /></span>
          </button>

          <div className="slots">
            {team.members.map((m, i) => m ? (
              <button key={i} className="slot" style={{ '--i': i, ...slotColors(db, m.types) } as CSSProperties} onClick={() => setView({ kind: 'edit', slot: i })}>
                <MemberCard db={db} m={m} />
              </button>
            ) : (
              <button key={i} className="slot slot--empty" style={{ '--i': i } as CSSProperties} onClick={() => setView({ kind: 'pick', slot: i })}>
                <svg viewBox="0 0 24 24" width="28" height="28" aria-hidden><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" /></svg>
                <span>Agregar Pokémon</span>
              </button>
            ))}
          </div>

          {note && <p className="move-slot__warn">{note}. Puede elegirlos a mano.</p>}

          {members.length > 0 && (
            <button className={`share-btn${sharing ? ' is-on' : ''}`} onClick={() => { setSharing((x) => !x); setShareMsg(''); }}>
              <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden><circle cx="18" cy="5" r="2.6" fill="currentColor" /><circle cx="6" cy="12" r="2.6" fill="currentColor" /><circle cx="18" cy="19" r="2.6" fill="currentColor" /><path d="M8.3 10.8l7.4-4.3M8.3 13.2l7.4 4.3" stroke="currentColor" strokeWidth="2" /></svg>
              Compartir equipo
            </button>
          )}
          {sharing && (
            <section className="panel share">
              <div className="share__opts">
                <button className="share__opt" onClick={async () => {
                  const url = teamLink(team);
                  const nav2 = navigator as Navigator & { share?: (d: ShareData) => Promise<void> };
                  if (nav2.share) {
                    try { await nav2.share({ title: `JuasDex · ${team.name}`, text: `Mi equipo "${team.name}" en JuasDex:`, url }); setShareMsg(''); return; } catch { /* cancelado o no disponible */ }
                  }
                  setShareMsg((await copyText(url)) ? 'Enlace copiado. Péguelo en WhatsApp o donde quiera.' : 'No se pudo copiar el enlace.');
                }}>
                  <strong>Enviar enlace</strong>
                  <small>Para otra persona con JuasDex: lo abre y lo guarda con un toque.</small>
                </button>
                <button className="share__opt" disabled={!sdText} onClick={async () => setShareMsg((await copyText(sdText)) ? 'Texto copiado en formato Showdown.' : 'No se pudo copiar. Puede seleccionarlo abajo.')}>
                  <strong>Copiar para Showdown</strong>
                  <small>Texto en inglés que entienden Pokémon Showdown y otras herramientas.</small>
                </button>
              </div>
              {shareMsg && <p className="share__msg">{shareMsg}</p>}
              {sdText && <textarea className="text-area text-area--mono" readOnly value={sdText} rows={Math.min(14, sdText.split('\n').length + 1)} onFocus={(e) => e.currentTarget.select()} />}
              {team.randomizer && <p className="note">Los tipos del Modo Randomizer viajan en el enlace, pero no en el texto de Showdown.</p>}
            </section>
          )}

          {members.length > 0 && <TeamAnalysis db={db} members={members} extra={<SwapSuggestion db={db} team={team} setTeam={setTeam} />} />}

          <div className="danger-zone">
            {confirmDel ? (
              <>
                <span>¿Seguro? Esto no se puede deshacer.</span>
                <button className="lf__link" onClick={() => setConfirmDel(false)}>Cancelar</button>
                <button className="danger-btn" onClick={() => { teams.remove(team.id); nav.back(); }}>Sí, borrar</button>
              </>
            ) : (
              <button className="lf__link" onClick={() => setConfirmDel(true)}>Borrar equipo</button>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

/** Colores de la tarjeta: los dos tipos en diagonal (si tiene uno solo, el mismo color más oscuro) */
const slotColors = (db: Db, types: number[]) => {
  const a = db.meta.types[types[0]]?.[1] ?? 'normal';
  const b = types[1] ? db.meta.types[types[1]]?.[1] : null;
  return { '--t1': `var(--c-${a})`, '--t2': b ? `var(--c-${b})` : `color-mix(in srgb, var(--c-${a}) 68%, #000)` } as CSSProperties;
};

function MemberCard({ db, m }: { db: Db; m: TeamMember }) {
  const info = pidInfo(db, m.pid);
  const item = m.item ? db.items[m.item] : null;
  const nature = m.nature ? db.natures[m.nature] : null;
  const g1 = db.meta.types[m.types[0]]?.[1] ?? 'normal';
  const g2 = m.types[1] ? db.meta.types[m.types[1]]?.[1] ?? g1 : g1;
  return (
    <>
      <svg className="slot__mark slot__mark--1" viewBox="0 0 24 24" aria-hidden style={{ '--glyph-cut': 'transparent' } as CSSProperties}>{glyphPaths(g1)}</svg>
      <svg className="slot__mark slot__mark--2" viewBox="0 0 24 24" aria-hidden style={{ '--glyph-cut': 'transparent' } as CSSProperties}>{glyphPaths(g2)}</svg>
      <span className="slot__head">
        <span className="slot__mon"><Sprite db={db} pid={m.pid} size={64} fallback={m.species} /></span>
        <span className="slot__id">
          <strong>{info.name}</strong>
          {info.form && <small>{info.form}</small>}
          <span className="slot__types">{m.types.map((t) => <span key={t} className="slot__type">{db.meta.types[t]?.[0]}</span>)}</span>
        </span>
        {item && <span className="slot__item" title={item[0]}><ItemIcon db={db} ident={item[4]} size={30} /></span>}
      </span>
      <span className="slot__meta">
        {db.abilities[m.abil]?.[0] ?? 'Sin habilidad'}{nature ? ` · ${nature[0]}` : ''}
      </span>
      <span className="slot__moves">
        {[0, 1, 2, 3].map((k) => {
          const mv = db.moves[m.moves[k]];
          return mv
            ? <span key={k} className={`slot__move t-${db.meta.types[mv[1]]?.[1]}`}>{mv[0]}</span>
            : <span key={k} className="slot__move slot__move--empty">—</span>;
        })}
      </span>
    </>
  );
}

/* ---------- Elegir Pokémon ---------- */
function PickMon({ db, team, pool, onPick, onCancel }: { db: Db; team: Team; pool: number[] | null; onPick: (pid: number) => void; onCancel: () => void }) {
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const nq = fold(q.trim());
  const list = useMemo(() => (pool ?? []).filter((pid) => {
    if (!nq) return true;
    const i = pidInfo(db, pid);
    return fold(`${i.name} ${i.form ?? ''}`).includes(nq) || String(i.species) === nq;
  }), [pool, nq, db]);
  return (
    <div className="detail teampage">
      <header className="dex-top dex-top--detail">
        <div className="dex-top__inner nav-row">
          <button className="nav-btn" onClick={onCancel} aria-label="Volver al equipo">
            <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
            <span>Equipo</span>
          </button>
        </div>
      </header>
      <main className="body">
        <div className="stack-gap">
          <div className="pick-head">
            <h3>Elija un Pokémon</h3>
            <span className="muted small">{team.randomizer ? 'Modo Randomizer: todos los Pokémon y formas' : `Disponibles en ${gameName(db, team.vg)}`}</span>
          </div>
          <input className="text-input" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nombre o número" aria-label="Buscar Pokémon" autoFocus />
          {!pool && <div className="empty"><Spinner /> Cargando…</div>}
          {pool && list.length === 0 && <div className="empty">Diay, no hay ninguno así en este juego.</div>}
          <div className={`minigrid${busy ? ' is-busy' : ''}`}>
            {list.map((pid) => (
              <MiniMon key={pid} db={db} pid={pid} onClick={() => { if (busy) return; setBusy(true); Promise.resolve(onPick(pid)).finally(() => setBusy(false)); }} />
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}

/* ---------- Editar un miembro ---------- */
function EditMember({ db, team, member, onChange, onRemove, onSwap, onDone }: {
  db: Db; team: Team; member: TeamMember; onChange: (m: TeamMember) => void; onRemove: () => void; onSwap: () => void; onDone: () => void;
}) {
  const [v, setV] = useState<Variety | null>(null);
  useEffect(() => {
    let alive = true;
    loadSpecies(member.species, db.meta.chunk).then((sp) => {
      if (!alive) return;
      setV(sp.varieties.find((x) => x.pid === member.pid) ?? sp.varieties[0]);
    });
    return () => { alive = false; };
  }, [db, member.pid, member.species]);

  const info = pidInfo(db, member.pid);
  const rando = Boolean(team.randomizer);
  const learnable = useMemo(() => {
    if (rando) return Object.keys(db.moves).map(Number).sort((a, b) => db.moves[a][0].localeCompare(db.moves[b][0], 'es'));
    if (!v) return [] as number[];
    const ids = new Set((v.moves[team.vg] ?? []).map((x) => x[0]));
    return [...ids].filter((mid) => db.moves[mid]).sort((a, b) => db.moves[a][0].localeCompare(db.moves[b][0], 'es'));
  }, [v, team.vg, db, rando]);
  const learnSet = new Set(learnable);
  const ownAbil = new Set(v?.abil.map(([a]) => a) ?? []);
  const abilOpts: Opt[] = [
    ...(v?.abil ?? []).map(([aid, hidden]) => ({ value: aid, label: db.abilities[aid]?.[0] ?? '¿?', hint: hidden ? 'Oculta' : undefined, group: 'De este Pokémon' })),
    ...Object.entries(db.abilities).filter(([aid, a]) => !ownAbil.has(+aid) && a[2] > 0).sort((a, b) => a[1][0].localeCompare(b[1][0], 'es'))
      .map(([aid, a]) => ({ value: +aid, label: a[0], group: 'Todas las habilidades' })),
  ];
  const toggleType = (t: number) => {
    const has = member.types.includes(t);
    if (has && member.types.length === 1) return; // siempre al menos un tipo
    const next = has ? member.types.filter((x) => x !== t) : [...member.types, t].slice(-2);
    onChange({ ...member, origTypes: member.origTypes ?? member.types, types: next });
  };

  const natureOpts: Opt[] = [
    { value: 0, label: 'Sin naturaleza' },
    ...Object.entries(db.natures).sort((a, b) => a[1][0].localeCompare(b[1][0], 'es')).map(([nid, n]) => ({
      value: +nid, label: n[0], hint: n[1] === n[2] ? 'Neutral' : `+${STAT_SHORT[n[1]]}  −${STAT_SHORT[n[2]]}`,
    })),
  ];
  const itemOpts: Opt[] = [
    { value: 0, label: 'Sin objeto' },
    ...Object.entries(db.items).filter(([, it]) => it[2] === 'equip' || it[2] === 'baya' || it[2] === 'evo')
      .sort((a, b) => a[1][1].localeCompare(b[1][1], 'es') || a[1][0].localeCompare(b[1][0], 'es'))
      .map(([iid, it]) => ({ value: +iid, label: it[0], group: it[1], icon: <ItemIcon db={db} ident={it[4]} size={28} /> })),
  ];
  const moveOpts = (slot: number): Opt[] => [
    { value: 0, label: 'Ninguno' },
    ...learnable.filter((mid) => mid === member.moves[slot] || !member.moves.includes(mid)).map((mid) => {
      const m = db.moves[mid];
      return {
        value: mid, label: m[0],
        hint: `${db.meta.types[m[1]]?.[0]} · ${['', 'Estado', 'Físico', 'Especial'][m[2]]}${m[3] ? ` · Pot. ${m[3]}` : ''}`,
        icon: <span className={`opt__dot t-${db.meta.types[m[1]]?.[1]}`} />,
      };
    }),
  ];
  const setMove = (slot: number, mid: number) => {
    const moves = [...member.moves];
    while (moves.length < 4) moves.push(0);
    moves[slot] = mid;
    onChange({ ...member, moves: moves.filter((x, i) => x || i < 4).slice(0, 4) });
  };
  const nature = member.nature ? db.natures[member.nature] : null;

  return (
    <div className={`detail teampage t-bg-${db.meta.types[member.types[0]]?.[1] ?? 'normal'}`}>
      <header className="dex-top dex-top--detail">
        <div className="dex-top__inner nav-row">
          <button className="nav-btn" onClick={onDone} aria-label="Volver al equipo">
            <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
            <span>{team.name}</span>
          </button>
        </div>
      </header>
      <section className="hero">
        <div className="screen">
          <div className="screen__glass"><span className="hero__sprite"><span className="float"><Sprite db={db} pid={member.pid} size={120} fallback={member.species} /></span></span></div>
          <div className="hero__info">
            <span className="hero__num">#{String(member.species).padStart(4, '0')}</span>
            <h2 className="hero__name">{info.name}</h2>
            {info.form && <span className="hero__form">{info.form}</span>}
            <div className="hero__types">{member.types.map((t, i) => <TypeBadge key={t} db={db} id={t} style={{ '--i': i } as CSSProperties} />)}</div>
            {rando && <span className="rando-tag rando-tag--hero">Modo Randomizer</span>}
            <div className="member-actions">
              <button className="chip" onClick={onSwap}>Cambiar</button>
              <button className="chip" onClick={onRemove}>Quitar</button>
            </div>
          </div>
        </div>
      </section>

      <main className="body">
        {!v ? <div className="empty"><Spinner /> Cargando…</div> : (
          <div className="stack-gap">
            {rando && (
              <section className="panel">
                <div className="panel__head">
                  <h3>Tipos</h3>
                  {member.origTypes && member.origTypes.join() !== member.types.join() && (
                    <button className="lf__link" onClick={() => onChange({ ...member, types: member.origTypes! })}>Volver a los originales</button>
                  )}
                </div>
                <div className="typegrid typegrid--plain">
                  {Object.entries(db.meta.types).map(([tid, [name, ident]]) => (
                    <button key={tid} className={`tchip t-${ident}${member.types.includes(+tid) ? ' is-on' : ''}`} aria-pressed={member.types.includes(+tid)} onClick={() => toggleType(+tid)}>
                      <svg className="tchip__glyph" viewBox="0 0 24 24" width="16" height="16" aria-hidden style={{ '--glyph-cut': `var(--c-${ident})` } as CSSProperties}>{glyphPaths(ident)}</svg>
                      {name}
                    </button>
                  ))}
                </div>
                <p className="note">Hasta 2 tipos. Las debilidades del equipo usan estos tipos.</p>
              </section>
            )}

            <section className="panel">
              <h3>Habilidad</h3>
              {rando ? (
                <Picker title="Habilidad" value={member.abil} options={abilOpts} searchable onChange={(a) => onChange({ ...member, abil: a })} />
              ) : (
                <div className="abil-pick">
                  {v.abil.map(([aid, hidden]) => (
                    <button key={aid} className={`abil-chip${member.abil === aid ? ' is-on' : ''}`} aria-pressed={member.abil === aid} onClick={() => onChange({ ...member, abil: aid })}>
                      <strong>{db.abilities[aid]?.[0]}</strong>
                      {hidden ? <span className="hidden-tag">Oculta</span> : null}
                    </button>
                  ))}
                </div>
              )}
              {!rando && member.abil && !ownAbil.has(member.abil) && <p className="move-slot__warn">{db.abilities[member.abil]?.[0]} no es una habilidad normal de este Pokémon.</p>}
              {db.abilities[member.abil]?.[1] && <p className="muted small abil-desc">{db.abilities[member.abil][1]}</p>}
            </section>

            <section className="panel">
              <h3>Naturaleza y objeto</h3>
              <div className="two-fields">
                <div className="field">
                  <span>Naturaleza</span>
                  <Picker title="Naturaleza" value={member.nature} options={natureOpts} searchable onChange={(n) => onChange({ ...member, nature: n })} />
                </div>
                <div className="field">
                  <span>Objeto</span>
                  <Picker
                    title="Objeto equipado"
                    value={member.item}
                    options={itemOpts}
                    searchable
                    onChange={(it) => onChange({ ...member, item: it })}
                    display={member.item && db.items[member.item] ? <span className="picker__item"><ItemIcon db={db} ident={db.items[member.item][4]} size={26} />{db.items[member.item][0]}</span> : undefined}
                  />
                </div>
              </div>
              <div className="mini-stats">
                {v.stats.map((s, i) => {
                  const st = i + 1;
                  const up = nature && nature[1] !== nature[2] && nature[1] === st;
                  const down = nature && nature[1] !== nature[2] && nature[2] === st;
                  return (
                    <span key={i} className={`mini-stat${up ? ' is-up' : ''}${down ? ' is-down' : ''}`}>
                      <small>{STAT_SHORT[st]}</small>
                      <strong>{s}{up ? ' ▲' : down ? ' ▼' : ''}</strong>
                    </span>
                  );
                })}
              </div>
            </section>

            <section className="panel">
              <div className="panel__head"><h3>Movimientos</h3><span className="muted small">{rando ? `Todos (${learnable.length})` : `${learnable.length} disponibles en ${gameName(db, team.vg)}`}</span></div>
              {learnable.length === 0 && <p className="muted">Este Pokémon no tiene movimientos registrados en este juego.</p>}
              <div className="move-slots">
                {[0, 1, 2, 3].map((k) => {
                  const mid = member.moves[k] ?? 0;
                  const m = mid ? db.moves[mid] : null;
                  const invalid = Boolean(mid && !learnSet.has(mid));
                  return (
                    <div key={k} className="move-slot">
                      <Picker
                        title={`Movimiento ${k + 1}`}
                        value={mid}
                        options={moveOpts(k)}
                        searchable
                        onChange={(x) => setMove(k, x)}
                        display={m ? (
                          <span className={`picker__move t-${db.meta.types[m[1]]?.[1]}`}>
                            <span className="opt__dot" />{m[0]}<MoveClass c={m[2]} />
                          </span>
                        ) : <span className="muted">Elegir movimiento {k + 1}</span>}
                      />
                      {invalid && <span className="move-slot__warn">No se aprende en este juego</span>}
                    </div>
                  );
                })}
              </div>
            </section>

            <button className="big-btn" onClick={onDone}>Listo</button>
          </div>
        )}
      </main>
    </div>
  );
}

/* ---------- Análisis ---------- */
const ALL_T = Array.from({ length: 18 }, (_, i) => i + 1);
const gradeOf = (bad: number, steps: number[]) => ['A', 'B', 'C', 'D', 'F'][steps.findIndex((x) => bad <= x) === -1 ? 4 : steps.findIndex((x) => bad <= x)];
const mxLabel = (x: number) => (x === 4 ? '×4' : x === 2 ? '×2' : '');

function analyze(db: Db, members: TeamMember[], pool: Pool | null) {
  const defs = members.map((m) => defense(db, m.types, m.abil));
  const name = (m: TeamMember) => pidInfo(db, m.pid).name;
  const rows = ALL_T.map((t) => {
    const mults = defs.map((d) => d[t] ?? 1);
    const weak = mults.filter((x) => x > 1).length;
    const resist = mults.filter((x) => x < 1).length;
    const quad = members.filter((_, i) => mults[i] >= 4).map(name);
    return { t, mults, weak, resist, quad, score: weak - resist + quad.length * 0.5 };
  }).sort((a, b) => b.score - a.score || b.weak - a.weak || a.t - b.t);
  const defBad = rows.reduce((s, r) => s + Math.max(0, r.weak - r.resist) + (r.weak >= 3 ? 1.5 : 0) + r.quad.length * 0.5, 0);
  const threats = rows.filter((r) => r.weak >= 2 && r.weak > r.resist).slice(0, 3);
  // Qué tipo (solo) aguantaría mejor esos golpes sin sumar problemas
  const fixes = threats.length ? ALL_T.map((d) => {
    let s = 0;
    for (const r of threats) { const m = db.meta.chart[r.t]?.[d] ?? 1; s += m < 1 ? (m === 0 ? 1.3 : 1) : m > 1 ? -1.2 : 0; }
    for (const r of rows) if (r.weak >= 2 && !threats.includes(r) && (db.meta.chart[r.t]?.[d] ?? 1) > 1) s -= 0.5;
    return { d, s };
  }).filter((x) => x.s >= 1).sort((a, b) => b.s - a.s).slice(0, 2).map((x) => x.d) : [];

  // Ataques
  const atk = members.flatMap((m) => m.moves.filter((mid) => db.moves[mid]).map((mid) => ({ m, mid, type: db.moves[mid][1], cls: db.moves[mid][2] })));
  const phys = atk.filter((x) => x.cls === 2).length;
  const spec = atk.filter((x) => x.cls === 3).length;
  const status = atk.filter((x) => x.cls === 1).length;
  const hitters = (d: number) => atk.filter((x) => x.cls !== 1).map((x) => ({ ...x, mult: db.meta.chart[x.type]?.[d] ?? 1 })).filter((x) => x.mult >= 2)
    .sort((a, b) => b.mult - a.mult);
  const covered = ALL_T.filter((d) => hitters(d).length > 0);
  const gaps = ALL_T.filter((d) => !covered.includes(d));
  const hasAttacks = phys + spec > 0;
  const moveFix = hasAttacks && gaps.length ? ALL_T.map((a) => ({ a, n: gaps.filter((g) => (db.meta.chart[a]?.[g] ?? 1) >= 2).length })).sort((x, y) => y.n - x.n)[0] : null;

  // Velocidad
  const speeds = pool ? members.map((m) => pool[m.pid]?.[1]?.[5] ?? 0) : null;
  const fast = speeds ? speeds.filter((v) => v >= 90).length : 0;
  const noMoves = members.filter((m) => !m.moves.some((mid) => db.moves[mid])).map(name);

  return { rows, defBad, threats, fixes, phys, spec, status, hitters, covered, gaps, hasAttacks, moveFix, speeds, fast, noMoves };
}

type Insight = { tone: 'warn' | 'ok' | 'tip'; body: ReactNode };

function TeamAnalysis({ db, members, extra }: { db: Db; members: TeamMember[]; extra?: ReactNode }) {
  const [pool, setPool] = useState<Pool | null>(null);
  const [full, setFull] = useState(false);
  const [pickT, setPickT] = useState<number | null>(null);
  useEffect(() => { loadPool().then(setPool).catch(() => undefined); }, []);
  const a = useMemo(() => analyze(db, members, pool), [db, members, pool]);
  const n = members.length;
  const tName = (t: number) => db.meta.types[t]?.[0] ?? '';
  const defGrade = gradeOf(a.defBad, [1, 3, 5.5, 8.5]);
  const covGrade = a.hasAttacks ? gradeOf(18 - a.covered.length, [2, 5, 8, 11]) : '—';

  const ins: Insight[] = [];
  for (const r of a.threats) {
    ins.push({ tone: 'warn', body: <><TypeBadge db={db} id={r.t} small /> <span><b>{r.weak} débiles</b> · {r.resist === 0 ? 'nadie lo resiste' : `${r.resist} lo resiste${r.resist > 1 ? 'n' : ''}`}{r.quad.length ? <> · <b>{r.quad.join(' y ')}</b> recibe ×4</> : null}</span></> });
  }
  if (a.threats.length && a.fixes.length) {
    ins.push({ tone: 'tip', body: <span>Un Pokémon tipo {a.fixes.map((d, i) => <span key={d}>{i ? ' o ' : ''}<TypeBadge db={db} id={d} small /></span>)} aguantaría esos golpes.</span> });
  }
  if (!a.threats.length && n >= 3) ins.push({ tone: 'ok', body: <span>Defensa sólida: ningún tipo le pega fuerte a varios a la vez.</span> });
  if (a.noMoves.length) ins.push({ tone: 'tip', body: <span>{a.noMoves.join(', ')} todavía no tiene{a.noMoves.length > 1 ? 'n' : ''} movimientos.</span> });
  if (a.hasAttacks && a.phys + a.spec >= 4) {
    if (a.spec === 0) ins.push({ tone: 'warn', body: <span>Todos sus ataques son <b>físicos</b>. Un rival con Intimidación o Fuego Fatuo lo frena; sume algo especial.</span> });
    else if (a.phys === 0) ins.push({ tone: 'warn', body: <span>Todos sus ataques son <b>especiales</b>. Un Pokémon con mucha Def. Especial lo aguanta; sume algo físico.</span> });
    else if (a.phys / a.spec >= 3 || a.spec / a.phys >= 3) ins.push({ tone: 'tip', body: <span>Casi todo es {a.phys > a.spec ? 'físico' : 'especial'} ({Math.max(a.phys, a.spec)} de {a.phys + a.spec} ataques).</span> });
    else ins.push({ tone: 'ok', body: <span>Buen balance entre ataques físicos y especiales.</span> });
  }
  if (a.speeds && n >= 3) {
    if (a.fast <= 1) ins.push({ tone: 'warn', body: <span>Equipo lento: {a.fast === 0 ? 'ninguno es rápido' : 'solo uno es rápido'} (velocidad base 90+). Un Pañuelo Elección o Espacio Raro le ayudaría.</span> });
    else if (a.fast >= n - 1 && n >= 4) ins.push({ tone: 'ok', body: <span>Equipo veloz: {a.fast} de {n} pegan primero casi siempre.</span> });
  }
  if (a.moveFix && a.moveFix.n >= 2) ins.push({ tone: 'tip', body: <span>Un ataque tipo <TypeBadge db={db} id={a.moveFix.a} small /> le daría súper eficaz contra {a.moveFix.n} tipos que hoy no cubre.</span> });
  if (!a.hasAttacks) ins.push({ tone: 'tip', body: <span>Elija movimientos de ataque para ver la cobertura y el balance.</span> });

  const top = a.rows.filter((r) => r.weak || r.resist).slice(0, 6);
  const picked = pickT ? a.hitters(pickT) : [];
  return (
    <>
      <section className="panel ana">
        <h3>Análisis del equipo</h3>
        <div className="grades">
          <div className={`grade g-${defGrade}`}><b>{defGrade}</b><span>Defensa</span></div>
          <div className={`grade g-${covGrade === '—' ? 'x' : covGrade}`}><b>{covGrade}</b><span>Cobertura{a.hasAttacks ? ` · ${a.covered.length}/18` : ''}</span></div>
          <div className="grade grade--bar">
            <span className="balance" aria-label={`${a.phys} físicos, ${a.spec} especiales, ${a.status} de estado`}>
              {a.phys + a.spec + a.status === 0 ? <i className="balance__none" /> : <>
                <i className="cls-phys" style={{ flex: a.phys }} /><i className="cls-spec" style={{ flex: a.spec }} /><i className="cls-status" style={{ flex: a.status }} />
              </>}
            </span>
            <span className="balance__nums"><em className="cls-phys">{a.phys}</em> fís · <em className="cls-spec">{a.spec}</em> esp · <em className="cls-status">{a.status}</em> est</span>
          </div>
          <div className="grade grade--bar">
            <span className="speed-dots">{members.map((m, i) => <i key={i} className={a.speeds && a.speeds[i] >= 90 ? 'on' : ''} title={a.speeds ? `${pidInfo(db, m.pid).name}: ${a.speeds[i]}` : ''} />)}</span>
            <span className="balance__nums">{a.speeds ? `${a.fast} de ${n} rápidos` : 'Velocidad…'}</span>
          </div>
        </div>
        <ul className="insights">
          {ins.map((x, i) => <li key={i} className={`ins ins--${x.tone}`} style={{ '--i': i } as CSSProperties}><span className="ins__dot" aria-hidden />{x.body}</li>)}
        </ul>
        {extra}
      </section>

      <section className="panel">
        <div className="panel__head"><h3>Defensa por tipo</h3><span className="muted small">resiste · débil</span></div>
        <div className="dbars">
          {top.map((r) => (
            <div key={r.t} className="dbar">
              <span className="dbar__type"><TypeBadge db={db} id={r.t} small /></span>
              <span className="dbar__side dbar__side--l">{Array.from({ length: n }, (_, i) => <i key={i} className={i < r.resist ? 'on' : ''} />)}</span>
              <span className="dbar__side dbar__side--r">{Array.from({ length: n }, (_, i) => <i key={i} className={i < r.weak ? (i < r.quad.length ? 'on q' : 'on') : ''} />)}</span>
            </div>
          ))}
        </div>
        <button className="lf__link more-link" onClick={() => setFull((x) => !x)}>{full ? 'Ocultar tabla' : 'Ver tabla completa'}</button>
        {full && (
          <>
            <div className="matrix" style={{ '--cols': n } as CSSProperties}>
              <span className="matrix__corner" />
              {members.map((m, i) => <span key={i} className="matrix__head"><Sprite db={db} pid={m.pid} size={36} fallback={m.species} /></span>)}
              <span className="matrix__head matrix__sum">Débil / Res.</span>
              {[...a.rows].sort((x, y) => x.t - y.t).map((r) => (
                <div key={r.t} className="matrix__row">
                  <span className="matrix__type"><TypeBadge db={db} id={r.t} small /></span>
                  {r.mults.map((x, i) => <span key={i} className={`matrix__cell m-${String(x).replace('.', '')}`}>{x === 0 ? '0' : x === 0.25 ? '¼' : x === 0.5 ? '½' : x === 1 ? '' : x}</span>)}
                  <span className="matrix__sum"><b className="w">{r.weak}</b> / <b className="r">{r.resist}</b></span>
                </div>
              ))}
            </div>
            <p className="note">×2 o más en rojo, resistencias en verde, inmunidad en gris. Incluye habilidades como Levitación o Absorbe Agua.</p>
          </>
        )}
      </section>

      <section className="panel">
        <div className="panel__head"><h3>Cobertura de ataques</h3><span className="pill">{a.covered.length} de 18</span></div>
        {!a.hasAttacks ? <p className="muted">Elija movimientos de ataque para ver contra qué tipos pega súper eficaz.</p> : (
          <>
            <p className="muted small">Toque un tipo para ver quién le pega fuerte.</p>
            <div className="covgrid">
              {ALL_T.map((t) => (
                <button key={t} className={`covcell t-${db.meta.types[t]?.[1]}${a.covered.includes(t) ? '' : ' is-gap'}${pickT === t ? ' is-on' : ''}`} onClick={() => setPickT(pickT === t ? null : t)}>
                  <svg viewBox="0 0 24 24" aria-hidden>{glyphPaths(db.meta.types[t]?.[1] ?? 'normal')}</svg>
                  <span>{tName(t)}</span>
                </button>
              ))}
            </div>
            {pickT && (
              <div className="covpick">
                <p className="covpick__title">Contra <TypeBadge db={db} id={pickT} small /></p>
                {picked.length === 0 ? <p className="muted small">Nadie le pega súper eficaz. Busque un ataque de un tipo que le gane.</p> : (
                  <ul>
                    {picked.slice(0, 8).map((x, i) => (
                      <li key={i}>
                        <Sprite db={db} pid={x.m.pid} size={36} fallback={x.m.species} />
                        <span><b>{pidInfo(db, x.m.pid).name}</b> · {db.moves[x.mid][0]}</span>
                        <em className={x.mult >= 4 ? 'x4' : ''}>{mxLabel(x.mult)}</em>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </>
        )}
      </section>
    </>
  );
}

/* ---------- Sugerir cambio ---------- */
// Una sola sugerencia, pequeña, dentro del análisis. La × la esconde hasta que el equipo cambie.
const dismissed = () => store.get<Record<string, string>>('swapDismiss', {});
const dismiss = (id: number, sig: string) => store.set('swapDismiss', { ...dismissed(), [id]: sig });

function SwapSuggestion({ db, team, setTeam }: { db: Db; team: Team; setTeam: (t: Team) => void }) {
  const [sug, setSug] = useState<Suggestion | null>(null);
  const [hidden, setHidden] = useState(false);
  const [busy, setBusy] = useState(false);
  const [undo, setUndo] = useState<{ slot: number; prev: TeamMember; name: string; prevName: string } | null>(null);
  const sig = team.members.map((m) => m?.pid ?? 0).filter(Boolean).join('-');

  useEffect(() => {
    let alive = true;
    setSug(null); setHidden(false);
    if (team.randomizer || dismissed()[team.id] === sig) return;
    Promise.all([loadPool(), loadVgDex()])
      .then(([pool, vgDex]) => suggestSwap(db, pool, vgDex, team, new Set(favs.list())))
      .then((x) => { if (alive && x && dismissed()[team.id] !== x.sig) setSug(x); })
      .catch(() => undefined);
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db, sig, team.vg, team.randomizer, team.id]);

  useEffect(() => { if (!undo) return; const t = window.setTimeout(() => setUndo(null), 9000); return () => window.clearTimeout(t); }, [undo]);

  if (undo) {
    return (
      <div className="sug sug--done" role="status">
        <span><b>{undo.name}</b> entró por {undo.prevName}.</span>
        <button className="sug__link" onClick={() => {
          const members = [...team.members]; members[undo.slot] = undo.prev;
          const t = { ...team, members }; dismiss(team.id, members.map((m) => m?.pid ?? 0).filter(Boolean).join('-'));
          setTeam(t); setUndo(null);
        }}>Deshacer</button>
      </div>
    );
  }
  if (!sug || hidden) return null;
  const from = pidInfo(db, sug.fromPid), to = pidInfo(db, sug.toPid);
  const apply = async () => {
    setBusy(true);
    try {
      const pool = await loadPool();
      const m = await buildMember(db, pool, team, sug.slot, sug.toPid);
      if (!m) return;
      const prev = team.members[sug.slot]!;
      const members = [...team.members]; members[sug.slot] = m;
      dismiss(team.id, members.map((x) => x?.pid ?? 0).filter(Boolean).join('-')); // no encadenar otra sugerencia enseguida
      setTeam({ ...team, members });
      setUndo({ slot: sug.slot, prev, name: to.name, prevName: from.name });
    } finally { setBusy(false); }
  };
  return (
    <div className="sug">
      <div className="sug__top">
        <span className="sug__tag">
          <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden><path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2V16h5v-.1c0-.8.4-1.5 1-2A6 6 0 0 0 12 3Z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
          Sugerencia
        </span>
        <button className="sug__x" aria-label="Descartar sugerencia" onClick={() => { dismiss(team.id, sug.sig); setHidden(true); }}>
          <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden><path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" /></svg>
        </button>
      </div>
      <div className="sug__swap">
        <span className="sug__mon sug__mon--out"><Sprite db={db} pid={sug.fromPid} size={40} /><span>{from.name}</span></span>
        <svg className="sug__arrow" viewBox="0 0 24 24" width="20" height="20" aria-hidden><path d="M5 12h13m-5-5 5 5-5 5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
        <button className="sug__mon" onClick={() => nav.push(`pokemon-${db.forms[sug.toPid]?.[0] ?? sug.toPid}`)} title={`Ver a ${to.name}`}>
          <Sprite db={db} pid={sug.toPid} size={40} /><span>{to.name}{to.form ? <small> {to.form}</small> : null}</span>
        </button>
      </div>
      <ul className="sug__why">{sug.reasons.map((r) => <li key={r}>{r}</li>)}</ul>
      <div className="sug__actions">
        <small>Se arma con movimientos y objeto. Puede deshacerlo.</small>
        <button className="sug__go" disabled={busy} onClick={apply}>{busy ? 'Cambiando…' : 'Cambiar'}</button>
      </div>
    </div>
  );
}

/* ---------- Generador ---------- */
const PURPOSES: { id: Purpose; title: string; desc: string; icon: string }[] = [
  { id: 'historia', title: 'Historia', desc: 'Para jugar la aventura: fuertes, variados y fáciles de usar.', icon: 'M4 19V6l8-3 8 3v13l-8 3-8-3Zm8-16v19' },
  { id: 'combates', title: 'Combates', desc: 'Para pelear con amigos: más poder y sets más afilados.', icon: 'M5 19 19 5m-4 0h4v4M5 5l14 14m-4 0h4v-4' },
  { id: 'monotipo', title: 'Monotipo', desc: 'Los seis de un mismo tipo. Usted elige cuál.', icon: 'M12 3 21 12 12 21 3 12Z' },
  { id: 'sorpresa', title: 'Sorpréndame', desc: 'Al azar, pero con sentido. Para salir de la rutina.', icon: 'M12 3v4m0 10v4M3 12h4m10 0h4M6 6l2.5 2.5m7 7L18 18m0-12-2.5 2.5m-7 7L6 18' },
];

const THINKING = ['Revisando debilidades…', 'Buscando cobertura…', 'Balanceando físicos y especiales…', 'Eligiendo movimientos…'];
function GenBusy() {
  const [i, setI] = useState(0);
  useEffect(() => { const t = setInterval(() => setI((x) => Math.min(x + 1, THINKING.length - 1)), 380); return () => clearInterval(t); }, []);
  return (
    <div className="gen-busy" role="status">
      <span className="gen-busy__ball" aria-hidden />
      <span key={i} className="gen-busy__text">{THINKING[i]}</span>
      <span className="gen-busy__steps" aria-hidden>{THINKING.map((_, k) => <i key={k} className={k <= i ? 'on' : ''} />)}</span>
    </div>
  );
}

export function GenPage({ db }: { db: Db }) {
  const [vgDex, setVgDex] = useState<Record<string, number[]> | null>(null);
  const [pool, setPool] = useState<Pool | null>(null);
  const [loadErr, setLoadErr] = useState(false);
  const [o, setO] = useState<GenOptions>(() => ({ vg: 25, purpose: 'historia', monoType: 10, anchors: [], legends: false, ...store.get<Partial<GenOptions>>('genOpts', {}) }));
  const [stage, setStage] = useState<'ask' | 'busy' | 'done' | 'error'>('ask');
  const [result, setResult] = useState<Omit<Team, 'id'> | null>(null);
  const [q, setQ] = useState('');
  useEffect(() => {
    Promise.all([loadVgDex(), loadPool()]).then(([v, p]) => { setVgDex(v); setPool(p); }).catch(() => setLoadErr(true));
  }, []);
  useEffect(() => { document.querySelector('.sheet')?.scrollTo({ top: 0, behavior: reducedMotion() ? 'auto' : 'smooth' }); }, [stage]);

  const games = db.meta.versionGroups.filter((g) => (vgDex ? vgDex[g.id]?.length : true));
  const gameOpts: Opt[] = [...games].reverse().map((g) => ({ value: g.id, label: g.name, group: `Generación ${GENS[g.gen - 1]}` }));
  const inGame = useMemo(() => new Set(vgDex?.[o.vg] ?? []), [vgDex, o.vg]);
  const set = (p: Partial<GenOptions>) => setO((x) => ({ ...x, ...p }));
  const setVg = (vg: number) => setO((x) => ({ ...x, vg, anchors: x.anchors.filter((pid) => vgDex?.[vg]?.includes(pid)) }));

  const favIn = favs.list().filter((sid) => inGame.has(sid) && !o.anchors.includes(sid)).slice(0, 12);
  const found = q.trim().length >= 2 ? [...inGame].filter((pid) => fold(pidInfo(db, pid).name + ' ' + (pidInfo(db, pid).form ?? '')).includes(fold(q.trim())) && !o.anchors.includes(pid)).slice(0, 9) : [];
  const addAnchor = (pid: number) => { if (o.anchors.length < 2) set({ anchors: [...o.anchors, pid] }); setQ(''); };

  const run = async () => {
    if (!vgDex || !pool) return;
    store.set('genOpts', o);
    setStage('busy');
    try {
      const avoid = (result?.members.filter(Boolean) as TeamMember[] | undefined)?.map((m) => m.pid) ?? [];
      const [t] = await Promise.all([generateTeam(db, pool, vgDex, o, avoid), new Promise((r) => setTimeout(r, reducedMotion() ? 300 : 1500))]);
      if (!t || !t.members.some(Boolean)) { setStage('error'); return; }
      setResult(t); setStage('done');
    } catch { setStage('error'); }
  };
  const teamName = () => o.purpose === 'monotipo' ? `Monotipo ${db.meta.types[o.monoType]?.[0] ?? ''}` : o.purpose === 'combates' ? 'Equipo de combate' : o.purpose === 'sorpresa' ? 'Equipo sorpresa' : 'Equipo de aventura';
  const save = () => { if (!result) return; const t = teams.add({ ...result, name: teamName() }); nav.replace(`equipo-${t.id}`); };

  const members = (result?.members.filter(Boolean) ?? []) as TeamMember[];
  return (
    <div className="detail teamspage genpage">
      <header className="dex-top dex-top--detail">
        <div className="dex-top__inner nav-row"><BackButton onClick={() => nav.back()} /></div>
      </header>
      <section className="hero">
        <div className="screen">
          <div className="emblem emblem--teams emblem--gen"><span className="emblem__icon"><BallsIcon size={56} /></span></div>
          <div className="hero__info">
            <span className="hero__num">Generador</span>
            <h2 className="hero__name">{stage === 'done' ? teamName() : 'Arme un equipo por mí'}</h2>
            <span className="hero__genus">{stage === 'done' ? gameName(db, o.vg) : 'Conteste unas preguntas y JuasDex arma los seis con movimientos.'}</span>
          </div>
        </div>
      </section>
      <main className="body">
        <div className="stack-gap">
          {loadErr && <div className="empty">Diay, no se pudieron cargar los datos. ¿Tiene conexión?</div>}

          {(stage === 'ask' || stage === 'error') && (
            <>
              <div className="qblock">
                <span className="qnum">1</span>
                <div className="qbody">
                  <h3>¿Para qué juego?</h3>
                  <Picker title="Elija un juego" value={o.vg} options={gameOpts} onChange={setVg} />
                </div>
              </div>

              <div className="qblock">
                <span className="qnum">2</span>
                <div className="qbody">
                  <h3>¿Para qué es?</h3>
                  <div className="purposes">
                    {PURPOSES.map((p) => (
                      <button key={p.id} className={`purpose${o.purpose === p.id ? ' is-on' : ''}`} onClick={() => set({ purpose: p.id })} aria-pressed={o.purpose === p.id}>
                        <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden><path d={p.icon} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                        <strong>{p.title}</strong>
                        <small>{p.desc}</small>
                      </button>
                    ))}
                  </div>
                  {o.purpose === 'monotipo' && (
                    <div className="monogrid">
                      {ALL_T.map((t) => (
                        <button key={t} className={`covcell t-${db.meta.types[t]?.[1]}${o.monoType === t ? ' is-on' : ' is-gap'}`} onClick={() => set({ monoType: t })} aria-pressed={o.monoType === t}>
                          <svg viewBox="0 0 24 24" aria-hidden>{glyphPaths(db.meta.types[t]?.[1] ?? 'normal')}</svg>
                          <span>{db.meta.types[t]?.[0]}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  {o.purpose === 'combates' && (
                    <button className={`rando rando--mini${o.legends ? ' is-on' : ''}`} role="switch" aria-checked={o.legends} onClick={() => set({ legends: !o.legends })}>
                      <span className="rando__text"><strong>Permitir legendarios</strong><small>{o.legends ? 'Pueden salir legendarios y singulares.' : 'Solo Pokémon normales.'}</small></span>
                      <span className="rando__switch" aria-hidden><i /></span>
                    </button>
                  )}
                </div>
              </div>

              <div className="qblock">
                <span className="qnum">3</span>
                <div className="qbody">
                  <h3>¿Alguno que no puede faltar? <small className="muted">(opcional, hasta 2)</small></h3>
                  {o.anchors.length > 0 && (
                    <div className="anchors">
                      {o.anchors.map((pid) => (
                        <button key={pid} className="anchor" onClick={() => set({ anchors: o.anchors.filter((x) => x !== pid) })} aria-label={`Quitar ${pidInfo(db, pid).name}`}>
                          <Sprite db={db} pid={pid} size={44} /><span>{pidInfo(db, pid).name}</span><i aria-hidden>×</i>
                        </button>
                      ))}
                    </div>
                  )}
                  {o.anchors.length < 2 && (
                    <>
                      <input className="text-input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar un Pokémon de este juego…" />
                      {found.length > 0 && <div className="minigrid">{found.map((pid) => <MiniMon key={pid} db={db} pid={pid} onClick={() => addAnchor(pid)} />)}</div>}
                      {!q && favIn.length > 0 && (
                        <>
                          <p className="muted small">De sus favoritos:</p>
                          <div className="minigrid">{favIn.map((pid) => <MiniMon key={pid} db={db} pid={pid} onClick={() => addAnchor(pid)} />)}</div>
                        </>
                      )}
                    </>
                  )}
                </div>
              </div>

              {stage === 'error' && <p className="move-slot__warn">No hubo suficientes Pokémon con esas respuestas en este juego. Pruebe otro tipo o juego.</p>}
              <button className="big-btn big-btn--gen" disabled={!vgDex || !pool} onClick={run}>
                <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden><path d="M12 3l2.2 5.6L20 9.3l-4.5 3.8 1.5 5.9L12 15.8 7 19l1.5-5.9L4 9.3l5.8-.7Z" fill="currentColor" /></svg>
                {vgDex && pool ? 'Generar equipo' : 'Cargando…'}
              </button>
            </>
          )}

          {stage === 'busy' && <GenBusy />}

          {stage === 'done' && result && (
            <>
              <div className="slots">
                {result.members.map((m, i) => m ? (
                  <div key={`${i}-${m.pid}`} className="slot" style={{ '--i': i, ...slotColors(db, m.types) } as CSSProperties}><MemberCard db={db} m={m} /></div>
                ) : null)}
              </div>
              {o.purpose === 'monotipo' && <p className="note">En un monotipo todos comparten debilidades, así que la nota de defensa siempre sale baja: esa es la gracia del reto. JuasDex elige los que mejor tapan esos huecos.</p>}
              {members.length < 6 && <p className="note">Solo se encontraron {members.length} opciones que cumplen con todo en este juego.</p>}
              <div className="btn-row">
                <button className="big-btn" onClick={save}>Guardar equipo</button>
                <button className="big-btn big-btn--alt" onClick={run}>
                  <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden><path d="M20 12a8 8 0 1 1-2.3-5.7M20 4v5h-5" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  Otro
                </button>
              </div>
              <button className="lf__link more-link" onClick={() => setStage('ask')}>Cambiar respuestas</button>
              <TeamAnalysis db={db} members={members} />
              <p className="note">Después de guardarlo puede cambiar cualquier cosa: Pokémon, movimientos, objetos…</p>
            </>
          )}
        </div>
      </main>
    </div>
  );
}

/* ---------- Abrir un enlace compartido ---------- */
export function ImportPage({ db, code }: { db: Db; code: string }) {
  const [team, setTeam] = useState<Omit<Team, 'id'> | null | 'error'>(null);
  useEffect(() => {
    let alive = true;
    decodeTeam(db, code).then((t) => alive && setTeam(t ?? 'error')).catch(() => alive && setTeam('error'));
    return () => { alive = false; };
  }, [db, code]);
  const save = () => {
    if (!team || team === 'error') return;
    const t = teams.add(team);
    nav.replace(`equipo-${t.id}`);
  };
  return (
    <div className="detail teamspage">
      <header className="dex-top dex-top--detail">
        <div className="dex-top__inner nav-row"><BackButton onClick={() => nav.back()} /></div>
      </header>
      <section className="hero">
        <div className="screen">
          <div className="emblem emblem--teams"><span className="emblem__icon"><BallsIcon size={56} /></span></div>
          <div className="hero__info">
            <span className="hero__num">Le compartieron un equipo</span>
            <h2 className="hero__name">{team && team !== 'error' ? team.name : 'Equipo'}</h2>
            {team && team !== 'error' && <span className="hero__genus">{gameName(db, team.vg)}{team.randomizer ? ' · Randomizer' : ''}</span>}
          </div>
        </div>
      </section>
      <main className="body">
        <div className="stack-gap">
          {team === null && <div className="empty"><Spinner /> Abriendo el equipo…</div>}
          {team === 'error' && <div className="empty">Diay, este enlace no se pudo leer. Pídale a quien se lo mandó que lo vuelva a copiar.</div>}
          {team && team !== 'error' && (
            <>
              <div className="slots">
                {team.members.filter(Boolean).map((m, i) => (
                  <div key={i} className="slot" style={{ '--i': i, ...slotColors(db, (m as TeamMember).types) } as CSSProperties}>
                    <MemberCard db={db} m={m as TeamMember} />
                  </div>
                ))}
              </div>
              <button className="big-btn" onClick={save}>Guardar en mis equipos</button>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
