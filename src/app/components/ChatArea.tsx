import { useState, useRef, useEffect } from 'react';
import { Bot, Sparkles, User, ArrowUp, Mic, Square } from 'lucide-react';
import { Conversation } from '../types';
import RichMessageContent from './RichMessageContent';
import AnalysisContent from './AnalysisContent';

interface ChatAreaProps {
  assistantName: string;
  assistantDescription: string;
  conversation: Conversation | undefined;
  onNewConversation: () => void;
  onSendMessage: (content: string) => void;
  onRegenerate: (messageId: string) => void;
  onStopGeneration: () => void;
  isGenerating?: boolean;
}

export default function ChatArea({ assistantName, assistantDescription, conversation, onNewConversation, onSendMessage, onRegenerate, onStopGeneration, isGenerating }: ChatAreaProps) {
  const [inputValue, setInputValue] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // 不同助理的建议问题
  const suggestionsByAssistant: Record<string, string[]> = {
    '706测试': [
      "去年12月份907医院涉业科室单科就医人数核数？",
      "去年12月份907医院门诊费用排序分析？",
      "去年907医院门诊各查血，检验费用和相应费用占比？",
      "去年第二季度907医院眼科门诊费用？",
    ],
    '门诊收费数据': [
      "上个月各社区门诊处方费用？",
      "今年各科室门诊收费统计？",
      "最近一周门诊挂号费用分析？",
      "本月门诊医保统筹费用？",
    ],
    '医疗数据': [
      "去年907医院骨科统筹费用？",
      "今年各科室住院人次统计？",
      "最近三个月手术费用分析？",
      "本季度医疗费用增长趋势？",
    ],
    '汽车舆情': [
      "最近一周新能源汽车舆情分析？",
      "本月各品牌汽车投诉统计？",
      "最新的汽车质量问题报告？",
      "近期汽车市场热点话题？",
    ],
  };

  // 不同助理的演示文本（用于语音输入模拟）
  const demoTextsByAssistant: Record<string, string[]> = {
    '706测试': [
      "去年12月份907医院门诊费用排序分析",
      "去年第二季度907医院眼科门诊费用",
      "去年907医院门诊各查血检验费用和相应费用占比",
      "去年12月份907医院涉业科室单科就医人数核数",
    ],
    '门诊收费数据': [
      "上个月各社区门诊处方费用",
      "今年各科室门诊收费统计",
      "最近一周门诊挂号费用分析",
      "本月门诊医保统筹费用",
    ],
    '医疗数据': [
      "去年907医院骨科统筹费用",
      "今年各科室住院人次统计",
      "最近三个月手术费用分析",
      "本季度医疗费用增长趋势",
    ],
    '汽车舆情': [
      "最近一周新能源汽车舆情分析",
      "本月各品牌汽车投诉统计",
      "最新的汽车质量问题报告",
      "近期汽车市场热点话题",
    ],
  };

  const suggestions = suggestionsByAssistant[assistantName] || suggestionsByAssistant['706测试'];
  const demoTexts = demoTextsByAssistant[assistantName] || demoTextsByAssistant['706测试'];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversation?.messages]);

  // 清空输入框当对话切换时
  useEffect(() => {
    setInputValue('');
    setIsRecording(false);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }, [conversation?.id]);

  const handleSend = () => {
    if (inputValue.trim()) {
      onSendMessage(inputValue.trim());
      setInputValue('');
      setIsRecording(false);
      // Reset textarea height
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    onSendMessage(suggestion);
  };

  const handleRecommendationClick = (question: string) => {
    onSendMessage(question);
  };

  const handleRegenerateClick = (messageId: string) => {
    onRegenerate(messageId);
  };

  const startRecording = () => {
    setIsRecording(true);
    
    // Simulate voice recognition with demo text
    const randomText = demoTexts[Math.floor(Math.random() * demoTexts.length)];
    const words = randomText.split('');
    let currentText = '';
    
    // Simulate typing effect
    words.forEach((char, index) => {
      setTimeout(() => {
        currentText += char;
        setInputValue(currentText);
      }, index * 100); // 100ms per character
    });
  };

  const stopRecording = () => {
    setIsRecording(false);
    // 清空输入框
    setInputValue('');
    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleMicClick = () => {
    if (!inputValue.trim()) {
      // No text, start/stop recording
      if (isRecording) {
        stopRecording();
      } else {
        startRecording();
      }
    } else {
      // Has text - always send the message
      setIsRecording(false);
      handleSend();
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-gray-50">
      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="max-w-5xl mx-auto h-full">
          {!conversation || conversation.messages.length === 0 ? (
            // Welcome State
            <div className="flex flex-col items-center justify-center h-full text-center pt-20">
              <h2 className="text-2xl font-semibold text-gray-900 mb-8">
                有什么我能帮你的吗？
              </h2>
              <div className="w-full max-w-4xl">
                <div className="text-left mb-3">
                  <span className="text-sm text-gray-600">你可能想问</span>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  {suggestions.slice(0, 4).map((suggestion, index) => (
                    <button
                      key={index}
                      onClick={() => handleSuggestionClick(suggestion)}
                      className="group relative p-5 bg-white border border-gray-200 rounded-xl text-left hover:border-blue-400 hover:shadow-md transition-all duration-200 cursor-pointer"
                    >
                      <div className="flex items-start gap-3">
                        <Sparkles className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5 group-hover:text-blue-600 transition-colors" />
                        <span className="text-sm text-gray-700 leading-relaxed group-hover:text-gray-900">{suggestion}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            // Conversation Messages
            <div className="space-y-6">
              {conversation.messages.map((message, index) => (
                <div
                  key={message.id}
                  className={`${message.role === 'user' ? 'flex justify-end' : ''}`}
                >
                  {message.role === 'user' ? (
                    <div className="max-w-4xl">
                      <div className="rounded-lg bg-blue-600 text-white px-4 py-3 inline-block">
                        <div className="text-sm whitespace-pre-wrap text-white">
                          {message.content}
                        </div>
                      </div>
                    </div>
                  ) : message.role === 'analysis' ? (
                    <div className="w-full">
                      <AnalysisContent 
                        status={message.analysisStatus || 'analyzing'}
                        hasResultData={message.hasResultData}
                        intentStep={message.intentStep || 'pending'}
                        sqlStep={message.sqlStep || 'pending'}
                        visibleTables={message.visibleTables}
                        visibleMetrics={message.visibleMetrics}
                        showQueryMode={message.showQueryMode}
                        visibleSqlButtons={message.visibleSqlButtons}
                        isInterrupted={message.isInterrupted}
                      />
                    </div>
                  ) : (
                    <div className="w-full">
                      <RichMessageContent 
                        content={message.content} 
                        isRich={message.isRich}
                        onQuestionClick={handleRecommendationClick}
                        onRegenerate={handleRegenerateClick}
                        messageId={message.id}
                        isInterrupted={message.isInterrupted}
                      />
                    </div>
                  )}
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>
      </div>

      {/* Input Area */}
      <div className="px-6 py-4">
        <div className="max-w-5xl mx-auto">
          {/* Input Box Container */}
          <div className="bg-white border border-gray-200 rounded-3xl shadow-sm">
            {/* Input Box */}
            <div className="relative px-5 pt-4 pb-3">
              <textarea
                ref={textareaRef}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="请输入你的问题"
                className="w-full bg-transparent text-sm text-gray-900 placeholder-gray-400 focus:outline-none resize-none"
                rows={1}
                style={{ minHeight: '24px', maxHeight: '200px' }}
                onInput={(e) => {
                  const target = e.target as HTMLTextAreaElement;
                  target.style.height = 'auto';
                  target.style.height = Math.min(target.scrollHeight, 200) + 'px';
                }}
              />
            </div>

            {/* Bottom Toolbar */}
            <div className="px-4 pb-3 flex items-center justify-end">
              <div className="relative">
                {/* Tooltip */}
                {showTooltip && (
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 bg-gray-800 text-white text-xs rounded-lg whitespace-nowrap shadow-lg">
                    {isGenerating ? '停止生成' : isRecording ? '停止语音输入' : inputValue.trim() ? '发送' : '语音输入'}
                    {/* Arrow */}
                    <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px">
                      <div className="border-4 border-transparent border-t-gray-800"></div>
                    </div>
                  </div>
                )}
                
                <button
                  onClick={isGenerating ? onStopGeneration : handleMicClick}
                  onMouseEnter={() => setShowTooltip(true)}
                  onMouseLeave={() => setShowTooltip(false)}
                  className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200 ${
                    isGenerating
                      ? 'bg-red-600 hover:bg-red-700'
                      : isRecording
                      ? 'bg-blue-600 hover:bg-blue-700'
                      : inputValue.trim()
                      ? 'bg-blue-600 hover:bg-blue-700'
                      : 'bg-gray-200 hover:bg-gray-300'
                  }`}
                >
                  {isGenerating ? (
                    <Square className="w-4 h-4 text-white fill-white" />
                  ) : isRecording ? (
                    // Recording indicator - three vertical bars
                    <div className="flex items-center gap-0.5">
                      <div className="w-0.5 h-3 bg-white rounded-full animate-pulse" style={{ animationDelay: '0ms' }}></div>
                      <div className="w-0.5 h-4 bg-white rounded-full animate-pulse" style={{ animationDelay: '150ms' }}></div>
                      <div className="w-0.5 h-3 bg-white rounded-full animate-pulse" style={{ animationDelay: '300ms' }}></div>
                    </div>
                  ) : inputValue.trim() ? (
                    <ArrowUp className="w-5 h-5 text-white" />
                  ) : (
                    <Mic className="w-5 h-5 text-gray-600" />
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}