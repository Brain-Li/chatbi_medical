import { useState } from 'react';
import { Car, DollarSign, Activity, TestTube, Plus, MessageSquare, Trash2 } from 'lucide-react';
import { Conversation } from '../App';

interface SidebarProps {
  selectedAssistant: string;
  onSelectAssistant: (name: string) => void;
  conversations: Conversation[];
  currentConversationId: string | null;
  onNewConversation: () => void;
  onSelectConversation: (id: string) => void;
  onDeleteConversation: (id: string) => void;
  onRenameConversation: (id: string, newTitle: string) => void;
}

export default function Sidebar({ 
  selectedAssistant, 
  onSelectAssistant, 
  conversations,
  currentConversationId,
  onNewConversation,
  onSelectConversation,
  onDeleteConversation,
  onRenameConversation,
}: SidebarProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const assistants = [
    {
      icon: Car,
      name: '汽车舆情',
      description: '汽车舆情分析',
      color: 'bg-blue-100 text-blue-600',
    },
    {
      icon: DollarSign,
      name: '门诊收费数据',
      description: '门诊收费数据分析',
      color: 'bg-green-100 text-green-600',
    },
    {
      icon: Activity,
      name: '医疗数据',
      description: '',
      color: 'bg-blue-100 text-blue-600',
    },
    {
      icon: TestTube,
      name: '706测试',
      description: '',
      color: 'bg-blue-100 text-blue-600',
    },
  ];

  // 获取当前助理的对话列表，按更新时间倒序排序
  const currentAssistantConversations = conversations
    .filter(conv => conv.assistant === selectedAssistant)
    .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());

  return (
    <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
      {/* New Conversation Button */}
      <div className="p-3 border-b border-gray-200">
        <button
          onClick={onNewConversation}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span className="text-sm font-medium">新对话</span>
        </button>
      </div>

      {/* Assistants Section - Fixed, no scroll */}
      <div className="py-2 border-b border-gray-200">
        {assistants.map((assistant) => {
          const Icon = assistant.icon;
          const isSelected = selectedAssistant === assistant.name;
          
          return (
            <button
              key={assistant.name}
              onClick={() => onSelectAssistant(assistant.name)}
              className={`w-full px-4 py-2.5 flex items-center gap-3 hover:bg-gray-50 transition-colors ${
                isSelected ? 'bg-blue-50' : ''
              }`}
            >
              <div className={`w-8 h-8 rounded flex items-center justify-center flex-shrink-0 ${
                isSelected ? 'bg-blue-600 text-white' : assistant.color
              }`}>
                <Icon className="w-4 h-4" />
              </div>
              <div className="flex-1 text-left">
                <div className={`text-sm ${isSelected ? 'text-blue-600 font-medium' : 'text-gray-900'}`}>
                  {assistant.name}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* History Section - Scrollable */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="px-4 pt-3 pb-2 border-t border-gray-100">
          <span className="text-sm font-medium text-gray-900">历史对话</span>
        </div>

        <div className="flex-1 overflow-y-auto">
          {currentAssistantConversations.length > 0 ? (
            <div className="py-1">
              {currentAssistantConversations.map((conv) => {
                const isSelected = currentConversationId === conv.id;
                const isHovered = hoveredId === conv.id;

                return (
                  <div
                    key={conv.id}
                    className={`group relative px-3 py-2 mx-2 rounded-lg cursor-pointer transition-colors ${
                      isSelected ? 'bg-blue-50' : 'hover:bg-gray-100'
                    }`}
                    onMouseEnter={() => setHoveredId(conv.id)}
                    onMouseLeave={() => setHoveredId(null)}
                    onClick={() => onSelectConversation(conv.id)}
                  >
                    <div className="flex items-center gap-2">
                      <MessageSquare className={`w-4 h-4 flex-shrink-0 ${isSelected ? 'text-blue-600' : 'text-gray-400'}`} />
                      
                      <span className={`flex-1 text-sm truncate ${isSelected ? 'text-blue-600 font-medium' : 'text-gray-700'}`}>
                        {conv.title}
                      </span>
                      
                      {(isHovered || isSelected) && (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteConfirmId(conv.id);
                            }}
                            className="p-1 hover:bg-red-100 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <Trash2 className="w-3 h-3 text-red-600" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="px-4 py-8 text-center text-sm text-gray-400">
              暂无历史对话
            </div>
          )}
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      {deleteConfirmId && (
        <div className="fixed inset-0 flex items-center justify-center z-50">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-black/10"
            onClick={() => setDeleteConfirmId(null)}
          ></div>
          
          {/* Dialog */}
          <div className="relative bg-white rounded-lg shadow-xl p-6 w-80 border border-gray-200">
            <h3 className="text-lg font-medium text-gray-900 mb-2">删除对话</h3>
            <p className="text-sm text-gray-500 mb-6">
              确定删除这条对话记录？此操作无法撤销。
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                取消
              </button>
              <button
                onClick={() => {
                  onDeleteConversation(deleteConfirmId);
                  setDeleteConfirmId(null);
                }}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors"
              >
                删除
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}