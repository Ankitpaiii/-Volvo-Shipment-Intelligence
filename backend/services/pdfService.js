import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pdf = require('pdf-parse');

/**
 * Extract plain text from a PDF file buffer.
 */
export const extractTextFromPDF = async (buffer) => {
  try {
    const data = await pdf(buffer);
    return data.text || '';
  } catch (error) {
    console.error('Error parsing PDF:', error);
    throw new Error('Failed to extract text from PDF document.');
  }
};
