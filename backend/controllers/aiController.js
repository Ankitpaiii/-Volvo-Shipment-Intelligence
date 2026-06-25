import * as groqService from '../services/groqService.js';
import * as n8nService from '../services/n8nService.js';
import { supabase } from '../config/supabase.js';

// Regex to validate phone numbers (E.164 format with optional leading '+')
const PHONE_REGEX = /^\+?[1-9]\d{9,14}$/;

/**
 * Generate a study tip of the day
 */
export const tip = async (req, res) => {
  try {
    const response = await groqService.generateStudyTip();
    return res.status(200).json(response);
  } catch (err) {
    console.error('Study tip controller error:', err);
    return res.status(502).json({ error: 'AI service unavailable' });
  }
};

/**
 * Summarize a college notice and optionally broadcast it via n8n/Twilio
 */
export const summarize = async (req, res) => {
  const { noticeText, phoneList } = req.body;

  if (!noticeText) {
    return res.status(400).json({ error: 'Notice text is required.' });
  }

  try {
    // 1. Call Groq service to summarize the notice text
    const aiResponse = await groqService.summarizeNotice(noticeText);
    const { summary, eventTitle, eventDate } = aiResponse;

    // 2. If a phoneList is supplied, validate it and broadcast the summary
    if (phoneList && Array.isArray(phoneList) && phoneList.length > 0) {
      const invalidPhones = [];
      const cleanPhoneList = [];

      for (const phone of phoneList) {
        if (PHONE_REGEX.test(phone)) {
          // Normalize by stripping any '+' character
          cleanPhoneList.push(phone.replace('+', ''));
        } else {
          invalidPhones.push(phone);
        }
      }

      if (invalidPhones.length > 0) {
        return res.status(400).json({
          error: `Invalid phone numbers: ${invalidPhones.join(', ')}. Use +91XXXXXXXXXX format.`
        });
      }

      // Convert summary array to formatted bullet list
      const aiSummary = summary.map(bullet => '• ' + bullet).join('\n');

      // Trigger n8n Notice Broadcast Webhook
      let n8nSuccess = false;
      try {
        n8nSuccess = await n8nService.triggerNoticeBroadcast({
          noticeText,
          aiSummary,
          eventDate,
          eventTitle,
          phoneList: cleanPhoneList
        });
      } catch (webhookErr) {
        console.error('n8n notice broadcast webhook execution failed:', webhookErr);
      }

      // Log the automation broadcast action
      const { error: logError } = await supabase
        .from('automation_logs')
        .insert({
          student_id: req.user.id,
          type: 'notice_broadcast',
          payload: {
            noticeText,
            aiSummary,
            eventTitle,
            eventDate,
            phoneList: cleanPhoneList
          },
          status: n8nSuccess ? 'success' : 'failed'
        });

      if (logError) {
        console.error('Failed to log notice broadcast automation:', logError.message);
      }
    }

    return res.status(200).json(aiResponse);
  } catch (err) {
    console.error('Summarize notice controller error:', err);
    return res.status(502).json({ error: 'AI service unavailable' });
  }
};

/**
 * Generate 5 study flashcards from lecture notes
 */
export const flashcards = async (req, res) => {
  const { notes } = req.body;

  if (!notes) {
    return res.status(400).json({ error: 'Lecture notes content is required.' });
  }

  try {
    const response = await groqService.generateFlashcards(notes);
    return res.status(200).json(response);
  } catch (err) {
    console.error('Flashcards generation controller error:', err);
    return res.status(502).json({ error: 'AI service unavailable' });
  }
};

/**
 * Check academic attendance records and output risk assessments
 */
export const attendance = async (req, res) => {
  const { attendanceData } = req.body;

  if (!attendanceData || !Array.isArray(attendanceData) || attendanceData.length === 0) {
    return res.status(400).json({ error: 'Attendance data list is required.' });
  }

  try {
    const response = await groqService.checkAttendanceRisk(attendanceData);
    return res.status(200).json(response);
  } catch (err) {
    console.error('Attendance checking controller error:', err);
    return res.status(502).json({ error: 'AI service unavailable' });
  }
};

/**
 * Generate MCQs from lecture notes, trigger WhatsApp "quiz ready" alert and log.
 */
export const mcq = async (req, res) => {
  const { notes, subject, topic, count } = req.body;
  const studentId = req.user.id;

  if (!notes || !subject || !topic) {
    return res.status(400).json({ error: 'Notes, subject, and topic are required.' });
  }

  try {
    // 1. Fetch student details for notifications
    const { data: student } = await supabase
      .from('students')
      .select('*')
      .eq('id', studentId)
      .single();

    // 2. Generate MCQs using groq
    const limit = count ? parseInt(count, 10) : 5;
    const response = await groqService.generateMCQs(notes, limit);

    if (!response || !response.mcqs) {
      return res.status(500).json({ error: 'Failed to generate MCQs.' });
    }

    // 3. Trigger WhatsApp + Calendar alert via n8n
    let triggered = false;
    if (student) {
      triggered = await n8nService.triggerQuizReady({
        studentName: student.name,
        phone: student.phone,
        subject,
        topic,
        mcqCount: response.mcqs.length
      });

      // 4. Log the automation
      await supabase
        .from('automation_logs')
        .insert({
          student_id: studentId,
          type: 'quiz_ready',
          payload: {
            subject,
            topic,
            mcqCount: response.mcqs.length
          },
          status: triggered ? 'success' : 'failed'
        });
    }

    return res.status(200).json({
      success: true,
      mcqs: response.mcqs,
      automationStatus: triggered ? 'triggered' : 'failed'
    });
  } catch (err) {
    console.error('MCQ generation controller error:', err);
    return res.status(502).json({ error: err.message || 'AI service unavailable' });
  }
};

