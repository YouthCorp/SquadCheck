import Link from 'next/link';
import type { PredictedLineup, PredictedPlayer } from '@/lib/types';

// ── Pitch lineup visualization ───────────────────────────────────────────────

function PlayerNode({ player }: { player: PredictedPlayer }) {
  const isRotation = player.role === 'rotation' || player.role === 'bench';
  const isSignalRecovered = !!player.signalRecovered;

  // Border: signal-recovered (blue dashed) > recentReturn (orange) > default (white)
  const photoBorder = isSignalRecovered
    ? '2px dashed #4589ff'
    : player.recentReturn
    ? '2px solid #ff832b'
    : '2px solid rgba(255,255,255,0.7)';

  const availabilityPct = isSignalRecovered
    ? Math.round(player.signalRecovered!.predictedAvailability * 100)
    : null;

  return (
    <div
      style={{
        position: 'absolute',
        left: `${player.pitchX}%`,
        top: `${100 - player.pitchY}%`,
        transform: 'translate(-50%, -50%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '0.125rem',
        zIndex: 2,
        width: '4.5rem',
      }}
    >
      {/* Slot label */}
      <span
        style={{
          fontSize: '0.5625rem',
          fontWeight: 700,
          color: '#a8d4a0',
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
          lineHeight: 1,
        }}
      >
        {player.slotLabel}
      </span>

      {/* Player photo */}
      <div
        title={
          isSignalRecovered
            ? `Signal return: ${availabilityPct}% availability (${player.signalRecovered!.latestSignalStage?.replace(/_/g, ' ') ?? ''})`
            : player.recentReturn
            ? 'Recently returned from injury'
            : undefined
        }
        style={{
          position: 'relative',
          width: '2rem',
          height: '2rem',
          borderRadius: '50%',
          overflow: 'hidden',
          border: photoBorder,
          background: 'rgba(0,0,0,0.5)',
          flexShrink: 0,
        }}
      >
        {player.photo ? (
          <img
            src={player.photo}
            alt=""
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
            }}
          />
        ) : (
          <div
            style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '0.625rem',
              color: 'rgba(255,255,255,0.7)',
              fontWeight: 600,
            }}
          >
            {player.playerName.split(' ').pop()?.[0] ?? '?'}
          </div>
        )}
      </div>

      {/* Player name */}
      <Link
        href={`/player/${player.playerId}`}
        style={{
          fontSize: '0.625rem',
          fontWeight: 600,
          color: isRotation ? 'rgba(255,255,255,0.65)' : 'rgba(255,255,255,0.95)',
          textDecoration: 'none',
          textAlign: 'center',
          lineHeight: 1.2,
          maxWidth: '100%',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          textShadow: '0 1px 3px rgba(0,0,0,0.8)',
        }}
      >
        {player.playerName}
      </Link>
    </div>
  );
}

export function PitchLineup({ lineup }: { lineup: PredictedLineup }) {
  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        aspectRatio: '68 / 95',
        background: 'linear-gradient(180deg, #2d6b30 0%, #1e5a22 50%, #2d6b30 100%)',
        borderRadius: '0.5rem',
        overflow: 'hidden',
        minWidth: '260px',
      }}
    >
      {/* Pitch stripes (alternating shade) */}
      {[0, 1, 2, 3, 4, 5, 6, 7].map(i => (
        <div
          key={i}
          style={{
            position: 'absolute',
            top: `${i * 12.5}%`,
            left: 0,
            right: 0,
            height: '12.5%',
            background: i % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent',
          }}
        />
      ))}

      {/* Pitch outline */}
      <div
        style={{
          position: 'absolute',
          top: '2%',
          left: '4%',
          right: '4%',
          bottom: '2%',
          border: '1px solid rgba(255,255,255,0.25)',
          zIndex: 1,
        }}
      />

      {/* Half line */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '4%',
          right: '4%',
          height: '1px',
          background: 'rgba(255,255,255,0.25)',
          zIndex: 1,
        }}
      />

      {/* Center circle */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          width: '18%',
          aspectRatio: '1',
          transform: 'translate(-50%, -50%)',
          border: '1px solid rgba(255,255,255,0.25)',
          borderRadius: '50%',
          zIndex: 1,
        }}
      />

      {/* Bottom penalty box (GK side) */}
      <div
        style={{
          position: 'absolute',
          bottom: '2%',
          left: '22%',
          right: '22%',
          height: '14%',
          border: '1px solid rgba(255,255,255,0.25)',
          borderBottom: 'none',
          zIndex: 1,
        }}
      />

      {/* Bottom goal box */}
      <div
        style={{
          position: 'absolute',
          bottom: '2%',
          left: '34%',
          right: '34%',
          height: '5%',
          border: '1px solid rgba(255,255,255,0.25)',
          borderBottom: 'none',
          zIndex: 1,
        }}
      />

      {/* Top penalty box (attack side) */}
      <div
        style={{
          position: 'absolute',
          top: '2%',
          left: '22%',
          right: '22%',
          height: '14%',
          border: '1px solid rgba(255,255,255,0.25)',
          borderTop: 'none',
          zIndex: 1,
        }}
      />

      {/* Top goal box */}
      <div
        style={{
          position: 'absolute',
          top: '2%',
          left: '34%',
          right: '34%',
          height: '5%',
          border: '1px solid rgba(255,255,255,0.25)',
          borderTop: 'none',
          zIndex: 1,
        }}
      />

      {/* Formation label */}
      <div
        style={{
          position: 'absolute',
          top: '0.5rem',
          right: '0.5rem',
          fontSize: '0.625rem',
          fontWeight: 700,
          color: 'rgba(255,255,255,0.5)',
          zIndex: 3,
          letterSpacing: '0.08em',
        }}
      >
        {lineup.formation}
      </div>

      {/* Players */}
      {lineup.starters.map(player => (
        <PlayerNode key={player.playerId} player={player} />
      ))}
    </div>
  );
}
