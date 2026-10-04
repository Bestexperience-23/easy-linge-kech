const XLSX = require('xlsx');
const path = require('path');

const filePath = path.resolve('C:/Users/dell/.gemini/antigravity/brain/a1e54513-b0f9-40fd-aec0-413b76a81569/.user_uploaded/media_1790750068935.xlsx');

const workbook = XLSX.readFile(filePath);

console.log('=== SHEET NAMES ===');
console.log(workbook.SheetNames);

for (const sheetName of workbook.SheetNames) {
  console.log(`\n\n========== SHEET: "${sheetName}" ==========`);
  const sheet = workbook.Sheets[sheetName];
  
  // Get range
  const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1');
  console.log(`Range: ${sheet['!ref']}`);
  console.log(`Rows: ${range.e.r + 1}, Cols: ${range.e.c + 1}`);
  
  // Convert to JSON
  const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
  
  // Print all rows
  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    // Filter out completely empty rows
    if (row.some((cell) => cell !== '' && cell !== null && cell !== undefined)) {
      console.log(`Row ${i}: ${JSON.stringify(row)}`);
    }
  }
}
