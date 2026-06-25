import { useState, useCallback } from 'react';
import api from '../api/axios';
import toast from 'react-hot-toast';

export function useKnowledge() {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchDocuments = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.get('/api/knowledge/documents');
      setDocuments(response.data.documents || []);
    } catch (err) {
      console.error('Failed to fetch documents:', err);
      toast.error('Failed to load knowledge documents.');
    } finally {
      setLoading(false);
    }
  }, []);

  const uploadDocument = async (file, category) => {
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('category', category);

      const response = await api.post('/api/knowledge/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      setDocuments(prev => [response.data.document, ...prev]);
      toast.success(`Indexed ${file.name} successfully!`);
      return response.data.document;
    } catch (err) {
      console.error('Failed to upload document:', err);
      toast.error(err.response?.data?.error || 'Failed to index PDF document.');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const deleteDocument = async (id) => {
    setLoading(true);
    try {
      await api.delete(`/api/knowledge/documents/${id}`);
      setDocuments(prev => prev.filter(d => d.id !== id));
      toast.success('Document index deleted.');
    } catch (err) {
      console.error('Failed to delete document:', err);
      toast.error('Failed to delete document.');
    } finally {
      setLoading(false);
    }
  };

  const searchKnowledge = async (query, category = null) => {
    setLoading(true);
    try {
      const response = await api.post('/api/knowledge/search', { query, category });
      return response.data.results || [];
    } catch (err) {
      console.error('Failed semantic query:', err);
      toast.error('Semantic search failed.');
      return [];
    } finally {
      setLoading(false);
    }
  };

  return {
    documents,
    loading,
    fetchDocuments,
    uploadDocument,
    deleteDocument,
    searchKnowledge
  };
}
