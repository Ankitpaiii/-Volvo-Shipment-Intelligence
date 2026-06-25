import { supabase } from '../config/supabase.js';
import * as groqService from '../services/groqService.js';
import { semanticSearch } from '../services/ragService.js';

/**
 * Validate a student's startup idea and persist the report.
 */
export const validateStartup = async (req, res) => {
  const { idea, problem, solution, targetAudience } = req.body;
  const studentId = req.user.id;

  if (!idea || !problem || !solution || !targetAudience) {
    return res.status(400).json({ error: 'All fields (idea, problem, solution, targetAudience) are required.' });
  }

  try {
    // 1. Check for relevant RAG context in 'startup' category documents
    let problemWithContext = problem;
    try {
      const matches = await semanticSearch(studentId, idea + ' ' + problem, 'startup', 2);
      if (matches && matches.length > 0) {
        const matchText = matches.map(m => m.content).join('\n');
        problemWithContext += `\n\nAdditional relevant research files context:\n${matchText}`;
      }
    } catch (ragErr) {
      console.error('RAG lookup failed during startup validator check:', ragErr);
    }

    // 2. Generate the validation report from Groq service
    const analysis = await groqService.validateStartupIdea({
      idea,
      problem: problemWithContext,
      solution,
      targetAudience
    });

    if (!analysis) {
      return res.status(500).json({ error: 'AI startup validation failed.' });
    }

    // 2. Persist in database
    const { data: report, error: dbError } = await supabase
      .from('startup_reports')
      .insert({
        student_id: studentId,
        idea,
        analysis
      })
      .select()
      .single();

    if (dbError) {
      console.error('Error saving startup report:', dbError.message);
      return res.status(500).json({ error: 'Failed to save startup validation report.' });
    }

    // 3. Log the automation
    await supabase
      .from('automation_logs')
      .insert({
        student_id: studentId,
        type: 'startup_report',
        payload: {
          reportId: report.id,
          ideaTitle: idea,
          riskScore: analysis.riskScore,
          feasibilityScore: analysis.feasibilityScore
        },
        status: 'success'
      });

    return res.status(200).json({
      success: true,
      report
    });
  } catch (error) {
    console.error('Error in validateStartup:', error);
    return res.status(500).json({ error: error.message || 'Failed to analyze and validate startup idea.' });
  }
};

/**
 * List all saved startup reports for the logged-in student.
 */
export const getStartupReports = async (req, res) => {
  const studentId = req.user.id;

  try {
    const { data: reports, error } = await supabase
      .from('startup_reports')
      .select('*')
      .eq('student_id', studentId)
      .order('created_at', { ascending: false });

    if (error) {
      return res.status(500).json({ error: 'Failed to retrieve startup reports.' });
    }

    return res.status(200).json({ reports });
  } catch (error) {
    console.error('Error in getStartupReports:', error);
    return res.status(500).json({ error: 'An unexpected error occurred.' });
  }
};

/**
 * Delete a startup report.
 */
export const deleteStartupReport = async (req, res) => {
  const studentId = req.user.id;
  const reportId = req.params.id;

  try {
    const { error } = await supabase
      .from('startup_reports')
      .delete()
      .eq('id', reportId)
      .eq('student_id', studentId);

    if (error) {
      return res.status(500).json({ error: 'Failed to delete startup report.' });
    }

    return res.status(200).json({ success: true, message: 'Startup report deleted successfully.' });
  } catch (error) {
    console.error('Error in deleteStartupReport:', error);
    return res.status(500).json({ error: 'An unexpected error occurred.' });
  }
};
