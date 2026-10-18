/** Work stays in the page's model history. Reload starts clean; downloaded
 * project files are the explicit way to preserve work across page sessions. */
export function useProjectDraft() {
  return { ready: true, status: '当前页面保留 · 刷新后重置', saveNow: async () => {} };
}
