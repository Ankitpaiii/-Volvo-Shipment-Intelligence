import multer from 'multer';
import { supabase } from '../config/supabase.js';
import { extractTextFromPDF } from '../services/pdfService.js';
import { chunkText, getEmbedding, semanticSearch } from '../services/ragService.js';

// Configure multer memory storage for PDF processing
const storage = multer.memoryStorage();
export const uploadMiddleware = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF documents are allowed.'), false);
    }
  }
}).single('file');

/**
 * Handle document uploading, text extraction, chunking, embedding, and storage.
 */
export const uploadDocument = async (req, res) => {
  const studentId = req.user.id;
  const { category } = req.body;

  if (!req.file) {
    return res.status(400).json({ error: 'Please upload a PDF document.' });
  }

  const allowedCategories = ['academic', 'placement', 'startup'];
  if (!category || !allowedCategories.includes(category)) {
    return res.status(400).json({ error: `Invalid category. Must be one of: ${allowedCategories.join(', ')}` });
  }

  try {
    const filename = req.file.originalname;

    // 1. Extract text from PDF buffer
    const extractedText = await extractTextFromPDF(req.file.buffer);
    if (!extractedText || extractedText.trim().length === 0) {
      return res.status(400).json({ error: 'The PDF document appears to be empty or unscannable.' });
    }

    // 2. Chunk text
    const chunks = chunkText(extractedText);
    if (chunks.length === 0) {
      return res.status(400).json({ error: 'Failed to split text into readable sections.' });
    }

    // 3. Create document record
    const { data: document, error: docError } = await supabase
      .from('knowledge_documents')
      .insert({
        student_id: studentId,
        filename,
        category,
        chunk_count: chunks.length
      })
      .select()
      .single();

    if (docError || !document) {
      console.error('Database error saving document:', docError);
      return res.status(500).json({ error: 'Failed to save document metadata.' });
    }

    // 4. Generate embeddings and save chunks in bulk
    const chunkInsertions = chunks.map((chunk, idx) => {
      const embedding = getEmbedding(chunk);
      return {
        document_id: document.id,
        content: chunk,
        embedding,
        chunk_index: idx
      };
    });

    const { error: chunkError } = await supabase
      .from('knowledge_chunks')
      .insert(chunkInsertions);

    if (chunkError) {
      console.error('Database error saving chunks:', chunkError);
      // Clean up the document record on chunk insertion error (manual rollback)
      await supabase.from('knowledge_documents').delete().eq('id', document.id);
      return res.status(500).json({ error: 'Failed to store document text chunks.' });
    }

    return res.status(201).json({
      success: true,
      message: `Document ${filename} successfully uploaded and index populated with ${chunks.length} chunks.`,
      document
    });
  } catch (error) {
    console.error('Error in uploadDocument controller:', error);
    return res.status(500).json({ error: error.message || 'An error occurred during file upload.' });
  }
};

/**
 * List all documents uploaded by the student.
 */
export const getDocuments = async (req, res) => {
  const studentId = req.user.id;

  try {
    const { data: documents, error } = await supabase
      .from('knowledge_documents')
      .select('*')
      .eq('student_id', studentId)
      .order('created_at', { ascending: false });

    if (error) {
      return res.status(500).json({ error: 'Failed to retrieve documents.' });
    }

    return res.status(200).json({ documents });
  } catch (error) {
    console.error('Error in getDocuments:', error);
    return res.status(500).json({ error: 'An unexpected error occurred.' });
  }
};

/**
 * Delete an uploaded document and its chunks.
 */
export const deleteDocument = async (req, res) => {
  const studentId = req.user.id;
  const documentId = req.params.id;

  try {
    const { error } = await supabase
      .from('knowledge_documents')
      .delete()
      .eq('id', documentId)
      .eq('student_id', studentId);

    if (error) {
      return res.status(500).json({ error: 'Failed to delete document.' });
    }

    return res.status(200).json({ success: true, message: 'Document and text indices deleted successfully.' });
  } catch (error) {
    console.error('Error in deleteDocument:', error);
    return res.status(500).json({ error: 'An unexpected error occurred.' });
  }
};

/**
 * Run semantic search on student's knowledge base.
 */
export const queryKnowledge = async (req, res) => {
  const studentId = req.user.id;
  const { query, category, limit } = req.body;

  if (!query) {
    return res.status(400).json({ error: 'Search query is required.' });
  }

  try {
    const searchResults = await semanticSearch(studentId, query, category, limit || 5);
    return res.status(200).json({ success: true, results: searchResults });
  } catch (error) {
    console.error('Error querying knowledge base:', error);
    return res.status(500).json({ error: 'Failed to process semantic query.' });
  }
};
