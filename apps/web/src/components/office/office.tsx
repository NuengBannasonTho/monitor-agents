import { zoneOf } from '@agent-office/shared';
import type { Agent, AgentState, Subagent, Zone } from '@agent-office/shared';
import { AnimatePresence, useReducedMotion } from 'motion/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Point, Team } from '../../lib/geometry';
import {
  deskGrid,
  loungeGrid,
  loungeSlotPosition,
  placesForSubagents,
  seatSubagents,
} from '../../lib/geometry';
import { hashString } from '../../lib/seed';
import { useStableSlots } from '../../hooks/use-stable-slots';
import type { Rect } from '../../hooks/use-zone-rects';
import { useZoneRects } from '../../hooks/use-zone-rects';
import { useWorkPeriod } from '../../lib/work-hours';
import { cityHorizonPx } from '../scene/city';
import { CityScene } from '../scene/city-scene';
import { DESK_ITEMS } from '../scene/desk-art';
import { Desk, MINI_SEAT_ABOVE_DESK_PX, SEAT_ABOVE_DESK_PX } from '../scene/desk';
import { ForestScene } from '../scene/forest-scene';
import { useSceneTheme } from '../scene/use-scene-theme';
import { useSkins } from '../../skins/skin-context';
import { officePixelSize } from '../avatar/avatar';
import { CHARACTER_HEIGHT, CHARACTER_WIDTH, Character } from './character';
import styles from './office.module.css';
import { CampIcon, WorkIcon } from '../icons';
import { StateCounts } from './state-counts';
import { SubagentCharacter } from './subagent-character';
import { ZonePanel } from './zone-panel';
import { Crowd } from './crowd';
import { useCollapsedZone } from './use-collapsed-zone';
import { WorkClock } from './work-clock';

interface OfficeProps {
  readonly agents: readonly Agent[];
  readonly selectedId?: string | null;
  /** Agents with a finished turn you have not opened yet. */
  readonly finishedIds?: ReadonlySet<string>;
  /** Agents waiting on you, longest wait first. */
  readonly waiting?: readonly Agent[];
  readonly onSelect?: (id: string) => void;
  /** Opens an agent's details (never toggles them closed). */
  readonly onOpen?: (id: string) => void;
}

/** How long a panel takes to open or shut; matches the CSS in office.module.css. */
const PANEL_MOTION_MS = 460;

/** The states each panel holds, in the order an agent moves through them. */
const CAMP_STATES: readonly AgentState[] = ['idle', 'done', 'stale'];
const WORK_STATES: readonly AgentState[] = ['called', 'working', 'reading', 'running', 'needs-you'];

const NONE: ReadonlySet<string> = new Set();

/** A subagent seated at its small desk. */
interface SubPlacement {
  readonly sub: Subagent;
  readonly parent: Agent;
  /** The desk place its small desk shares. */
  readonly place: number;
  /** Desk-top center of its small desk. */
  readonly desk: Point;
  readonly target: Point;
}

interface Placement {
  readonly agent: Agent;
  readonly zone: Zone;
  readonly target: Point;
  /** Index into the desk grid, for agents at work. */
  readonly desk?: number;
}

/** What each panel is called and what it holds. */
const ZONE_TEXT = {
  lounge: { title: 'Base Camp', hint: 'Idle, finished and asleep' },
  table: { title: 'Agent Work', hint: 'Working on your prompts' },
} as const;

/** Lounge grids never shrink below this many cells, so small changes don't reflow everyone. */
const MIN_LOUNGE_CELLS = 6;
const LOUNGE_MIN_CELL_PX = 128;
/** Keeps sprites (and their name tag) inside the lounge while standing or walking. */
const LOUNGE_PADDING = {
  x: CHARACTER_WIDTH / 2 + 18,
  y: CHARACTER_HEIGHT / 2 + 20,
};

/** A zone just opening has no size yet; its scene waits until it does. */
function hasRoom(rect: Rect): boolean {
  return rect.width >= 2 && rect.height >= 2;
}

function maxValue(map: ReadonlyMap<string, number>): number {
  let max = -1;
  for (const v of map.values()) max = Math.max(max, v);
  return max;
}

export function Office({
  agents,
  selectedId = null,
  finishedIds = NONE,
  waiting = [],
  onSelect,
  onOpen,
}: OfficeProps): React.JSX.Element {
  const officeRef = useRef<HTMLDivElement>(null);
  const loungeRef = useRef<HTMLDivElement>(null);
  const tableRef = useRef<HTMLDivElement>(null);
  const [collapsed, setCollapsed] = useCollapsedZone();
  const reduceMotion = useReducedMotion() ?? false;
  // While a panel opens or shuts: sizes are not followed, scenes blur, characters fade out.
  const [animating, setAnimating] = useState(false);
  // One shared plan book for Base Camp, so strollers never walk into each other.
  const crowd = useMemo(() => new Crowd(), []);
  const { rects, settling } = useZoneRects(officeRef, loungeRef, tableRef, animating);
  const theme = useSceneTheme();
  const period = useWorkPeriod();
  // Scenery pixels match the avatars: 5 px for pixel workers, 2 px for image skins.
  const px = officePixelSize(useSkins());

  const tableIds = useMemo(
    () => agents.filter((a) => zoneOf(a.state) === 'table').map((a) => a.id),
    [agents],
  );
  const loungeIds = useMemo(
    () => agents.filter((a) => zoneOf(a.state) === 'lounge').map((a) => a.id),
    [agents],
  );
  const deskSlots = useStableSlots(tableIds);
  const loungeSlots = useStableSlots(loungeIds);
  // Every pair of subagents takes one desk place for their two small desks.
  const subagentPlaces = agents.reduce(
    (n, a) => n + placesForSubagents(a.subagents?.length ?? 0),
    0,
  );
  const seatsNeeded = maxValue(deskSlots) + 1 + subagentPlaces;

  const desks = useMemo(() => {
    if (rects === null) return null;
    const grid = deskGrid(rects.table, cityHorizonPx(rects.table.height, px), seatsNeeded);
    // Snap desks onto the scenery's pixel grid so their pixels line up with the floor's.
    const snap = (v: number): number => Math.round(v / px) * px;
    return {
      ...grid,
      desks: grid.desks.map((d) => ({ x: snap(d.x), y: snap(d.y) })),
    };
  }, [rects, seatsNeeded, px]);

  // Where waiting agents may stroll: the lounge minus room for the sprite and its name tag.
  // Memoized on the measured rect only, so walkers are not reset by unrelated updates.
  const wanderArea = useMemo<Rect | null>(() => {
    if (rects === null) return null;
    const l = rects.lounge;
    return {
      left: l.left + LOUNGE_PADDING.x,
      top: l.top + LOUNGE_PADDING.y,
      width: Math.max(0, l.width - LOUNGE_PADDING.x * 2),
      height: Math.max(0, l.height - LOUNGE_PADDING.y * 2),
    };
  }, [rects]);

  const placements: readonly Placement[] = useMemo(() => {
    if (rects === null || desks === null) return [];
    const lounge = rects.lounge;
    const table = rects.table;
    const grid = loungeGrid(
      lounge,
      Math.max(MIN_LOUNGE_CELLS, maxValue(loungeSlots) + 1),
      LOUNGE_MIN_CELL_PX,
    );

    const result: Placement[] = [];
    for (const agent of agents) {
      const zone = zoneOf(agent.state);
      // A collapsed panel shows no one, nor does one still opening (it has no size yet):
      // its people appear once it has, rather than being placed in a zero-size box.
      if (zone === collapsed || !hasRoom(zone === 'table' ? table : lounge)) continue;
      if (zone === 'table') {
        const deskIndex = desks.fillOrder[deskSlots.get(agent.id) ?? -1];
        const desk = deskIndex === undefined ? undefined : desks.desks[deskIndex];
        if (desk === undefined) continue;
        result.push({
          agent,
          zone,
          desk: deskIndex,
          target: {
            x: table.left + desk.x,
            y: table.top + desk.y - SEAT_ABOVE_DESK_PX,
          },
        });
      } else {
        const slot = loungeSlots.get(agent.id);
        if (slot === undefined) continue;
        const p = loungeSlotPosition(lounge, grid, slot, LOUNGE_PADDING, agent.id);
        result.push({
          agent,
          zone,
          target: { x: lounge.left + p.x, y: lounge.top + p.y },
        });
      }
    }
    return result;
  }, [agents, rects, desks, deskSlots, loungeSlots, collapsed]);

  const deskStates = useMemo(() => {
    const states = new Map<number, AgentState>();
    for (const p of placements) if (p.desk !== undefined) states.set(p.desk, p.agent.state);
    return states;
  }, [placements]);

  // Subagents sit at small desks next to their agent's desk (or mid-plaza if it is in camp).
  const subPlacements = useMemo<readonly SubPlacement[]>(() => {
    if (rects === null || desks === null || collapsed === 'table' || !hasRoom(rects.table)) {
      return [];
    }
    const teams: Team[] = [];
    for (const a of agents) {
      const slot = zoneOf(a.state) === 'table' ? deskSlots.get(a.id) : undefined;
      const home = slot === undefined ? null : (desks.fillOrder[slot] ?? null);
      const subs = a.subagents?.length ?? 0;
      if (home !== null || subs > 0) teams.push({ id: a.id, home, subagents: subs });
    }
    const seats = seatSubagents(desks, teams);
    const out: SubPlacement[] = [];
    for (const a of agents) {
      const list = a.subagents ?? [];
      seats.get(a.id)?.forEach((seat, i) => {
        const sub = list[i];
        const place = desks.desks[seat.place];
        if (sub === undefined || place === undefined) return;
        const desk = {
          x: rects.table.left + place.x + seat.dx,
          y: rects.table.top + place.y,
        };
        out.push({
          sub,
          parent: a,
          place: seat.place,
          desk,
          target: { x: desk.x, y: desk.y - MINI_SEAT_ABOVE_DESK_PX },
        });
      });
    }
    return out;
  }, [agents, rects, desks, deskSlots, collapsed]);

  /** Desk places holding small desks instead of a full one. */
  const miniPlaces = useMemo(() => new Set(subPlacements.map((s) => s.place)), [subPlacements]);

  /** Where each agent sits now, so its subagents hop out of its desk. */
  const seatOf = useMemo(() => {
    const map = new Map<string, Point>();
    for (const p of placements) map.set(p.agent.id, p.target);
    return map;
  }, [placements]);

  const urgent = agents.filter((a) => a.state === 'needs-you').length;
  const toggle = (zone: Zone) => () => {
    setCollapsed(collapsed === zone ? null : zone);
    if (!reduceMotion) setAnimating(true);
  };
  useEffect(() => {
    if (!animating) return;
    const timer = setTimeout(() => {
      setAnimating(false);
    }, PANEL_MOTION_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [animating]);

  return (
    <div
      ref={officeRef}
      className={styles.office}
      data-collapsed={collapsed ?? undefined}
      data-animating={animating ? 'true' : undefined}
    >
      <ZonePanel
        id="lounge"
        side="left"
        title={ZONE_TEXT.lounge.title}
        icon={<CampIcon size={20} />}
        hint={ZONE_TEXT.lounge.hint}
        stats={<StateCounts states={CAMP_STATES} agents={agents} />}
        aside={
          period === null ? undefined : (
            <WorkClock zone="lounge" period={period} working={tableIds.length} />
          )
        }
        count={loungeIds.length}
        collapsed={collapsed === 'lounge'}
        animating={animating}
        onToggle={toggle('lounge')}
        zoneRef={loungeRef}
        zoneClassName={styles.lounge}
      >
        {/* A collapsing scene stays until it has faded out with its card. */}
        {rects !== null && hasRoom(rects.lounge) && (collapsed !== 'lounge' || animating) && (
          <ForestScene
            width={rects.lounge.width}
            height={rects.lounge.height}
            theme={theme}
            px={px}
          />
        )}
        {agents.length === 0 && (
          <p className={styles.empty}>
            <CampIcon size={28} className={styles.emptyIcon} />
            No agent is running. Open Assistants to start a task.
          </p>
        )}
      </ZonePanel>

      <ZonePanel
        id="table"
        side="right"
        title={ZONE_TEXT.table.title}
        icon={<WorkIcon size={20} />}
        hint={ZONE_TEXT.table.hint}
        stats={
          <StateCounts states={WORK_STATES} agents={agents} waiting={waiting} onOpen={onOpen} />
        }
        aside={
          period === null ? undefined : (
            <WorkClock zone="table" period={period} working={tableIds.length} />
          )
        }
        count={tableIds.length}
        urgent={urgent}
        collapsed={collapsed === 'table'}
        animating={animating}
        onToggle={toggle('table')}
        zoneRef={tableRef}
        zoneClassName={styles.tableZone}
      >
        {rects !== null && hasRoom(rects.table) && (collapsed !== 'table' || animating) && (
          <CityScene width={rects.table.width} height={rects.table.height} theme={theme} px={px} />
        )}
      </ZonePanel>

      {/* One shared stage for every character, so zone changes are a single continuous flight. */}
      <div className={styles.stage}>
        {rects !== null &&
          collapsed !== 'table' &&
          desks?.desks.map((d, i) => {
            if (miniPlaces.has(i)) return null;
            const y = rects.table.top + d.y;
            return (
              <Desk
                key={i}
                x={rects.table.left + d.x}
                y={y}
                // Just in front of the worker seated here (characters use their center y).
                zIndex={Math.round(y - SEAT_ABOVE_DESK_PX) + 1}
                side={(i % desks.cols) % 2 === 0 ? 'left' : 'right'}
                item={DESK_ITEMS[hashString(`desk-${String(i)}`) % DESK_ITEMS.length] ?? 'none'}
                state={deskStates.get(i) ?? null}
                theme={theme}
                px={px}
              />
            );
          })}
        {subPlacements.map((s) => (
          <Desk
            key={`mini:${s.parent.id}:${s.sub.id}`}
            size="mini"
            x={s.desk.x}
            y={s.desk.y}
            zIndex={Math.round(s.target.y) + 1}
            side="left"
            item="none"
            state={s.sub.state}
            theme={theme}
            px={px}
          />
        ))}
        <AnimatePresence>
          {subPlacements.map((s) => (
            <SubagentCharacter
              key={`sub:${s.parent.id}:${s.sub.id}`}
              sub={s.sub}
              parent={s.parent}
              target={s.target}
              from={seatOf.get(s.parent.id) ?? s.target}
              selected={s.parent.id === selectedId}
              instant={settling}
              onSelect={onSelect}
            />
          ))}
          {placements.map((p) => (
            <Character
              key={p.agent.id}
              agent={p.agent}
              zone={p.zone}
              instant={settling}
              target={p.target}
              wanderArea={p.zone === 'lounge' ? wanderArea : null}
              crowd={crowd}
              selected={p.agent.id === selectedId}
              fresh={finishedIds.has(p.agent.id)}
              lunch={p.zone === 'lounge' && period?.kind === 'lunch'}
              onSelect={onSelect}
            />
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
