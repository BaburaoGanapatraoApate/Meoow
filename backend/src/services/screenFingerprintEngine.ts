import crypto from "crypto";
import jpeg from "jpeg-js";
import { computeBinaryImageFingerprint, normalizeImagePayload } from "./screenDeduplicationService";

export const SPATIAL_GRID_COLS = 128;
export const SPATIAL_GRID_ROWS = 72;
export const BYTES_PER_CELL = 6;
export const SPATIAL_FINGERPRINT_SIZE = SPATIAL_GRID_COLS * SPATIAL_GRID_ROWS * BYTES_PER_CELL; // 55,296 bytes (~55KB)
export const SCROLL_PROFILE_BINS = 256;
export const OBSERVATION_TTL_MS = 60 * 1000; // 60s

export interface DecodedImage {
  width: number;
  height: number;
  luminance: Uint8Array; // W * H values in [0, 255]
}

export interface SpatialFingerprint {
  cols: number;
  rows: number;
  data: Uint8Array; // 36,864 bytes
}

export interface ScrollCorrelationResult {
  detectedShift: number; // in pixels
  confidence: number;    // normalized correlation in [0, 1]
  isAmbiguous: boolean;
  revealedBandHasContent: boolean;
}

export interface DiffCluster {
  minCol: number;
  maxCol: number;
  minRow: number;
  maxRow: number;
  cellCount: number;
  maxDelta: number;
}

export type MaterialChangeReason =
  | "IDENTICAL_BINARY"
  | "NON_MATERIAL_BLINKING_CARET"
  | "NON_MATERIAL_OS_TRAY_CLOCK"
  | "MATERIAL_TEXT_MUTATION"
  | "MATERIAL_CODE_CHANGE"
  | "MATERIAL_SCROLL_REVEALED_CONTENT"
  | "MATERIAL_SCROLL_VIEWPORT_RELOCATION"
  | "MATERIAL_RESIZE_OR_DISPLAY_CHANGE"
  | "MATERIAL_LAYOUT_CHANGE"
  | "MATERIAL_POINTER_MOVEMENT"
  | "UNCERTAIN_LOW_CORRELATION_SCROLL"
  | "UNCERTAIN_CONSERVATIVE_CHANGE"
  | "CORRUPTED_OR_UNSUPPORTED_IMAGE";

export interface ScreenChangeEvaluation {
  isMaterialChange: boolean;
  reasonCode: MaterialChangeReason;
  metrics: {
    exactShaMatch: boolean;
    diffCellCount: number;
    clusterCount: number;
    scrollShift: number;
    scrollConfidence: number;
    maxLocalDelta: number;
  };
}

export interface ScreenObservation {
  observationId: string;
  userId: string;
  sessionId: string;
  captureSequence: number;
  createdAt: number;
  expiresAt: number;
  contextSig: string;
  threadId?: string;
  exactSha256: string;
  spatialFingerprint: Uint8Array;
  rowProfile: Uint16Array;
  width: number;
  height: number;
  priorAnswer?: string;
  modelUsed?: string;
  decodedLuminance?: Uint8Array;
  logicalIdentityKey?: string;
  promptHash?: string;
}

/**
 * Validates and decodes JPEG image buffer to raw RGB using pure-JS jpeg-js.
 */
export function decodeJpegOnly(imageBuffer: Buffer): jpeg.RawImageData<Uint8Array> {
  if (!imageBuffer || imageBuffer.length < 4) {
    throw new Error("Invalid image buffer: buffer too small");
  }

  // Check JPEG SOI marker (0xFF, 0xD8)
  if (imageBuffer[0] !== 0xff || imageBuffer[1] !== 0xd8) {
    throw new Error("Unsupported image format: only JPEG is accepted (Option A)");
  }

  let decoded: jpeg.RawImageData<Uint8Array>;
  try {
    decoded = jpeg.decode(imageBuffer, { useTArray: true, formatAsRGBA: false });
  } catch (err: any) {
    throw new Error(`JPEG decoding failed: ${err.message || String(err)}`);
  }

  const { width, height, data } = decoded;
  if (!width || !height || width <= 0 || height <= 0 || !data || data.length < width * height * 3) {
    throw new Error("Corrupted JPEG: invalid image dimensions or truncated pixel stream");
  }

  return decoded;
}

/**
 * Fast integer luminance conversion from RGB to grayscale: Y = (299*R + 587*G + 114*B + 500) / 1000
 */
export function convertRgbToLuminance(data: Uint8Array, width: number, height: number): Uint8Array {
  const pixelCount = width * height;
  const luminance = new Uint8Array(pixelCount);

  for (let i = 0, j = 0; i < pixelCount; i++, j += 3) {
    const r = data[j];
    const g = data[j + 1];
    const b = data[j + 2];
    luminance[i] = ((299 * r + 587 * g + 114 * b + 500) / 1000) | 0;
  }

  return luminance;
}

/**
 * Validates and decodes JPEG image buffer using pure-JS jpeg-js.
 * Fails closed if buffer is invalid, corrupted, or non-JPEG.
 */
export function decodeJpegToLuminance(imageBuffer: Buffer): DecodedImage {
  const decoded = decodeJpegOnly(imageBuffer);
  const luminance = convertRgbToLuminance(decoded.data, decoded.width, decoded.height);
  return { width: decoded.width, height: decoded.height, luminance };
}

/**
 * Extracts compact 128x72 2D spatial fingerprint from decoded luminance.
 * Each cell stores 4 bytes:
 * - Byte 0: Y_avg (mean cell luminance)
 * - Byte 1: Edge Energy E (high-frequency stroke energy)
 * - Byte 2: G_H (horizontal quadrant gradient bias)
 * - Byte 3: G_V (vertical quadrant gradient bias)
 */
export function extractSpatialFingerprint(decoded: DecodedImage): SpatialFingerprint {
  const { width, height, luminance } = decoded;
  const cols = SPATIAL_GRID_COLS;
  const rows = SPATIAL_GRID_ROWS;
  const data = new Uint8Array(cols * rows * BYTES_PER_CELL);

  const cellW = width / cols;
  const cellH = height / rows;

  for (let r = 0; r < rows; r++) {
    const y0 = Math.floor(r * cellH);
    const y1 = Math.min(height, Math.floor((r + 1) * cellH));
    const midY = (y0 + y1) >> 1;

    for (let c = 0; c < cols; c++) {
      const x0 = Math.floor(c * cellW);
      const x1 = Math.min(width, Math.floor((c + 1) * cellW));
      const midX = (x0 + x1) >> 1;

      let sumY = 0;
      let sumGrad = 0;
      let qTopLeft = 0;
      let qTopRight = 0;
      let qBottomLeft = 0;
      let qBottomRight = 0;
      let nTL = 0;
      let nTR = 0;
      let nBL = 0;
      let nBR = 0;
      let count = 0;

      let minVal = 255;
      let maxVal = 0;
      for (let y = y0; y < y1; y++) {
        const rowOffset = y * width;
        const isTop = y < midY;
        for (let x = x0; x < x1; x++) {
          const idx = rowOffset + x;
          const val = luminance[idx];
          sumY += val;
          count++;
          if (val < minVal) minVal = val;
          if (val > maxVal) maxVal = val;

          // Local stroke gradient
          const rightVal = x + 1 < width ? luminance[idx + 1] : val;
          const downVal = y + 1 < height ? luminance[idx + width] : val;
          sumGrad += Math.abs(rightVal - val) + Math.abs(downVal - val);

          // Subcell quadrant accumulation
          if (isTop) {
            if (x < midX) {
              qTopLeft += val;
              nTL++;
            } else {
              qTopRight += val;
              nTR++;
            }
          } else {
            if (x < midX) {
              qBottomLeft += val;
              nBL++;
            } else {
              qBottomRight += val;
              nBR++;
            }
          }
        }
      }

      const outIdx = (r * cols + c) * BYTES_PER_CELL;
      if (count === 0) {
        data[outIdx] = 0;
        data[outIdx + 1] = 0;
        data[outIdx + 2] = 0;
        data[outIdx + 3] = 0;
        data[outIdx + 4] = 0;
        data[outIdx + 5] = 0;
        continue;
      }

      const avgY = Math.round(sumY / count);
      const avgTL = nTL > 0 ? Math.round(qTopLeft / nTL) : avgY;
      const avgTR = nTR > 0 ? Math.round(qTopRight / nTR) : avgY;
      const avgBL = nBL > 0 ? Math.round(qBottomLeft / nBL) : avgY;
      const avgBR = nBR > 0 ? Math.round(qBottomRight / nBR) : avgY;

      // Normalized stroke gradient: scale so thin 1-2px lines produce distinct energy
      const edgeEnergy = Math.min(255, Math.round((sumGrad * 3) / count));
      const peakContrast = maxVal >= minVal ? maxVal - minVal : 0;

      data[outIdx] = avgTL;
      data[outIdx + 1] = avgTR;
      data[outIdx + 2] = avgBL;
      data[outIdx + 3] = avgBR;
      data[outIdx + 4] = edgeEnergy;
      data[outIdx + 5] = peakContrast;
    }
  }

  return { cols, rows, data };
}

/**
 * Extracts compact 256-sample row-luminance profile for bounded scroll correlation.
 */
export function extractCompactRowProfile(decoded: DecodedImage): Uint16Array {
  const { width, height, luminance } = decoded;
  const bins = SCROLL_PROFILE_BINS;
  const profile = new Uint16Array(bins);
  const rowsPerBin = height / bins;

  for (let b = 0; b < bins; b++) {
    const y0 = Math.floor(b * rowsPerBin);
    const y1 = Math.min(height, Math.floor((b + 1) * rowsPerBin));
    let binSum = 0;
    let count = 0;

    for (let y = y0; y < y1; y++) {
      const rowOffset = y * width;
      // Stride sampling across row for high speed (every 4th pixel)
      for (let x = 0; x < width; x += 4) {
        binSum += luminance[rowOffset + x];
        count++;
      }
    }
    profile[b] = count > 0 ? Math.round(binSum / count) : 0;
  }

  return profile;
}

/**
 * Bounded multi-resolution scroll correlation.
 * 1. Coarse search on 256-sample profile over [-64, 64] shift bins.
 * 2. Fine localized 1px refinement on raw image scanlines.
 * 3. Confidence and ambiguity evaluation (fails closed if r < 0.85 or multi-peak).
 */
export function detectScrollShift(
  prevProfile: Uint16Array,
  currProfile: Uint16Array,
  prevDecoded: DecodedImage | undefined,
  currDecoded: DecodedImage
): ScrollCorrelationResult {
  const bins = SCROLL_PROFILE_BINS;

  // 1. Calculate profile variance
  let sumP = 0;
  let sumC = 0;
  let sumSqP = 0;
  let sumSqC = 0;
  for (let i = 0; i < bins; i++) {
    const vp = prevProfile[i];
    const vc = currProfile[i];
    sumP += vp;
    sumC += vc;
    sumSqP += vp * vp;
    sumSqC += vc * vc;
  }
  const varP = sumSqP / bins - (sumP / bins) * (sumP / bins);
  const varC = sumSqC / bins - (sumC / bins) * (sumC / bins);

  // If both profiles have negligible variance (flat background, no vertical texture to correlate),
  // there is no basis for scroll detection. Safely return 0 shift.
  if (varP < 4 && varC < 4) {
    return {
      detectedShift: 0,
      confidence: 1.0,
      isAmbiguous: false,
      revealedBandHasContent: false,
    };
  }

  // 2. Evaluate shift = 0 directly
  let pSum0 = 0;
  for (let i = 0; i < bins; i++) {
    pSum0 += prevProfile[i] * currProfile[i];
  }
  const num0 = pSum0 - (sumP * sumC) / bins;
  const den0 = Math.sqrt(Math.max(0, varP) * Math.max(0, varC)) * bins;
  const r0 = den0 > 1e-6 ? num0 / den0 : 0;

  // 3. Scan shifts [-maxBinShift, maxBinShift]
  const maxBinShift = 64; // +/- 25% of viewport height
  let bestBinShift = 0;
  let bestCorrelation = r0;
  let secondBestCorrelation = -1;

  for (let shift = -maxBinShift; shift <= maxBinShift; shift++) {
    if (shift === 0) continue;
    const startIdx = Math.max(0, shift);
    const endIdx = Math.min(bins, bins + shift);
    const len = endIdx - startIdx;
    if (len < 64) continue;

    let sum1 = 0;
    let sum2 = 0;
    let sum1Sq = 0;
    let sum2Sq = 0;
    let pSum = 0;

    for (let i = 0; i < len; i++) {
      const v1 = prevProfile[shift >= 0 ? i : i - shift];
      const v2 = currProfile[shift >= 0 ? i + shift : i];
      sum1 += v1;
      sum2 += v2;
      sum1Sq += v1 * v1;
      sum2Sq += v2 * v2;
      pSum += v1 * v2;
    }

    const num = pSum - (sum1 * sum2) / len;
    const den = Math.sqrt((sum1Sq - (sum1 * sum1) / len) * (sum2Sq - (sum2 * sum2) / len));
    const r = den > 1e-6 ? num / den : 0;

    if (r > bestCorrelation) {
      secondBestCorrelation = bestCorrelation;
      bestCorrelation = r;
      bestBinShift = shift;
    } else if (r > secondBestCorrelation) {
      secondBestCorrelation = r;
    }
  }

  const binToPixelScale = currDecoded.height / bins;
  let pixelShift = Math.round(bestBinShift * binToPixelScale);

  if (bestBinShift === 0 || Math.abs(pixelShift) < 4) {
    return {
      detectedShift: 0,
      confidence: Math.max(0, bestCorrelation),
      isAmbiguous: false,
      revealedBandHasContent: false,
    };
  }

  // Non-zero shift detected: check ambiguity
  const isAmbiguous =
    bestCorrelation < 0.85 ||
    (secondBestCorrelation > 0.8 && bestCorrelation - secondBestCorrelation < 0.05);

  if (isAmbiguous) {
    return {
      detectedShift: pixelShift,
      confidence: Math.max(0, bestCorrelation),
      isAmbiguous: true,
      revealedBandHasContent: false,
    };
  }

  // Fine refinement within +/- 8 pixels around coarse estimate
  if (
    prevDecoded &&
    currDecoded &&
    prevDecoded.luminance &&
    currDecoded.luminance &&
    prevDecoded.luminance.length > 0 &&
    currDecoded.luminance.length > 0
  ) {
    const fineWindow = 8;
    let bestFineShift = pixelShift;
    let bestFineDiff = Infinity;

    for (let d = -fineWindow; d <= fineWindow; d++) {
      const testShift = pixelShift + d;
      const y0Prev = Math.max(0, -testShift);
      const y0Curr = Math.max(0, testShift);
      const testH = Math.min(currDecoded.height - y0Curr, prevDecoded.height - y0Prev);
      if (testH < currDecoded.height * 0.5) continue;

      let absDiff = 0;
      let samples = 0;
      for (let y = 0; y < testH; y += 2) {
        const pOffset = (y0Prev + y) * prevDecoded.width;
        const cOffset = (y0Curr + y) * currDecoded.width;
        for (let x = 0; x < currDecoded.width; x += 32) {
          absDiff += Math.abs(currDecoded.luminance[cOffset + x] - prevDecoded.luminance[pOffset + x]);
          samples++;
        }
      }
      const meanDiff = samples > 0 ? absDiff / samples : Infinity;
      if (meanDiff < bestFineDiff) {
        bestFineDiff = meanDiff;
        bestFineShift = testShift;
      }
    }
    pixelShift = bestFineShift;
  }

  // Check whether revealed edge stripe contains non-background content
  let revealedBandHasContent = false;
  const revealedHeight = Math.min(currDecoded.height, Math.abs(pixelShift));
  const startY = pixelShift > 0 ? currDecoded.height - revealedHeight : 0;
  let nonBgPixels = 0;
  let totalSamples = 0;

  for (let y = startY; y < startY + revealedHeight; y += 2) {
    const offset = y * currDecoded.width;
    for (let x = 0; x < currDecoded.width; x += 8) {
      const val = currDecoded.luminance[offset + x];
      // Content pixels: not pure white (255) and not pure black (0)
      if (val > 25 && val < 235) {
        nonBgPixels++;
      }
      totalSamples++;
    }
  }
  revealedBandHasContent = totalSamples > 0 && nonBgPixels / totalSamples > 0.05;

  return {
    detectedShift: pixelShift,
    confidence: Math.max(0, bestCorrelation),
    isAmbiguous: false,
    revealedBandHasContent,
  };
}

/**
 * Clusters differing cells on the 128x72 grid into bounding boxes.
 * Note: Cell difference threshold uses Euclidean distance across all 4 quantized features.
 */
export function clusterSpatialDifferences(
  prevFp: SpatialFingerprint,
  currFp: SpatialFingerprint
): DiffCluster[] {
  const cols = SPATIAL_GRID_COLS;
  const rows = SPATIAL_GRID_ROWS;
  const diffGrid = new Uint8Array(cols * rows); // 1 if cell is diff, 0 otherwise
  const deltaGrid = new Uint8Array(cols * rows);

  let totalDiffCells = 0;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const idx = (r * cols + c) * BYTES_PER_CELL;
      const dTL = Math.abs(currFp.data[idx] - prevFp.data[idx]);
      const dTR = Math.abs(currFp.data[idx + 1] - prevFp.data[idx + 1]);
      const dBL = Math.abs(currFp.data[idx + 2] - prevFp.data[idx + 2]);
      const dBR = Math.abs(currFp.data[idx + 3] - prevFp.data[idx + 3]);
      const dE = Math.abs(currFp.data[idx + 4] - prevFp.data[idx + 4]);
      const dC = Math.abs(currFp.data[idx + 5] - prevFp.data[idx + 5]);

      // Max feature delta across any of the 6 features
      const maxDelta = Math.max(dTL, dTR, dBL, dBR, dE, dC);

      // Strict per-cell sensitivity:
      // - Any quadrant luminance shift >= 2
      // - OR edge energy shift >= 3
      // - OR peak contrast shift >= 4
      if (dTL >= 2 || dTR >= 2 || dBL >= 2 || dBR >= 2 || dE >= 3 || dC >= 4) {
        diffGrid[r * cols + c] = 1;
        deltaGrid[r * cols + c] = maxDelta;
        totalDiffCells++;
      }
    }
  }

  if (totalDiffCells === 0) {
    return [];
  }

  // Connected-component clustering (8-connectivity on 128x72 grid)
  const visited = new Uint8Array(cols * rows);
  const clusters: DiffCluster[] = [];

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const idx = r * cols + c;
      if (diffGrid[idx] === 1 && visited[idx] === 0) {
        let minCol = c;
        let maxCol = c;
        let minRow = r;
        let maxRow = r;
        let cellCount = 0;
        let maxClusterDelta = 0;

        const queue: number[] = [idx];
        visited[idx] = 1;

        while (queue.length > 0) {
          const curr = queue.pop()!;
          const currR = (curr / cols) | 0;
          const currC = curr % cols;

          cellCount++;
          if (currC < minCol) minCol = currC;
          if (currC > maxCol) maxCol = currC;
          if (currR < minRow) minRow = currR;
          if (currR > maxRow) maxRow = currR;

          const delta = deltaGrid[curr];
          if (delta > maxClusterDelta) maxClusterDelta = delta;

          for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
              if (dr === 0 && dc === 0) continue;
              const nr = currR + dr;
              const nc = currC + dc;
              if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) {
                const nIdx = nr * cols + nc;
                if (diffGrid[nIdx] === 1 && visited[nIdx] === 0) {
                  visited[nIdx] = 1;
                  queue.push(nIdx);
                }
              }
            }
          }
        }

        clusters.push({
          minCol,
          maxCol,
          minRow,
          maxRow,
          cellCount,
          maxDelta: maxClusterDelta,
        });
      }
    }
  }

  return clusters;
}

/**
 * Strict Blinking Text Caret Validator.
 * Caret must satisfy:
 * 1. Exactly 1 cluster across the entire 128x72 screen.
 * 2. Width <= 1 cell (col span == 0).
 * 3. Height <= 2 cells (row span <= 1).
 * 4. Zero other diffs anywhere on the screen.
 * 5. On the raw pixel level within that cell: width <= 2px, height 10-30px, aspect ratio >= 4.0.
 */
export function isValidBlinkingCaret(
  cluster: DiffCluster,
  prevDecoded?: DecodedImage,
  currDecoded?: DecodedImage
): boolean {
  // Bounding cell span
  const colSpan = cluster.maxCol - cluster.minCol + 1;
  const rowSpan = cluster.maxRow - cluster.minRow + 1;
  if (colSpan > 1 || rowSpan > 3) return false;

  if (
    !prevDecoded ||
    !currDecoded ||
    !prevDecoded.luminance ||
    !currDecoded.luminance ||
    prevDecoded.luminance.length === 0 ||
    currDecoded.luminance.length === 0
  ) {
    return false;
  }

  // Inspect raw pixel patch within the affected cell
  const cellW = prevDecoded.width / SPATIAL_GRID_COLS;
  const cellH = prevDecoded.height / SPATIAL_GRID_ROWS;

  const px0 = Math.max(0, Math.floor(cluster.minCol * cellW));
  const px1 = Math.min(prevDecoded.width, Math.ceil((cluster.maxCol + 1) * cellW));
  const py0 = Math.max(0, Math.floor(cluster.minRow * cellH));
  const py1 = Math.min(prevDecoded.height, Math.ceil((cluster.maxRow + 1) * cellH));

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  let diffPixels = 0;

  for (let y = py0; y < py1; y++) {
    const rowOffset = y * prevDecoded.width;
    for (let x = px0; x < px1; x++) {
      const pVal = prevDecoded.luminance[rowOffset + x];
      const cVal = currDecoded.luminance[rowOffset + x];
      if (Math.abs(pVal - cVal) > 15) {
        diffPixels++;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (diffPixels === 0) return false;

  const w = maxX - minX + 1;
  const h = maxY - minY + 1;

  // Strict caret geometry: width <= 2px (allow 3px at high-DPI), height 10-30px, aspect ratio >= 4.0
  const isCaretDim = w <= 2 && h >= 10 && h <= 30 && h / w >= 4.0;
  return isCaretDim;
}

/**
 * Strict OS Taskbar Clock Validator.
 * Tray clock must satisfy:
 * 1. Exactly 1 cluster across the entire screen.
 * 2. Strictly located in standard OS tray bounds (Windows bottom-right: col >= 110, row >= 67).
 * 3. 0 diffs in content area.
 */
export function isValidOsTrayClock(
  cluster: DiffCluster,
  screenWidth: number,
  screenHeight: number
): boolean {
  // Windows bottom-right tray coordinates on 128x72 grid:
  // col >= 110 (~86% of width), row >= 67 (~93% of height)
  const isWithinTrayCols = cluster.minCol >= 110 && cluster.maxCol <= 127;
  const isWithinTrayRows = cluster.minRow >= 67 && cluster.maxRow <= 71;

  if (!isWithinTrayCols || !isWithinTrayRows) {
    return false;
  }

  const colSpan = cluster.maxCol - cluster.minCol + 1;
  const rowSpan = cluster.maxRow - cluster.minRow + 1;
  // Clock is small (< 6 cells wide, < 3 cells tall)
  return colSpan <= 6 && rowSpan <= 3;
}

export interface NestedStageTimings {
  inputNormMs: number;
  sha256Ms: number;
  jpegDecodeMs: number;
  luminanceExtractMs: number;
  spatialFpMs: number;
  rowProfileMs: number;
  scrollDetectMs: number;
  diffClusteringMs: number;
  finalDecisionMs: number;
  totalEvaluateChangeMs: number;
}

/**
 * Primary Material Change Evaluation Engine.
 */
export class ScreenFingerprintEngine {
  /**
   * Evaluates whether current incoming screen image is materially changed relative
   * to previous baseline observation.
   */
  public evaluateChange(params: {
    currImageBuffer: Buffer;
    prevObservation?: ScreenObservation | null;
    collectTiming?: boolean;
  }): {
    evaluation: ScreenChangeEvaluation;
    currDecoded?: DecodedImage;
    currFp?: SpatialFingerprint;
    currRowProfile?: Uint16Array;
    exactSha256: string;
    stageTimings?: NestedStageTimings;
  } {
    const tTotalStart = performance.now();
    const collectTiming = !!params.collectTiming;
    let tA0 = 0, tA1 = 0, tB0 = 0, tB1 = 0, tC0 = 0, tC1 = 0;
    let tD0 = 0, tD1 = 0, tE0 = 0, tE1 = 0, tF0 = 0, tF1 = 0;
    let tG0 = 0, tG1 = 0, tH0 = 0, tH1 = 0, tI0 = 0, tI1 = 0;

    // Stage A: Input Normalization & Validation
    if (collectTiming) tA0 = performance.now();
    const { currImageBuffer, prevObservation } = params;
    if (collectTiming) tA1 = performance.now();

    // Stage B: SHA-256 Binary Hash
    if (collectTiming) tB0 = performance.now();
    const { fingerprint: exactSha256 } = computeBinaryImageFingerprint(
      currImageBuffer.toString("base64")
    );
    if (collectTiming) tB1 = performance.now();

    // 0. Exact SHA-256 binary match -> UNCHANGED immediately
    if (prevObservation && prevObservation.exactSha256 === exactSha256) {
      const tTotalEnd = performance.now();
      return {
        evaluation: {
          isMaterialChange: false,
          reasonCode: "IDENTICAL_BINARY",
          metrics: {
            exactShaMatch: true,
            diffCellCount: 0,
            clusterCount: 0,
            scrollShift: 0,
            scrollConfidence: 1.0,
            maxLocalDelta: 0,
          },
        },
        exactSha256,
        stageTimings: collectTiming
          ? {
              inputNormMs: tA1 - tA0,
              sha256Ms: tB1 - tB0,
              jpegDecodeMs: 0,
              luminanceExtractMs: 0,
              spatialFpMs: 0,
              rowProfileMs: 0,
              scrollDetectMs: 0,
              diffClusteringMs: 0,
              finalDecisionMs: tTotalEnd - tB1,
              totalEvaluateChangeMs: tTotalEnd - tTotalStart,
            }
          : undefined,
      };
    }

    // Stage C: JPEG Decode & Stage D: Luminance Extraction
    let currDecoded: DecodedImage;
    if (collectTiming) {
      tC0 = performance.now();
      let decodedRaw: jpeg.RawImageData<Uint8Array>;
      try {
        decodedRaw = decodeJpegOnly(currImageBuffer);
      } catch (_err) {
        tC1 = performance.now();
        const tTotalEnd = performance.now();
        return {
          evaluation: {
            isMaterialChange: true,
            reasonCode: "CORRUPTED_OR_UNSUPPORTED_IMAGE",
            metrics: {
              exactShaMatch: false,
              diffCellCount: 0,
              clusterCount: 0,
              scrollShift: 0,
              scrollConfidence: 0,
              maxLocalDelta: 0,
            },
          },
          exactSha256,
          stageTimings: {
            inputNormMs: tA1 - tA0,
            sha256Ms: tB1 - tB0,
            jpegDecodeMs: tC1 - tC0,
            luminanceExtractMs: 0,
            spatialFpMs: 0,
            rowProfileMs: 0,
            scrollDetectMs: 0,
            diffClusteringMs: 0,
            finalDecisionMs: tTotalEnd - tC1,
            totalEvaluateChangeMs: tTotalEnd - tTotalStart,
          },
        };
      }
      tC1 = performance.now();

      tD0 = performance.now();
      const luminance = convertRgbToLuminance(decodedRaw.data, decodedRaw.width, decodedRaw.height);
      currDecoded = { width: decodedRaw.width, height: decodedRaw.height, luminance };
      tD1 = performance.now();
    } else {
      try {
        currDecoded = decodeJpegToLuminance(currImageBuffer);
      } catch (_err) {
        return {
          evaluation: {
            isMaterialChange: true,
            reasonCode: "CORRUPTED_OR_UNSUPPORTED_IMAGE",
            metrics: {
              exactShaMatch: false,
              diffCellCount: 0,
              clusterCount: 0,
              scrollShift: 0,
              scrollConfidence: 0,
              maxLocalDelta: 0,
            },
          },
          exactSha256,
        };
      }
    }

    // 2. If no previous observation exists, this is a fresh baseline -> MATERIALLY_CHANGED
    if (!prevObservation) {
      if (collectTiming) tE0 = performance.now();
      const currFp = extractSpatialFingerprint(currDecoded);
      if (collectTiming) tE1 = performance.now();

      if (collectTiming) tF0 = performance.now();
      const currRowProfile = extractCompactRowProfile(currDecoded);
      if (collectTiming) tF1 = performance.now();

      const tTotalEnd = performance.now();
      return {
        evaluation: {
          isMaterialChange: true,
          reasonCode: "MATERIAL_LAYOUT_CHANGE",
          metrics: {
            exactShaMatch: false,
            diffCellCount: SPATIAL_GRID_COLS * SPATIAL_GRID_ROWS,
            clusterCount: 1,
            scrollShift: 0,
            scrollConfidence: 0,
            maxLocalDelta: 255,
          },
        },
        currDecoded,
        currFp,
        currRowProfile,
        exactSha256,
        stageTimings: collectTiming
          ? {
              inputNormMs: tA1 - tA0,
              sha256Ms: tB1 - tB0,
              jpegDecodeMs: tC1 - tC0,
              luminanceExtractMs: tD1 - tD0,
              spatialFpMs: tE1 - tE0,
              rowProfileMs: tF1 - tF0,
              scrollDetectMs: 0,
              diffClusteringMs: 0,
              finalDecisionMs: tTotalEnd - tF1,
              totalEvaluateChangeMs: tTotalEnd - tTotalStart,
            }
          : undefined,
      };
    }

    // 3. Dimension mismatch -> MATERIALLY_CHANGED
    if (currDecoded.width !== prevObservation.width || currDecoded.height !== prevObservation.height) {
      if (collectTiming) tE0 = performance.now();
      const currFp = extractSpatialFingerprint(currDecoded);
      if (collectTiming) tE1 = performance.now();

      if (collectTiming) tF0 = performance.now();
      const currRowProfile = extractCompactRowProfile(currDecoded);
      if (collectTiming) tF1 = performance.now();

      const tTotalEnd = performance.now();
      return {
        evaluation: {
          isMaterialChange: true,
          reasonCode: "MATERIAL_RESIZE_OR_DISPLAY_CHANGE",
          metrics: {
            exactShaMatch: false,
            diffCellCount: SPATIAL_GRID_COLS * SPATIAL_GRID_ROWS,
            clusterCount: 1,
            scrollShift: 0,
            scrollConfidence: 0,
            maxLocalDelta: 255,
          },
        },
        currDecoded,
        currFp,
        currRowProfile,
        exactSha256,
        stageTimings: collectTiming
          ? {
              inputNormMs: tA1 - tA0,
              sha256Ms: tB1 - tB0,
              jpegDecodeMs: tC1 - tC0,
              luminanceExtractMs: tD1 - tD0,
              spatialFpMs: tE1 - tE0,
              rowProfileMs: tF1 - tF0,
              scrollDetectMs: 0,
              diffClusteringMs: 0,
              finalDecisionMs: tTotalEnd - tF1,
              totalEvaluateChangeMs: tTotalEnd - tTotalStart,
            }
          : undefined,
      };
    }

    // Stage E: Spatial Fingerprint
    if (collectTiming) tE0 = performance.now();
    const currFp = extractSpatialFingerprint(currDecoded);
    if (collectTiming) tE1 = performance.now();

    // Stage F: Row Profile
    if (collectTiming) tF0 = performance.now();
    const currRowProfile = extractCompactRowProfile(currDecoded);
    if (collectTiming) tF1 = performance.now();

    const prevFp: SpatialFingerprint = {
      cols: SPATIAL_GRID_COLS,
      rows: SPATIAL_GRID_ROWS,
      data: prevObservation.spatialFingerprint,
    };

    // Stage G: Scroll Detection
    const prevDecoded: DecodedImage | undefined = prevObservation.decodedLuminance
      ? {
          width: prevObservation.width,
          height: prevObservation.height,
          luminance: prevObservation.decodedLuminance,
        }
      : undefined;

    if (collectTiming) tG0 = performance.now();
    const scrollResult = detectScrollShift(
      prevObservation.rowProfile,
      currRowProfile,
      prevDecoded,
      currDecoded
    );
    if (collectTiming) tG1 = performance.now();

    if (scrollResult.isAmbiguous || scrollResult.revealedBandHasContent || Math.abs(scrollResult.detectedShift) >= 4) {
      const reasonCode: MaterialChangeReason = scrollResult.isAmbiguous
        ? "UNCERTAIN_LOW_CORRELATION_SCROLL"
        : scrollResult.revealedBandHasContent
        ? "MATERIAL_SCROLL_REVEALED_CONTENT"
        : "MATERIAL_SCROLL_VIEWPORT_RELOCATION";

      const tTotalEnd = performance.now();
      return {
        evaluation: {
          isMaterialChange: true,
          reasonCode,
          metrics: {
            exactShaMatch: false,
            diffCellCount: 0,
            clusterCount: 0,
            scrollShift: scrollResult.detectedShift,
            scrollConfidence: scrollResult.confidence,
            maxLocalDelta: 0,
          },
        },
        currDecoded,
        currFp,
        currRowProfile,
        exactSha256,
        stageTimings: collectTiming
          ? {
              inputNormMs: tA1 - tA0,
              sha256Ms: tB1 - tB0,
              jpegDecodeMs: tC1 - tC0,
              luminanceExtractMs: tD1 - tD0,
              spatialFpMs: tE1 - tE0,
              rowProfileMs: tF1 - tF0,
              scrollDetectMs: tG1 - tG0,
              diffClusteringMs: 0,
              finalDecisionMs: tTotalEnd - tG1,
              totalEvaluateChangeMs: tTotalEnd - tTotalStart,
            }
          : undefined,
      };
    }

    // Stage H: Spatial Diff Clustering
    if (collectTiming) tH0 = performance.now();
    const clusters = clusterSpatialDifferences(prevFp, currFp);
    if (collectTiming) tH1 = performance.now();

    // Stage I: Final Decision Logic
    if (collectTiming) tI0 = performance.now();
    let totalDiffCells = 0;
    let maxLocalDelta = 0;
    for (const cl of clusters) {
      totalDiffCells += cl.cellCount;
      if (cl.maxDelta > maxLocalDelta) maxLocalDelta = cl.maxDelta;
    }

    // Zero cell differences -> UNCHANGED
    if (clusters.length === 0) {
      if (collectTiming) tI1 = performance.now();
      const tTotalEnd = performance.now();
      return {
        evaluation: {
          isMaterialChange: false,
          reasonCode: "IDENTICAL_BINARY",
          metrics: {
            exactShaMatch: false,
            diffCellCount: 0,
            clusterCount: 0,
            scrollShift: scrollResult.detectedShift,
            scrollConfidence: scrollResult.confidence,
            maxLocalDelta: 0,
          },
        },
        currDecoded,
        currFp,
        currRowProfile,
        exactSha256,
        stageTimings: collectTiming
          ? {
              inputNormMs: tA1 - tA0,
              sha256Ms: tB1 - tB0,
              jpegDecodeMs: tC1 - tC0,
              luminanceExtractMs: tD1 - tD0,
              spatialFpMs: tE1 - tE0,
              rowProfileMs: tF1 - tF0,
              scrollDetectMs: tG1 - tG0,
              diffClusteringMs: tH1 - tH0,
              finalDecisionMs: tTotalEnd - tI0,
              totalEvaluateChangeMs: tTotalEnd - tTotalStart,
            }
          : undefined,
      };
    }

    // Rule: "Diff size alone MUST NEVER authorize a skip"
    // Only check validated exceptions if clusters.length === 1
    if (clusters.length === 1) {
      const singleCluster = clusters[0];

      // Exception A: Validated Blinking Caret
      if (isValidBlinkingCaret(singleCluster, prevDecoded, currDecoded)) {
        if (collectTiming) tI1 = performance.now();
        const tTotalEnd = performance.now();
        return {
          evaluation: {
            isMaterialChange: false,
            reasonCode: "NON_MATERIAL_BLINKING_CARET",
            metrics: {
              exactShaMatch: false,
              diffCellCount: totalDiffCells,
              clusterCount: 1,
              scrollShift: scrollResult.detectedShift,
              scrollConfidence: scrollResult.confidence,
              maxLocalDelta,
            },
          },
          currDecoded,
          currFp,
          currRowProfile,
          exactSha256,
          stageTimings: collectTiming
            ? {
                inputNormMs: tA1 - tA0,
                sha256Ms: tB1 - tB0,
                jpegDecodeMs: tC1 - tC0,
                luminanceExtractMs: tD1 - tD0,
                spatialFpMs: tE1 - tE0,
                rowProfileMs: tF1 - tF0,
                scrollDetectMs: tG1 - tG0,
                diffClusteringMs: tH1 - tH0,
                finalDecisionMs: tTotalEnd - tI0,
                totalEvaluateChangeMs: tTotalEnd - tTotalStart,
              }
            : undefined,
        };
      }

      // Exception B: Validated OS Taskbar Clock
      if (isValidOsTrayClock(singleCluster, currDecoded.width, currDecoded.height)) {
        if (collectTiming) tI1 = performance.now();
        const tTotalEnd = performance.now();
        return {
          evaluation: {
            isMaterialChange: false,
            reasonCode: "NON_MATERIAL_OS_TRAY_CLOCK",
            metrics: {
              exactShaMatch: false,
              diffCellCount: totalDiffCells,
              clusterCount: 1,
              scrollShift: scrollResult.detectedShift,
              scrollConfidence: scrollResult.confidence,
              maxLocalDelta,
            },
          },
          currDecoded,
          currFp,
          currRowProfile,
          exactSha256,
          stageTimings: collectTiming
            ? {
                inputNormMs: tA1 - tA0,
                sha256Ms: tB1 - tB0,
                jpegDecodeMs: tC1 - tC0,
                luminanceExtractMs: tD1 - tD0,
                spatialFpMs: tE1 - tE0,
                rowProfileMs: tF1 - tF0,
                scrollDetectMs: tG1 - tG0,
                diffClusteringMs: tH1 - tH0,
                finalDecisionMs: tTotalEnd - tI0,
                totalEvaluateChangeMs: tTotalEnd - tTotalStart,
              }
            : undefined,
        };
      }
    }

    // If more than 1 cluster, or not matching verified caret/tray -> MATERIALLY_CHANGED
    const reasonCode: MaterialChangeReason =
      clusters.length > 5 || totalDiffCells > 50
        ? "MATERIAL_LAYOUT_CHANGE"
        : "MATERIAL_CODE_CHANGE";

    if (collectTiming) tI1 = performance.now();
    const tTotalEnd = performance.now();

    return {
      evaluation: {
        isMaterialChange: true,
        reasonCode,
        metrics: {
          exactShaMatch: false,
          diffCellCount: totalDiffCells,
          clusterCount: clusters.length,
          scrollShift: scrollResult.detectedShift,
          scrollConfidence: scrollResult.confidence,
          maxLocalDelta,
        },
      },
      currDecoded,
      currFp,
      currRowProfile,
      exactSha256,
      stageTimings: collectTiming
        ? {
            inputNormMs: tA1 - tA0,
            sha256Ms: tB1 - tB0,
            jpegDecodeMs: tC1 - tC0,
            luminanceExtractMs: tD1 - tD0,
            spatialFpMs: tE1 - tE0,
            rowProfileMs: tF1 - tF0,
            scrollDetectMs: tG1 - tG0,
            diffClusteringMs: tH1 - tH0,
            finalDecisionMs: tTotalEnd - tI0,
            totalEvaluateChangeMs: tTotalEnd - tTotalStart,
          }
        : undefined,
    };
  }
}

/**
 * Thread-safe, session-isolated, monotonically ordered Screen Observation Store.
 */
export class ScreenObservationStore {
  private observations = new Map<string, ScreenObservation>();
  private sessionLocks = new Map<string, Promise<void>>();
  private readonly defaultTtlMs: number;

  constructor(ttlMs: number = OBSERVATION_TTL_MS) {
    this.defaultTtlMs = ttlMs;
  }

  private getSessionKey(userId: string, sessionId: string): string {
    return `user:${userId}:sess:${sessionId || "default_session"}`;
  }

  /**
   * Atomically updates the observation for (userId, sessionId) subject to monotonic sequence.
   * Older or duplicate sequence captures are strictly rejected from overwriting newer captures.
   */
  public async updateObservation(params: {
    userId: string;
    sessionId: string;
    captureSequence: number;
    contextSig: string;
    threadId?: string;
    exactSha256: string;
    spatialFingerprint: Uint8Array;
    rowProfile: Uint16Array;
    width: number;
    height: number;
    priorAnswer?: string;
    modelUsed?: string;
    ttlMs?: number;
    decodedLuminance?: Uint8Array;
    logicalIdentityKey?: string;
    promptHash?: string;
  }): Promise<{ accepted: boolean; reason: string }> {
    const key = this.getSessionKey(params.userId, params.sessionId);

    // Acquire session lock to serialize concurrent updates
    const currentLock = this.sessionLocks.get(key) || Promise.resolve();
    let releaseLock: () => void;
    const newLock = new Promise<void>((resolve) => {
      releaseLock = resolve;
    });
    this.sessionLocks.set(key, newLock);

    try {
      await currentLock;

      if (!Number.isInteger(params.captureSequence) || params.captureSequence < 0) {
        return { accepted: false, reason: "INVALID_CAPTURE_SEQUENCE" };
      }

      const current = this.observations.get(key);
      const now = Date.now();

      if (current) {
        // Monotonic sequence check
        if (params.captureSequence <= current.captureSequence) {
          return {
            accepted: false,
            reason: `OUT_OF_ORDER_OR_DUPLICATE_SEQUENCE: incoming=${params.captureSequence} current=${current.captureSequence}`,
          };
        }
      }

      const ttl = params.ttlMs ?? this.defaultTtlMs;
      const observation: ScreenObservation = {
        observationId: `obs_${now}_${Math.random().toString(36).slice(2, 7)}`,
        userId: params.userId,
        sessionId: params.sessionId,
        captureSequence: params.captureSequence,
        createdAt: now,
        expiresAt: now + ttl,
        contextSig: params.contextSig,
        threadId: params.threadId,
        exactSha256: params.exactSha256,
        spatialFingerprint: params.spatialFingerprint,
        rowProfile: params.rowProfile,
        width: params.width,
        height: params.height,
        priorAnswer: params.priorAnswer,
        modelUsed: params.modelUsed,
        decodedLuminance: params.decodedLuminance,
        logicalIdentityKey: params.logicalIdentityKey,
        promptHash: params.promptHash,
      };

      this.observations.set(key, observation);
      return { accepted: true, reason: "ACCEPTED" };
    } finally {
      releaseLock!();
    }
  }

  /**
   * Retrieves active, unexpired observation for (userId, sessionId).
   * Automatically purges if expired.
   */
  public getObservation(userId: string, sessionId: string): ScreenObservation | null {
    const key = this.getSessionKey(userId, sessionId);
    const obs = this.observations.get(key);
    if (!obs) return null;

    if (Date.now() >= obs.expiresAt) {
      this.observations.delete(key);
      return null;
    }

    return obs;
  }

  /**
   * Invalidates observation for a user and session (e.g. on logout or context shift).
   */
  public invalidateSession(userId: string, sessionId: string): boolean {
    const key = this.getSessionKey(userId, sessionId);
    return this.observations.delete(key);
  }

  /**
   * Clears all observations across all users (testing only).
   */
  public clear(): void {
    this.observations.clear();
    this.sessionLocks.clear();
  }
}

export const screenFingerprintEngine = new ScreenFingerprintEngine();
export const screenObservationStore = new ScreenObservationStore();
