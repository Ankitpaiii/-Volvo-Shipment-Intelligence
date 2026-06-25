import { supabase } from '../config/supabase.js';
import * as groqService from '../services/groqService.js';
import * as n8nService from '../services/n8nService.js';
import { semanticSearch } from '../services/ragService.js';

/**
 * List all companies tracked by the student.
 */
export const getCompanies = async (req, res) => {
  const studentId = req.user.id;

  try {
    const { data: companies, error } = await supabase
      .from('placement_companies')
      .select('*')
      .eq('student_id', studentId)
      .order('created_at', { ascending: false });

    if (error) {
      return res.status(500).json({ error: 'Failed to retrieve companies.' });
    }

    return res.status(200).json({ companies });
  } catch (error) {
    console.error('Error in getCompanies:', error);
    return res.status(500).json({ error: 'An unexpected error occurred.' });
  }
};

/**
 * Track a new placement company.
 */
export const addCompany = async (req, res) => {
  const { company_name, role, status, notes, interview_rounds } = req.body;
  const studentId = req.user.id;

  if (!company_name) {
    return res.status(400).json({ error: 'Company name is required.' });
  }

  try {
    const { data: company, error } = await supabase
      .from('placement_companies')
      .insert({
        student_id: studentId,
        company_name,
        role: role || '',
        status: status || 'applied',
        notes: notes || '',
        interview_rounds: interview_rounds || []
      })
      .select()
      .single();

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    return res.status(201).json({ success: true, company });
  } catch (error) {
    console.error('Error in addCompany:', error);
    return res.status(500).json({ error: 'An unexpected error occurred.' });
  }
};

/**
 * Update tracked company status or details.
 * If status changes to 'interview' and date is scheduled, triggers n8n alert.
 */
export const updateCompany = async (req, res) => {
  const companyId = req.params.id;
  const studentId = req.user.id;
  const { company_name, role, status, notes, interview_rounds } = req.body;

  try {
    // 1. Fetch current company details
    const { data: current, error: fetchErr } = await supabase
      .from('placement_companies')
      .select('*')
      .eq('id', companyId)
      .eq('student_id', studentId)
      .single();

    if (fetchErr || !current) {
      return res.status(404).json({ error: 'Company track not found.' });
    }

    // 2. Perform database update
    const { data: updated, error: updateErr } = await supabase
      .from('placement_companies')
      .update({
        company_name: company_name || current.company_name,
        role: role !== undefined ? role : current.role,
        status: status || current.status,
        notes: notes !== undefined ? notes : current.notes,
        interview_rounds: interview_rounds || current.interview_rounds
      })
      .eq('id', companyId)
      .select()
      .single();

    if (updateErr) {
      return res.status(500).json({ error: updateErr.message });
    }

    // 3. Check if status updated to 'interview' OR an interview is newly scheduled
    const wasAlreadyInterview = current.status === 'interview';
    const isNowInterview = updated.status === 'interview';

    // Look for scheduled interviews in rounds
    const nextRound = updated.interview_rounds.find(r => r.date && r.status === 'scheduled');
    
    if (isNowInterview && nextRound && (!wasAlreadyInterview || nextRound.date !== (current.interview_rounds.find(r => r.status === 'scheduled')?.date))) {
      // Trigger n8n webhook and log
      const { data: student } = await supabase
        .from('students')
        .select('*')
        .eq('id', studentId)
        .single();

      if (student) {
        const triggered = await n8nService.triggerPlacementReminder({
          studentName: student.name,
          phone: student.phone,
          companyName: updated.company_name,
          role: updated.role,
          interviewDate: nextRound.date,
          roundName: nextRound.name || 'Interview Round'
        });

        await supabase
          .from('automation_logs')
          .insert({
            student_id: studentId,
            type: 'placement_reminder',
            payload: {
              companyName: updated.company_name,
              role: updated.role,
              interviewDate: nextRound.date,
              roundName: nextRound.name
            },
            status: triggered ? 'success' : 'failed'
          });
      }
    }

    return res.status(200).json({ success: true, company: updated });
  } catch (error) {
    console.error('Error in updateCompany:', error);
    return res.status(500).json({ error: 'An unexpected error occurred.' });
  }
};

/**
 * Remove tracked company.
 */
export const deleteCompany = async (req, res) => {
  const companyId = req.params.id;
  const studentId = req.user.id;

  try {
    const { error } = await supabase
      .from('placement_companies')
      .delete()
      .eq('id', companyId)
      .eq('student_id', studentId);

    if (error) {
      return res.status(500).json({ error: 'Failed to delete tracked company.' });
    }

    return res.status(200).json({ success: true, message: 'Tracked company deleted successfully.' });
  } catch (error) {
    console.error('Error in deleteCompany:', error);
    return res.status(500).json({ error: 'An unexpected error occurred.' });
  }
};

/**
 * Generate a new DSA Problem.
 */
export const getDSAProblem = async (req, res) => {
  const { topic, difficulty } = req.body;
  if (!topic || !difficulty) {
    return res.status(400).json({ error: 'Topic and difficulty are required.' });
  }

  try {
    const problem = await groqService.generateDSAProblem(topic, difficulty);
    return res.status(200).json({ success: true, problem });
  } catch (error) {
    console.error('Error generating DSA problem:', error);
    return res.status(500).json({ error: 'Failed to generate DSA problem.' });
  }
};

/**
 * Conduct Mock Interview questions.
 */
export const startMockInterview = async (req, res) => {
  const { type, studentContext } = req.body;
  const studentId = req.user.id;

  if (!type) {
    return res.status(400).json({ error: 'Interview type is required.' });
  }

  try {
    let finalContext = studentContext || 'General engineering student';
    try {
      const matches = await semanticSearch(studentId, type, 'placement', 2);
      if (matches && matches.length > 0) {
        const matchText = matches.map(m => m.content).join('\n');
        finalContext += `\n\nAdditional relevant placement study guide:\n${matchText}`;
      }
    } catch (ragErr) {
      console.error('RAG lookup failed during placement interview prep:', ragErr);
    }

    const interview = await groqService.conductMockInterview(type, finalContext);
    return res.status(200).json({ success: true, interview });
  } catch (error) {
    console.error('Error starting mock interview:', error);
    return res.status(500).json({ error: 'Failed to start mock interview.' });
  }
};

/**
 * Evaluate Mock Interview answers.
 */
export const evaluateInterview = async (req, res) => {
  const { questions, answers } = req.body;
  if (!questions || !answers || !Array.isArray(questions) || !Array.isArray(answers)) {
    return res.status(400).json({ error: 'Questions and answers arrays are required.' });
  }

  try {
    const evaluation = await groqService.evaluateInterviewAnswers(questions, answers);
    return res.status(200).json({ success: true, evaluation });
  } catch (error) {
    console.error('Error evaluating interview answers:', error);
    return res.status(500).json({ error: 'Failed to evaluate mock interview.' });
  }
};

/**
 * Evaluate ATS Resume compatibility.
 */
export const analyzeATSResume = async (req, res) => {
  const { resumeText, targetRole } = req.body;
  if (!resumeText) {
    return res.status(400).json({ error: 'Resume text is required.' });
  }

  try {
    const analysis = await groqService.analyzeResume(resumeText, targetRole);
    return res.status(200).json({ success: true, analysis });
  } catch (error) {
    console.error('Error analyzing resume:', error);
    return res.status(500).json({ error: 'Failed to analyze resume.' });
  }
};
