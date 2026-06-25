import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

/**
 * 1. POSTs deadline data to N8N_DEADLINE_WEBHOOK.
 * Strips '+' prefix from the phone number.
 */
export const triggerDeadlineReminder = async ({ studentName, phone, subject, deadline, taskTitle, reminderTime }) => {
  try {
    const webhookUrl = process.env.N8N_DEADLINE_WEBHOOK;
    if (!webhookUrl) {
      console.warn('Warning: N8N_DEADLINE_WEBHOOK is not defined. Skipping n8n request.');
      return false;
    }

    const payload = {
      studentName,
      phone: phone.replace(/^\+/, ''),
      subject,
      taskTitle,
      deadline: new Date(deadline).toISOString(),
      reminderTime: new Date(reminderTime).toISOString()
    };

    await axios.post(webhookUrl, payload, {
      headers: { 'Content-Type': 'application/json' }
    });
    return true;
  } catch (error) {
    console.error('Error triggering n8n deadline reminder webhook:', error.message);
    return false;
  }
};

/**
 * 2. POSTs notice broadcast data to N8N_NOTICE_WEBHOOK.
 * Strips '+' prefixes from phoneList items.
 */
export const triggerNoticeBroadcast = async ({ noticeText, aiSummary, eventDate, eventTitle, phoneList }) => {
  try {
    const webhookUrl = process.env.N8N_NOTICE_WEBHOOK;
    if (!webhookUrl) {
      console.warn('Warning: N8N_NOTICE_WEBHOOK is not defined. Skipping n8n request.');
      return false;
    }

    const cleanedPhones = phoneList.map(num => num.replace(/^\+/, ''));
    const payload = {
      noticeText,
      aiSummary, // Joined string with bullet points
      eventTitle,
      eventDate: eventDate ? new Date(eventDate).toISOString() : null,
      phoneList: cleanedPhones
    };

    await axios.post(webhookUrl, payload, {
      headers: { 'Content-Type': 'application/json' }
    });
    return true;
  } catch (error) {
    console.error('Error triggering n8n notice broadcast webhook:', error.message);
    return false;
  }
};

/**
 * 3. POSTs quiz ready alert data to N8N_QUIZ_WEBHOOK.
 */
export const triggerQuizReady = async ({ studentName, phone, subject, topic, mcqCount }) => {
  try {
    const webhookUrl = process.env.N8N_QUIZ_WEBHOOK;
    if (!webhookUrl) {
      console.warn('Warning: N8N_QUIZ_WEBHOOK is not defined. Skipping n8n request.');
      return false;
    }

    const payload = {
      studentName,
      phone: phone.replace(/^\+/, ''),
      subject,
      topic,
      mcqCount
    };

    await axios.post(webhookUrl, payload, {
      headers: { 'Content-Type': 'application/json' }
    });
    return true;
  } catch (error) {
    console.error('Error triggering n8n quiz ready webhook:', error.message);
    return false;
  }
};

/**
 * 4. POSTs study plan reminder to N8N_STUDY_REMINDER_WEBHOOK.
 */
export const triggerStudyReminder = async ({ studentName, phone, subject, deadline, studyPlan }) => {
  try {
    const webhookUrl = process.env.N8N_STUDY_REMINDER_WEBHOOK;
    if (!webhookUrl) {
      console.warn('Warning: N8N_STUDY_REMINDER_WEBHOOK is not defined. Skipping n8n request.');
      return false;
    }

    const payload = {
      studentName,
      phone: phone.replace(/^\+/, ''),
      subject,
      deadline: new Date(deadline).toISOString(),
      studyPlan // Array of daily plan sessions
    };

    await axios.post(webhookUrl, payload, {
      headers: { 'Content-Type': 'application/json' }
    });
    return true;
  } catch (error) {
    console.error('Error triggering n8n study reminder webhook:', error.message);
    return false;
  }
};

/**
 * 5. POSTs attendance warning alert to N8N_ATTENDANCE_ALERT_WEBHOOK.
 */
export const triggerAttendanceAlert = async ({ studentName, phone, subject, currentAttendance, riskLevel }) => {
  try {
    const webhookUrl = process.env.N8N_ATTENDANCE_ALERT_WEBHOOK;
    if (!webhookUrl) {
      console.warn('Warning: N8N_ATTENDANCE_ALERT_WEBHOOK is not defined. Skipping n8n request.');
      return false;
    }

    const payload = {
      studentName,
      phone: phone.replace(/^\+/, ''),
      subject,
      currentAttendance,
      riskLevel
    };

    await axios.post(webhookUrl, payload, {
      headers: { 'Content-Type': 'application/json' }
    });
    return true;
  } catch (error) {
    console.error('Error triggering n8n attendance alert webhook:', error.message);
    return false;
  }
};

/**
 * 6. POSTs placement interview alerts to N8N_PLACEMENT_WEBHOOK.
 */
export const triggerPlacementReminder = async ({ studentName, phone, companyName, role, interviewDate, roundName }) => {
  try {
    const webhookUrl = process.env.N8N_PLACEMENT_WEBHOOK;
    if (!webhookUrl) {
      console.warn('Warning: N8N_PLACEMENT_WEBHOOK is not defined. Skipping n8n request.');
      return false;
    }

    const payload = {
      studentName,
      phone: phone.replace(/^\+/, ''),
      companyName,
      role,
      interviewDate: new Date(interviewDate).toISOString(),
      roundName
    };

    await axios.post(webhookUrl, payload, {
      headers: { 'Content-Type': 'application/json' }
    });
    return true;
  } catch (error) {
    console.error('Error triggering n8n placement webhook:', error.message);
    return false;
  }
};

/**
 * 7. POSTs study group invitations to N8N_STUDY_GROUP_WEBHOOK.
 */
export const triggerStudyGroupInvite = async ({ creatorName, membersList, subject, groupTitle, scheduledAt }) => {
  try {
    const webhookUrl = process.env.N8N_STUDY_GROUP_WEBHOOK;
    if (!webhookUrl) {
      console.warn('Warning: N8N_STUDY_GROUP_WEBHOOK is not defined. Skipping n8n request.');
      return false;
    }

    const payload = {
      creatorName,
      membersList: membersList.map(m => ({ ...m, phone: m.phone.replace(/^\+/, '') })),
      subject,
      groupTitle,
      scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : null
    };

    await axios.post(webhookUrl, payload, {
      headers: { 'Content-Type': 'application/json' }
    });
    return true;
  } catch (error) {
    console.error('Error triggering n8n study group webhook:', error.message);
    return false;
  }
};

