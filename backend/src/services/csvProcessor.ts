import csvParser from 'csv-parser';
import { Readable } from 'stream';
import fs from 'fs';

/**
 * Normalize a CSV header into a compact key used for header matching.
 * Removes whitespace and lowercases the header so similar headers
 * like "Department Name" and "departmentname" match.
 */
function normalizeKey(k: string) {
  return k.replace(/\s+/g, '').toLowerCase();
}

/**
 * Aggregate sales totals from a Readable CSV stream.
 *
 * This function uses streaming parsing (`csv-parser`) so it can
 * handle very large CSV files that don't fit in memory. It returns
 * a Map keyed by Department Name with aggregated totals.
 *
 * The function attempts to detect header names by normalizing the
 * CSV headers and matching ones that contain `department` and `sales`.
 */
export async function aggregateFromStream(stream: Readable): Promise<Map<string, number>> {
  return new Promise((resolve, reject) => {
    const totals = new Map<string, number>();

    let headersMap: Record<string, string> | null = null;

    stream
      .pipe(csvParser())
      .on('headers', (headers: string[]) => {
        headersMap = {} as Record<string, string>;
        for (const h of headers) {
          headersMap[normalizeKey(h)] = h;
        }
      })
      .on('data', (row: Record<string, any>) => {
        try {
          if (!headersMap) return;
          // Determine which header corresponds to the department column
          const depKey = headersMap['departmentname'] || headersMap['departmentname,'] || Object.keys(headersMap).find(k => k.includes('department')) ? headersMap[Object.keys(headersMap).find(k => k.includes('department')) as string] : null;

          // Determine which header corresponds to the sales/number column
          const salesKey = headersMap['numberofsales'] || Object.keys(headersMap).find(k => k.includes('sales')) ? headersMap[Object.keys(headersMap).find(k => k.includes('sales')) as string] : null;

          const dept = depKey ? (row[depKey] || '').toString().trim() : '';
          const salesRaw = salesKey ? (row[salesKey] || '0').toString().replace(/[^0-9\-\.]/g, '') : '0';
          const sales = parseInt(salesRaw, 10) || 0;

          if (!dept) return;
          const prev = totals.get(dept) || 0;
          totals.set(dept, prev + sales);
        } catch (err) {
          // Swallow row-level errors so a single bad row doesn't abort the whole file.
          // In production, consider logging or recording malformed rows.
        }
      })
      .on('end', () => resolve(totals))
      .on('error', (err) => reject(err));
  });
}

// If the CSV file does not include headers this function parse it with forced headers: department, date, sales.
export async function aggregateFromFilePath(filePath: string): Promise<Map<string, number>> {
  return new Promise((resolve, reject) => {
    const totals = new Map<string, number>();

    const stream = fs.createReadStream(filePath).pipe(csvParser({ headers: ['department', 'date', 'sales'] }));

    stream
      .on('data', (row: Record<string, any>) => {
        try {
          const dept = (row['department'] || '').toString().trim();
          const salesRaw = (row['sales'] || '0').toString().replace(/[^0-9\-\.]/g, '');
          const sales = parseInt(salesRaw, 10) || 0;
          if (!dept) return;
          const prev = totals.get(dept) || 0;
          totals.set(dept, prev + sales);
        } catch (_err) {
          // ignore row errors
        }
      })
      .on('end', () => resolve(totals))
      .on('error', (err) => reject(err));
  });
}

export function mapToCsv(totals: Map<string, number>) {
  const lines = ['Department Name,Total Number of Sales'];
  for (const [dep, total] of totals) {
    const safeDep = dep.includes(',') ? `"${dep.replace(/"/g, '""')}"` : dep;
    lines.push(`${safeDep},${total}`);
  }
  return lines.join('\n');
}
