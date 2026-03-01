import type { PositionGroup } from './player-weight';

// ── Specific position types ──────────────────────────────────

export type SpecificPosition =
  | 'GK'
  // Defenders
  | 'LB' | 'LCB' | 'CB' | 'RCB' | 'RB' | 'LWB' | 'RWB'
  // Midfielders
  | 'LDM' | 'CDM' | 'RDM' | 'LCM' | 'CM' | 'RCM' | 'LM' | 'RM'
  | 'LAM' | 'CAM' | 'RAM'
  // Forwards
  | 'LW' | 'RW' | 'LF' | 'CF' | 'RF' | 'LST' | 'ST' | 'RST';

export interface FormationSlot {
  row: number;
  col: number;
  specificPosition: SpecificPosition;
  positionGroup: PositionGroup;
  displayLabel: string;
  pitchX: number;  // 0-100, left→right
  pitchY: number;  // 0-100, GK(0)→attack(100)
}

// ── Position group mapping ───────────────────────────────────

const POS_TO_GROUP: Record<SpecificPosition, PositionGroup> = {
  GK: 'GK',
  LB: 'DEF', LCB: 'DEF', CB: 'DEF', RCB: 'DEF', RB: 'DEF', LWB: 'DEF', RWB: 'DEF',
  LDM: 'MID', CDM: 'MID', RDM: 'MID', LCM: 'MID', CM: 'MID', RCM: 'MID',
  LM: 'MID', RM: 'MID', LAM: 'MID', CAM: 'MID', RAM: 'MID',
  LW: 'FWD', RW: 'FWD', LF: 'FWD', CF: 'FWD', RF: 'FWD',
  LST: 'FWD', ST: 'FWD', RST: 'FWD',
};

// ── Display labels ───────────────────────────────────────────

const DISPLAY_LABEL: Record<SpecificPosition, string> = {
  GK: 'GK',
  LB: 'LB', LCB: 'CB', CB: 'CB', RCB: 'CB', RB: 'RB', LWB: 'LWB', RWB: 'RWB',
  LDM: 'DM', CDM: 'DM', RDM: 'DM',
  LCM: 'CM', CM: 'CM', RCM: 'CM', LM: 'LM', RM: 'RM',
  LAM: 'AM', CAM: 'AM', RAM: 'AM',
  LW: 'LW', RW: 'RW', LF: 'LF', CF: 'CF', RF: 'RF',
  LST: 'ST', ST: 'ST', RST: 'ST',
};

// ── Compatible positions (which positions can fill a given slot) ──

export const COMPATIBLE_POSITIONS: Record<SpecificPosition, SpecificPosition[]> = {
  GK:  ['GK'],
  // Defenders
  LB:  ['LB', 'LWB'],
  LCB: ['LCB', 'CB', 'RCB'],
  CB:  ['CB', 'LCB', 'RCB'],
  RCB: ['RCB', 'CB', 'LCB'],
  RB:  ['RB', 'RWB'],
  LWB: ['LWB', 'LB', 'LM'],
  RWB: ['RWB', 'RB', 'RM'],
  // Defensive midfield
  LDM: ['LDM', 'CDM', 'RDM', 'LCM', 'CM'],
  CDM: ['CDM', 'LDM', 'RDM', 'CM'],
  RDM: ['RDM', 'CDM', 'LDM', 'RCM', 'CM'],
  // Central midfield
  LCM: ['LCM', 'CM', 'RCM', 'LDM', 'CDM', 'LAM', 'CAM'],
  CM:  ['CM', 'LCM', 'RCM', 'CDM', 'CAM'],
  RCM: ['RCM', 'CM', 'LCM', 'RDM', 'CDM', 'RAM', 'CAM'],
  LM:  ['LM', 'LW', 'LWB', 'LAM'],
  RM:  ['RM', 'RW', 'RWB', 'RAM'],
  // Attacking midfield
  LAM: ['LAM', 'CAM', 'RAM', 'LW', 'LM', 'LCM'],
  CAM: ['CAM', 'LAM', 'RAM', 'CF', 'CM'],
  RAM: ['RAM', 'CAM', 'LAM', 'RW', 'RM', 'RCM'],
  // Forwards
  LW:  ['LW', 'LM', 'LF', 'LAM'],
  RW:  ['RW', 'RM', 'RF', 'RAM'],
  LF:  ['LF', 'LW', 'CF', 'LST', 'LAM'],
  CF:  ['CF', 'ST', 'CAM', 'LST', 'RST'],
  RF:  ['RF', 'RW', 'CF', 'RST', 'RAM'],
  LST: ['LST', 'ST', 'RST', 'CF', 'LF'],
  ST:  ['ST', 'CF', 'LST', 'RST'],
  RST: ['RST', 'ST', 'LST', 'CF', 'RF'],
};

// ── Helper to build a slot ───────────────────────────────────

function slot(
  row: number, col: number,
  pos: SpecificPosition,
  pitchX: number, pitchY: number,
): FormationSlot {
  return {
    row, col,
    specificPosition: pos,
    positionGroup: POS_TO_GROUP[pos],
    displayLabel: DISPLAY_LABEL[pos],
    pitchX, pitchY,
  };
}

// ── Formation templates ──────────────────────────────────────
// pitchX: 0=left, 100=right
// pitchY: 0=GK end, 100=attacking end

const TEMPLATES: Record<string, FormationSlot[]> = {
  '4-2-3-1': [
    slot(1, 1, 'GK',  50,  5),
    slot(2, 1, 'LB',  12, 25), slot(2, 2, 'LCB', 37, 25), slot(2, 3, 'RCB', 63, 25), slot(2, 4, 'RB',  88, 25),
    slot(3, 1, 'LDM', 37, 45), slot(3, 2, 'RDM', 63, 45),
    slot(4, 1, 'LW',  12, 65), slot(4, 2, 'CAM', 50, 65), slot(4, 3, 'RW',  88, 65),
    slot(5, 1, 'ST',  50, 88),
  ],
  '4-3-3': [
    slot(1, 1, 'GK',  50,  5),
    slot(2, 1, 'LB',  12, 25), slot(2, 2, 'LCB', 37, 25), slot(2, 3, 'RCB', 63, 25), slot(2, 4, 'RB',  88, 25),
    slot(3, 1, 'LCM', 25, 48), slot(3, 2, 'CM',  50, 48), slot(3, 3, 'RCM', 75, 48),
    slot(4, 1, 'LW',  12, 72), slot(4, 2, 'ST',  50, 80), slot(4, 3, 'RW',  88, 72),
  ],
  '3-4-2-1': [
    slot(1, 1, 'GK',  50,  5),
    slot(2, 1, 'LCB', 25, 22), slot(2, 2, 'CB',  50, 22), slot(2, 3, 'RCB', 75, 22),
    slot(3, 1, 'LWB',  8, 42), slot(3, 2, 'LCM', 37, 42), slot(3, 3, 'RCM', 63, 42), slot(3, 4, 'RWB', 92, 42),
    slot(4, 1, 'LAM', 33, 65), slot(4, 2, 'RAM', 67, 65),
    slot(5, 1, 'ST',  50, 88),
  ],
  '4-4-2': [
    slot(1, 1, 'GK',  50,  5),
    slot(2, 1, 'LB',  12, 25), slot(2, 2, 'LCB', 37, 25), slot(2, 3, 'RCB', 63, 25), slot(2, 4, 'RB',  88, 25),
    slot(3, 1, 'LM',  12, 50), slot(3, 2, 'LCM', 37, 50), slot(3, 3, 'RCM', 63, 50), slot(3, 4, 'RM',  88, 50),
    slot(4, 1, 'LST', 37, 80), slot(4, 2, 'RST', 63, 80),
  ],
  '3-5-2': [
    slot(1, 1, 'GK',  50,  5),
    slot(2, 1, 'LCB', 25, 22), slot(2, 2, 'CB',  50, 22), slot(2, 3, 'RCB', 75, 22),
    slot(3, 1, 'LWB',  8, 45), slot(3, 2, 'LCM', 30, 45), slot(3, 3, 'CM',  50, 45), slot(3, 4, 'RCM', 70, 45), slot(3, 5, 'RWB', 92, 45),
    slot(4, 1, 'LST', 37, 80), slot(4, 2, 'RST', 63, 80),
  ],
  '4-1-4-1': [
    slot(1, 1, 'GK',  50,  5),
    slot(2, 1, 'LB',  12, 25), slot(2, 2, 'LCB', 37, 25), slot(2, 3, 'RCB', 63, 25), slot(2, 4, 'RB',  88, 25),
    slot(3, 1, 'CDM', 50, 40),
    slot(4, 1, 'LM',  12, 58), slot(4, 2, 'LCM', 37, 58), slot(4, 3, 'RCM', 63, 58), slot(4, 4, 'RM',  88, 58),
    slot(5, 1, 'ST',  50, 88),
  ],
  '4-4-1-1': [
    slot(1, 1, 'GK',  50,  5),
    slot(2, 1, 'LB',  12, 25), slot(2, 2, 'LCB', 37, 25), slot(2, 3, 'RCB', 63, 25), slot(2, 4, 'RB',  88, 25),
    slot(3, 1, 'LM',  12, 46), slot(3, 2, 'LCM', 37, 46), slot(3, 3, 'RCM', 63, 46), slot(3, 4, 'RM',  88, 46),
    slot(4, 1, 'CAM', 50, 66),
    slot(5, 1, 'ST',  50, 88),
  ],
  '3-4-3': [
    slot(1, 1, 'GK',  50,  5),
    slot(2, 1, 'LCB', 25, 22), slot(2, 2, 'CB',  50, 22), slot(2, 3, 'RCB', 75, 22),
    slot(3, 1, 'LWB',  8, 45), slot(3, 2, 'LCM', 37, 45), slot(3, 3, 'RCM', 63, 45), slot(3, 4, 'RWB', 92, 45),
    slot(4, 1, 'LW',  15, 75), slot(4, 2, 'ST',  50, 82), slot(4, 3, 'RW',  85, 75),
  ],
  '5-4-1': [
    slot(1, 1, 'GK',  50,  5),
    slot(2, 1, 'LWB',  8, 25), slot(2, 2, 'LCB', 27, 22), slot(2, 3, 'CB',  50, 22), slot(2, 4, 'RCB', 73, 22), slot(2, 5, 'RWB', 92, 25),
    slot(3, 1, 'LM',  12, 50), slot(3, 2, 'LCM', 37, 50), slot(3, 3, 'RCM', 63, 50), slot(3, 4, 'RM',  88, 50),
    slot(4, 1, 'ST',  50, 82),
  ],
  '5-3-2': [
    slot(1, 1, 'GK',  50,  5),
    slot(2, 1, 'LWB',  8, 25), slot(2, 2, 'LCB', 27, 22), slot(2, 3, 'CB',  50, 22), slot(2, 4, 'RCB', 73, 22), slot(2, 5, 'RWB', 92, 25),
    slot(3, 1, 'LCM', 25, 48), slot(3, 2, 'CM',  50, 48), slot(3, 3, 'RCM', 75, 48),
    slot(4, 1, 'LST', 37, 80), slot(4, 2, 'RST', 63, 80),
  ],
  '3-4-1-2': [
    slot(1, 1, 'GK',  50,  5),
    slot(2, 1, 'LCB', 25, 22), slot(2, 2, 'CB',  50, 22), slot(2, 3, 'RCB', 75, 22),
    slot(3, 1, 'LWB',  8, 42), slot(3, 2, 'LCM', 37, 42), slot(3, 3, 'RCM', 63, 42), slot(3, 4, 'RWB', 92, 42),
    slot(4, 1, 'CAM', 50, 62),
    slot(5, 1, 'LST', 37, 82), slot(5, 2, 'RST', 63, 82),
  ],
  '3-2-4-1': [
    slot(1, 1, 'GK',  50,  5),
    slot(2, 1, 'LCB', 25, 22), slot(2, 2, 'CB',  50, 22), slot(2, 3, 'RCB', 75, 22),
    slot(3, 1, 'LDM', 37, 38), slot(3, 2, 'RDM', 63, 38),
    slot(4, 1, 'LW',  12, 58), slot(4, 2, 'LAM', 37, 58), slot(4, 3, 'RAM', 63, 58), slot(4, 4, 'RW',  88, 58),
    slot(5, 1, 'ST',  50, 82),
  ],
  '4-3-1-2': [
    slot(1, 1, 'GK',  50,  5),
    slot(2, 1, 'LB',  12, 25), slot(2, 2, 'LCB', 37, 25), slot(2, 3, 'RCB', 63, 25), slot(2, 4, 'RB',  88, 25),
    slot(3, 1, 'LCM', 25, 42), slot(3, 2, 'CM',  50, 42), slot(3, 3, 'RCM', 75, 42),
    slot(4, 1, 'CAM', 50, 60),
    slot(5, 1, 'LST', 37, 82), slot(5, 2, 'RST', 63, 82),
  ],
  '4-3-2-1': [
    slot(1, 1, 'GK',  50,  5),
    slot(2, 1, 'LB',  12, 25), slot(2, 2, 'LCB', 37, 25), slot(2, 3, 'RCB', 63, 25), slot(2, 4, 'RB',  88, 25),
    slot(3, 1, 'LCM', 25, 42), slot(3, 2, 'CM',  50, 42), slot(3, 3, 'RCM', 75, 42),
    slot(4, 1, 'LAM', 33, 62), slot(4, 2, 'RAM', 67, 62),
    slot(5, 1, 'ST',  50, 85),
  ],
  '4-5-1': [
    slot(1, 1, 'GK',  50,  5),
    slot(2, 1, 'LB',  12, 25), slot(2, 2, 'LCB', 37, 25), slot(2, 3, 'RCB', 63, 25), slot(2, 4, 'RB',  88, 25),
    slot(3, 1, 'LM',   8, 50), slot(3, 2, 'LCM', 28, 50), slot(3, 3, 'CM',  50, 50), slot(3, 4, 'RCM', 72, 50), slot(3, 5, 'RM',  92, 50),
    slot(4, 1, 'ST',  50, 82),
  ],
  '4-2-2-2': [
    slot(1, 1, 'GK',  50,  5),
    slot(2, 1, 'LB',  12, 25), slot(2, 2, 'LCB', 37, 25), slot(2, 3, 'RCB', 63, 25), slot(2, 4, 'RB',  88, 25),
    slot(3, 1, 'LDM', 37, 40), slot(3, 2, 'RDM', 63, 40),
    slot(4, 1, 'LAM', 37, 60), slot(4, 2, 'RAM', 63, 60),
    slot(5, 1, 'LST', 37, 82), slot(5, 2, 'RST', 63, 82),
  ],
  '3-5-1-1': [
    slot(1, 1, 'GK',  50,  5),
    slot(2, 1, 'LCB', 25, 22), slot(2, 2, 'CB',  50, 22), slot(2, 3, 'RCB', 75, 22),
    slot(3, 1, 'LWB',  8, 42), slot(3, 2, 'LCM', 28, 42), slot(3, 3, 'CM',  50, 42), slot(3, 4, 'RCM', 72, 42), slot(3, 5, 'RWB', 92, 42),
    slot(4, 1, 'CAM', 50, 62),
    slot(5, 1, 'ST',  50, 85),
  ],
  '3-1-4-2': [
    slot(1, 1, 'GK',  50,  5),
    slot(2, 1, 'LCB', 25, 22), slot(2, 2, 'CB',  50, 22), slot(2, 3, 'RCB', 75, 22),
    slot(3, 1, 'CDM', 50, 38),
    slot(4, 1, 'LM',  12, 55), slot(4, 2, 'LCM', 37, 55), slot(4, 3, 'RCM', 63, 55), slot(4, 4, 'RM',  88, 55),
    slot(5, 1, 'LST', 37, 80), slot(5, 2, 'RST', 63, 80),
  ],
  '4-1-3-2': [
    slot(1, 1, 'GK',  50,  5),
    slot(2, 1, 'LB',  12, 25), slot(2, 2, 'LCB', 37, 25), slot(2, 3, 'RCB', 63, 25), slot(2, 4, 'RB',  88, 25),
    slot(3, 1, 'CDM', 50, 40),
    slot(4, 1, 'LCM', 25, 55), slot(4, 2, 'CM',  50, 55), slot(4, 3, 'RCM', 75, 55),
    slot(5, 1, 'LST', 37, 80), slot(5, 2, 'RST', 63, 80),
  ],
  '4-2-4': [
    slot(1, 1, 'GK',  50,  5),
    slot(2, 1, 'LB',  12, 25), slot(2, 2, 'LCB', 37, 25), slot(2, 3, 'RCB', 63, 25), slot(2, 4, 'RB',  88, 25),
    slot(3, 1, 'LDM', 37, 45), slot(3, 2, 'RDM', 63, 45),
    slot(4, 1, 'LW',  12, 72), slot(4, 2, 'LST', 37, 78), slot(4, 3, 'RST', 63, 78), slot(4, 4, 'RW',  88, 72),
  ],
};

// ── Dynamic derivation for unknown formations ────────────────

/**
 * Derive specific position from grid coordinate and formation string.
 * Used as fallback when no pre-defined template exists.
 */
function deriveDefRow(colCount: number, col: number): SpecificPosition {
  if (colCount === 3) return ([  'LCB', 'CB', 'RCB'] as SpecificPosition[])[col - 1] ?? 'CB';
  if (colCount === 4) return (['LB', 'LCB', 'RCB', 'RB'] as SpecificPosition[])[col - 1] ?? 'CB';
  if (colCount === 5) return (['LWB', 'LCB', 'CB', 'RCB', 'RWB'] as SpecificPosition[])[col - 1] ?? 'CB';
  return 'CB';
}

function deriveMidRow(colCount: number, col: number, isWide: boolean): SpecificPosition {
  if (colCount === 1) return isWide ? 'CDM' : 'CM';
  if (colCount === 2) {
    return isWide
      ? (['LDM', 'RDM'] as SpecificPosition[])[col - 1] ?? 'CDM'
      : (['LCM', 'RCM'] as SpecificPosition[])[col - 1] ?? 'CM';
  }
  if (colCount === 3) return (['LCM', 'CM', 'RCM'] as SpecificPosition[])[col - 1] ?? 'CM';
  if (colCount === 4) return (['LM', 'LCM', 'RCM', 'RM'] as SpecificPosition[])[col - 1] ?? 'CM';
  if (colCount === 5) return (['LWB', 'LCM', 'CM', 'RCM', 'RWB'] as SpecificPosition[])[col - 1] ?? 'CM';
  return 'CM';
}

function deriveFwdRow(colCount: number, col: number): SpecificPosition {
  if (colCount === 1) return 'ST';
  if (colCount === 2) return (['LST', 'RST'] as SpecificPosition[])[col - 1] ?? 'ST';
  if (colCount === 3) return (['LW', 'ST', 'RW'] as SpecificPosition[])[col - 1] ?? 'ST';
  if (colCount === 4) return (['LW', 'LST', 'RST', 'RW'] as SpecificPosition[])[col - 1] ?? 'ST';
  return 'ST';
}

function spreadX(colCount: number, col: number): number {
  if (colCount === 1) return 50;
  // Spread from 12 to 88
  const margin = 12;
  return margin + ((col - 1) / (colCount - 1)) * (100 - 2 * margin);
}

function buildDynamicTemplate(formation: string): FormationSlot[] {
  const segments = formation.split('-').map(Number).filter(n => !isNaN(n) && n > 0);
  if (segments.length < 2) return TEMPLATES['4-4-2'];

  const total = segments.reduce((a, b) => a + b, 0);
  if (total !== 10) return TEMPLATES['4-4-2'];

  const totalRows = segments.length;
  const slots: FormationSlot[] = [];

  // GK always row 1
  slots.push(slot(1, 1, 'GK', 50, 5));

  // Distribute Y across rows: row 2 (DEF) to row N+1 (FWD)
  const yStart = 22;
  const yEnd = 85;

  for (let segIdx = 0; segIdx < totalRows; segIdx++) {
    const colCount = segments[segIdx];
    const row = segIdx + 2;
    const y = totalRows === 1
      ? 50
      : yStart + (segIdx / (totalRows - 1)) * (yEnd - yStart);

    const isFwdRow = segIdx === totalRows - 1;
    const isDefRow = segIdx === 0;
    // A row is "wide" if it's adjacent to defense (first mid row)
    const isWide = segIdx === 1 && !isFwdRow;

    for (let c = 1; c <= colCount; c++) {
      const x = spreadX(colCount, c);
      let pos: SpecificPosition;

      if (isDefRow) {
        pos = deriveDefRow(colCount, c);
      } else if (isFwdRow) {
        pos = deriveFwdRow(colCount, c);
      } else {
        pos = deriveMidRow(colCount, c, isWide);
      }

      slots.push(slot(row, c, pos, Math.round(x), Math.round(y)));
    }
  }

  return slots;
}

// ── Public API ───────────────────────────────────────────────

/**
 * Get the formation template for a given formation string.
 * Returns a pre-defined template if available, otherwise builds one dynamically.
 */
export function getFormationTemplate(formation: string): FormationSlot[] {
  return TEMPLATES[formation] ?? buildDynamicTemplate(formation);
}

/**
 * Resolve specific position from a grid coordinate and formation.
 * Grid format: "row:col" (e.g., "2:4" = row 2, column 4).
 */
export function resolveGridPosition(
  formation: string,
  grid: string,
): SpecificPosition | null {
  if (!grid) return null;
  const parts = grid.split(':').map(Number);
  if (parts.length !== 2 || isNaN(parts[0]) || isNaN(parts[1])) return null;

  const [row, col] = parts;
  const template = getFormationTemplate(formation);
  const matched = template.find(s => s.row === row && s.col === col);
  return matched?.specificPosition ?? null;
}

/**
 * Check if a candidate position can fill a given slot.
 * Returns an affinity score (0 = incompatible, higher = better fit).
 */
export function positionAffinityForSlot(
  candidatePosition: SpecificPosition,
  slotPosition: SpecificPosition,
): number {
  if (candidatePosition === slotPosition) return 1.0;
  const compatible = COMPATIBLE_POSITIONS[slotPosition];
  if (compatible && compatible.includes(candidatePosition)) return 0.85;
  // Check if same position group
  if (POS_TO_GROUP[candidatePosition] === POS_TO_GROUP[slotPosition]) return 0.4;
  return 0.0;
}
