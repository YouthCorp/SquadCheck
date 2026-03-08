'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

interface TeamGroup {
  leagueId: number;
  leagueName: string;
  teams: { id: number; name: string }[];
}

interface MatchupSelectorProps {
  teamsByLeague: TeamGroup[];
  currentHomeId: number | null;
  currentAwayId: number | null;
  locale: string;
}

export function MatchupSelector({
  teamsByLeague,
  currentHomeId,
  currentAwayId,
  locale,
}: MatchupSelectorProps) {
  const router = useRouter();
  const [homeId, setHomeId] = useState<string>(currentHomeId?.toString() ?? '');
  const [awayId, setAwayId] = useState<string>(currentAwayId?.toString() ?? '');

  function handleCompare() {
    if (homeId && awayId) {
      router.push(`/matchup?home=${homeId}&away=${awayId}`);
    }
  }

  function swapTeams() {
    const tmp = homeId;
    setHomeId(awayId);
    setAwayId(tmp);
  }

  const selectStyle: React.CSSProperties = {
    width: '100%',
    padding: '0.625rem 0.75rem',
    background: 'var(--cds-layer-01, #262626)',
    border: '1px solid var(--cds-border-subtle-01, #393939)',
    color: 'var(--cds-text-primary, #f4f4f4)',
    fontSize: '0.875rem',
    borderRadius: 0,
    cursor: 'pointer',
    outline: 'none',
    appearance: 'none',
    WebkitAppearance: 'none',
  };

  const labelStyle: React.CSSProperties = {
    fontSize: '0.6875rem',
    fontWeight: 600,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: 'var(--cds-text-helper, #8d8d8d)',
    marginBottom: '0.375rem',
    display: 'block',
  };

  return (
    <div style={{
      background: 'var(--cds-layer-01, #262626)',
      border: '1px solid var(--cds-border-subtle-01, #393939)',
      padding: '1.25rem 1rem',
    }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr auto', gap: '0.75rem', alignItems: 'end' }}>
        {/* Home team */}
        <div>
          <label style={labelStyle}>
            {locale === 'ko' ? '홈 팀' : 'Home Team'}
          </label>
          <div style={{ position: 'relative' }}>
            <select
              value={homeId}
              onChange={(e) => setHomeId(e.target.value)}
              style={selectStyle}
            >
              <option value="">{locale === 'ko' ? '팀 선택…' : 'Select a team…'}</option>
              {teamsByLeague.map((group) => (
                <optgroup key={group.leagueId} label={group.leagueName}>
                  {group.teams.map((team) => (
                    <option key={team.id} value={team.id}>
                      {team.name}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
            <div style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--cds-text-helper, #8d8d8d)', fontSize: '0.75rem' }}>▾</div>
          </div>
        </div>

        {/* Swap button */}
        <button
          onClick={swapTeams}
          title={locale === 'ko' ? '팀 교체' : 'Swap teams'}
          style={{
            background: 'var(--cds-layer-02, #393939)',
            border: '1px solid var(--cds-border-subtle-01, #393939)',
            color: 'var(--cds-text-secondary, #c6c6c6)',
            padding: '0.625rem 0.75rem',
            cursor: 'pointer',
            fontSize: '1rem',
            borderRadius: 0,
          }}
        >
          ⇄
        </button>

        {/* Away team */}
        <div>
          <label style={labelStyle}>
            {locale === 'ko' ? '원정 팀' : 'Away Team'}
          </label>
          <div style={{ position: 'relative' }}>
            <select
              value={awayId}
              onChange={(e) => setAwayId(e.target.value)}
              style={selectStyle}
            >
              <option value="">{locale === 'ko' ? '팀 선택…' : 'Select a team…'}</option>
              {teamsByLeague.map((group) => (
                <optgroup key={group.leagueId} label={group.leagueName}>
                  {group.teams.map((team) => (
                    <option key={team.id} value={team.id}>
                      {team.name}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
            <div style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--cds-text-helper, #8d8d8d)', fontSize: '0.75rem' }}>▾</div>
          </div>
        </div>

        {/* Compare button */}
        <button
          onClick={handleCompare}
          disabled={!homeId || !awayId || homeId === awayId}
          style={{
            padding: '0.625rem 1.25rem',
            background: homeId && awayId && homeId !== awayId
              ? 'var(--cds-interactive, #0f62fe)'
              : 'var(--cds-layer-02, #393939)',
            border: 'none',
            color: homeId && awayId && homeId !== awayId
              ? '#fff'
              : 'var(--cds-text-helper, #8d8d8d)',
            fontSize: '0.875rem',
            fontWeight: 600,
            cursor: homeId && awayId && homeId !== awayId ? 'pointer' : 'not-allowed',
            borderRadius: 0,
            whiteSpace: 'nowrap',
          }}
        >
          {locale === 'ko' ? '비교하기' : 'Compare'}
        </button>
      </div>

      {homeId && awayId && homeId === awayId && (
        <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: '#f1c21b' }}>
          {locale === 'ko' ? '같은 팀을 선택했습니다' : 'Please select two different teams'}
        </div>
      )}
    </div>
  );
}
