import { useState, useCallback } from 'react';
import api from '../api/axios';
import toast from 'react-hot-toast';

export function useTasks() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.get('/api/tasks');
      setTasks(response.data.tasks || []);
    } catch (err) {
      console.error('Failed to fetch tasks:', err);
      toast.error('Failed to load tasks list.');
    } finally {
      setLoading(false);
    }
  }, []);

  const createTask = async (taskPayload) => {
    setLoading(true);
    try {
      const response = await api.post('/api/tasks', taskPayload);
      toast.success('Task added! WhatsApp reminder set ✅');
      await fetchTasks(); // Re-fetch from Supabase to keep states aligned
      return response.data.task;
    } catch (err) {
      console.error('Failed to create task:', err);
      toast.error(err.response?.data?.error || 'Failed to create task.');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const updateTaskStatus = async (taskId, newStatus) => {
    setLoading(true);
    try {
      const response = await api.patch(`/api/tasks/${taskId}`, { status: newStatus });
      toast.success(`Task status updated to ${newStatus}`);
      await fetchTasks(); // Re-fetch from Supabase to keep states aligned
      return response.data.task;
    } catch (err) {
      console.error('Failed to update task status:', err);
      toast.error('Failed to update task status.');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const deleteTask = async (taskId) => {
    setLoading(true);
    try {
      await api.delete(`/api/tasks/${taskId}`);
      toast.success('Task deleted successfully.');
      await fetchTasks(); // Re-fetch from Supabase to keep states aligned
    } catch (err) {
      console.error('Failed to delete task:', err);
      toast.error('Failed to delete task.');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return {
    tasks,
    loading,
    fetchTasks,
    createTask,
    updateTaskStatus,
    deleteTask
  };
}
