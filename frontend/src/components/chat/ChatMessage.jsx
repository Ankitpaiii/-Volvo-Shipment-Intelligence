import React from 'react';
import { Sparkles, User, Terminal } from 'lucide-react';

/**
 * Deterministic, offline custom parser to render basic markdown elements into HTML.
 */
function renderMarkdown(content) {
  if (!content) return '';

  let html = content;

  // 1. Escaping raw HTML tags to prevent XSS
  html = html
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // 2. Format code blocks: ```code```
  html = html.replace(/```([\s\S]*?)```/g, (match, code) => {
    return `<pre class="my-3 p-4 bg-gray-950 text-emerald-400 rounded-2xl text-[10px] font-mono border border-gray-900 overflow-x-auto"><code class="block font-mono leading-relaxed">${code.trim()}</code></pre>`;
  });

  // 3. Format inline code: `code`
  html = html.replace(/`([^`]+)`/g, '<code class="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-900 text-rose-500 rounded font-mono text-[11px]">$1</code>');

  // 4. Format bold text: **text**
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong class="font-extrabold text-gray-900 dark:text-white">$1</strong>');

  // 5. Format lists: items beginning with * or - on a new line
  const lines = html.split('\n');
  let inList = false;
  const processedLines = lines.map(line => {
    const trimmed = line.trim();
    if (trimmed.startsWith('* ') || trimmed.startsWith('- ')) {
      const contentStr = trimmed.substring(2);
      let out = '';
      if (!inList) {
        inList = true;
        out += '<ul class="list-disc list-inside space-y-1 my-2 text-xs font-semibold pl-1 leading-relaxed">';
      }
      out += `<li>${contentStr}</li>`;
      return out;
    } else {
      let out = '';
      if (inList) {
        inList = false;
        out += '</ul>';
      }
      out += line;
      return out;
    }
  });

  if (inList) {
    processedLines.push('</ul>');
  }

  return processedLines.join('<br />');
}

export default function ChatMessage({ message }) {
  const isAssistant = message.role === 'assistant';

  return (
    <div className={`flex gap-4 p-4 rounded-3xl transition-all duration-200 ${
      isAssistant
        ? 'bg-gray-50/55 dark:bg-gray-900/10 border border-gray-200/40 dark:border-gray-800/10'
        : 'bg-white dark:bg-gray-800'
    }`}>
      
      {/* Avatar node */}
      <div className={`w-10 h-10 rounded-full flex items-center justify-center border shadow-sm flex-shrink-0 ${
        isAssistant
          ? 'bg-blue-600 border-blue-500 text-white shadow-blue-500/10'
          : 'bg-gray-100 dark:bg-gray-700 border-gray-200 dark:border-gray-700 text-gray-500'
      }`}>
        {isAssistant ? <Sparkles className="w-5 h-5" /> : <User className="w-5 h-5" />}
      </div>

      {/* Message content block */}
      <div className="space-y-1 min-w-0 flex-1">
        <span className="text-[10px] font-black uppercase tracking-wider text-gray-400">
          {isAssistant ? 'AI Study Buddy' : 'You'}
        </span>
        <div
          className="text-xs text-gray-750 dark:text-gray-300 leading-relaxed font-semibold break-words"
          dangerouslySetInnerHTML={{ __html: renderMarkdown(message.content) }}
        />
      </div>

    </div>
  );
}
