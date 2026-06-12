/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { CountryDef, Sticker } from "./types";

export const FLAG_MAP: Record<string, string> = {
  MEX: "🇲🇽", RSA: "🇿🇦", KOR: "🇰🇷", CZE: "🇨🇿", CAN: "🇨🇦", BIH: "🇧🇦", QAT: "🇶🇦", SUI: "🇨🇭",
  BRA: "🇧🇷", MAR: "🇲🇦", HAI: "🇭🇹", SCO: "🏴󠁧󠁢󠁳󠁣󠁴󠁿", USA: "🇺🇸", PAR: "🇵🇾", AUS: "🇦🇺", TUR: "🇹🇷",
  GER: "🇩🇪", CUW: "🇨🇼", CIV: "🇨🇮", ECU: "🇪🇨", NED: "🇳🇱", JPN: "🇯🇵", SWE: "🇸🇪", TUN: "🇹🇳",
  BEL: "🇧🇪", EGY: "🇪🇬", IRN: "🇮🇷", NZL: "🇳🇿", ESP: "🇪🇸", CPV: "🇨🇻", KSA: "🇸🇦", URU: "🇺🇾",
  FRA: "🇫🇷", SEN: "🇸🇳", IRQ: "🇮🇶", NOR: "🇳🇴", ARG: "🇦🇷", ALG: "🇩🇿", AUT: "🇦🇹", JOR: "🇯🇴",
  POR: "🇵🇹", COD: "🇨🇩", UZB: "🇺🇿", COL: "🇨🇴", ENG: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", CRO: "🇭🇷", GHA: "🇬🇭", PAN: "🇵🇦"
};

export function getCountryDisplaySection(code: string, name: string): string {
  const flag = FLAG_MAP[code] || "🏳️";
  return `${code} ${name.toUpperCase()} ${flag}`;
}

export const COUNTRIES: CountryDef[] = [
  { code: "MEX", name: "México", page: 8 },
  { code: "RSA", name: "África do Sul", page: 10 },
  { code: "KOR", name: "Coreia do Sul", page: 12 },
  { code: "CZE", name: "República Tcheca", page: 14 },
  { code: "CAN", name: "Canadá", page: 16 },
  { code: "BIH", name: "Bósnia e Herzegovina", page: 18 },
  { code: "QAT", name: "Catar", page: 20 },
  { code: "SUI", name: "Suíça", page: 22 },
  { code: "BRA", name: "Brasil", page: 24 },
  { code: "MAR", name: "Marrocos", page: 26 },
  { code: "HAI", name: "Haiti", page: 28 },
  { code: "SCO", name: "Escócia", page: 30 },
  { code: "USA", name: "Estados Unidos", page: 32 },
  { code: "PAR", name: "Paraguai", page: 34 },
  { code: "AUS", name: "Austrália", page: 36 },
  { code: "TUR", name: "Turquia", page: 38 },
  { code: "GER", name: "Alemanha", page: 40 },
  { code: "CUW", name: "Curaçao", page: 42 },
  { code: "CIV", name: "Costa do Marfim", page: 44 },
  { code: "ECU", name: "Equador", page: 46 },
  { code: "NED", name: "Holanda", page: 48 },
  { code: "JPN", name: "Japão", page: 50 },
  { code: "SWE", name: "Suécia", page: 52 },
  { code: "TUN", name: "Tunísia", page: 54 },
  { code: "BEL", name: "Bélgica", page: 58 },
  { code: "EGY", name: "Egito", page: 60 },
  { code: "IRN", name: "Irã", page: 62 },
  { code: "NZL", name: "Nova Zelândia", page: 64 },
  { code: "ESP", name: "Espanha", page: 66 },
  { code: "CPV", name: "Cabo Verde", page: 68 },
  { code: "KSA", name: "Arábia Saudita", page: 70 },
  { code: "URU", name: "Uruguai", page: 72 },
  { code: "FRA", name: "França", page: 74 },
  { code: "SEN", name: "Senegal", page: 76 },
  { code: "IRQ", name: "Iraque", page: 78 },
  { code: "NOR", name: "Noruega", page: 80 },
  { code: "ARG", name: "Argentina", page: 82 },
  { code: "ALG", name: "Argélia", page: 84 },
  { code: "AUT", name: "Áustria", page: 86 },
  { code: "JOR", name: "Jordânia", page: 88 },
  { code: "POR", name: "Portugal", page: 90 },
  { code: "COD", name: "RD Congo", page: 92 },
  { code: "UZB", name: "Uzbequistão", page: 94 },
  { code: "COL", name: "Colômbia", page: 96 },
  { code: "ENG", name: "Inglaterra", page: 98 },
  { code: "CRO", name: "Croácia", page: 100 },
  { code: "GHA", name: "Gana", page: 102 },
  { code: "PAN", name: "Panamá", page: 104 }
];

export function getStickersList(): Sticker[] {
  const stickers: Sticker[] = [];

  // 1. Capa / 00 (1 figurinha - logo panini)
  stickers.push({
    id: "00",
    label: "00",
    section: "Capa",
    page: 4, // Page 4 is standard for cover/inside
    row: 1,
    col: 1,
    isLeftPage: true
  });

  // 2. Fls. 1 / FWC1-FWC4 (4 figurinhas)
  for (let i = 1; i <= 4; i++) {
    const isLeft = i <= 2;
    stickers.push({
      id: `FWC${i}`,
      label: `FWC ${i}`,
      section: "Fls. 1",
      page: 5,
      row: isLeft ? 1 : 2,
      col: i % 2 === 1 ? 1 : 2,
      isLeftPage: true
    });
  }

  // 3. Fls. 2-3 / FWC5-FWC8 (4 figurinhas)
  for (let i = 5; i <= 8; i++) {
    const isLeft = i <= 6;
    stickers.push({
      id: `FWC${i}`,
      label: `FWC ${i}`,
      section: "Fls. 2-3",
      page: isLeft ? 6 : 7,
      row: 1,
      col: i % 2 === 1 ? 1 : 2,
      isLeftPage: isLeft
    });
  }

  // 4. Países (MEX 8 até PAN 104)
  COUNTRIES.forEach((c) => {
    const basePage = c.page;

    // Left page (10 figs, MEX 1-10)
    // XXOO / OOOO / OOOO
    // Let's place MEX1 to MEX10
    let leftCount = 0;
    for (let r = 0; r < 3; r++) {
      for (let col = 0; col < 4; col++) {
        // Skip XX on Row 0 (col 0 and col 1)
        if (r === 0 && (col === 0 || col === 1)) {
          continue;
        }
        leftCount++;
        stickers.push({
          id: `${c.code}${leftCount}`,
          label: `${c.code} ${leftCount}`,
          section: getCountryDisplaySection(c.code, c.name),
          page: basePage,
          row: r,
          col: col,
          isLeftPage: true
        });
      }
    }

    // Right page (10 figs, MEX 11-20)
    // OOOX / OOOO / XOOO
    let rightCount = 10;
    for (let r = 0; r < 3; r++) {
      for (let col = 0; col < 4; col++) {
        // Skip X on Row 0 (col 3)
        if (r === 0 && col === 3) {
          continue;
        }
        // Skip X on Row 2 (col 0)
        if (r === 2 && col === 0) {
          continue;
        }
        rightCount++;
        stickers.push({
          id: `${c.code}${rightCount}`,
          label: `${c.code} ${rightCount}`,
          section: getCountryDisplaySection(c.code, c.name),
          page: basePage + 1,
          row: r,
          col: col,
          isLeftPage: false
        });
      }
    }
  });

  // 5. FIFA WORLD CUP HISTORY
  // FWC9-FWC13 / Fls. 106-107 (5 figurinhas)
  for (let i = 9; i <= 13; i++) {
    const isLeft = i <= 11;
    stickers.push({
      id: `FWC${i}`,
      label: `FWC ${i}`,
      section: "História FWC",
      page: isLeft ? 106 : 107,
      row: isLeft ? (i === 11 ? 2 : 1) : 1,
      col: i % 2 === 1 ? 1 : 2,
      isLeftPage: isLeft
    });
  }

  // FWC14-FWC19 / Fls. 108-109 (6 figurinhas)
  for (let i = 14; i <= 19; i++) {
    const isLeft = i <= 16;
    stickers.push({
      id: `FWC${i}`,
      label: `FWC ${i}`,
      section: "História FWC",
      page: isLeft ? 108 : 109,
      row: isLeft ? (i - 14) % 3 : (i - 17) % 3,
      col: isLeft ? 1 : 2,
      isLeftPage: isLeft
    });
  }

  // 6. Contracapa CC1-CC14 (14 figurinhas)
  for (let i = 1; i <= 14; i++) {
    const isLeft = i <= 7;
    stickers.push({
      id: `CC${i}`,
      label: `CC ${i}`,
      section: "Coca-Cola",
      page: isLeft ? 110 : 111,
      row: isLeft ? Math.floor((i - 1) / 3) : Math.floor((i - 8) / 3),
      col: isLeft ? (i - 1) % 3 + 1 : (i - 8) % 3 + 1,
      isLeftPage: isLeft
    });
  }

  return stickers;
}
