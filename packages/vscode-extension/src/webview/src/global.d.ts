// CSS 模块类型声明
declare module "*.css" {
  const content: Record<string, string>;
  export default content;
}

// VSCode Webview API 类型声明
declare function acquireVsCodeApi(): {
  postMessage(message: unknown): void;
  getState(): unknown;
  setState(state: unknown): void;
};
