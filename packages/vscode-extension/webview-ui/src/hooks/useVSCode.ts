import { useCallback, useEffect, useRef } from "react";
import type { WebviewMessage, ExtensionMessage } from "../types";

// 获取 VSCode API（只能调用一次）
function getVSCodeAPI(): ReturnType<typeof acquireVsCodeApi> | null {
  if (typeof acquireVsCodeApi === "function") {
    return acquireVsCodeApi();
  }
  return null;
}

const vscode = getVSCodeAPI();

/**
 * 与 VSCode 扩展通信的 Hook
 */
export function useVSCode(onMessage?: (message: ExtensionMessage) => void) {
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  useEffect(() => {
    const handler = (event: MessageEvent<ExtensionMessage>) => {
      onMessageRef.current?.(event.data);
    };

    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, []);

  const postMessage = useCallback((message: WebviewMessage) => {
    if (vscode) {
      vscode.postMessage(message);
    } else {
      // 开发模式下在浏览器中运行时，打印到控制台
      console.log("[Webview → VSCode]", message);
    }
  }, []);

  return { postMessage, isInVSCode: !!vscode };
}
