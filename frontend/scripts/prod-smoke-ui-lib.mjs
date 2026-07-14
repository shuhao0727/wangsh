export async function isNotFoundPage(page) {
  const [codeCount, messageCount] = await Promise.all([
    page.getByText("404", { exact: true }).count(),
    page.getByText("抱歉，您访问的页面不存在。", { exact: true }).count(),
  ]);

  return codeCount > 0 && messageCount > 0;
}
