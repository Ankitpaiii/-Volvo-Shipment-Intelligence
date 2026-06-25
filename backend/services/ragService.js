import { supabase } from '../config/supabase.js';

/**
 * Generates a deterministic 384-dimensional unit-normalized vector for a given text.
 * Uses a word-hash projection algorithm to run instantly and offline without model dependencies.
 */
export const getEmbedding = (text) => {
  const vector = new Array(384).fill(0);
  const cleanText = text.toLowerCase().replace(/[^a-z0-9]/g, ' ');
  const words = cleanText.split(/\s+/).filter(w => w.length > 2);

  if (words.length === 0) {
    for (let i = 0; i < 384; i++) {
      vector[i] = Math.sin(i);
    }
  } else {
    for (const word of words) {
      for (let i = 0; i < 384; i++) {
        let hash = 0;
        for (let c = 0; c < word.length; c++) {
          hash = (hash * 31 + word.charCodeAt(c) + i) & 0xffffffff;
        }
        const val = ((Math.abs(hash) % 2000) / 1000) - 1; // value between -1.0 and 1.0
        vector[i] += val;
      }
    }
  }

  // L2 normalization
  let norm = 0;
  for (let i = 0; i < 384; i++) {
    norm += vector[i] * vector[i];
  }
  norm = Math.sqrt(norm);

  if (norm > 0) {
    for (let i = 0; i < 384; i++) {
      vector[i] /= norm;
    }
  }

  return vector;
};

/**
 * Splits text into chunks of specified size and overlap.
 */
export const chunkText = (text, chunkSize = 800, overlap = 200) => {
  const chunks = [];
  let startIndex = 0;

  if (!text) return chunks;

  while (startIndex < text.length) {
    let endIndex = startIndex + chunkSize;
    if (endIndex < text.length) {
      // Find a clean boundary (sentence or word boundary) near the end
      const boundaryIndex = text.lastIndexOf('. ', endIndex);
      if (boundaryIndex > startIndex + chunkSize - overlap) {
        endIndex = boundaryIndex + 1; // Include the period
      } else {
        const spaceIndex = text.lastIndexOf(' ', endIndex);
        if (spaceIndex > startIndex + chunkSize - overlap) {
          endIndex = spaceIndex;
        }
      }
    }

    chunks.push(text.substring(startIndex, endIndex).trim());
    startIndex = endIndex - overlap;
    if (startIndex >= text.length - overlap) {
      break;
    }
  }

  return chunks.filter(c => c.length > 10);
};

/**
 * Performs cosine similarity between two 384-dimension vectors.
 */
export const cosineSimilarity = (vecA, vecB) => {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < 384; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  return denominator === 0 ? 0 : dotProduct / denominator;
};

/**
 * Performs semantic search on documents belonging to a student.
 */
export const semanticSearch = async (studentId, queryText, category = null, limit = 5) => {
  try {
    const queryEmbedding = getEmbedding(queryText);

    // 1. Fetch document IDs matching the student (and category if provided)
    let docQuery = supabase
      .from('knowledge_documents')
      .select('id, filename, category')
      .eq('student_id', studentId);

    if (category) {
      docQuery = docQuery.eq('category', category);
    }

    const { data: docs, error: docError } = await docQuery;
    if (docError || !docs || docs.length === 0) {
      return [];
    }

    const docIds = docs.map(d => d.id);

    // 2. Fetch chunks corresponding to those documents
    const { data: chunks, error: chunkError } = await supabase
      .from('knowledge_chunks')
      .select('id, document_id, content, embedding')
      .in('document_id', docIds);

    if (chunkError || !chunks || chunks.length === 0) {
      return [];
    }

    // 3. Compute local cosine similarity (works even if pgvector functions are not registered in RPC)
    const results = chunks.map(chunk => {
      // Handle embedding string or array formats from Supabase pgvector
      let chunkEmbedding = chunk.embedding;
      if (typeof chunkEmbedding === 'string') {
        // format is '[0.1,0.2,...]'
        chunkEmbedding = chunkEmbedding
          .replace(/[\[\]]/g, '')
          .split(',')
          .map(Number);
      }

      const similarity = chunkEmbedding ? cosineSimilarity(queryEmbedding, chunkEmbedding) : 0;
      const docMeta = docs.find(d => d.id === chunk.document_id);

      return {
        chunkId: chunk.id,
        documentId: chunk.document_id,
        filename: docMeta ? docMeta.filename : 'Unknown Document',
        category: docMeta ? docMeta.category : 'general',
        content: chunk.content,
        similarity
      };
    });

    // 4. Sort and return top results
    return results
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);
  } catch (error) {
    console.error('Error in semantic search service:', error);
    return [];
  }
};
