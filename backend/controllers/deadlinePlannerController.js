import { supabase } from '../config/supabase.js';
import * as groqService from '../services/groqService.js';
import * as n8nService from '../services/n8nService.js';

/**
 * Generate a smart study plan and trigger WhatsApp + Calendar study reminders.
 */
export const createStudyPlan = async (req, res) => {
  const { subject, deadline, difficulty, estimatedHours } = req.body;
  const studentId = req.user.id;

  if (!subject || !deadline || !difficulty || !estimatedHours) {
    return res.status(400).json({ error: 'All fields (subject, deadline, difficulty, estimatedHours) are required.' });
  }

  try {
    // 1. Fetch student's profile
    const { data: student, error: studentError } = await supabase
      .from('students')
      .select('*')
      .eq('id', studentId)
      .single();

    if (studentError || !student) {
      console.error('Student fetch error:', studentError);
      return res.status(404).json({ error: 'Student profile not found.' });
    }

    // 2. Call Groq service to generate the study plan
    const currentDate = new Date().toISOString().split('T')[0];
    const aiResult = await groqService.generateStudyPlan({
      subject,
      deadline,
      difficulty,
      estimatedHours,
      currentDate
    });

    if (!aiResult || !aiResult.studyPlan) {
      return res.status(500).json({ error: 'Failed to generate study plan from AI service.' });
    }

    // 3. Trigger n8n Study Reminder webhook
    const triggered = await n8nService.triggerStudyReminder({
      studentName: student.name,
      phone: student.phone,
      subject,
      deadline,
      studyPlan: aiResult.studyPlan
    });

    // 4. Log the automation
    const { error: logError } = await supabase
      .from('automation_logs')
      .insert({
        student_id: studentId,
        type: 'study_reminder',
        payload: {
          subject,
          deadline,
          difficulty,
          estimatedHours,
          studyPlan: aiResult.studyPlan,
          revisionDays: aiResult.revisionDays,
          recommendation: aiResult.recommendation
        },
        status: triggered ? 'success' : 'failed'
      });

    if (logError) {
      console.error('Failed to insert automation log:', logError.message);
    }

    return res.status(200).json({
      success: true,
      studyPlan: aiResult.studyPlan,
      revisionDays: aiResult.revisionDays,
      totalSessions: aiResult.totalSessions,
      recommendation: aiResult.recommendation,
      automationStatus: triggered ? 'triggered' : 'failed'
    });
  } catch (error) {
    console.error('Error in createStudyPlan controller:', error);
    return res.status(500).json({ error: error.message || 'An error occurred while generating your study plan.' });
  }
};
