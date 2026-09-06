import React, { useState, useEffect } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';

interface CodeBlockProps {
  inline?: boolean;
  className?: string;
  children: React.ReactNode;
  [key: string]: any;
}

const LANGUAGE_LABELS: Record<string, string> = {
  bash: 'Bash', c: 'C', cpp: 'C++', csharp: 'C#', css: 'CSS', go: 'Go', html: 'HTML',
  java: 'Java', javascript: 'JavaScript', js: 'JavaScript', json: 'JSON', jsx: 'JSX',
  kotlin: 'Kotlin', markdown: 'Markdown', md: 'Markdown', php: 'PHP', python: 'Python',
  py: 'Python', ruby: 'Ruby', rust: 'Rust', sql: 'SQL', swift: 'Swift', text: 'Text',
  ts: 'TypeScript', tsx: 'TSX', typescript: 'TypeScript', yaml: 'YAML', yml: 'YAML'
};

export const CodeBlock: React.FC<CodeBlockProps> = ({ inline, className, children, ...rest }) => {
  const [copied, setCopied] = useState(false);
  
  useEffect(() => {
    if (copied) {
      const timer = setTimeout(() => setCopied(false), 1500);
      return () => clearTimeout(timer);
    }
  }, [copied]);

  const match = /language-(\w+)/.exec(className || '');
  const language = match ? match[1] : '';
  const hasLanguage = !!language;
  const content = String(children).replace(/\n$/, '');
  const hasNewlines = content.includes('\n');
  const length = content.length;
  
  const isBlock = !inline && (hasLanguage || hasNewlines || length > 80);

  const handleCopy = async () => {
    try {
      if (window.meow && window.meow.copyTextToClipboard) {
        await window.meow.copyTextToClipboard(content);
      } else {
        await navigator.clipboard.writeText(content);
      }
      setCopied(true);
    } catch (err) {
      console.error('Failed to copy text', err);
    }
  };

  if (isBlock) {
    const label = LANGUAGE_LABELS[language.toLowerCase()] || language || 'Code';
    return (
      <div className="code-block">
        <div className="code-block-header">
          <span>{label}</span>
          <button onClick={handleCopy}>{copied ? 'Copied!' : 'Copy'}</button>
        </div>
        <SyntaxHighlighter language={language} style={oneDark} PreTag="div" {...rest}>
          {content}
        </SyntaxHighlighter>
      </div>
    );
  }

  return (
    <code className="inline-code" {...rest}>
      {children}
    </code>
  );
};
