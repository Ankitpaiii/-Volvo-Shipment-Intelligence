import Groq from 'groq-sdk';
import dotenv from 'dotenv';

dotenv.config();

if (!process.env.GROQ_API_KEY) {
  throw new Error('GROQ_API_KEY must be set in .env');
}

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const MODEL = 'llama-3.1-8b-instant';

/**
 * 1. Summarize notice text into 3 bullet points, and extract event details.
 */
export const summarizeNotice = async (noticeText) => {
  try {
    const response = await groq.chat.completions.create({
      model: MODEL,
      response_format: { type: 'json_object' },
      messages: [
        { 
          role: 'system', 
          content: 'You are a helpful assistant for college students. Always respond with valid JSON.' 
        },
        { 
          role: 'user', 
          content: `Summarize the following college notice in exactly 3 bullet points. Extract the event date and title if mentioned.
The eventDate must be in ISO 8601 format if found, or null if not mentioned.
Return JSON: { "summary": string[], "eventTitle": string, "eventDate": string | null }
Notice: ${noticeText}`
        }
      ],
      max_tokens: 1024,
    });

    return JSON.parse(response.choices[0].message.content);
  } catch (error) {
    console.error('Groq summarizeNotice error:', error);
    throw new Error('AI service failed to summarize the notice.');
  }
};

/**
 * 2. Generate exactly 5 flashcards from the lecture notes.
 */
export const generateFlashcards = async (notes) => {
  try {
    const response = await groq.chat.completions.create({
      model: MODEL,
      response_format: { type: 'json_object' },
      messages: [
        { 
          role: 'system', 
          content: 'You are a helpful study assistant for B.Tech students. Always respond with valid JSON.' 
        },
        { 
          role: 'user', 
          content: `Generate exactly 5 flashcards from these lecture notes. Make questions specific and testable.
Return JSON: { "flashcards": [{ "question": string, "answer": string }] }
Notes: ${notes}`
        }
      ],
      max_tokens: 1024,
    });

    return JSON.parse(response.choices[0].message.content);
  } catch (error) {
    console.error('Groq generateFlashcards error:', error);
    throw new Error('AI service failed to generate flashcards.');
  }
};

/**
 * 3. Generate a study tip of the day (under 20 words).
 */
export const generateStudyTip = async () => {
  try {
    const response = await groq.chat.completions.create({
      model: MODEL,
      response_format: { type: 'json_object' },
      messages: [
        { 
          role: 'system', 
          content: 'You are a helpful assistant for B.Tech students. Always respond with valid JSON.' 
        },
        { 
          role: 'user', 
          content: `Give one specific, actionable study tip for today. Keep it under 20 words.
Return JSON: { "tip": string }`
        }
      ],
      max_tokens: 1024,
    });

    return JSON.parse(response.choices[0].message.content);
  } catch (error) {
    console.error('Groq generateStudyTip error:', error);
    throw new Error('AI service failed to generate study tip.');
  }
};

/**
 * 4. Check attendance records and flag at-risk subjects.
 */
export const checkAttendanceRisk = async (attendanceData) => {
  try {
    const response = await groq.chat.completions.create({
      model: MODEL,
      response_format: { type: 'json_object' },
      messages: [
        { 
          role: 'system', 
          content: 'You are a helpful academic advisor for B.Tech students. Always respond with valid JSON.' 
        },
        { 
          role: 'user', 
          content: `Analyze this attendance data. For each subject, calculate the current percentage.
Mark subjects below 75% as at-risk and calculate how many more classes they must attend
(without missing any) to reach 75%. Also give one overall motivational tip.
Return JSON: { "alerts": [{ "subject": string, "currentPercent": number, "classesNeeded": number, "isAtRisk": boolean }], "overallTip": string }
Data: ${JSON.stringify(attendanceData)}`
        }
      ],
      max_tokens: 1024,
    });

    return JSON.parse(response.choices[0].message.content);
  } catch (error) {
    console.error('Groq checkAttendanceRisk error:', error);
    throw new Error('AI service failed to analyze attendance.');
  }
};

/**
 * 5. Generate MCQs from lecture notes for quiz mode.
 */
export const generateMCQs = async (notes, count = 5) => {
  try {
    const response = await groq.chat.completions.create({
      model: MODEL,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: 'You are a B.Tech exam question generator. Always respond with valid JSON.'
        },
        {
          role: 'user',
          content: `Generate exactly ${count} multiple-choice questions from these lecture notes. Each question must have exactly 4 options labeled A, B, C, D with one correct answer. Also identify the topic each question covers.
Return JSON: { "mcqs": [{ "question": string, "options": { "A": string, "B": string, "C": string, "D": string }, "correct": "A"|"B"|"C"|"D", "topic": string, "explanation": string }] }
Notes: ${notes}`
        }
      ],
      max_tokens: 2048,
    });

    return JSON.parse(response.choices[0].message.content);
  } catch (error) {
    console.error('Groq generateMCQs error:', error);
    throw new Error('AI service failed to generate MCQs.');
  }
};

/**
 * 6. Generate a smart study plan from deadline and difficulty info.
 */
export const generateStudyPlan = async ({ subject, deadline, difficulty, estimatedHours, currentDate }) => {
  try {
    const response = await groq.chat.completions.create({
      model: MODEL,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: 'You are an academic planner for B.Tech students. Always respond with valid JSON.'
        },
        {
          role: 'user',
          content: `Create a study plan for the following:
Subject: ${subject}
Deadline: ${deadline}
Difficulty: ${difficulty}
Estimated Hours Needed: ${estimatedHours}
Current Date: ${currentDate}

Break down the study into daily sessions. Include revision time. Each session should have a date, duration in hours, and what to focus on.
Return JSON: {
  "studyPlan": [{ "date": string, "durationHours": number, "focus": string, "type": "study"|"revision"|"practice" }],
  "totalSessions": number,
  "revisionDays": number,
  "recommendation": string
}`
        }
      ],
      max_tokens: 2048,
    });

    return JSON.parse(response.choices[0].message.content);
  } catch (error) {
    console.error('Groq generateStudyPlan error:', error);
    throw new Error('AI service failed to generate study plan.');
  }
};

/**
 * 7. Multi-mode chat completion for Chat Hub.
 */
export const chatCompletion = async (messages, mode, ragContext = '') => {
  const systemPrompts = {
    study: 'You are a knowledgeable study assistant for B.Tech engineering students. Help with concepts, problem-solving, and exam preparation. Be specific and technical.',
    placement: 'You are a placement preparation coach for B.Tech students. Help with interview prep, DSA concepts, company research, and career guidance.',
    startup: 'You are a startup mentor and business advisor. Help validate ideas, discuss business models, market analysis, and entrepreneurship strategies.',
    creator: 'You are a creative content and project advisor. Help with project ideas, technical writing, presentations, and creative problem-solving.',
    general: 'You are a helpful AI assistant for college students. Answer questions clearly and concisely on any topic.'
  };

  try {
    let systemPrompt = systemPrompts[mode] || systemPrompts.general;
    if (ragContext) {
      systemPrompt += `\n\nYou have access to the student's personal indexed documents. Use this context if relevant to answer the query. You MUST cite the source file name (e.g., "[Source file: filename.pdf]") in your response when referencing this context.\n\nContext:\n${ragContext}`;
    }

    const response = await groq.chat.completions.create({
      model: MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages
      ],
      max_tokens: 2048,
    });

    return response.choices[0].message.content;
  } catch (error) {
    console.error('Groq chatCompletion error:', error);
    throw new Error('AI chat service failed.');
  }
};


/**
 * 8. Startup idea validation for BrainSpace.
 */
export const validateStartupIdea = async ({ idea, problem, solution, targetAudience }) => {
  try {
    const response = await groq.chat.completions.create({
      model: MODEL,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: 'You are a startup analyst and venture capital advisor. Always respond with valid JSON.'
        },
        {
          role: 'user',
          content: `Perform a comprehensive startup validation analysis:

Idea: ${idea}
Problem: ${problem}
Solution: ${solution}
Target Audience: ${targetAudience}

Return JSON: {
  "swot": { "strengths": string[], "weaknesses": string[], "opportunities": string[], "threats": string[] },
  "tam": string,
  "sam": string,
  "som": string,
  "competitorAnalysis": [{ "competitor": string, "advantage": string, "disadvantage": string }],
  "revenueModel": string[],
  "riskScore": number,
  "feasibilityScore": number,
  "scalabilityScore": number,
  "overallVerdict": string,
  "recommendations": string[]
}
Scores must be 1-100.`
        }
      ],
      max_tokens: 2048,
    });

    return JSON.parse(response.choices[0].message.content);
  } catch (error) {
    console.error('Groq validateStartupIdea error:', error);
    throw new Error('AI service failed to validate startup idea.');
  }
};

/**
 * 9. Generate an original DSA coding problem.
 */
export const generateDSAProblem = async (topic, difficulty) => {
  try {
    const response = await groq.chat.completions.create({
      model: MODEL,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: 'You are a competitive programming problem setter. Generate ORIGINAL problems. Do NOT copy from LeetCode or HackerRank. Always respond with valid JSON.'
        },
        {
          role: 'user',
          content: `Generate one original ${difficulty} difficulty coding problem on the topic: ${topic}.

Return JSON: {
  "title": string,
  "description": string,
  "constraints": string[],
  "sampleInput": string,
  "sampleOutput": string,
  "hints": string[],
  "editorial": string,
  "solution": string,
  "timeComplexity": string,
  "spaceComplexity": string
}`
        }
      ],
      max_tokens: 2048,
    });

    return JSON.parse(response.choices[0].message.content);
  } catch (error) {
    console.error('Groq generateDSAProblem error:', error);
    throw new Error('AI service failed to generate DSA problem.');
  }
};

/**
 * 10. Mock interview Q&A with feedback.
 */
export const conductMockInterview = async (type, studentContext) => {
  try {
    const response = await groq.chat.completions.create({
      model: MODEL,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: 'You are a professional interviewer conducting mock interviews for B.Tech students. Always respond with valid JSON.'
        },
        {
          role: 'user',
          content: `Generate a ${type} mock interview with 5 questions for a B.Tech student.
Student context: ${studentContext}

Return JSON: {
  "questions": [{ "question": string, "expectedAnswer": string, "tips": string }],
  "interviewType": string,
  "overallAdvice": string
}`
        }
      ],
      max_tokens: 2048,
    });

    return JSON.parse(response.choices[0].message.content);
  } catch (error) {
    console.error('Groq conductMockInterview error:', error);
    throw new Error('AI service failed to generate mock interview.');
  }
};

/**
 * 11. Evaluate mock interview answers and provide feedback.
 */
export const evaluateInterviewAnswers = async (questions, answers) => {
  try {
    const response = await groq.chat.completions.create({
      model: MODEL,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: 'You are a professional interviewer evaluating candidate answers. Always respond with valid JSON.'
        },
        {
          role: 'user',
          content: `Evaluate these interview answers:
${questions.map((q, i) => `Q${i+1}: ${q}\nA${i+1}: ${answers[i] || 'No answer provided'}`).join('\n\n')}

Return JSON: {
  "evaluations": [{ "questionIndex": number, "score": number, "feedback": string, "improvementAreas": string[] }],
  "overallScore": number,
  "communicationScore": number,
  "technicalScore": number,
  "improvementAreas": string[],
  "overallFeedback": string
}
Scores must be 1-100.`
        }
      ],
      max_tokens: 2048,
    });

    return JSON.parse(response.choices[0].message.content);
  } catch (error) {
    console.error('Groq evaluateInterviewAnswers error:', error);
    throw new Error('AI service failed to evaluate interview answers.');
  }
};

/**
 * 12. Analyze resume text for ATS compatibility.
 */
export const analyzeResume = async (resumeText, targetRole) => {
  try {
    const response = await groq.chat.completions.create({
      model: MODEL,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: 'You are an ATS (Applicant Tracking System) expert and career coach. Always respond with valid JSON.'
        },
        {
          role: 'user',
          content: `Analyze this resume for ATS compatibility${targetRole ? ` for the role: ${targetRole}` : ''}:

${resumeText}

Return JSON: {
  "atsScore": number,
  "missingKeywords": string[],
  "improvements": [{ "section": string, "suggestion": string }],
  "strengths": string[],
  "weaknesses": string[],
  "overallFeedback": string
}
Score must be 1-100.`
        }
      ],
      max_tokens: 2048,
    });

    return JSON.parse(response.choices[0].message.content);
  } catch (error) {
    console.error('Groq analyzeResume error:', error);
    throw new Error('AI service failed to analyze resume.');
  }
};

/**
 * 13. AI match students for study groups.
 */
export const matchStudyGroup = async (studentProfile, availableStudents) => {
  try {
    const response = await groq.chat.completions.create({
      model: MODEL,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: 'You are an academic group matching assistant. Always respond with valid JSON.'
        },
        {
          role: 'user',
          content: `Match this student with the best study group partners:
Student: ${JSON.stringify(studentProfile)}
Available students: ${JSON.stringify(availableStudents)}

Match based on: same subject, same year, compatible schedules.
Return JSON: {
  "matches": [{ "studentId": string, "compatibilityScore": number, "reason": string }],
  "suggestedGroupName": string,
  "suggestedSchedule": string
}
Scores must be 1-100.`
        }
      ],
      max_tokens: 1024,
    });

    return JSON.parse(response.choices[0].message.content);
  } catch (error) {
    console.error('Groq matchStudyGroup error:', error);
    throw new Error('AI service failed to match study group.');
  }
};
