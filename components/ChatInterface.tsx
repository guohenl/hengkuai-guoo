import React, { useRef, useEffect } from 'react';
import { Message, Sender, Suggestion } from '../types';
import { MarkdownRenderer } from './MarkdownRenderer';
import { Send, Activity, User, Bot, AlertCircle } from 'lucide-react';

interface ChatInterfaceProps {
  messages: Message[];
  isLoading: boolean;
  onSendMessage: (text: string) => void;
  suggestions: Suggestion[];
}

export const ChatInterface: React.FC<ChatInterfaceProps> = ({ 
  messages, 
  isLoading, 
  onSendMessage,
  suggestions
}) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [inputText, setInputText] = React.useState('');

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputText.trim() && !isLoading) {
      onSendMessage(inputText);
      setInputText('');
    }
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-xl shadow-xl overflow-hidden border border-gray-200">
      {/* Header */}
      <div className="bg-gradient-to-r from-medical-600 to-medical-900 p-4 text-white flex items-center justify-between shadow-md shrink-0">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-white/20 rounded-full">
            <Activity className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold">血液净化智能助手</h1>
            <p className="text-xs text-medical-100 opacity-90">AI驱动的血液净化专家 (Nephrology AI)</p>
          </div>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6 bg-gray-50/50">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center text-gray-500 space-y-4 opacity-70 p-8">
            <Activity className="w-16 h-16 text-gray-300" />
            <p className="text-lg font-medium">您可以询问关于血液净化、凝血机制或透析原理的问题。</p>
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex w-full ${msg.sender === Sender.User ? 'justify-end' : 'justify-start'}`}
          >
            <div className={`flex max-w-[90%] md:max-w-[80%] ${msg.sender === Sender.User ? 'flex-row-reverse' : 'flex-row'} items-start gap-3`}>
              
              {/* Avatar */}
              <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center shadow-sm ${
                msg.sender === Sender.User 
                  ? 'bg-primary-600 text-white' 
                  : 'bg-medical-600 text-white'
              }`}>
                {msg.sender === Sender.User ? <User size={16} /> : <Bot size={16} />}
              </div>

              {/* Bubble */}
              <div className={`flex flex-col ${msg.sender === Sender.User ? 'items-end' : 'items-start'}`}>
                <div
                  className={`px-5 py-4 rounded-2xl shadow-sm text-left ${
                    msg.sender === Sender.User
                      ? 'bg-primary-600 text-white rounded-tr-none'
                      : msg.isError 
                        ? 'bg-red-50 border border-red-200 text-red-800 rounded-tl-none'
                        : 'bg-white border border-gray-100 text-gray-800 rounded-tl-none'
                  }`}
                >
                  {msg.sender === Sender.User ? (
                    <p className="whitespace-pre-wrap">{msg.text}</p>
                  ) : (
                    <MarkdownRenderer content={msg.text} />
                  )}
                </div>
                <span className="text-xs text-gray-400 mt-1 px-1">
                  {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex w-full justify-start">
            <div className="flex max-w-[80%] flex-row items-start gap-3">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-medical-600 text-white flex items-center justify-center shadow-sm">
                <Bot size={16} />
              </div>
              <div className="bg-white border border-gray-100 px-5 py-4 rounded-2xl rounded-tl-none shadow-sm flex items-center space-x-2">
                <div className="w-2 h-2 bg-medical-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                <div className="w-2 h-2 bg-medical-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                <div className="w-2 h-2 bg-medical-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Suggestions / Input Area */}
      <div className="p-4 bg-white border-t border-gray-100 shrink-0">
        {messages.length < 2 && suggestions.length > 0 && !isLoading && (
          <div className="mb-4 flex flex-wrap gap-2">
            {suggestions.map((s) => (
              <button
                key={s.id}
                onClick={() => onSendMessage(s.text)}
                className="text-xs sm:text-sm bg-medical-50 hover:bg-medical-100 text-medical-800 px-3 py-1.5 rounded-full transition-colors border border-medical-200 flex items-center gap-1"
              >
                <AlertCircle size={12} />
                {s.text}
              </button>
            ))}
          </div>
        )}

        <form onSubmit={handleSubmit} className="relative flex items-center gap-2">
          <input
            type="text"
            className="flex-1 bg-gray-50 text-gray-900 border border-gray-300 rounded-full py-3 px-5 focus:outline-none focus:ring-2 focus:ring-medical-500 focus:border-transparent transition-all placeholder-gray-400"
            placeholder="请输入您的医疗问题..."
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={isLoading || !inputText.trim()}
            className="bg-medical-600 hover:bg-medical-700 disabled:opacity-50 disabled:cursor-not-allowed text-white p-3 rounded-full transition-colors shadow-sm flex items-center justify-center"
          >
            <Send size={20} />
          </button>
        </form>
        <div className="text-center mt-2">
           <span className="text-[10px] text-gray-400">AI生成内容仅供参考，临床决策请咨询专业医生。</span>
        </div>
      </div>
    </div>
  );
};