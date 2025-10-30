import OpenAI from 'openai';
import type { TranscriptSegment, ActionItem } from './types';

const SYSTEM_PROMPT = `You are a concise, faithful meeting scribe.
Given timestamped, speaker-labeled transcript chunks, produce:
1) Executive Summary (short bullets),
2) Key Decisions (explicit bullets),
3) Action Items table: Owner | Task | Due | Priority.
Use only facts present; avoid speculation; prefer imperative verbs.`;

export class LLMSummarizer {
  private client: OpenAI;
  private model: string;

  constructor(apiKey: string, model: string = 'gpt-4o-mini') {
    // Allow browser mode in Electron renderer (sandboxed, API key comes from main process)
    this.client = new OpenAI({ 
      apiKey,
      dangerouslyAllowBrowser: true
    });
    this.model = model;
  }

  async summarize(
    segments: TranscriptSegment[]
  ): Promise<{ summary: string[]; decisions: string[]; actionItems: ActionItem[] }> {
    if (segments.length === 0) {
      return { summary: [], decisions: [], actionItems: [] };
    }

    const transcript = segments
      .map((s) => `[${s.start}] ${s.speaker}: ${s.text}`)
      .join('\n');

    const prompt = `Analyze this meeting transcript and extract:

1. Executive Summary (3-5 bullet points)
2. Key Decisions (list all explicit decisions)
3. Action Items (extract owner, task, due date, priority)

IMPORTANT: For Action Items, if any field cannot be extracted from the conversation, use "N/A":
- If owner/person is not mentioned or unclear: use "N/A" 
- If due date is not mentioned: use "N/A"
- If priority is not mentioned or unclear: use "N/A"
- Task description must always be provided (use a general description if vague)

Transcript:
${transcript}

Format your response as JSON:
{
  "summary": ["bullet 1", "bullet 2", ...],
  "decisions": ["decision 1", "decision 2", ...],
  "actionItems": [
    {"owner": "Name or N/A", "task": "task description", "due": "YYYY-MM-DD or N/A", "priority": "High|Medium|Low|N/A"}
  ]
}`;

    try {
      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: prompt },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.3,
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No response from LLM');
      }

      const parsed = JSON.parse(content);
      return {
        summary: parsed.summary || [],
        decisions: parsed.decisions || [],
        actionItems: this.normalizeActionItems(parsed.actionItems || [], segments[0]?.start || new Date().toISOString().split('T')[0]),
      };
    } catch (error) {
      console.error('LLM summarization error:', error);
      return { summary: [], decisions: [], actionItems: [] };
    }
  }

  private normalizeActionItems(items: any[], meetingDate: string): ActionItem[] {
    return items.map((item) => ({
      owner: item.owner && item.owner.trim() && item.owner.toLowerCase() !== 'unassigned' && item.owner.toLowerCase() !== 'unknown' ? item.owner.trim() : 'N/A',
      task: item.task && item.task.trim() ? item.task.trim() : 'N/A',
      due: this.parseDueDate(item.due, meetingDate),
      priority: (item.priority && ['High', 'Medium', 'Low', 'N/A'].includes(item.priority)) ? item.priority as ActionItem['priority'] : 'N/A',
    }));
  }

  private parseDueDate(due: string, meetingDate: string): string {
    if (!due || !due.trim() || due.trim().toUpperCase() === 'N/A') return 'N/A';

    const dueTrimmed = due.trim();

    // Try to parse ISO date
    if (dueTrimmed.match(/^\d{4}-\d{2}-\d{2}$/)) {
      return dueTrimmed;
    }

    // Try relative dates (Friday, next week, etc.)
    const meeting = new Date(meetingDate);
    const lowerDue = dueTrimmed.toLowerCase();

    if (lowerDue.includes('friday')) {
      const daysUntilFriday = (5 - meeting.getDay()) % 7 || 7;
      const date = new Date(meeting);
      date.setDate(date.getDate() + daysUntilFriday);
      return date.toISOString().split('T')[0];
    }

    if (lowerDue.includes('monday')) {
      const daysUntilMonday = (1 - meeting.getDay() + 7) % 7 || 7;
      const date = new Date(meeting);
      date.setDate(date.getDate() + daysUntilMonday);
      return date.toISOString().split('T')[0];
    }

    if (lowerDue.includes('next week')) {
      const date = new Date(meeting);
      date.setDate(date.getDate() + 7);
      return date.toISOString().split('T')[0];
    }

    // If we can't parse it, return N/A instead of the unparsed string
    return 'N/A';
  }
}

