/**
 * Maskotens utsagn.
 *
 * Ett utsagn per dag, det samme hele dagen, og et nytt i morgen. Valget er en
 * ren funksjon av datoen, så det ikke trengs verken lagring eller tilfeldighet
 * for å holde det stabilt gjennom dagen.
 *
 * Utsagnene går i fast rekkefølge i stedet for å trekkes tilfeldig. Da kommer
 * alle med før noen gjentas.
 */

export const QUOTES: readonly string[] = [
  'Du blir ikke bedre av å løse det du allerede kan.',
  'Feil svar er data. Noter hva som glapp, og gå videre.',
  'Ett brett i dag slår ti brett kvelden før eksamen.',
  'Den som regner sakte og riktig, regner fort til slutt.',
  'Du trenger ikke være rask. Du trenger å være ferdig.',
  'Hver celle du fyller er én du slipper å frykte senere.',
  'Sitter du fast, er det der læringen skjer.',
  'Et hint i dag er ett du ikke trenger i morgen.',
  'Det som føles tungt nå, blir rutine om to uker.',
  'Regn ut det du kan først. Resten løsner ofte av seg selv.',
  'Ingen har skjønt derivasjon på første forsøk. Ingen.',
  'Ta pauser. Hjernen jobber videre uten deg.',
  'Bedre å forstå én oppgave enn å gjette på ti.',
  'Du konkurrerer mot deg selv i forrige uke.',
  'Skriv ned mellomregningen. Hodet ditt jukser.',
  'Litt hver dag er den kjedelige metoden som faktisk virker.',
  'Tvil er ikke et tegn på at du er dårlig. Det er et tegn på at du tenker.',
  'Du har løst vanskeligere ting enn dette før.',
  'Sjekk svaret. Det tar fem sekunder og redder mange poeng.',
  'Et halvferdig brett er bedre enn et uåpnet et.',
  'Fart kommer gratis når forståelsen sitter.',
  'Les oppgaven én gang til. Svaret ligger ofte i teksten.',
  'Den beste tiden å begynne var i går. Den nest beste er nå.',
  'Ikke sammenlign kapittel tre av din reise med kapittel ti av noen andres.',
  'Å stå fast i ti minutter er billigere enn å hoppe over i ti uker.',
  'Rutine slår motivasjon. Motivasjon kommer og går.',
  'Du husker det du har slitt med. Ikke det du bare leste.',
  'Gjør den vanskeligste oppgaven først, mens du er uthvilt.',
  'Ingen ser på tiden din. Bare at du møtte opp.',
  'Fremgang er sjelden noe du merker mens den skjer.',
  'Regn med penn. Skjermen tilgir for lett.',
  'Du er nærmere enn du tror. Det er derfor det er tungt.',
];

/**
 * Antall døgn siden epoken, regnet ut fra den lokale kalenderdatoen.
 *
 * Date.UTC brukes med vilje: tidssonen skal ikke kunne skyve to påfølgende
 * datoer inn i samme døgn ved sommertidsovergang.
 */
export function dayNumber(date: Date): number {
  return Math.floor(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86_400_000,
  );
}

/** Dagens utsagn. Samme dato gir alltid samme tekst. */
export function dailyQuote(date: Date, quotes: readonly string[] = QUOTES): string {
  if (quotes.length === 0) return '';
  const index = ((dayNumber(date) % quotes.length) + quotes.length) % quotes.length;
  return quotes[index] ?? '';
}
