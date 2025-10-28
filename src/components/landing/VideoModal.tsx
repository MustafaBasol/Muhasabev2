import React, { useEffect } from 'react';
import { X, Play } from 'lucide-react';

interface VideoModalProps {
  onClose: () => void;
}

const VideoModal: React.FC<VideoModalProps> = ({ onClose }) => {
  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, []);

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black bg-opacity-75 flex items-center justify-center p-4"
      onClick={handleBackdropClick}
    >
      <div className="relative bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 bg-black bg-opacity-50 text-white p-2 rounded-full hover:bg-opacity-75 transition-colors"
          aria-label="Close video"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Video placeholder */}
        <div className="aspect-video bg-gray-900 flex items-center justify-center">
          {/* Since we don't have an actual video, show a placeholder */}
          <div className="text-center text-white">
            <div className="w-20 h-20 bg-white bg-opacity-20 rounded-full flex items-center justify-center mx-auto mb-4">
              <Play className="h-10 w-10 ml-1" />
            </div>
            <h3 className="text-2xl font-semibold mb-2">Comptario Demo</h3>
            <p className="text-gray-300 mb-6">
              See how easy it is to manage your pre-accounting with Comptario
            </p>
            <div className="text-sm text-gray-400">
              Demo video coming soon. In the meantime, try our free trial!
            </div>
          </div>
        </div>

        {/* Video info */}
        <div className="p-6">
          <h3 className="text-xl font-semibold text-gray-900 mb-2">
            Comptario Product Demo
          </h3>
          <p className="text-gray-600 mb-4">
            Discover how Comptario can streamline your invoicing, expense tracking, and VAT management 
            in just a few minutes.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={() => {
                onClose();
                // Open login in new tab
                window.open(import.meta.env.VITE_LOGIN_URL || '/login', '_blank');
              }}
              className="bg-gray-900 text-white px-6 py-3 rounded-lg font-semibold hover:bg-gray-800 transition-colors flex items-center justify-center gap-2"
            >
              Start Free Trial
            </button>
            <button
              onClick={onClose}
              className="text-gray-700 hover:text-gray-900 px-6 py-3 rounded-lg font-semibold transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VideoModal;