import { useState } from 'react';
import api from '../api/axios';
import toast from 'react-hot-toast';

export function useAI() {
  const [loading, setLoading] = useState(false);

  const fetchStudyTip = async () => {
    setLoading(true);
    try {
      const response = await api.post('/api/ai/tip');
      return response.data.tip;
    } catch (err) {
      console.error('Failed to fetch study tip:', err);
      toast.error('Failed to load study tip of the day.');
      return null;
    } finally {
      setLoading(false);
    }
  };

  const summarizeNotice = async (noticeText, phoneList = null) => {
    setLoading(true);
    try {
      const payload = { noticeText };
      if (phoneList && phoneList.length > 0) {
        payload.phoneList = phoneList;
      }
      const response = await api.post('/api/ai/summarize', payload);
      return response.data;
    } catch (err) {
      console.error('Failed to summarize notice:', err);
      toast.error(err.response?.data?.error || 'Failed to process notice summary.');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const generateFlashcards = async (notes) => {
    setLoading(true);
    try {
      const response = await api.post('/api/ai/flashcards', { notes });
      return response.data.flashcards || [];
    } catch (err) {
      console.error('Failed to generate flashcards:', err);
      toast.error(err.response?.data?.error || 'Failed to generate study flashcards.');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const checkAttendanceRisk = async (attendanceData) => {
    setLoading(true);
    try {
      const response = await api.post('/api/ai/attendance', { attendanceData });
      return response.data;
    } catch (err) {
      console.error('Failed to check attendance:', err);
      toast.error(err.response?.data?.error || 'Failed to perform attendance analysis.');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const generateMCQs = async (notes, subject, topic, count = 5) => {
    setLoading(true);
    try {
      const response = await api.post('/api/ai/mcq', { notes, subject, topic, count });
      return response.data.mcqs || [];
    } catch (err) {
      console.error('Failed to generate MCQs:', err);
      toast.error(err.response?.data?.error || 'Failed to generate MCQs.');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return {
    loading,
    fetchStudyTip,
    summarizeNotice,
    generateFlashcards,
    checkAttendanceRisk,
    generateMCQs
  };
}
