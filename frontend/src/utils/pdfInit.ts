/**
 * PDF.js 初始化配置
 * 解决生产模式下 GlobalWorkerOptions.workerSrc 未配置的问题
 */

// PDF.js 配置标志，避免重复配置
let pdfjsConfigured = false;

/**
 * 配置 PDF.js workerSrc
 * 对于 pdfjs-dist v3.11.174，worker 文件需要正确配置
 */
export async function configurePdfJs(): Promise<void> {
  if (pdfjsConfigured) {
    return;
  }

  try {
    // 动态导入 pdfjs-dist
    const pdfjs = await import('pdfjs-dist/build/pdf');

    // 设置 workerSrc
    // 在 Vite 构建中，我们需要使用正确的 worker 文件路径
    // pdfjs-dist v3 的 worker 文件位于 node_modules/pdfjs-dist/build/pdf.worker.js
    // 在构建时，我们将其复制到 assets 目录

    if (import.meta.env.PROD) {
      // 生产环境：使用构建后的 worker 文件
      // 文件位于 /assets/pdf.worker.js（相对于网站根目录）
      pdfjs.GlobalWorkerOptions.workerSrc = '/assets/pdf.worker.js';
    } else {
      // 开发环境：直接引用 node_modules 中的 worker 文件
      // 在开发服务器中，Vite 会处理 node_modules 的路径
      pdfjs.GlobalWorkerOptions.workerSrc = '/node_modules/pdfjs-dist/build/pdf.worker.js';
    }

    console.log('PDF.js configured with workerSrc:', pdfjs.GlobalWorkerOptions.workerSrc);
    pdfjsConfigured = true;
  } catch (error) {
    console.error('Failed to configure PDF.js:', error);
    throw error;
  }
}

/**
 * 获取配置好的 PDF.js 实例
 */
export async function getPdfJs(): Promise<any> {
  await configurePdfJs();
  return await import('pdfjs-dist/build/pdf');
}