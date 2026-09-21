import React, { useState } from 'react';
import { Maximize2, Monitor, AlertTriangle, RefreshCw } from 'lucide-react';

interface BlockingOverlayProps {
  isExitedFullscreen: boolean;
  isShareStopped: boolean;
  onRequestFullscreen: () => void;
  onReshareScreen: () => Promise<boolean>;
}

export const BlockingOverlay: React.FC<BlockingOverlayProps> = ({
  isExitedFullscreen,
  isShareStopped,
  onRequestFullscreen,
  onReshareScreen,
}) => {
  const [reshareError, setReshareError] = useState<string | null>(null);
  const [isResharing, setIsResharing] = useState<boolean>(false);

  if (!isExitedFullscreen && !isShareStopped) {
    return null;
  }

  const handleReshare = async () => {
    setReshareError(null);
    setIsResharing(true);
    try {
      const success = await onReshareScreen();
      if (!success) {
        setReshareError('You must share your ENTIRE screen. Window or tab shares are not accepted.');
      }
    } catch (err: unknown) {
      setReshareError(err instanceof Error ? err.message : 'Failed to re-share screen.');
    } finally {
      setIsResharing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#1F2420]/80 backdrop-blur-md flex items-center justify-center p-4 select-none">
      <div className="bg-[#FAF6F0] border-2 border-[#C1592B] rounded-xl max-w-md w-full p-6 shadow-2xl text-center space-y-4 animate-in zoom-in-95 duration-150">
        <div className="w-12 h-12 rounded-full bg-[#C1592B]/15 text-[#C1592B] mx-auto flex items-center justify-center">
          <AlertTriangle className="w-6 h-6" />
        </div>

        <div>
          <h3 className="text-xl font-serif text-[#1F2420] font-semibold">
            {isShareStopped ? 'Screen Sharing Terminated' : 'Fullscreen Mode Exited'}
          </h3>
          <p className="text-xs text-[#1F2420]/75 mt-1.5 leading-relaxed">
            {isShareStopped
              ? 'Your screen share session was paused or stopped. A proctoring violation has been logged. You must share your entire screen to resume the assessment.'
              : 'You have exited the mandatory fullscreen assessment view. A proctoring violation has been logged. Return to fullscreen immediately.'}
          </p>
        </div>

        {reshareError && (
          <div className="p-2.5 rounded-md bg-[#C1592B]/10 border border-[#C1592B]/20 text-xs text-[#C1592B]">
            {reshareError}
          </div>
        )}

        <div className="pt-2">
          {isShareStopped ? (
            <button
              type="button"
              id="btn-reshare-screen"
              disabled={isResharing}
              onClick={handleReshare}
              className="w-full py-3 rounded-lg bg-[#C1592B] hover:bg-[#a6481e] text-[#FAF6F0] font-medium text-xs font-mono uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-md cursor-pointer"
            >
              {isResharing ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Verifying Screen Share...</span>
                </>
              ) : (
                <>
                  <Monitor className="w-4 h-4" />
                  <span>Re-Share Entire Screen</span>
                </>
              )}
            </button>
          ) : (
            <button
              type="button"
              id="btn-return-fullscreen"
              onClick={onRequestFullscreen}
              className="w-full py-3 rounded-lg bg-[#1F2420] hover:bg-[#C1592B] text-[#FAF6F0] font-medium text-xs font-mono uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-md cursor-pointer"
            >
              <Maximize2 className="w-4 h-4" />
              <span>Return to Fullscreen</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
