// secure context (HTTPS/localhost) 가 아니면 navigator.clipboard 가 undefined
// 라 throw — 폰/태블릿이 LAN IP(HTTP) 로 접속한 dev 환경이 대표 사례.
// 그 경우 legacy execCommand("copy") 로 fallback. 둘 다 실패하면 false 반환,
// 호출 측이 input select 같은 수동 안내로 처리.
export async function copyText(text: string): Promise<boolean> {
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // fallthrough → execCommand
    }
  }
  if (typeof document === "undefined") return false;
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.top = "0";
    ta.style.left = "-9999px";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}
