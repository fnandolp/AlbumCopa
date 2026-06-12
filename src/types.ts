/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Sticker {
  id: string;        // e.g. "MEX1", "00", "FWC4", "CC1"
  label: string;     // e.g. "00", "MEX 1", "FWC 4", "CC 1"
  section: string;   // e.g. "Capa", "Fls. 1", "Espanha"
  page: number;      // e.g. 8, 10
  row: number;       // For visual layout (0-2)
  col: number;       // For visual layout (0-3)
  isLeftPage: boolean; // Left double page vs. right double page
}

export interface CountryDef {
  code: string;
  name: string;
  page: number;
}

export interface AlbumState {
  albumCode: string | null;
  glued: Record<string, boolean>;     // stickerId -> isGlued (colada)
  repeated: Record<string, number>;  // stickerId -> count of duplicates (repetidas)
  updatedAt: string | null;           // Date string
}

export interface SystemStats {
  total: number;
  gluedCount: number;
  missingCount: number;
  repeatedCount: number;
  percentage: number;
}
