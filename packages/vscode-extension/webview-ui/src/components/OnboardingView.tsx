import { useState, useCallback } from "react";

interface OnboardingViewProps {
  onAction: (action: string, data?: unknown) => void;
  onBack: () => void;
  isHelpMode?: boolean;
}

export function OnboardingView({
  onAction,
  onBack,
  isHelpMode = false,
}: OnboardingViewProps) {
  const [cursorSelected, setCursorSelected] = useState(true); // 默认选中
  const [isSettingUp, setIsSettingUp] = useState(false);

  const handleSetup = useCallback(async () => {
    if (!cursorSelected) return;
    setIsSettingUp(true);
    onAction("quickSetup", ["cursor"]);
  }, [cursorSelected, onAction]);

  return (
    <div className={`onboarding ${isHelpMode ? "help-mode" : ""}`}>
      <div className="onboarding-header">
        {isHelpMode && (
          <button className="back-btn" onClick={onBack} title="Back">
            <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M19 12H5" />
              <path d="M12 19l-7-7 7-7" />
            </svg>
          </button>
        )}
        <h1 className="onboarding-title">
          {isHelpMode ? "Setup" : "Welcome to Lineu"}
        </h1>
      </div>

      <div className="onboarding-content">
        <p className="onboarding-subtitle">
          Select your AI tool to set up Lineu:
        </p>

        <div className="platform-grid">
          {/* Cursor - 可选 */}
          <button
            className={`platform-card ${cursorSelected ? "selected" : ""}`}
            onClick={() => setCursorSelected(!cursorSelected)}
            disabled={isSettingUp}
          >
            <div className="platform-check">
              {cursorSelected && (
                <svg viewBox="0 0 24 24" className="check-icon">
                  <path d="M20 6L9 17l-5-5" />
                </svg>
              )}
            </div>
            <div className="platform-info">
              <span className="platform-name">Cursor</span>
              <span className="platform-desc">MCP + Commands</span>
            </div>
          </button>

          {/* Coming Soon 选项 */}
          <div className="platform-card disabled">
            <div className="platform-check"></div>
            <div className="platform-info">
              <span className="platform-name">Claude Desktop / Claude Code</span>
              <span className="platform-desc coming-soon">Coming Soon</span>
            </div>
          </div>
        </div>

        <p className="setup-hint">
          This will configure MCP and install Spark commands.
        </p>
      </div>

      <div className="onboarding-footer">
        <button
          className="btn btn-primary"
          onClick={handleSetup}
          disabled={!cursorSelected || isSettingUp}
        >
          {isSettingUp ? "Setting up..." : "Set Up Lineu"}
        </button>
        {!isHelpMode && (
          <button
            className="btn btn-secondary"
            onClick={onBack}
            disabled={isSettingUp}
          >
            Skip for Now
          </button>
        )}
        {isHelpMode && (
          <button
            className="btn btn-secondary"
            onClick={onBack}
            disabled={isSettingUp}
          >
            Back
          </button>
        )}
      </div>
    </div>
  );
}
