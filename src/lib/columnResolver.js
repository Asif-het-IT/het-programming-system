/**
 * Column Letter Resolver
 * Converts Excel-style column letters (A, B, AA, AB) to indices
 * A=0, B=1, Z=25, AA=26, AB=27, etc.
 */

export function colLetterToIndex(col) {
  if (!col || typeof col !== 'string') return -1;
  
  const letter = col.trim().toUpperCase();
  let index = 0;
  
  for (let i = 0; i < letter.length; i++) {
    const charCode = letter.charCodeAt(i);
    if (charCode < 65 || charCode > 90) return -1;
    
    index = index * 26 + (charCode - 64);
  }
  
  return index - 1;
}

export function indexToColLetter(index) {
  if (index < 0) return '';
  
  let col = '';
  let num = index + 1;
  
  while (num > 0) {
    const remainder = (num - 1) % 26;
    col = String.fromCharCode(65 + remainder) + col;
    num = Math.floor((num - 1) / 26);
  }
  
  return col;
}

export function resolveColumnIndices(columnsList = []) {
  return columnsList
    .map(col => colLetterToIndex(col))
    .filter(idx => idx >= 0);
}

export function extractColumnsFromRow(row = [], columnIndices = []) {
  if (columnIndices.length === 0) return row;
  return columnIndices.map(idx => row[idx] ?? '');
}

export function parseCSVLine(line = '') {
  const result = [];
  let current = '';
  let insideQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];
    
    if (char === '"') {
      if (insideQuotes && nextChar === '"') {
        current += '"';
        i++;
      } else {
        insideQuotes = !insideQuotes;
      }
    } else if (char === ',' && !insideQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  
  result.push(current.trim());
  return result;
}

export function parseCSV(csvText = '') {
  const lines = csvText.split('\n').filter(l => l.trim());
  if (lines.length === 0) return [];
  
  const headers = parseCSVLine(lines[0]);
  const rows = [];
  
  for (let i = 1; i < lines.length; i++) {
    const row = parseCSVLine(lines[i]);
    const obj = {};
    
    headers.forEach((header, idx) => {
      obj[header] = row[idx] ?? '';
    });
    
    rows.push(obj);
  }
  
  return rows;
}

export function filterRowsByColumns(rows = [], columnsList = []) {
  if (columnsList.length === 0 || rows.length === 0) return rows;
  
  const columnIndices = resolveColumnIndices(columnsList);
  
  return rows.map(rowData => {
    const filtered = {};
    
    columnsList.forEach((col, idx) => {
      const colIndex = columnIndices[idx];
      if (colIndex >= 0) {
        const key = col;
        filtered[key] = Array.isArray(rowData) ? rowData[colIndex] : rowData[key];
      }
    });
    
    return filtered;
  });
}
