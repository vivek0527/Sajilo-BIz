import { NextRequest, NextResponse } from 'next/server';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { writeFile, unlink, mkdir } from 'fs/promises';
import path from 'path';
import fs from 'fs';

const execFileAsync = promisify(execFile);

export async function POST(req: NextRequest) {
  let tempFilePath = '';
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded', items: [], raw_lines: [] }, { status: 400 });
    }

    // 1. Create temp directory if it doesn't exist
    const tempDir = path.join(process.cwd(), 'scratch', 'temp_uploads');
    if (!fs.existsSync(tempDir)) {
      await mkdir(tempDir, { recursive: true });
    }

    // 2. Write file buffer to temp file
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    
    // Sanitize filename to prevent directory traversal issues
    const sanitizedFileName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
    tempFilePath = path.join(tempDir, sanitizedFileName);
    await writeFile(tempFilePath, buffer);

    // 3. Resolve path to Python interpreter and OCR script
    const isWindows = process.platform === 'win32';
    const pythonPath = isWindows
      ? path.join(process.cwd(), '.venv', 'Scripts', 'python.exe')
      : path.join(process.cwd(), '.venv', 'bin', 'python');

    const scriptPath = path.join(process.cwd(), 'scratch', 'ocr_scan.py');

    if (!fs.existsSync(pythonPath)) {
      return NextResponse.json({
        error: `Python virtual environment interpreter not found at: ${pythonPath}. Please ensure venv is active and packages are installed.`,
        items: [],
        raw_lines: []
      }, { status: 500 });
    }

    // 4. Run the python OCR script
    // Set a timeout of 180 seconds since processing complex documents can take some time
    // Explicitly pass process.env so the subprocess inherits user directories and caches
    const { stdout, stderr } = await execFileAsync(pythonPath, [scriptPath, tempFilePath], {
      timeout: 180000, // 180 seconds
      maxBuffer: 10 * 1024 * 1024, // 10MB stdout buffer limit
      env: { ...process.env }
    });

    // 5. Parse stdout JSON
    try {
      const data = JSON.parse(stdout);
      
      // Add status/warnings from python script if any
      if (stderr && stderr.trim()) {
        console.warn('OCR Script Stderr:', stderr);
      }
      
      return NextResponse.json(data);
    } catch (parseError) {
      console.error('Failed to parse OCR output JSON. Stdout:', stdout, 'Stderr:', stderr);
      return NextResponse.json({
        error: 'OCR script did not return valid JSON output.',
        raw_output: stdout,
        system_error: stderr,
        items: [],
        raw_lines: []
      }, { status: 500 });
    }
  } catch (error: any) {
    console.error('API OCR route error:', error);
    if (error.stdout) console.error('OCR subprocess stdout:', error.stdout);
    if (error.stderr) console.error('OCR subprocess stderr:', error.stderr);
    
    const detailedMessage = error.stderr
      ? `${error.message}\nSubprocess Stderr:\n${error.stderr}`
      : error.message;

    return NextResponse.json({
      error: detailedMessage || 'Internal server error during OCR processing',
      items: [],
      raw_lines: []
    }, { status: 500 });
  } finally {
    // 6. Cleanup temp file
    if (tempFilePath && fs.existsSync(tempFilePath)) {
      await unlink(tempFilePath).catch(err => {
        console.error('Failed to delete temp OCR upload file:', err);
      });
    }
  }
}
