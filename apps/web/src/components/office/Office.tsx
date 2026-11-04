import { zoneOf } from '@agent-office/shared';
import type { Agent, AgentState, Zone } from '@agent-office/shared';
import { AnimatePresence } from 'motion/react';
import { useMemo, useRef } from 'react';
import { cx } from '../../lib/cx';
import type { Point } from '../../lib/geometry';
import { deskGrid, loungeGrid, loungeSlotPosition } from '../../lib/geometry';
import { hashString } from '../../lib/seed';
import { useStableSlots } from '../../lib/useStableSlots';
import type { Rect } from '../../lib/useZoneRects';
import { useZoneRects } from '../../lib/useZoneRects';
import { cityHorizonPx } from '../scene/city';
import { CityScene } from '../scene/CityScene';
import { DESK_ITEMS } from '../scene/deskSprite';
import { Desk, SEAT_ABOVE_DESK_PX } from '../scene/Desk';
import { ForestScene } from '../scene/ForestScene';
import { useSceneTheme } from '../scene/useSceneTheme';
import { CHARACTER_HEIGHT, CHARACTER_WIDTH, Character } from './Character';
import styles from './Office.module.css';

interface OfficeProps {
  readonly agents: readonly Agent[];
  readonly selectedId?: string | null;
  readonly onSelect?: (id: string) => void;
}

interface Placement {
  readonly agent: Agent;
  readonly zone: Zone;
  readonly target: Point;
  /** Index into the desk grid, for agents in the city. */
  readonly desk?: number;
}

/** Lounge grids never shrink below this many cells, so small changes don't reflow everyone. */
const MIN_LOUNGE_CELLS = 6;
const LOUNGE_MIN_CELL_PX = 128;
/** Keeps sprites (and their name tag) inside the lounge while standing or walking. */
const LOUNGE_PADDING = { x: CHARACTER_WIDTH / 2 + 18, y: CHARACTER_HEIGHT / 2 + 20 };

function maxValue(map: ReadonlyMap<string, number>): number {
  let max = -1;
  for (const v of map.values()) max = Math.max(max, v);
  return max;
}

export function Office({ agents, selectedId = null, onSelect }: OfficeProps) {
  const officeRef = useRef<HTMLDivElement>(null);
  const loungeRef = useRef<HTMLElement>(null);
  const tableRef = useRef<HTMLElement>(null);
  const rects = useZoneRects(officeRef, loungeRef, tableRef);
  const theme = useSceneTheme();

  const tableIds = useMemo(
    () => agents.filter((a) => zoneOf(a.state) === 'table').map((a) => a.id),
    [agents],
  );
  const loungeIds = useMemo(
    () => agents.filter((a) => zoneOf(a.state) === 'lounge').map((a) => a.id),
    [agents],
  );
  const seats = useStableSlots(tableIds);
  const loungeSlots = useStableSlots(loungeIds);
  const seatsNeeded = maxValue(seats) + 1;

  const desks = useMemo(
    () =>
      rects === null ? null : deskGrid(rects.table, cityHorizonPx(rects.table.height), seatsNeeded),
    [rects, seatsNeeded],
  );

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
      if (zone === 'table') {
        const deskIndex = desks.fillOrder[seats.get(agent.id) ?? -1];
        const desk = deskIndex === undefined ? undefined : desks.desks[deskIndex];
        if (desk === undefined) continue;
        result.push({
          agent,
          zone,
          desk: deskIndex,
          target: { x: table.left + desk.x, y: table.top + desk.y - SEAT_ABOVE_DESK_PX },
        });
      } else {
        const slot = loungeSlots.get(agent.id);
        if (slot === undefined) continue;
        const p = loungeSlotPosition(lounge, grid, slot, LOUNGE_PADDING, agent.id);
        result.push({ agent, zone, target: { x: lounge.left + p.x, y: lounge.top + p.y } });
      }
    }
    return result;
  }, [agents, rects, desks, seats, loungeSlots]);

  const deskStates = useMemo(() => {
    const states = new Map<number, AgentState>();
    for (const p of placements) if (p.desk !== undefined) states.set(p.desk, p.agent.state);
    return states;
  }, [placements]);

  return (
    <div ref={officeRef} className={styles.office}>
      <section
        ref={loungeRef}
        className={cx(styles.zone, styles.lounge)}
        aria-labelledby="lounge-title"
      >
        {rects !== null && (
          <ForestScene width={rects.lounge.width} height={rects.lounge.height} theme={theme} />
        )}
        <h2 id="lounge-title" className={styles.zoneTitle}>
          Forest <span className={styles.zoneCount}>{loungeIds.length}</span>
        </h2>
        {agents.length === 0 && (
          <p className={styles.empty}>
            Nobody here yet. Start a Claude Code session in an Orca worktree and it will show up.
          </p>
        )}
      </section>

      <section
        ref={tableRef}
        className={cx(styles.zone, styles.tableZone)}
        aria-labelledby="table-title"
      >
        {rects !== null && (
          <CityScene width={rects.table.width} height={rects.table.height} theme={theme} />
        )}
        <h2 id="table-title" className={styles.zoneTitle}>
          City <span className={styles.zoneCount}>{tableIds.length}</span>
        </h2>
      </section>

      {/* One shared stage for every character, so zone changes are a single continuous flight. */}
      <div className={styles.stage}>
        {rects !== null &&
          desks?.desks.map((d, i) => {
            const y = rects.table.top + d.y;
            return (
              <Desk
                key={i}
                x={rects.table.left + d.x}
                y={y}
                // Just in front of the worker seated here (characters use their center y).
                zIndex={Math.round(y - SEAT_ABOVE_DESK_PX) + 1}
                side={(i % desks.cols) % 2 === 0 ? 'left' : 'right'}
                item={DESK_ITEMS[hashString(`desk-${i}`) % DESK_ITEMS.length] ?? 'none'}
                state={deskStates.get(i) ?? null}
                theme={theme}
              />
            );
          })}
        <AnimatePresence>
          {placements.map((p) => (
            <Character
              key={p.agent.id}
              agent={p.agent}
              zone={p.zone}
              target={p.target}
              wanderArea={p.zone === 'lounge' ? wanderArea : null}
              selected={p.agent.id === selectedId}
              onSelect={onSelect}
            />
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
