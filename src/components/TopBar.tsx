/**
 * Toppbaren i merkefargen. Ligger over alle skjermene og er stedet man
 * kommer seg videre fra, uansett hvor man er.
 */
interface TopBarProps {
  /** Vises til høyre. Null skjuler knappen, f.eks. når siden alt er åpen. */
  onShowStats: (() => void) | null;
  /** Vises når et brett er i gang. */
  onNewBoard?: (() => void) | null;
}

export function TopBar({ onShowStats, onNewBoard }: TopBarProps): React.JSX.Element {
  return (
    <header className="toppbar">
      <span className="logo">
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
      </span>

      <span className="fyll" />

      {onNewBoard !== null && onNewBoard !== undefined && (
        <button type="button" className="toppknapp" onClick={onNewBoard}>
          Nytt brett
        </button>
      )}
      {onShowStats !== null && (
        <button type="button" className="toppknapp" onClick={onShowStats}>
          Profil
        </button>
      )}
    </header>
  );
}
