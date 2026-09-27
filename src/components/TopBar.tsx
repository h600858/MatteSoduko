/**
 * Toppbaren i merkefargen. Ligger over alle skjermene og er stedet man
 * kommer seg videre fra, uansett hvor man er.
 */
interface TopBarProps {
  /** Null når man allerede står på hjemskjermen. */
  onHome: (() => void) | null;
  /** Null når profilen alt er åpen. */
  onShowProfile: (() => void) | null;
  /** Vises når et brett er i gang. */
  onNewBoard?: (() => void) | null;
}

export function TopBar({
  onHome,
  onShowProfile,
  onNewBoard,
}: TopBarProps): React.JSX.Element {
  return (
    <header className="toppbar">
      <button
        type="button"
        className="logo"
        onClick={() => onHome?.()}
        disabled={onHome === null}
        aria-label="Til startsiden"
      >
        <span className="logomerke" aria-hidden="true">
          <i />
          <i />
          <i />
          <i />
          <i />
          <i />
          <i />
          <i />
          <i />
        </span>
        MatteSudoku
      </button>

      <span className="fyll" />

      {onNewBoard !== null && onNewBoard !== undefined && (
        <button type="button" className="toppknapp" onClick={onNewBoard}>
          Nytt brett
        </button>
      )}
      {onShowProfile !== null && (
        <button type="button" className="toppknapp" onClick={onShowProfile}>
          Profil
        </button>
      )}
    </header>
  );
}
