import { useCallback } from "react";

interface OnboardingState {
  apiKeyConfigured: boolean;
  mcpConfigured: boolean;
  hooksConfigured: boolean;
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
  const requiredDone = state.apiKeyConfigured && state.mcpConfigured;

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
            <h2>Step 1: Configure OpenRouter API Key</h2>
            {!isHelpMode && (
              <span className={`status ${state.apiKeyConfigured ? "done" : ""}`}>
                {state.apiKeyConfigured ? "✓ Done" : "Required"}
              </span>
            )}
          </div>
          <p>
            {isHelpMode
              ? "Set your OpenRouter API key for generating cards."
              : "Required. This key is needed for generating cards via OpenRouter."}
          </p>
          <div className="step-actions">
            <button
              className="btn btn-secondary"
              onClick={() => onAction("configureOpenRouter")}
            >
              Set API Key
            </button>
          </div>
        </div>

        <div className="step">
          <div className="step-header">
            <h2>Step 2: Configure MCP</h2>
            {!isHelpMode && (
              <span className={`status ${state.mcpConfigured ? "done" : ""}`}>
                {state.mcpConfigured ? "✓ Done" : "Required"}
              </span>
            )}
          </div>
          <p>
            {isHelpMode
              ? "Create or update the MCP config file for your AI tool."
              : "Required. Create the MCP config file or copy the snippet into your AI tool settings."}
          </p>
          <p className="step-hint">
            Cursor: <code>~/.cursor/mcp.json</code>
            <br />
            Claude Desktop: <code>~/Library/Application Support/Claude/claude_desktop_config.json</code>
          </p>
          {!isHelpMode && (
            <p className="step-hint">Restart your AI tool after saving the config.</p>
          )}
          <div className="step-actions">
            <button
              className="btn btn-secondary"
              onClick={() => onAction("createMcpConfig")}
            >
              Create MCP Config
            </button>
            <button
              className="btn btn-secondary"
              onClick={() => onAction("copyMcpConfig")}
            >
              Copy Config
            </button>
          </div>
        </div>

        <div className="step">
          <div className="step-header">
            <h2>Step 3: Configure Hooks</h2>
            {!isHelpMode && (
              <span className={`status optional ${state.hooksConfigured ? "done" : ""}`}>
                {state.hooksConfigured ? "✓ Done" : "Optional"}
              </span>
            )}
          </div>
          <p>
            {isHelpMode
              ? "Set up hooks for auto-capture after AI conversations."
              : "Optional. Create hooks config for auto-capture after AI conversations."}
          </p>
          <p className="step-hint">
            Cursor: <code>~/.cursor/hooks.json</code>
            <br />
            Claude Code: <code>~/.claude/settings.json</code>
          </p>
          <div className="step-actions">
            <button
              className="btn btn-secondary"
              onClick={() => onAction("createHooksConfig")}
            >
              Create Hooks Config
            </button>
            <button
              className="btn btn-secondary"
              onClick={() => onAction("copyHooksConfig")}
            >
              Copy Config
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
              {requiredDone ? "✓ Complete Setup" : "Complete Steps 1 & 2"}
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
