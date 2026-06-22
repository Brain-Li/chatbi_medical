import { Settings } from 'lucide-react';

export default function FloatingButton() {
  return (
    <button className="fixed bottom-8 right-8 w-14 h-14 bg-blue-600 rounded-full shadow-lg flex items-center justify-center hover:bg-blue-700 transition-colors">
      <Settings className="w-6 h-6 text-white" />
    </button>
  );
}
