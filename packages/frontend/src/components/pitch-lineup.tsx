import Link from 'next/link';
import type { PredictedLineup, PredictedPlayer } from '@/lib/types';
import { cn } from '@/lib/utils';

// ── Pitch markup lines ───────────────────────────────────────────────────────
const pitchLineBase = 'absolute border-white/25 z-[1]';

function PitchLines() {
  return (
    <>
      {/* Stripes */}
      {[0, 1, 2, 3, 4, 5, 6, 7].map(i => (
        <div
          key={i}
          className="absolute left-0 right-0"
          style={{ top: `${i * 12.5}%`, height: '12.5%', background: i % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent' }}
        />
      ))}
      {/* Pitch outline */}
      <div className={cn(pitchLineBase, 'border inset-[2%]')} />
      {/* Half line */}
      <div className={cn(pitchLineBase, 'border-t')} style={{ top: '50%', left: '4%', right: '4%' }} />
      {/* Center circle */}
      <div
        className={cn(pitchLineBase, 'border rounded-full')}
        style={{ top: '50%', left: '50%', width: '18%', aspectRatio: '1', transform: 'translate(-50%, -50%)' }}
      />
      {/* Bottom penalty box (GK side) */}
      <div className={cn(pitchLineBase, 'border border-b-0')} style={{ bottom: '2%', left: '22%', right: '22%', height: '14%' }} />
      {/* Bottom goal box */}
      <div className={cn(pitchLineBase, 'border border-b-0')} style={{ bottom: '2%', left: '34%', right: '34%', height: '5%' }} />
      {/* Top penalty box */}
      <div className={cn(pitchLineBase, 'border border-t-0')} style={{ top: '2%', left: '22%', right: '22%', height: '14%' }} />
      {/* Top goal box */}
      <div className={cn(pitchLineBase, 'border border-t-0')} style={{ top: '2%', left: '34%', right: '34%', height: '5%' }} />
    </>
  );
}

// ── Player node ───────────────────────────────────────────────────────────────
function PlayerNode({ player, index }: { player: PredictedPlayer; index: number }) {
  const isRotation = player.role === 'rotation' || player.role === 'bench';
  const isSignalRecovered = !!player.signalRecovered;

  const availabilityPct = isSignalRecovered
    ? Math.round(player.signalRecovered!.predictedAvailability * 100)
    : null;

  const photoTitle = isSignalRecovered
    ? `Signal return: ${availabilityPct}% availability (${player.signalRecovered!.latestSignalStage?.replace(/_/g, ' ') ?? ''})`
    : player.recentReturn
    ? 'Recently returned from injury'
    : undefined;

  return (
    <div
      className="absolute z-[2] flex flex-col items-center gap-0.5 w-[4.5rem]"
      style={{
        left: `${player.pitchX}%`,
        top: `${100 - player.pitchY}%`,
        transform: 'translate(-50%, -50%)',
        animationDelay: `${index * 50}ms`,
      }}
    >
      {/* Slot label */}
      <span className="text-[0.5625rem] font-bold uppercase tracking-wide leading-none text-[#a8d4a0]">
        {player.slotLabel}
      </span>

      {/* Player photo */}
      <div
        title={photoTitle}
        className={cn(
          'relative w-8 h-8 rounded-full overflow-hidden bg-black/50 shrink-0',
          isSignalRecovered
            ? 'ring-2 ring-primary ring-offset-0 [outline:2px_dashed_var(--primary)]'
            : player.recentReturn
            ? 'ring-2 ring-[var(--sc-orange)]'
            : 'ring-2 ring-white/70'
        )}
      >
        {player.photo ? (
          <img src={player.photo} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-[0.625rem] text-white/70 font-semibold">
            {player.playerName.split(' ').pop()?.[0] ?? '?'}
          </div>
        )}
      </div>

      {/* Player name */}
      <Link
        href={`/player/${player.playerId}`}
        className={cn(
          'text-[0.625rem] font-semibold no-underline text-center leading-tight max-w-full truncate',
          '[text-shadow:0_1px_3px_rgba(0,0,0,0.8)]',
          isRotation ? 'text-white/65' : 'text-white/95'
        )}
      >
        {player.playerName}
      </Link>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export function PitchLineup({ lineup }: { lineup: PredictedLineup }) {
  return (
    <div
      className="relative w-full overflow-hidden rounded-lg min-w-[260px]"
      style={{
        aspectRatio: '68 / 95',
        background: 'linear-gradient(180deg, #2d6b30 0%, #1e5a22 50%, #2d6b30 100%)',
      }}
    >
      <PitchLines />

      {/* Formation label — glass effect */}
      <div className="absolute top-2 right-2 z-[3] px-1.5 py-0.5 rounded text-[0.625rem] font-bold tracking-wider text-white/50 backdrop-blur-sm bg-black/40">
        {lineup.formation}
      </div>

      {/* Players */}
      {lineup.starters.map((player, i) => (
        <PlayerNode key={player.playerId} player={player} index={i} />
      ))}
    </div>
  );
}
