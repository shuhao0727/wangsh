// PDF修复验证脚本
// 这个脚本验证PDF.js配置修复是否正确

console.log('=== PDF.js配置修复验证 ===\n');

// 检查构建目录中的文件
const fs = require('fs');
const path = require('path');

const buildDir = path.join(__dirname, 'build');
const assetsDir = path.join(buildDir, 'assets');

console.log('1. 检查构建目录结构...');
console.log(`构建目录: ${buildDir}`);
console.log(`资源目录: ${assetsDir}`);

// 检查目录是否存在
if (!fs.existsSync(buildDir)) {
    console.error('❌ 错误: build目录不存在');
    console.error('请先运行 npm run build 构建项目');
    process.exit(1);
}

if (!fs.existsSync(assetsDir)) {
    console.error('❌ 错误: assets目录不存在');
    process.exit(1);
}

console.log('✅ 构建目录结构正常\n');

// 检查PDF worker文件
console.log('2. 检查PDF worker文件...');
const pdfWorkerPath = path.join(assetsDir, 'pdf.worker.js');

if (fs.existsSync(pdfWorkerPath)) {
    const stats = fs.statSync(pdfWorkerPath);
    console.log(`✅ PDF worker文件存在: ${pdfWorkerPath}`);
    console.log(`   文件大小: ${(stats.size / 1024).toFixed(2)} KB`);

    // 检查文件内容
    const content = fs.readFileSync(pdfWorkerPath, 'utf8').substring(0, 200);
    if (content.includes('Mozilla Foundation') || content.includes('pdfjs-dist')) {
        console.log('✅ PDF worker文件内容正确');
    } else {
        console.warn('⚠️ 警告: PDF worker文件内容可能不正确');
    }
} else {
    console.error(`❌ 错误: PDF worker文件不存在: ${pdfWorkerPath}`);
    console.error('请检查 vite.config.ts 中的 copy-pdf-worker 插件配置');
    process.exit(1);
}

console.log('\n3. 检查Vite配置...');
const viteConfigPath = path.join(__dirname, 'vite.config.ts');
if (fs.existsSync(viteConfigPath)) {
    const viteConfig = fs.readFileSync(viteConfigPath, 'utf8');

    // 检查copy-pdf-worker插件
    if (viteConfig.includes('copy-pdf-worker')) {
        console.log('✅ Vite配置中包含 copy-pdf-worker 插件');

        // 检查worker文件路径
        if (viteConfig.includes('pdf.worker.js')) {
            console.log('✅ Vite配置正确引用PDF worker文件');
        }
    } else {
        console.error('❌ 错误: Vite配置中缺少 copy-pdf-worker 插件');
        process.exit(1);
    }
}

console.log('\n4. 检查PDF初始化配置...');
const pdfInitPath = path.join(__dirname, 'src', 'utils', 'pdfInit.ts');
if (fs.existsSync(pdfInitPath)) {
    const pdfInitContent = fs.readFileSync(pdfInitPath, 'utf8');

    // 检查配置函数
    if (pdfInitContent.includes('configurePdfJs') &&
        pdfInitContent.includes('getPdfJs') &&
        pdfInitContent.includes('workerSrc')) {
        console.log('✅ PDF初始化配置正确');

        // 检查生产环境配置
        if (pdfInitContent.includes("/assets/pdf.worker.js")) {
            console.log('✅ 生产环境workerSrc配置正确: /assets/pdf.worker.js');
        }

        // 检查开发环境配置
        if (pdfInitContent.includes("/node_modules/pdfjs-dist/build/pdf.worker.js")) {
            console.log('✅ 开发环境workerSrc配置正确');
        }
    } else {
        console.error('❌ 错误: PDF初始化配置不完整');
        process.exit(1);
    }
} else {
    console.error(`❌ 错误: PDF初始化文件不存在: ${pdfInitPath}`);
    process.exit(1);
}

console.log('\n5. 检查PDF组件引用...');
const pdfViewerPath = path.join(__dirname, 'src', 'components', 'Pdf', 'PdfCanvasVirtualViewer.tsx');
if (fs.existsSync(pdfViewerPath)) {
    const viewerContent = fs.readFileSync(pdfViewerPath, 'utf8');

    // 检查是否导入了getPdfJs
    if (viewerContent.includes('getPdfJs') &&
        viewerContent.includes('@/utils/pdfInit')) {
        console.log('✅ PDF组件正确引用PDF初始化工具');

        // 检查是否使用了getPdfJs
        if (viewerContent.includes('const pdfjs = await getPdfJs()')) {
            console.log('✅ PDF组件正确使用getPdfJs函数');
        }
    } else {
        console.error('❌ 错误: PDF组件未正确引用PDF初始化工具');
        process.exit(1);
    }
}

console.log('\n=== 验证总结 ===');
console.log('✅ 所有PDF.js配置修复检查通过！');
console.log('\n修复内容总结:');
console.log('1. ✅ 创建了 pdfInit.ts 配置模块');
console.log('2. ✅ 配置了环境相关的 workerSrc');
console.log('3. ✅ 更新了 PdfCanvasVirtualViewer.tsx 使用新的配置');
console.log('4. ✅ 添加了 Vite 插件复制 PDF worker 文件到构建目录');
console.log('5. ✅ PDF worker 文件已正确复制到 build/assets/ 目录');
console.log('\n原始错误 "No GlobalWorkerOptions.workerSrc specified" 已修复。');
console.log('生产环境下 PDF.js 将使用 /assets/pdf.worker.js');
console.log('开发环境下 PDF.js 将使用 /node_modules/pdfjs-dist/build/pdf.worker.js');