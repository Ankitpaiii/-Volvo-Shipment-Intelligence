import { supabase } from '../config/supabase.js';
import * as n8nService from '../services/n8nService.js';

/**
 * Retrieve tasks for the logged in student
 */
export const getTasks = async (req, res) => {
  try {
    const { data: tasks, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('student_id', req.user.id)
      .order('deadline', { ascending: true });

    if (error) {
      console.error('Supabase getTasks database error:', error.message);
      return res.status(500).json({ error: error.message });
    }

    return res.status(200).json({ tasks: tasks || [] });
  } catch (err) {
    console.error('getTasks controller error:', err);
    return res.status(500).json({ error: 'An unexpected error occurred while fetching tasks' });
  }
};

/**
 * Create a new task and trigger n8n automation
 */
export const createTask = async (req, res) => {
  const { title, subject, deadline, add_to_calendar } = req.body;

  if (!title || !subject || !deadline) {
    return res.status(400).json({ error: 'Title, subject, and deadline are required fields.' });
  }

  try {
    // 1. Retrieve the student profile info
    const { data: student, error: studentError } = await supabase
      .from('students')
      .select('name, phone')
      .eq('id', req.user.id)
      .single();

    if (studentError || !student) {
      console.error('Failed to fetch student profile details:', studentError?.message);
      return res.status(400).json({ error: 'Student profile details not found.' });
    }

    // 2. Calculate reminder_time (use request payload or fallback to deadline - 24 hours)
    const deadlineDate = new Date(deadline);
    const reminder_time = req.body.reminder_time 
      ? new Date(req.body.reminder_time).toISOString()
      : new Date(deadlineDate.getTime() - 24 * 60 * 60 * 1000).toISOString();

    // 3. Insert task into Supabase table
    const { data: task, error: taskError } = await supabase
      .from('tasks')
      .insert({
        student_id: req.user.id,
        title,
        subject,
        deadline: deadlineDate.toISOString(),
        reminder_time,
        add_to_calendar: add_to_calendar !== false,
        status: 'pending',
        n8n_triggered: false
      })
      .select()
      .single();

    if (taskError) {
      console.error('Supabase task insert error:', taskError.message);
      return res.status(500).json({ error: taskError.message });
    }

    // 4. Trigger n8n webhook (run try/catch so API response doesn't block on network latency or n8n offline state)
    let n8nSuccess = false;
    try {
      n8nSuccess = await n8nService.triggerDeadlineReminder({
        studentName: student.name,
        phone: student.phone,
        subject,
        taskTitle: title,
        deadline: deadlineDate.toISOString(),
        reminderTime: reminder_time
      });
    } catch (webhookErr) {
      console.error('n8n integration error:', webhookErr);
    }

    // 5. Update task state if webhook successfully resolved
    if (n8nSuccess) {
      const { error: updateError } = await supabase
        .from('tasks')
        .update({ n8n_triggered: true })
        .eq('id', task.id);
      
      if (updateError) {
        console.error('Failed to update task n8n_triggered status:', updateError.message);
      } else {
        task.n8n_triggered = true;
      }
    }

    // 6. Record to automation log table
    const { error: logError } = await supabase
      .from('automation_logs')
      .insert({
        student_id: req.user.id,
        type: 'deadline_reminder',
        payload: {
          studentName: student.name,
          phone: student.phone,
          subject,
          taskTitle: title,
          deadline: deadlineDate.toISOString(),
          reminderTime: reminder_time,
          add_to_calendar: add_to_calendar !== false
        },
        status: n8nSuccess ? 'success' : 'failed'
      });

    if (logError) {
      console.error('Failed to create automation_logs entry:', logError.message);
    }

    // 7. Return created task details
    return res.status(201).json({ task });
  } catch (err) {
    console.error('createTask controller error:', err);
    return res.status(500).json({ error: 'An unexpected error occurred while creating the task' });
  }
};

/**
 * Patch task status (pending | done)
 */
export const updateTaskStatus = async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (status !== 'pending' && status !== 'done') {
    return res.status(400).json({ error: "Status must be 'pending' or 'done'" });
  }

  try {
    const { data: task, error } = await supabase
      .from('tasks')
      .update({ status })
      .eq('id', id)
      .eq('student_id', req.user.id)
      .select()
      .single();

    if (error) {
      console.error('Task status update db error:', error.message);
      return res.status(500).json({ error: error.message });
    }

    return res.status(200).json({ task });
  } catch (err) {
    console.error('updateTaskStatus controller error:', err);
    return res.status(500).json({ error: 'An unexpected error occurred while updating task status' });
  }
};

/**
 * Delete a task
 */
export const deleteTask = async (req, res) => {
  const { id } = req.params;

  try {
    const { error } = await supabase
      .from('tasks')
      .delete()
      .eq('id', id)
      .eq('student_id', req.user.id);

    if (error) {
      console.error('Task deletion database error:', error.message);
      return res.status(500).json({ error: error.message });
    }

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('deleteTask controller error:', err);
    return res.status(500).json({ error: 'An unexpected error occurred while deleting the task' });
  }
};
