import { Readable } from 'stream';
import { aggregateFromStream } from '../src/services/csvProcessor';

function streamFromString(s: string) {
  const r = new Readable();
  r.push(s);
  r.push(null);
  return r;
}

test('aggregateFromStream aggregates totals by department', async () => {
  const csv = `Department Name,Date, Number of Sales\nElectronics,2023-08-01,100\nClothing,2023-08-01,200\nElectronics,2023-08-02,150\n`;
  const stream = streamFromString(csv);
  const totals = await aggregateFromStream(stream as any);
  expect(totals.get('Electronics')).toBe(250);
  expect(totals.get('Clothing')).toBe(200);
});
