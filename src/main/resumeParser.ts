import fs from "fs";
import path from "path";
import pdfParse from "pdf-parse";
import mammoth from "mammoth";

export async function parsePDF(filePath: string): Promise<string> {
  const dataBuffer = fs.readFileSync(filePath);
  const data = await pdfParse(dataBuffer);
  return data.text;
}

export async function parseDOCX(filePath: string): Promise<string> {
  const result = await mammoth.extractRawText({ path: filePath });
  return result.value;
}

export async function parseResume(filePath: string): Promise<string> {
  try {
    const ext = path.extname(filePath).toLowerCase();
    if (ext === ".pdf") {
      return await parsePDF(filePath);
    } else if (ext === ".docx") {
      return await parseDOCX(filePath);
    } else if (ext === ".txt") {
      return fs.readFileSync(filePath, "utf-8");
    } else {
      throw new Error("Unsupported file type");
    }
  } catch (error: any) {
    return `Error parsing resume: ${error.message}`;
  }
}
