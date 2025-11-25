import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface MarkdownRendererProps {
  content: string;
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content }) => {
  return (
    <div className="prose prose-slate max-w-none dark:prose-invert text-sm sm:text-base leading-relaxed">
      <ReactMarkdown 
        remarkPlugins={[remarkGfm]}
        components={{
          ul: ({node, ...props}) => <ul className="list-disc pl-5 my-2 space-y-1" {...props} />,
          ol: ({node, ...props}) => <ol className="list-decimal pl-5 my-2 space-y-1" {...props} />,
          h1: ({node, ...props}) => <h1 className="text-xl font-bold text-gray-900 mt-4 mb-2" {...props} />,
          h2: ({node, ...props}) => <h2 className="text-lg font-bold text-medical-900 mt-4 mb-2 border-b border-medical-100 pb-1" {...props} />,
          h3: ({node, ...props}) => <h3 className="text-base font-semibold text-gray-800 mt-3 mb-1" {...props} />,
          strong: ({node, ...props}) => <strong className="font-semibold text-medical-600" {...props} />,
          p: ({node, ...props}) => <p className="mb-3 text-gray-700" {...props} />,
          blockquote: ({node, ...props}) => <blockquote className="border-l-4 border-primary-500 pl-4 italic bg-primary-50 py-2 rounded-r my-4" {...props} />,
          table: ({node, ...props}) => <div className="overflow-x-auto my-4"><table className="min-w-full divide-y divide-gray-200 border" {...props} /></div>,
          th: ({node, ...props}) => <th className="bg-gray-50 px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" {...props} />,
          td: ({node, ...props}) => <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500 border-t" {...props} />,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};
