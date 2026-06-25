import { useState, useCallback } from 'react';
import api from '../api/axios';
import toast from 'react-hot-toast';

export function usePlacement() {
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchCompanies = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.get('/api/placement/companies');
      setCompanies(response.data.companies || []);
    } catch (err) {
      console.error('Failed to fetch tracked companies:', err);
      toast.error('Failed to load placement track.');
    } finally {
      setLoading(false);
    }
  }, []);

  const addCompany = async (payload) => {
    setLoading(true);
    try {
      const response = await api.post('/api/placement/companies', payload);
      setCompanies(prev => [response.data.company, ...prev]);
      toast.success(`${payload.company_name} added to tracker.`);
      return response.data.company;
    } catch (err) {
      console.error('Failed to add company:', err);
      toast.error(err.response?.data?.error || 'Failed to add company.');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const updateCompany = async (id, payload) => {
    setLoading(true);
    try {
      const response = await api.patch(`/api/placement/companies/${id}`, payload);
      setCompanies(prev => prev.map(c => c.id === id ? response.data.company : c));
      toast.success('Company tracker updated.');
      return response.data.company;
    } catch (err) {
      console.error('Failed to update company:', err);
      toast.error(err.response?.data?.error || 'Failed to update company.');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const deleteCompany = async (id) => {
    setLoading(true);
    try {
      await api.delete(`/api/placement/companies/${id}`);
      setCompanies(prev => prev.filter(c => c.id !== id));
      toast.success('Company removed from tracker.');
    } catch (err) {
      console.error('Failed to delete company:', err);
      toast.error('Failed to remove company.');
    } finally {
      setLoading(false);
    }
  };

  // AI Placement Prep helpers
  const generateDSA = async (topic, difficulty) => {
    setLoading(true);
    try {
      const response = await api.post('/api/placement/dsa-problem', { topic, difficulty });
      return response.data.problem;
    } catch (err) {
      console.error('Failed to generate DSA problem:', err);
      toast.error('Failed to generate DSA question.');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const startMockInterview = async (type, studentContext) => {
    setLoading(true);
    try {
      const response = await api.post('/api/placement/mock-interview', { type, studentContext });
      return response.data.interview;
    } catch (err) {
      console.error('Failed to generate interview:', err);
      toast.error('Failed to generate mock interview questions.');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const submitInterviewAnswers = async (questions, answers) => {
    setLoading(true);
    try {
      const response = await api.post('/api/placement/evaluate-interview', { questions, answers });
      return response.data.evaluation;
    } catch (err) {
      console.error('Failed to evaluate interview answers:', err);
      toast.error('Failed to submit interview answers for feedback.');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const analyzeResumeATS = async (resumeText, targetRole) => {
    setLoading(true);
    try {
      const response = await api.post('/api/placement/resume-analyze', { resumeText, targetRole });
      return response.data.analysis;
    } catch (err) {
      console.error('Failed to analyze resume:', err);
      toast.error('Failed to complete ATS resume analysis.');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return {
    companies,
    loading,
    fetchCompanies,
    addCompany,
    updateCompany,
    deleteCompany,
    generateDSA,
    startMockInterview,
    submitInterviewAnswers,
    analyzeResumeATS
  };
}
