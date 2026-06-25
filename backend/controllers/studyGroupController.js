import { supabase } from '../config/supabase.js';
import * as groqService from '../services/groqService.js';
import * as n8nService from '../services/n8nService.js';

/**
 * List all study groups with creator and member details.
 */
export const getGroups = async (req, res) => {
  try {
    const { data: groups, error } = await supabase
      .from('study_groups')
      .select(`
        *,
        members:study_group_members(
          student_id,
          student:students(name, phone)
        )
      `)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching study groups:', error);
      return res.status(500).json({ error: 'Failed to retrieve study groups.' });
    }

    // Since creators are students, let's fetch creators manually or map them to avoid complex Supabase JOIN queries
    const studentIds = groups.map(g => g.creator_id);
    const { data: students } = await supabase
      .from('students')
      .select('id, name, phone')
      .in('id', studentIds);

    const mappedGroups = groups.map(group => {
      const creatorInfo = students?.find(s => s.id === group.creator_id);
      return {
        ...group,
        creator: creatorInfo || { name: 'Unknown', phone: '' }
      };
    });

    return res.status(200).json({ groups: mappedGroups });
  } catch (error) {
    console.error('Error in getGroups:', error);
    return res.status(500).json({ error: 'An unexpected error occurred.' });
  }
};

/**
 * Create a new study group and invite classmates.
 */
export const createGroup = async (req, res) => {
  const { subject, title, scheduled_at, max_members, invitees } = req.body;
  const creatorId = req.user.id;

  if (!subject || !title) {
    return res.status(400).json({ error: 'Subject and Title are required.' });
  }

  try {
    // 1. Fetch creator info
    const { data: creator, error: creatorErr } = await supabase
      .from('students')
      .select('*')
      .eq('id', creatorId)
      .single();

    if (creatorErr || !creator) {
      return res.status(404).json({ error: 'Creator student profile not found.' });
    }

    // 2. Create study group in database
    const { data: group, error: groupErr } = await supabase
      .from('study_groups')
      .insert({
        creator_id: creatorId,
        subject,
        title,
        scheduled_at: scheduled_at ? new Date(scheduled_at).toISOString() : null,
        max_members: max_members ? parseInt(max_members, 10) : 5
      })
      .select()
      .single();

    if (groupErr) {
      return res.status(500).json({ error: groupErr.message });
    }

    // 3. Add creator to the members list
    await supabase
      .from('study_group_members')
      .insert({
        group_id: group.id,
        student_id: creatorId
      });

    // 4. Handle invitations if invitees list is provided
    let inviteTriggered = false;
    if (invitees && Array.isArray(invitees) && invitees.length > 0) {
      const { data: studentsToInvite } = await supabase
        .from('students')
        .select('name, phone')
        .in('id', invitees);

      if (studentsToInvite && studentsToInvite.length > 0) {
        inviteTriggered = await n8nService.triggerStudyGroupInvite({
          creatorName: creator.name,
          membersList: studentsToInvite,
          subject,
          groupTitle: title,
          scheduledAt: scheduled_at
        });

        // Log invitation automation
        await supabase
          .from('automation_logs')
          .insert({
            student_id: creatorId,
            type: 'study_group_invite',
            payload: {
              groupId: group.id,
              groupTitle: title,
              inviteesCount: studentsToInvite.length
            },
            status: inviteTriggered ? 'success' : 'failed'
          });
      }
    }

    return res.status(201).json({
      success: true,
      group,
      inviteStatus: inviteTriggered ? 'triggered' : 'none'
    });
  } catch (error) {
    console.error('Error in createGroup:', error);
    return res.status(500).json({ error: 'An unexpected error occurred.' });
  }
};

/**
 * Join an existing study group.
 */
export const joinGroup = async (req, res) => {
  const groupId = req.params.id;
  const studentId = req.user.id;

  try {
    // Check group capacity
    const { data: group, error: fetchErr } = await supabase
      .from('study_groups')
      .select('*')
      .eq('id', groupId)
      .single();

    if (fetchErr || !group) {
      return res.status(404).json({ error: 'Study group not found.' });
    }

    const { count, error: countErr } = await supabase
      .from('study_group_members')
      .select('*', { count: 'exact', head: true })
      .eq('group_id', groupId);

    if (countErr) {
      return res.status(500).json({ error: 'Failed to verify member capacity.' });
    }

    if (count >= group.max_members) {
      return res.status(400).json({ error: 'Study group is already full.' });
    }

    const { error: joinErr } = await supabase
      .from('study_group_members')
      .insert({
        group_id: groupId,
        student_id: studentId
      });

    if (joinErr) {
      if (joinErr.code === '23505') {
        // Unique constraint violation
        return res.status(400).json({ error: 'You are already a member of this study group.' });
      }
      return res.status(500).json({ error: joinErr.message });
    }

    return res.status(200).json({ success: true, message: 'Joined group successfully.' });
  } catch (error) {
    console.error('Error in joinGroup:', error);
    return res.status(500).json({ error: 'An unexpected error occurred.' });
  }
};

/**
 * Perform AI matching to suggest compatible study group partners.
 */
export const matchPartners = async (req, res) => {
  const studentId = req.user.id;

  try {
    // 1. Fetch current student profile
    const { data: currentStudent, error: fetchErr } = await supabase
      .from('students')
      .select('*')
      .eq('id', studentId)
      .single();

    if (fetchErr || !currentStudent) {
      return res.status(404).json({ error: 'Your student profile is missing.' });
    }

    // 2. Fetch all other students
    const { data: classmates, error: classmatesErr } = await supabase
      .from('students')
      .select('id, name, branch, year, subjects')
      .neq('id', studentId);

    if (classmatesErr || !classmates || classmates.length === 0) {
      return res.status(200).json({ matches: [], suggestedGroupName: '', suggestedSchedule: '' });
    }

    // 3. Call Groq service to execute group match logic
    const matchedData = await groqService.matchStudyGroup(
      {
        id: currentStudent.id,
        name: currentStudent.name,
        branch: currentStudent.branch,
        year: currentStudent.year,
        subjects: currentStudent.subjects
      },
      classmates
    );

    // Mapped partner names back to the matches array
    const detailedMatches = (matchedData.matches || []).map(match => {
      const matchProfile = classmates.find(c => c.id === match.studentId);
      return {
        ...match,
        name: matchProfile ? matchProfile.name : 'Classmate',
        branch: matchProfile ? matchProfile.branch : '',
        year: matchProfile ? matchProfile.year : ''
      };
    });

    return res.status(200).json({
      success: true,
      matches: detailedMatches,
      suggestedGroupName: matchedData.suggestedGroupName,
      suggestedSchedule: matchedData.suggestedSchedule
    });
  } catch (error) {
    console.error('Error matching partners:', error);
    return res.status(500).json({ error: 'AI matching service failed.' });
  }
};
