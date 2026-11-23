import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import type { Db, Team, TeamMember, Variety } from '../types';
import { defense, loadSpecies, loadVgDex, pidInfo, teams } from '../data';
import { nav } from '../nav';
import { BackButton, GENS, ItemIcon, MiniMon, MoveClass, Picker, STAT_SHORT, Spinner, Sprite, TypeBadge, type Opt } from './bits';
import { glyphPaths } from './glyphs';

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
          <button className="big-btn" onClick={create}>
            <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" /></svg>
            Nuevo equipo
          </button>
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

  useEffect(() => { loadVgDex().then(setVgDex).catch(() => undefined); }, []);
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
              <button key={i} className={`slot t-${db.meta.types[m.types[0]]?.[1]}`} style={{ '--i': i } as CSSProperties} onClick={() => setView({ kind: 'edit', slot: i })}>
                <MemberCard db={db} m={m} />
              </button>
            ) : (
              <button key={i} className="slot slot--empty" style={{ '--i': i } as CSSProperties} onClick={() => setView({ kind: 'pick', slot: i })}>
                <svg viewBox="0 0 24 24" width="28" height="28" aria-hidden><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" /></svg>
                <span>Agregar Pokémon</span>
              </button>
            ))}
          </div>

          {members.length > 0 && <TeamDefense db={db} members={members} />}
          {members.length > 0 && <TeamCoverage db={db} members={members} />}

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

function MemberCard({ db, m }: { db: Db; m: TeamMember }) {
  const info = pidInfo(db, m.pid);
  const item = m.item ? db.items[m.item] : null;
  const nature = m.nature ? db.natures[m.nature] : null;
  return (
    <>
      <span className="slot__head">
        <Sprite db={db} pid={m.pid} size={64} fallback={m.species} />
        <span className="slot__id">
          <strong>{info.name}</strong>
          {info.form && <small>{info.form}</small>}
          <span className="slot__types">{m.types.map((t) => <TypeBadge key={t} db={db} id={t} small />)}</span>
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
function TeamDefense({ db, members }: { db: Db; members: TeamMember[] }) {
  const defs = members.map((m) => defense(db, m.types));
  const rows = Object.keys(db.meta.types).map(Number).map((t) => {
    const mults = defs.map((d) => d[t]);
    return { t, mults, weak: mults.filter((x) => x > 1).length, resist: mults.filter((x) => x > 0 && x < 1).length, immune: mults.filter((x) => x === 0).length };
  }).sort((a, b) => (b.weak - b.resist - b.immune) - (a.weak - a.resist - a.immune) || a.t - b.t);
  const danger = rows.filter((r) => r.weak >= 3 || (r.weak >= 2 && r.resist + r.immune === 0));
  const label = (x: number) => (x === 0 ? '0' : x === 0.25 ? '¼' : x === 0.5 ? '½' : x === 1 ? '' : `${x}`);
  return (
    <section className="panel">
      <h3>Debilidades del equipo</h3>
      {danger.length > 0 ? (
        <p className="team-warn">Cuidado con: {danger.map((r) => <TypeBadge key={r.t} db={db} id={r.t} small />)}</p>
      ) : <p className="team-ok">¡Bien balanceado! Ningún tipo pega fuerte a medio equipo.</p>}
      <div className="matrix" style={{ '--cols': members.length } as CSSProperties}>
        <span className="matrix__corner" />
        {members.map((m, i) => <span key={i} className="matrix__head"><Sprite db={db} pid={m.pid} size={36} fallback={m.species} /></span>)}
        <span className="matrix__head matrix__sum">Débil / Res.</span>
        {rows.map((r) => (
          <div key={r.t} className="matrix__row">
            <span className="matrix__type"><TypeBadge db={db} id={r.t} small /></span>
            {r.mults.map((x, i) => <span key={i} className={`matrix__cell m-${String(x).replace('.', '')}`}>{label(x)}</span>)}
            <span className="matrix__sum"><b className="w">{r.weak}</b> / <b className="r">{r.resist + r.immune}</b></span>
          </div>
        ))}
      </div>
      <p className="note">×2 o más en rojo, resistencias en verde, inmunidad en gris. No toma en cuenta habilidades.</p>
    </section>
  );
}

function TeamCoverage({ db, members }: { db: Db; members: TeamMember[] }) {
  const attackTypes = [...new Set(members.flatMap((m) => m.moves.filter((mid) => db.moves[mid] && db.moves[mid][2] !== 1).map((mid) => db.moves[mid][1])))];
  const all = Object.keys(db.meta.types).map(Number);
  const best = (d: number) => attackTypes.reduce((mx, a) => Math.max(mx, db.meta.chart[a]?.[d] ?? 1), attackTypes.length ? 0 : 1);
  const covered = all.filter((d) => best(d) >= 2);
  const missing = all.filter((d) => best(d) < 2);
  return (
    <section className="panel">
      <div className="panel__head"><h3>Cobertura de ataques</h3><span className="pill">{covered.length} de 18</span></div>
      {attackTypes.length === 0 ? <p className="muted">Elija movimientos de ataque para ver contra qué tipos pega súper eficaz.</p> : (
        <>
          <p className="muted small">Súper eficaz contra:</p>
          <div className="badges">{covered.map((t, i) => <TypeBadge key={t} db={db} id={t} small style={{ '--i': i } as CSSProperties} />)}</div>
          {missing.length > 0 && (
            <>
              <p className="muted small cov-gap">Sin ataques súper eficaces contra:</p>
              <div className="badges badges--dim">{missing.map((t, i) => <TypeBadge key={t} db={db} id={t} small style={{ '--i': i } as CSSProperties} />)}</div>
            </>
          )}
        </>
      )}
    </section>
  );
}
