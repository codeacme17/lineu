import { useCallback } from "react";

interface OnboardingState {
  mcpConfigured: boolean;
  commandsConfigured: boolean;
}

interface OnboardingViewProps {
  state: OnboardingState;
  onAction: (action: string) => void;
  onBack: () => void;
  isHelpMode?: boolean; // true = 从设置进入的 Help 模式
}

export function OnboardingView({
  state,
  onAction,
  onBack,
  isHelpMode = false,
}: OnboardingViewProps) {
  const requiredDone = state.mcpConfigured;

  const handleFinish = useCallback(() => {
    if (requiredDone) {
      onAction("finish");
      onBack();
    }
  }, [requiredDone, onAction, onBack]);

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
          {isHelpMode ? "Help" : "Welcome to Lineu"}
        </h1>
      </div>

      <div className="onboarding-steps">
        <div className="step">
          <div className="step-header">
            <h2>Step 1: Configure MCP</h2>
            {!isHelpMode && (
              <span className={`status ${state.mcpConfigured ? "done" : ""}`}>
                {state.mcpConfigured ? "✓" : "Required"}
              </span>
            )}
          </div>
          <p>
            {isHelpMode
              ? "Create the MCP config file for your AI tool."
              : "Required. Create the MCP config file for Lineu to work."}
          </p>
          {!isHelpMode && (
            <p className="step-hint">Restart your AI tool after creating the config.</p>
          )}
          <div className="step-actions">
            <button
              className="btn btn-secondary"
              onClick={() => onAction("createMcpConfig")}
            >
              Create MCP Config
            </button>
          </div>
        </div>

        <div className="step">
          <div className="step-header">
            <h2>Step 2: Set Up Commands</h2>
            {!isHelpMode && (
              <span className={`status optional ${state.commandsConfigured ? "done" : ""}`}>
                {state.commandsConfigured ? "✓" : "Optional"}
              </span>
            )}
          </div>
          <p>
            {isHelpMode
              ? "Install Spark commands for capturing knowledge."
              : "Optional. Install Spark commands to capture knowledge from AI conversations."}
          </p>
          <p className="step-hint">
            <code>/spark</code> - Capture knowledge
            <br />
            <code>/respark</code> - Different perspective
            <br />
            <code>/deepspark</code> - Deep dive
          </p>
          <div className="step-actions">
            <button
              className="btn btn-secondary"
              onClick={() => onAction("copyCommands")}
            >
              Install Commands
            </button>
          </div>
        </div>
      </div>

      <div className="onboarding-footer">
        {isHelpMode ? (
          <button className="btn btn-secondary" onClick={onBack}>
            ← Back to Cards
          </button>
        ) : (
          <>
            <button
              className="btn btn-primary"
              onClick={handleFinish}
              disabled={!requiredDone}
            >
              {requiredDone ? "✓ Complete Setup" : "Complete Step 1"}
            </button>
            <button className="btn btn-secondary" onClick={onBack}>
              Skip for Now
            </button>
          </>
        )}
      </div>
    </div>
  );
}
