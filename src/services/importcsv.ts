import * as fs from 'fs/promises';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { truncate } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export async function readCSVData(filePath: string): Promise<string[][]> {
  try {
    const absolutePath = path.resolve(__dirname, filePath);
    const csvText = await fs.readFile(absolutePath, 'utf-8');

    const lines = csvText.split('\n');
    const data: string[][] = [];

    for (const line of lines) {
      if (line.trim() !== '') {
        const row = line.split(',');
        data.push(row.map(cell => cell.trim()));
      }
    }

    return data;
  } catch (error) {
    console.error('Error reading CSV file:', error);
    return [];
  }
}

async function processCSV() {
  const csvData = await readCSVData('test.csv');
  console.log(csvData);

  if (csvData.length > 0) {
    console.log('First row, first cell:', csvData[0][0]);
    if (csvData.length > 1 && csvData[1].length > 2) {
      console.log('Second row, third cell:', csvData[1][2]);
    }
  }

  csvData.forEach(row => {
    console.log(row);
  });
}


processCSV();
