import { useMemo, useState } from 'react';
import { dailyQuote } from '../../core/game/mascot.ts';

/**
 * Manken tegnes som en krans av sirkler rundt ansiktet. Det gir den takkete
 * silhuetten uten en håndskrevet bane som er umulig å justere etterpå.
 */
function ManeRing({ count, radius }: { count: number; radius: number }): React.JSX.Element {
  const tufts = Array.from({ length: count }, (_unused, i) => {
    const angle = (i / count) * Math.PI * 2 - Math.PI / 2;
    return {
      key: i,
      cx: 60 + Math.cos(angle) * radius,
      cy: 58 + Math.sin(angle) * radius,
    };
  });

  return (
    <g>
      {tufts.map((tuft) => (
        <circle key={tuft.key} cx={tuft.cx} cy={tuft.cy} r="11" fill="var(--manke-mork)" />
      ))}
    </g>
  );
}

function Lion(): React.JSX.Element {
  return (
    <svg viewBox="0 0 120 128" className="love" role="img" aria-label="Løven, lagmaskoten">
      {/* Drakt */}
      <path
        d="M24 128c0-16 12-26 26-29h20c14 3 26 13 26 29z"
        fill="var(--merke-600)"
      />
      <path d="M50 99h20l-10 13z" fill="#ffffff" />
      {/* Skulderstriper, slik draktene pleier å ha */}
      <path d="M30 116a30 30 0 0 1 9-13v25h-9z" fill="#ffffff" />
      <path d="M90 116a30 30 0 0 0-9-13v25h9z" fill="#ffffff" />

      {/* Ører. Tegnes før manken, men stikker utenfor den. */}
      <circle cx="25" cy="33" r="12" fill="var(--manke-mork)" />
      <circle cx="95" cy="33" r="12" fill="var(--manke-mork)" />
      <circle cx="26" cy="34" r="5.5" fill="var(--pels)" />
      <circle cx="94" cy="34" r="5.5" fill="var(--pels)" />

      <ManeRing count={13} radius={32} />
      <circle cx="60" cy="58" r="31" fill="var(--manke-lys)" />

      {/* Ansikt */}
      <circle cx="60" cy="58" r="26" fill="var(--pels)" />

      {/* Pannebånd i lagfargen */}
      <path
        d="M36 44a26 26 0 0 1 48 0 31 31 0 0 0-48 0z"
        fill="var(--merke-600)"
      />
      <rect x="57" y="31" width="6" height="12" rx="3" fill="#ffffff" opacity="0.9" />

      {/* Øyne */}
      <circle cx="50" cy="57" r="4.2" fill="var(--strek)" />
      <circle cx="70" cy="57" r="4.2" fill="var(--strek)" />
      <circle cx="51.4" cy="55.6" r="1.5" fill="#ffffff" />
      <circle cx="71.4" cy="55.6" r="1.5" fill="#ffffff" />

      {/* Snute */}
      <ellipse cx="60" cy="70" rx="15" ry="11" fill="var(--snute)" />
      <path d="M60 71l-6-5.5h12z" fill="var(--strek)" />
      <path
        d="M60 71v4m0 0a4.5 4.5 0 0 1-6-2m6 2a4.5 4.5 0 0 0 6-2"
        stroke="var(--strek)"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}

interface MascotProps {
  /** Injiseres i tester og i forhåndsvisning. */
  date?: Date;
}

export function Mascot({ date }: MascotProps): React.JSX.Element {
  const [open, setOpen] = useState(true);
  const quote = useMemo(() => dailyQuote(date ?? new Date()), [date]);

  return (
    <div className={`maskot ${open ? 'apen' : 'lukket'}`}>
      {open && (
        <div className="snakkeboble" role="status">
          <p>{quote}</p>
          <button
            type="button"
            className="boblelukk"
            onClick={() => setOpen(false)}
            aria-label="Skjul dagens utsagn"
          >
            ×
          </button>
        </div>
      )}
      <button
        type="button"
        className="maskotknapp"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? 'Skjul dagens utsagn' : 'Vis dagens utsagn'}
        title="Dagens utsagn"
      >
        <Lion />
      </button>
    </div>
  );
}
