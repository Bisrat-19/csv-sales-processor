import { parentPort, workerData } from 'worker_threads';
import fs from 'fs';
import path from 'path';
import { aggregateFromFilePath, mapToCsv } from './services/csvProcessor';
import { v4 as uuidv4 } from 'uuid';

async function run() {
  const inputPath: string = workerData.inputPath;
  const outputDir: string = workerData.outputDir;

  const start = Date.now();

  try {
  // Aggregate the CSV using streaming. This keeps memory usage low
  // even for very large CSV files since rows are processed incrementally.
  const totals = await aggregateFromFilePath(inputPath);

    const fileName = `${uuidv4()}.csv`;
    const outPath = path.join(outputDir, fileName);
  // Write CSV output to disk. File names use UUIDs to avoid collisions
  // and to make it easy to reference them later.
  const csv = mapToCsv(totals);
  await fs.promises.writeFile(outPath, csv, 'utf-8');

  // Collect simple metrics for the caller: processing time and number of departments
  const processingTimeMs = Date.now() - start;
  const departmentCount = totals.size;

  // Send a message back to the parent thread with the result and metrics.
  parentPort?.postMessage({ status: 'done', fileName, metrics: { processingTimeMs, departmentCount } });
  } catch (err: any) {
    parentPort?.postMessage({ status: 'failed', error: (err && err.message) || String(err) });
  }
}

run();
