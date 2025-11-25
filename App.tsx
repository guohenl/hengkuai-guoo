import React, { useState, useCallback, useEffect, useRef } from 'react';
import { generateMedicalResponse } from './services/geminiService';
import { ChatInterface } from './components/ChatInterface';
import { HemodialysisCircuitDiagram } from './components/HemodialysisCircuitDiagram';
import { Message, Sender, Suggestion } from './types';
import { HeartPulse, Activity, GripVertical } from 'lucide-react';

const App: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  
  // Resizable sidebar state
  const [sidebarWidth, setSidebarWidth] = useState(50); // percentage
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Pre-defined suggestions relevant to the user's initial query about blood purification clogging
  const suggestions: Suggestion[] = [
    { id: '1', text: '血液净化的管路为什么容易堵塞?' },
    { id: '2', text: '如何预防透析管路凝血?' },
    { id: '3', text: '什么是体外循环中的“生物相容性”?' },
    { id: '4', text: '肝素和柠檬酸钠抗凝的区别?' },
  ];

  const handleSendMessage = useCallback(async (text: string) => {
    // Add User Message
    const userMsg: Message = {
      id: Date.now().toString(),
      text,
      sender: Sender.User,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);

    try {
      const responseText = await generateMedicalResponse(text);
      
      const botMsg: Message = {
        id: (Date.now() + 1).toString(),
        text: responseText,
        sender: Sender.Bot,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, botMsg]);
    } catch (error) {
      const errorMsg: Message = {
        id: (Date.now() + 1).toString(),
        text: "抱歉，处理您的医疗咨询时出现错误。请检查网络连接并重试。",
        sender: Sender.Bot,
        timestamp: new Date(),
        isError: true
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initialize with a welcome message
  useEffect(() => {
    const welcomeMsg: Message = {
      id: 'init',
      text: "您好！我是您的血液净化AI助手。\n\n左侧（桌面端）是一个交互式透析管路图。您可以**点击图中的部件**（如透析器、血泵），我将为您详细解释该部位容易发生凝血的机制和预防措施。\n\n您也可以直接在下方输入问题。",
      sender: Sender.Bot,
      timestamp: new Date(),
    };
    setMessages([welcomeMsg]);
  }, []);

  // Drag handlers
  const startResizing = useCallback(() => {
    setIsDragging(true);
  }, []);

  const stopResizing = useCallback(() => {
    setIsDragging(false);
  }, []);

  const resize = useCallback((e: MouseEvent) => {
    if (isDragging && containerRef.current) {
      const containerRect = containerRef.current.getBoundingClientRect();
      const newWidth = ((e.clientX - containerRect.left) / containerRect.width) * 100;
      // Limit width between 20% and 80%
      if (newWidth >= 20 && newWidth <= 80) {
        setSidebarWidth(newWidth);
      }
    }
  }, [isDragging]);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', resize);
      window.addEventListener('mouseup', stopResizing);
    }
    return () => {
      window.removeEventListener('mousemove', resize);
      window.removeEventListener('mouseup', stopResizing);
    };
  }, [isDragging, resize, stopResizing]);


  return (
    <div 
      ref={containerRef}
      className={`min-h-screen bg-gray-50 text-gray-800 font-sans flex flex-col md:flex-row overflow-hidden ${isDragging ? 'cursor-col-resize select-none' : ''}`}
    >
      
      {/* Sidebar - Interactive Diagram Panel */}
      <div 
        className="flex-col shrink-0 overflow-hidden hidden md:flex bg-white border-r border-gray-200"
        style={{ width: `${sidebarWidth}%` }}
      >
        <div className="p-3 border-b border-gray-100 bg-gray-50/50 flex-shrink-0">
          <div className="flex items-center gap-2 mb-1">
             <div className="bg-medical-100 p-1.5 rounded-lg">
               <HeartPulse className="w-4 h-4 text-medical-600" />
             </div>
             <h2 className="text-base font-bold text-gray-800">交互式管路图</h2>
          </div>
          <p className="text-[10px] text-gray-500 leading-relaxed truncate">
            点击组件查看凝血风险分析。
          </p>
        </div>

        <div className="flex-1 overflow-y-auto p-2 flex flex-col items-center bg-white relative">
          <div className="w-full h-full flex items-center justify-center">
             <HemodialysisCircuitDiagram onPartClick={handleSendMessage} />
          </div>
        </div>

        <div className="p-2 bg-medical-50 border-t border-medical-100 flex-shrink-0">
           <div className="flex gap-2 items-start">
              <Activity className="w-3 h-3 text-medical-600 mt-0.5 shrink-0" />
              <p className="text-[10px] text-medical-800 leading-tight">
                <strong>提示:</strong> 拖动右侧边缘可调整视图大小。
              </p>
           </div>
        </div>
      </div>

      {/* Drag Handle */}
      <div
        className="hidden md:flex w-2 cursor-col-resize items-center justify-center hover:bg-gray-200 active:bg-medical-500 transition-colors z-10 -ml-1 w-4 border-l border-gray-100"
        onMouseDown={startResizing}
      >
        <GripVertical className="w-4 h-4 text-gray-300" />
      </div>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col h-screen max-h-[100dvh] relative overflow-hidden" style={{ minWidth: 0 }}>
        <div className="flex-1 p-0 md:p-4 w-full h-full flex flex-col">
           {/* Mobile Header for Diagram Notice */}
           <div className="md:hidden bg-medical-50 p-2 text-center text-xs text-medical-800 border-b border-medical-100">
              请在桌面端查看交互式管路图。
           </div>
           
           <ChatInterface 
             messages={messages} 
             isLoading={isLoading} 
             onSendMessage={handleSendMessage}
             suggestions={suggestions}
           />
        </div>
      </main>
      
    </div>
  );
};

export default App;