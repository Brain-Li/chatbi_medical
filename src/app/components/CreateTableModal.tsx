import { useState } from 'react';
import { X } from 'lucide-react';

interface CreateTableModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: any) => void;
}

export default function CreateTableModal({ isOpen, onClose, onSave }: CreateTableModalProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState({
    dataSourceName: '',
    externalDataTable: '',
    assignedTo: '',
    description: '',
  });

  const handleNext = () => {
    if (currentStep === 1) {
      // 验证第一步必填字段
      if (!formData.dataSourceName || !formData.externalDataTable) {
        alert('请填写必填项');
        return;
      }
      setCurrentStep(2);
    }
  };

  const handleSave = () => {
    if (!formData.dataSourceName || !formData.externalDataTable) {
      alert('请填写必填项');
      return;
    }
    onSave(formData);
    handleCancel();
  };

  const handleCancel = () => {
    setFormData({
      dataSourceName: '',
      externalDataTable: '',
      assignedTo: '',
      description: '',
    });
    setCurrentStep(1);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg w-full max-w-2xl mx-4 shadow-xl">
        {/* 标题栏 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-medium text-gray-900">数据集信息</h2>
          <button
            onClick={handleCancel}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 步骤指示器 */}
        <div className="px-6 py-6 border-b border-gray-200">
          <div className="flex items-center justify-center gap-8">
            {/* 步骤1 */}
            <div className="flex items-center gap-3">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                currentStep === 1 ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'
              }`}>
                1
              </div>
              <span className={`text-sm ${
                currentStep === 1 ? 'text-blue-600 font-medium' : 'text-gray-600'
              }`}>
                基本信息
              </span>
            </div>

            {/* 连接线 */}
            <div className="flex-1 max-w-[100px] h-px bg-gray-300" />

            {/* 步骤2 */}
            <div className="flex items-center gap-3">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                currentStep === 2 ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'
              }`}>
                2
              </div>
              <span className={`text-sm ${
                currentStep === 2 ? 'text-blue-600 font-medium' : 'text-gray-600'
              }`}>
                关联信息
              </span>
            </div>
          </div>
        </div>

        {/* 表单内容 */}
        <div className="px-6 py-6 max-h-[calc(100vh-300px)] overflow-y-auto">
          {currentStep === 1 && (
            <div className="space-y-5">
              {/* 数据源名称 */}
              <div className="flex items-start gap-4">
                <label className="w-28 text-right text-sm text-gray-700 pt-2">
                  <span className="text-red-500">*</span> 数据源名称:
                </label>
                <div className="flex-1">
                  <select
                    value={formData.dataSourceName}
                    onChange={(e) => setFormData({ ...formData, dataSourceName: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded text-sm text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">数据库表名不可重复</option>
                    <option value="carSet">carSet</option>
                    <option value="medicalSet">medicalSet</option>
                  </select>
                </div>
              </div>

              {/* 外层数据表文本 */}
              <div className="flex items-start gap-4">
                <label className="w-28 text-right text-sm text-gray-700 pt-2">
                  <span className="text-red-500">*</span> 外层数据表文本:
                </label>
                <div className="flex-1">
                  <input
                    type="text"
                    value={formData.externalDataTable}
                    onChange={(e) => setFormData({ ...formData, externalDataTable: e.target.value })}
                    placeholder="请输入外层数据表文本"
                    className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              {/* 所在人 */}
              <div className="flex items-start gap-4">
                <label className="w-28 text-right text-sm text-gray-700 pt-2">
                  所在人:
                </label>
                <div className="flex-1">
                  <input
                    type="text"
                    value={formData.assignedTo}
                    onChange={(e) => setFormData({ ...formData, assignedTo: e.target.value })}
                    placeholder="请选择所在人员"
                    className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              {/* 数据库描述 */}
              <div className="flex items-start gap-4">
                <label className="w-28 text-right text-sm text-gray-700 pt-2">
                  数据库描述:
                </label>
                <div className="flex-1">
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="简单描述"
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                  />
                </div>
              </div>
            </div>
          )}

          {currentStep === 2 && (
            <div className="py-12 text-center text-gray-500">
              关联信息配置页面待开发
            </div>
          )}
        </div>

        {/* 底部按钮 */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200">
          <button
            onClick={handleCancel}
            className="px-6 py-2 border border-gray-300 text-gray-700 rounded hover:bg-gray-50 transition-colors text-sm"
          >
            取消
          </button>
          {currentStep === 1 && (
            <button
              onClick={handleNext}
              className="px-6 py-2 border border-blue-600 text-blue-600 rounded hover:bg-blue-50 transition-colors text-sm"
            >
              下一步
            </button>
          )}
          {currentStep === 2 && (
            <button
              onClick={() => setCurrentStep(1)}
              className="px-6 py-2 border border-blue-600 text-blue-600 rounded hover:bg-blue-50 transition-colors text-sm"
            >
              上一步
            </button>
          )}
          <button
            onClick={handleSave}
            className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors text-sm"
          >
            保存
          </button>
        </div>
      </div>
    </div>
  );
}
