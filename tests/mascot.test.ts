import { describe, expect, it } from 'vitest';
import { QUOTES, dailyQuote, dayNumber } from '../core/game/mascot.ts';

describe('dagens utsagn', () => {
  it('gir samme tekst hele dagen', () => {
    const morgen = new Date(2026, 8, 27, 6, 30);
    const kveld = new Date(2026, 8, 27, 23, 59);
    expect(dailyQuote(kveld)).toBe(dailyQuote(morgen));
  });

  it('gir ny tekst neste dag', () => {
    const iDag = new Date(2026, 8, 27, 12);
    const iMorgen = new Date(2026, 8, 28, 12);
    expect(dailyQuote(iMorgen)).not.toBe(dailyQuote(iDag));
  });

  it('går gjennom alle utsagnene før noen gjentas', () => {
    const sett = new Set<string>();
    for (let i = 0; i < QUOTES.length; i += 1) {
      sett.add(dailyQuote(new Date(2026, 0, 1 + i, 12)));
    }
    expect(sett.size).toBe(QUOTES.length);
  });

  it('gjentar seg først etter en hel runde', () => {
    const start = new Date(2026, 0, 1, 12);
    const enRundeSenere = new Date(2026, 0, 1 + QUOTES.length, 12);
    expect(dailyQuote(enRundeSenere)).toBe(dailyQuote(start));
  });

  it('teller døgn uavhengig av klokkeslett og tidssoneforskyvning', () => {
    // To datoer på hver side av sommertidsovergangen i Norge.
    const før = new Date(2026, 9, 24, 23, 30);
    const etter = new Date(2026, 9, 25, 0, 30);
    expect(dayNumber(etter) - dayNumber(før)).toBe(1);

    // Klokkeslettet skal ikke telle.
    expect(dayNumber(new Date(2026, 5, 3, 0, 0))).toBe(dayNumber(new Date(2026, 5, 3, 23, 59)));
  });

  it('tåler datoer langt tilbake i tid', () => {
    for (const dato of [new Date(1970, 0, 1), new Date(1965, 3, 12), new Date(2099, 11, 31)]) {
      const tekst = dailyQuote(dato);
      expect(QUOTES).toContain(tekst);
    }
  });

  it('tåler en tom utsagnsliste', () => {
    expect(dailyQuote(new Date(), [])).toBe('');
  });

  it('har utsagn som er korte nok til en snakkeboble', () => {
    for (const quote of QUOTES) {
      expect(quote.length).toBeGreaterThan(10);
      expect(quote.length, `for langt: ${quote}`).toBeLessThanOrEqual(110);
    }
  });

  it('har ingen duplikater', () => {
    expect(new Set(QUOTES).size).toBe(QUOTES.length);
  });
});
