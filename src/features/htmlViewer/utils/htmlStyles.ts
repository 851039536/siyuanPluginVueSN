/**
 * HTML展示 - 样式常量与内联注入（消除 BASE_STYLES / INLINE_STYLE_MAP / COPY_INTERCEPT_SCRIPT 重复）
 */

export const SHARED_CSS_RULES: Record<string, string> = {
  code:
    'font-family:"SF Mono",Menlo,Monaco,Consolas,"Courier New",monospace;background:#f6f8fa;padding:2px 4px;border-radius:3px;font-size:0.9em',
  pre:
    'font-family:"SF Mono",Menlo,Monaco,Consolas,"Courier New",monospace;background:#f6f8fa;padding:16px;border-radius:6px;overflow:auto;line-height:1.5',
  kbd: 'font-family:"SF Mono",Menlo,Monaco,Consolas,"Courier New",monospace',
  samp: 'font-family:"SF Mono",Menlo,Monaco,Consolas,"Courier New",monospace',
  table: 'border-collapse:collapse;width:100%',
  th: 'border:1px solid #dfe2e5;padding:6px 13px;background:#f6f8fa;font-weight:600',
  td: 'border:1px solid #dfe2e5;padding:6px 13px',
}

export const BASE_STYLES = [
  "<style>",
  'code,pre,kbd,samp{font-family:"SF Mono",Menlo,Monaco,Consolas,"Courier New",monospace}',
  "code{background:#f6f8fa;padding:2px 4px;border-radius:3px;font-size:0.9em}",
  "pre{background:#f6f8fa;padding:16px;border-radius:6px;overflow:auto;line-height:1.5}",
  "pre code{background:none;padding:0;font-size:inherit}",
  "table{border-collapse:collapse;width:100%}",
  "td,th{border:1px solid #dfe2e5;padding:6px 13px}",
  "th{background:#f6f8fa;font-weight:600}",
  "</style>",
].join("")

export const COPY_INTERCEPT_SCRIPT = `<script>
(function(){
  var S=${JSON.stringify(SHARED_CSS_RULES)};
  function apply(){
    for(var t in S){
      var els=document.querySelectorAll(t);
      for(var i=0;i<els.length;i++){
        var e=els[i];if(!e.style)continue;
        var ps=S[t].split(';');
        for(var j=0;j<ps.length;j++){
          var kv=ps[j].split(':');
          if(kv.length===2&&!e.style.getPropertyValue(kv[0].trim()))
            e.style.setProperty(kv[0].trim(),kv[1].trim());
        }
      }
    }
  }
  document.addEventListener('copy',function(e){
    try{
      apply();
      var h='';
      var ss=document.querySelectorAll('style');
      for(var i=0;i<ss.length;i++)h+=ss[i].outerHTML;
      h+=document.body.innerHTML;
      e.clipboardData.setData('text/html',h);
      e.clipboardData.setData('text/plain',document.body.innerText);
      e.preventDefault();
    }catch(ex){}
  });
})();
  <` + "/script>"

/** 清洗 SiYuan 专属属性/包裹元素 + 注入内联样式 */
export function cleanAndInlineStyles(html: string): string {
  let result = html
  result = result.replace(/<script[\s\S]*?<\/script>/gi, "")
  result = result.replace(/<\/?protyle-[\w-][^>]*>/gi, "")
  result = result.replace(/<\/?div[^>]*data-node-id[^>]*>/gi, "")
  result = result.replace(/\s+data-[\w-]+="[^"]*"/gi, "")

  for (const [tag, styles] of Object.entries(SHARED_CSS_RULES)) {
    result = result.replace(new RegExp(`<${tag}([^>]*?)>`, "gi"), (_, attrs: string) => {
      const existingMatch = attrs.match(/style="([^"]*)"/i)
      const cleaned = attrs.replace(/\s*style="[^"]*"/i, "")
      const combined = existingMatch ? `${styles};${existingMatch[1]}` : styles
      return `<${tag}${cleaned} style="${combined}">`
    })
  }

  result = result.replace(/<table([^>]*)>/gi, (_, attrs: string) => {
    let cleaned = attrs.replace(/\s*border="[^"]*"/i, "").replace(/\s*cellspacing="[^"]*"/i, "")
    return `<table${cleaned} border="1" cellspacing="0">`
  })
  return result
}

/** 将 HTML 内容包裹基础样式 + 复制拦截脚本 */
export function wrapWithBaseStyles(content: string): string {
  if (/<\/body>/i.test(content)) {
    return content.replace(/<\/body>/i, `${BASE_STYLES}${COPY_INTERCEPT_SCRIPT}</body>`)
  }
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body>${BASE_STYLES}${COPY_INTERCEPT_SCRIPT}${content}</body></html>`
}
