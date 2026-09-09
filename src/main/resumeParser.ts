import fs from "fs";
import path from "path";
import PDFParser from "pdf2json";
import mammoth from "mammoth";

export interface ResumeParseResult {
  success: boolean;
  format: "pdf" | "docx" | "txt" | "unknown";
  pageCount: number;
  extractedPages: number;
  extractedChars: number;
  text: string;
  fileName: string;
  filePath: string;
  warnings: string[];
  errorCode?:
    | "FILE_NOT_FOUND"
    | "FILE_EMPTY"
    | "UNSUPPORTED_FORMAT"
    | "PDF_EMPTY_TEXT"
    | "PDF_SCANNED_NO_TEXT"
    | "PDF_PARTIAL_EXTRACTION"
    | "PDF_PARSE_ERROR"
    | "DOCX_PARSE_ERROR"
    | "TXT_READ_ERROR";
  errorMessage?: string;
}

/**
 * Normalizes text content:
 * - Replaces non-standard bullets with standard markdown bullets
 * - Removes non-printable control characters
 * - Normalizes line breaks and whitespace
 * - Collapses excessive blank lines
 */
export function normalizeResumeText(text: string): string {
  if (!text || typeof text !== "string") return "";

  return text
    // Normalize newlines
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    // Remove non-printable control characters (keep \n and \t)
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
    // Replace bullet symbols with standard "- "
    .replace(/^[\s]*[•●○■▪▫✦❖★][\s]*/gm, "- ")
    .replace(/([^\n])[\s]*[•●○■▪▫✦❖★][\s]*/g, "$1\n- ")
    // Replace special dashes
    .replace(/[\u2013\u2014]/g, "-")
    // Replace tabs with 2 spaces
    .replace(/\t/g, "  ")
    // Collapse excessive horizontal whitespace (preserve single/double spaces)
    .replace(/[ \t]{4,}/g, "   ")
    // Collapse 3+ newlines to 2 newlines
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Spatially-aware page renderer for PDF documents (pdf2json format).
 * Correctly groups text items into lines and inserts spaces where spatial gaps exist.
 */
export function renderPdfPageTexts(page: any): string {
  const texts = page?.Texts || [];
  if (!texts || texts.length === 0) return "";

  const items: { x: number; y: number; w: number; str: string }[] = [];
  for (const t of texts) {
    if (!t || !t.R) continue;
    const rawStr = (t.R || []).map((r: any) => {
      try {
        return decodeURIComponent(r.T || "");
      } catch {
        return unescape(r.T || "");
      }
    }).join("");

    if (rawStr.trim().length > 0) {
      items.push({
        x: t.x,
        y: t.y,
        w: t.w || rawStr.length * 0.5,
        str: rawStr,
      });
    }
  }

  if (items.length === 0) return "";

  const yTolerance = 0.35;
  items.sort((a, b) => {
    const yDiff = a.y - b.y;
    if (Math.abs(yDiff) > yTolerance) return yDiff;
    return a.x - b.x;
  });

  const lines: (typeof items)[] = [];
  let currentLine: typeof items = [];
  let currentY: number | null = null;

  for (const item of items) {
    if (currentY === null) {
      currentY = item.y;
      currentLine.push(item);
    } else if (Math.abs(item.y - currentY) <= yTolerance) {
      currentLine.push(item);
    } else {
      lines.push(currentLine);
      currentLine = [item];
      currentY = item.y;
    }
  }
  if (currentLine.length > 0) lines.push(currentLine);

  const lineStrings: string[] = [];
  for (const line of lines) {
    line.sort((a, b) => a.x - b.x);
    let lineText = "";
    let lastXEnd: number | null = null;

    for (const item of line) {
      if (lastXEnd !== null) {
        const gap = item.x - lastXEnd;
        const needsSpace =
          gap > 0.15 &&
          !lineText.endsWith(" ") &&
          !item.str.startsWith(" ") &&
          !/^[\.,:;!?\)\}\]]/.test(item.str) &&
          !/[\(\{\[]$/.test(lineText);

        if (needsSpace) lineText += " ";
      }
      lineText += item.str;
      lastXEnd = item.x + item.w;
    }

    const trimmed = lineText.trim();
    if (trimmed) lineStrings.push(trimmed);
  }

  return lineStrings.join("\n");
}

/**
 * Spatially-aware page renderer for PDF documents.
 * Correctly groups text items into lines and inserts spaces where spatial gaps exist.
 */
export async function spatialPageRender(pageData: any): Promise<string> {
  if (pageData?.Texts) {
    return renderPdfPageTexts(pageData);
  }

  if (!pageData?.getTextContent) return "";

  const textContent = await pageData.getTextContent({
    normalizeWhitespace: true,
    disableCombineTextItems: false,
  });

  const rawItems: any[] = textContent.items;
  if (!rawItems || rawItems.length === 0) return "";
  const items = rawItems.filter((it) => it && typeof it.str === "string" && it.str.length > 0);
  if (items.length === 0) return "";

  const heights = items
    .map((it) => Math.abs(it.height || it.transform?.[0] || it.transform?.[3] || 10))
    .filter((h) => h > 0);
  const avgHeight = heights.length > 0 ? heights.reduce((a, b) => a + b, 0) / heights.length : 10;
  const yTolerance = Math.max(2, avgHeight * 0.35);

  // Sort items top-to-bottom (PDF Y is inverted in coordinate system, so higher Y comes first)
  const sorted = [...items].sort((a, b) => {
    const yDiff = b.transform[5] - a.transform[5];
    if (Math.abs(yDiff) > yTolerance) return yDiff;
    return a.transform[4] - b.transform[4];
  });

  const lines: any[][] = [];
  let currentLine: any[] = [];
  let currentLineY: number | null = null;

  for (const item of sorted) {
    const y = item.transform[5];
    if (currentLineY === null) {
      currentLineY = y;
      currentLine.push(item);
    } else if (Math.abs(y - currentLineY) <= yTolerance) {
      currentLine.push(item);
    } else {
      lines.push(currentLine);
      currentLine = [item];
      currentLineY = y;
    }
  }
  if (currentLine.length > 0) lines.push(currentLine);

  const lineStrings: string[] = [];
  for (const line of lines) {
    line.sort((a, b) => a.transform[4] - b.transform[4]);
    let lineText = "";
    let lastXEnd: number | null = null;

    for (const item of line) {
      const x = item.transform[4];
      const str = item.str;
      const width = item.width || str.length * (avgHeight * 0.5);

      if (lastXEnd !== null) {
        const gap = x - lastXEnd;
        const needsSpace =
          gap > Math.max(1.5, avgHeight * 0.15) &&
          !lineText.endsWith(" ") &&
          !str.startsWith(" ") &&
          !/^[\.,:;!?\)\}\]]/.test(str) &&
          !/[\(\{\[]$/.test(lineText);

        if (needsSpace) lineText += " ";
      }

      lineText += str;
      lastXEnd = x + width;
    }

    const trimmed = lineText.trim();
    if (trimmed) lineStrings.push(trimmed);
  }

  return lineStrings.join("\n");
}

/**
 * Checks if raw buffer appears to contain images (common in scanned PDFs)
 */
function bufferContainsPdfImages(buffer: Buffer): boolean {
  const sample = buffer.subarray(0, Math.min(buffer.length, 500000)).toString("latin1");
  return sample.includes("/Image") || sample.includes("/DCTDecode") || sample.includes("/JPXDecode");
}

export async function parsePDF(filePath: string): Promise<string> {
  const result = await parsePdfFile(filePath, path.basename(filePath), performance.now());
  return result.text;
}

export async function parseDOCX(filePath: string): Promise<string> {
  const result = await parseDocxFile(filePath, path.basename(filePath), performance.now());
  return result.text;
}

export async function parseResume(filePath: string): Promise<ResumeParseResult> {
  const startTime = performance.now();
  const fileName = path.basename(filePath);

  // 1. File existence & size checks
  if (!filePath || typeof filePath !== "string") {
    return {
      success: false,
      format: "unknown",
      pageCount: 0,
      extractedPages: 0,
      extractedChars: 0,
      text: "",
      fileName: fileName || "unknown",
      filePath: filePath || "",
      warnings: ["Invalid file path provided"],
      errorCode: "FILE_NOT_FOUND",
      errorMessage: "Invalid file path: path must be a non-empty string.",
    };
  }

  if (!fs.existsSync(filePath)) {
    return {
      success: false,
      format: "unknown",
      pageCount: 0,
      extractedPages: 0,
      extractedChars: 0,
      text: "",
      fileName,
      filePath,
      warnings: [`File not found: ${fileName}`],
      errorCode: "FILE_NOT_FOUND",
      errorMessage: `The resume file "${fileName}" was not found.`,
    };
  }

  const stat = fs.statSync(filePath);
  if (stat.size === 0) {
    return {
      success: false,
      format: "unknown",
      pageCount: 0,
      extractedPages: 0,
      extractedChars: 0,
      text: "",
      fileName,
      filePath,
      warnings: ["File is 0 bytes"],
      errorCode: "FILE_EMPTY",
      errorMessage: `The file "${fileName}" is empty (0 bytes).`,
    };
  }

  const ext = path.extname(filePath).toLowerCase();

  // 2. Format routing
  if (ext === ".pdf") {
    return await parsePdfFile(filePath, fileName, startTime);
  } else if (ext === ".docx") {
    return await parseDocxFile(filePath, fileName, startTime);
  } else if (ext === ".txt") {
    return await parseTxtFile(filePath, fileName, startTime);
  } else {
    return {
      success: false,
      format: "unknown",
      pageCount: 0,
      extractedPages: 0,
      extractedChars: 0,
      text: "",
      fileName,
      filePath,
      warnings: [`Unsupported extension: ${ext}`],
      errorCode: "UNSUPPORTED_FORMAT",
      errorMessage: `Unsupported file format "${ext}". Please upload a PDF, DOCX, or TXT file.`,
    };
  }
}

async function parsePdfFile(filePath: string, fileName: string, startTime: number): Promise<ResumeParseResult> {
  const warnings: string[] = [];
  let buffer: Buffer;

  try {
    buffer = fs.readFileSync(filePath);
  } catch (err: any) {
    return {
      success: false,
      format: "pdf",
      pageCount: 0,
      extractedPages: 0,
      extractedChars: 0,
      text: "",
      fileName,
      filePath,
      warnings: [err.message],
      errorCode: "PDF_PARSE_ERROR",
      errorMessage: `Could not read PDF file: ${err.message}`,
    };
  }

  try {
    const pdfData = await new Promise<any>((resolve, reject) => {
      const parser = new PDFParser();
      parser.on("pdfParser_dataError", (errData: any) => {
        reject(errData?.parserError || new Error(String(errData)));
      });
      parser.on("pdfParser_dataReady", (data: any) => {
        resolve(data);
      });
      try {
        parser.parseBuffer(buffer);
      } catch (e) {
        reject(e);
      }
    });

    const pages = pdfData?.Pages || [];
    const pageCount = pages.length || 1;
    let extractedPagesCount = 0;
    const pageTexts: string[] = [];

    for (let i = 0; i < pages.length; i++) {
      try {
        const pageText = renderPdfPageTexts(pages[i]);
        if (pageText && pageText.trim().length > 0) {
          extractedPagesCount++;
          pageTexts.push(pageText);
        } else {
          warnings.push(`Page ${i + 1} yielded no readable text.`);
        }
      } catch (pageErr: any) {
        warnings.push(`Page ${i + 1} render failed: ${pageErr.message}`);
      }
    }

    const rawText = pageTexts.join("\n\n");
    const normalized = normalizeResumeText(rawText);
    const charCount = normalized.length;
    const wordCount = normalized ? normalized.split(/\s+/).filter(Boolean).length : 0;
    const durationMs = Math.round(performance.now() - startTime);

    // Check for empty or scanned PDF
    if (charCount < 40 || wordCount < 8) {
      const isScanned = bufferContainsPdfImages(buffer);
      const errorCode = isScanned ? "PDF_SCANNED_NO_TEXT" : "PDF_EMPTY_TEXT";
      const errorMessage = isScanned
        ? `"${fileName}" appears to be a scanned or image-based PDF without a readable text layer. Please upload a text-based PDF or DOCX file.`
        : `No readable text could be found in "${fileName}". Please check that the PDF contains selectable text.`;

      console.log(`[ResumeParser] file="${fileName}" format=pdf pages=${pageCount} chars=${charCount} duration=${durationMs}ms errorCode=${errorCode}`);

      return {
        success: false,
        format: "pdf",
        pageCount,
        extractedPages: extractedPagesCount,
        extractedChars: charCount,
        text: "",
        fileName,
        filePath,
        warnings,
        errorCode,
        errorMessage,
      };
    }

    let errorCode: ResumeParseResult["errorCode"] = undefined;
    if (pageCount > 1 && extractedPagesCount < pageCount) {
      errorCode = "PDF_PARTIAL_EXTRACTION";
      warnings.push(`Extracted text from ${extractedPagesCount} of ${pageCount} pages.`);
    }

    console.log(
      `[ResumeParser] file="${fileName}" format=pdf pages=${pageCount} extractedPages=${extractedPagesCount} chars=${charCount} words=${wordCount} duration=${durationMs}ms success=true`
    );

    return {
      success: true,
      format: "pdf",
      pageCount,
      extractedPages: extractedPagesCount,
      extractedChars: charCount,
      text: normalized,
      fileName,
      filePath,
      warnings,
      errorCode,
    };
  } catch (err: any) {
    const durationMs = Math.round(performance.now() - startTime);
    console.error(`[ResumeParser] file="${fileName}" format=pdf error="${err.message}" duration=${durationMs}ms`);

    return {
      success: false,
      format: "pdf",
      pageCount: 0,
      extractedPages: 0,
      extractedChars: 0,
      text: "",
      fileName,
      filePath,
      warnings: [...warnings, err.message],
      errorCode: "PDF_PARSE_ERROR",
      errorMessage: `Failed to parse PDF "${fileName}": ${err.message}`,
    };
  }
}

async function parseDocxFile(filePath: string, fileName: string, startTime: number): Promise<ResumeParseResult> {
  try {
    const result = await mammoth.extractRawText({ path: filePath });
    const normalized = normalizeResumeText(result.value);
    const charCount = normalized.length;
    const wordCount = normalized ? normalized.split(/\s+/).filter(Boolean).length : 0;
    const durationMs = Math.round(performance.now() - startTime);

    if (charCount < 40 || wordCount < 8) {
      console.log(`[ResumeParser] file="${fileName}" format=docx chars=${charCount} duration=${durationMs}ms errorCode=DOCX_EMPTY`);
      return {
        success: false,
        format: "docx",
        pageCount: 1,
        extractedPages: 0,
        extractedChars: charCount,
        text: "",
        fileName,
        filePath,
        warnings: ["DOCX document contains insufficient text"],
        errorCode: "DOCX_PARSE_ERROR",
        errorMessage: `"${fileName}" contains insufficient readable text.`,
      };
    }

    console.log(
      `[ResumeParser] file="${fileName}" format=docx chars=${charCount} words=${wordCount} duration=${durationMs}ms success=true`
    );

    return {
      success: true,
      format: "docx",
      pageCount: 1,
      extractedPages: 1,
      extractedChars: charCount,
      text: normalized,
      fileName,
      filePath,
      warnings: [],
    };
  } catch (err: any) {
    const durationMs = Math.round(performance.now() - startTime);
    console.error(`[ResumeParser] file="${fileName}" format=docx error="${err.message}" duration=${durationMs}ms`);
    return {
      success: false,
      format: "docx",
      pageCount: 0,
      extractedPages: 0,
      extractedChars: 0,
      text: "",
      fileName,
      filePath,
      warnings: [err.message],
      errorCode: "DOCX_PARSE_ERROR",
      errorMessage: `Failed to parse Word document "${fileName}": ${err.message}`,
    };
  }
}

async function parseTxtFile(filePath: string, fileName: string, startTime: number): Promise<ResumeParseResult> {
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    const normalized = normalizeResumeText(raw);
    const charCount = normalized.length;
    const wordCount = normalized ? normalized.split(/\s+/).filter(Boolean).length : 0;
    const durationMs = Math.round(performance.now() - startTime);

    if (charCount < 40 || wordCount < 8) {
      return {
        success: false,
        format: "txt",
        pageCount: 1,
        extractedPages: 0,
        extractedChars: charCount,
        text: "",
        fileName,
        filePath,
        warnings: ["Text file contains insufficient text"],
        errorCode: "TXT_READ_ERROR",
        errorMessage: `"${fileName}" contains insufficient readable text.`,
      };
    }

    console.log(
      `[ResumeParser] file="${fileName}" format=txt chars=${charCount} words=${wordCount} duration=${durationMs}ms success=true`
    );

    return {
      success: true,
      format: "txt",
      pageCount: 1,
      extractedPages: 1,
      extractedChars: charCount,
      text: normalized,
      fileName,
      filePath,
      warnings: [],
    };
  } catch (err: any) {
    return {
      success: false,
      format: "txt",
      pageCount: 0,
      extractedPages: 0,
      extractedChars: 0,
      text: "",
      fileName,
      filePath,
      warnings: [err.message],
      errorCode: "TXT_READ_ERROR",
      errorMessage: `Failed to read text file "${fileName}": ${err.message}`,
    };
  }
}
