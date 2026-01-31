import { execFile } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { fileURLToPath } from 'url';

const execFileAsync = promisify(execFile);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const OCR_HELPER_PATH = path.join(__dirname, '..', 'ocr-helper');

interface OCRResult {
  text: string;
  confidence: number;
}

interface OCRError {
  error: string;
}

export async function processImageOCR(imagePath: string): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync(OCR_HELPER_PATH, [imagePath], {
      timeout: 30000, // 30 second timeout per image
    });

    const result = JSON.parse(stdout) as OCRResult | OCRError;

    if ('error' in result) {
      console.error(`OCR error for ${imagePath}:`, result.error);
      return null;
    }

    return result.text;
  } catch (error) {
    console.error(`Failed to process OCR for ${imagePath}:`, error);
    return null;
  }
}
