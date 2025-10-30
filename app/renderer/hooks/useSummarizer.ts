import { useCallback } from 'react';
import { useStore } from '../state/store';
import { LLMSummarizer } from '../lib/llm';

export function useSummarizer() {
  const {
    segments,
    setSummary,
    setDecisions,
    setActionItems,
    settings,
  } = useStore();

  const summarize = useCallback(async () => {
    if (!settings.apiKey || segments.length === 0) {
      return;
    }

    try {
      const summarizer = new LLMSummarizer(settings.apiKey, settings.model);
      const result = await summarizer.summarize(segments);

      setSummary(result.summary);
      setDecisions(result.decisions);
      setActionItems(result.actionItems);
    } catch (error) {
      console.error('Error generating summary:', error);
    }
  }, [segments, settings.apiKey, settings.model, setSummary, setDecisions, setActionItems]);

  return {
    summarize,
  };
}

