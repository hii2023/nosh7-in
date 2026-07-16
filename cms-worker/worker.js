/**
 * NOSH7 Blog CMS - Cloudflare Worker
 * Serves a passcode-gated admin UI to edit nosh7.in blog articles
 * (text blocks + inline images) and publishes by committing to
 * github.com/hii2023/nosh7-in via the GitHub Contents API.
 *
 * Secrets required:
 *   CMS_PASSCODE - passcode for the panel
 *   GITHUB_TOKEN - fine-grained PAT, repo hii2023/nosh7-in, Contents: read+write
 */

const REPO = 'hii2023/nosh7-in';
const BRANCH = 'main';
const SITE = 'https://nosh7.in';
const ARTICLE_RE = /^blog-[a-z0-9-]+\.html$/;
const IMG_NAME_RE = /^[a-z0-9][a-z0-9._-]*\.(webp|jpe?g|png)$/;

function b64encode(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  }
  return btoa(bin);
}

function json(data, status) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: { 'Content-Type': 'application/json', 'X-Robots-Tag': 'noindex, nofollow' }
  });
}

async function gh(env, method, path, body) {
  const res = await fetch('https://api.github.com' + path, {
    method: method,
    headers: {
      'Authorization': 'Bearer ' + env.GITHUB_TOKEN,
      'Accept': 'application/vnd.github+json',
      'User-Agent': 'nosh7-cms-worker',
      'X-GitHub-Api-Version': '2022-11-28'
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await res.json().catch(function () { return {}; });
  return { ok: res.ok, status: res.status, data: data };
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const path = url.pathname;

    if (path === '/') {
      return new Response(UI_HTML, {
        headers: { 'Content-Type': 'text/html; charset=utf-8', 'X-Robots-Tag': 'noindex, nofollow' }
      });
    }

    if (!path.startsWith('/api/')) return json({ error: 'Not found' }, 404);
    if (!env.CMS_PASSCODE) return json({ error: 'CMS_PASSCODE secret not set' }, 503);

    if (path === '/api/login' && req.method === 'POST') {
      const body = await req.json().catch(function () { return {}; });
      if (body.passcode === env.CMS_PASSCODE) return json({ ok: true });
      return json({ error: 'Wrong passcode' }, 401);
    }

    // Everything below requires the passcode header
    if (req.headers.get('x-cms-key') !== env.CMS_PASSCODE) {
      return json({ error: 'Unauthorized' }, 401);
    }

    if (path === '/api/status') {
      return json({ tokenConfigured: !!env.GITHUB_TOKEN });
    }

    if (path === '/api/articles') {
      // Public repo: list articles from the live sitemap (no token needed)
      const res = await fetch(SITE + '/sitemap.xml', { headers: { 'User-Agent': 'nosh7-cms-worker' } });
      const xml = await res.text();
      const locs = xml.match(/<loc>[^<]+<\/loc>/g) || [];
      const articles = [];
      for (const l of locs) {
        const u = l.replace(/<\/?loc>/g, '');
        const name = u.split('/').pop();
        if (ARTICLE_RE.test(name)) articles.push({ path: name, url: u });
      }
      return json({ articles: articles });
    }

    if (path === '/api/article') {
      const p = url.searchParams.get('path') || '';
      if (!ARTICLE_RE.test(p)) return json({ error: 'Invalid article path' }, 400);
      // Public repo: read raw file without a token
      const res = await fetch('https://raw.githubusercontent.com/' + REPO + '/' + BRANCH + '/' + p, {
        headers: { 'User-Agent': 'nosh7-cms-worker' }
      });
      if (!res.ok) return json({ error: 'Could not load article (' + res.status + ')' }, 502);
      return json({ html: await res.text() });
    }

    if (path === '/api/publish' && req.method === 'POST') {
      if (!env.GITHUB_TOKEN) return json({ error: 'GITHUB_TOKEN secret not set. Publishing is locked.' }, 503);
      const body = await req.json().catch(function () { return null; });
      if (!body || !ARTICLE_RE.test(body.path || '')) return json({ error: 'Invalid article path' }, 400);
      const html = body.html || '';
      if (html.length < 5000 || html.indexOf('<div class="article-wrap"') === -1 || html.indexOf('</html>') === -1) {
        return json({ error: 'Refusing to save: HTML looks incomplete/broken' }, 400);
      }

      // 1. Upload any new images to assets/blog/
      const images = Array.isArray(body.images) ? body.images : [];
      if (images.length > 10) return json({ error: 'Too many images in one publish' }, 400);
      for (const img of images) {
        if (!IMG_NAME_RE.test(img.name || '')) return json({ error: 'Invalid image name: ' + img.name }, 400);
        if (!img.base64 || img.base64.length > 1400000) return json({ error: 'Image too large (max ~1MB)' }, 400);
        const put = await gh(env, 'PUT', '/repos/' + REPO + '/contents/assets/blog/' + img.name, {
          message: 'CMS: add blog image ' + img.name,
          content: img.base64,
          branch: BRANCH
        });
        if (!put.ok && put.status !== 422) {
          return json({ error: 'Image upload failed: ' + (put.data.message || put.status) }, 502);
        }
        // 422 = already exists with same name; treat as OK (timestamped names make this rare)
      }

      // 2. Get current sha of the article
      const cur = await gh(env, 'GET', '/repos/' + REPO + '/contents/' + body.path + '?ref=' + BRANCH);
      if (!cur.ok) return json({ error: 'Could not read article sha: ' + (cur.data.message || cur.status) }, 502);

      // 3. Commit the updated HTML
      const put = await gh(env, 'PUT', '/repos/' + REPO + '/contents/' + body.path, {
        message: 'CMS: update ' + body.path,
        content: b64encode(html),
        sha: cur.data.sha,
        branch: BRANCH
      });
      if (!put.ok) return json({ error: 'Commit failed: ' + (put.data.message || put.status) }, 502);
      return json({ ok: true, commit: put.data.commit && put.data.commit.sha });
    }

    return json({ error: 'Not found' }, 404);
  }
};

const UI_HTML = '<!DOCTYPE html>\n' +
'<html lang="en">\n<head>\n' +
'<meta charset="UTF-8" />\n' +
'<meta name="viewport" content="width=device-width, initial-scale=1.0" />\n' +
'<meta name="robots" content="noindex, nofollow" />\n' +
'<title>NOSH7 Blog CMS</title>\n' +
'<link rel="preconnect" href="https://fonts.googleapis.com" />\n' +
'<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />\n' +
'<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />\n' +
'<style>\n' +
':root{--green:#1a3c2e;--sage:#52b788;--cream:#faf7f0;--line:#e5e0d5;--muted:#777;--red:#c0392b;}\n' +
'*{box-sizing:border-box;margin:0;padding:0;}\n' +
'body{font-family:"IBM Plex Sans",sans-serif;background:var(--cream);color:#222;min-height:100vh;}\n' +
'.top{background:var(--green);color:#fff;padding:14px 20px;display:flex;align-items:center;gap:12px;position:sticky;top:0;z-index:50;}\n' +
'.top b{font-size:17px;}.top span{opacity:.7;font-size:12px;}\n' +
'.top .right{margin-left:auto;display:flex;gap:8px;}\n' +
'.wrap{max-width:860px;margin:0 auto;padding:20px 16px 80px;}\n' +
'.card{background:#fff;border:1px solid var(--line);border-radius:14px;padding:18px;margin-bottom:14px;}\n' +
'button{font-family:inherit;font-size:14px;font-weight:600;border:none;border-radius:10px;padding:10px 16px;cursor:pointer;}\n' +
'.btn-g{background:var(--green);color:#fff;}.btn-s{background:var(--sage);color:#fff;}\n' +
'.btn-o{background:#fff;color:var(--green);border:1.5px solid var(--line);}\n' +
'.btn-r{background:#fdf0ee;color:var(--red);border:1.5px solid #f2c9c3;}\n' +
'button:disabled{opacity:.5;cursor:not-allowed;}\n' +
'input,textarea{font-family:inherit;font-size:15px;width:100%;padding:11px 12px;border:1.5px solid var(--line);border-radius:10px;background:#fff;}\n' +
'textarea{min-height:140px;font-family:ui-monospace,Menlo,monospace;font-size:13px;line-height:1.5;}\n' +
'.login{max-width:360px;margin:14vh auto 0;text-align:center;}\n' +
'.login h1{color:var(--green);font-size:22px;margin-bottom:6px;}\n' +
'.login p{color:var(--muted);font-size:13px;margin-bottom:18px;}\n' +
'.login input{text-align:center;margin-bottom:10px;}\n' +
'.alist a{display:block;background:#fff;border:1px solid var(--line);border-radius:12px;padding:14px 16px;margin-bottom:10px;color:var(--green);font-weight:600;text-decoration:none;font-size:15px;}\n' +
'.alist a small{display:block;color:var(--muted);font-weight:400;font-size:12px;margin-top:2px;}\n' +
'.banner{background:#fff8e6;border:1px solid #f0dfa8;border-radius:12px;padding:12px 14px;font-size:13px;line-height:1.6;margin-bottom:14px;}\n' +
'.banner code{background:#f4efe2;padding:1px 6px;border-radius:6px;font-size:12px;}\n' +
'.blk{background:#fff;border:1px solid var(--line);border-radius:12px;margin-bottom:10px;overflow:hidden;}\n' +
'.blk-head{display:flex;align-items:center;gap:8px;padding:8px 12px;background:#f7f4ec;border-bottom:1px solid var(--line);}\n' +
'.blk-tag{font-size:11px;font-weight:700;letter-spacing:.5px;color:var(--sage);text-transform:uppercase;}\n' +
'.blk-head .sp{margin-left:auto;display:flex;gap:4px;}\n' +
'.blk-head button{padding:4px 9px;font-size:12px;border-radius:8px;}\n' +
'.blk-body{padding:12px 14px;font-size:14px;line-height:1.65;overflow-x:auto;}\n' +
'.blk-body h2{color:var(--green);font-size:19px;}\n' +
'.blk-body img{max-width:100%;height:auto;border-radius:10px;}\n' +
'.blk-body table{border-collapse:collapse;font-size:12px;}.blk-body td,.blk-body th{border:1px solid var(--line);padding:4px 8px;}\n' +
'.addbar{text-align:center;margin:2px 0 12px;}\n' +
'.addbar button{font-size:12px;padding:6px 12px;}\n' +
'.modal-bg{position:fixed;inset:0;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;z-index:100;padding:16px;}\n' +
'.modal{background:#fff;border-radius:16px;padding:20px;width:100%;max-width:560px;max-height:88vh;overflow:auto;}\n' +
'.modal h3{color:var(--green);font-size:17px;margin-bottom:12px;}\n' +
'.modal label{display:block;font-size:12px;font-weight:600;color:var(--muted);margin:12px 0 4px;}\n' +
'.modal .row{display:flex;gap:8px;justify-content:flex-end;margin-top:16px;}\n' +
'.imgprev{max-width:100%;max-height:220px;border-radius:10px;display:block;margin:8px auto;}\n' +
'.hint{font-size:11.5px;color:var(--muted);margin-top:4px;line-height:1.5;}\n' +
'.toast{position:fixed;bottom:18px;left:50%;transform:translateX(-50%);background:var(--green);color:#fff;padding:11px 20px;border-radius:100px;font-size:13.5px;z-index:200;box-shadow:0 6px 20px rgba(0,0,0,.25);max-width:92vw;}\n' +
'.toast.err{background:var(--red);}\n' +
'.pubbar{position:fixed;bottom:0;left:0;right:0;background:#fff;border-top:1px solid var(--line);padding:10px 16px;display:flex;gap:10px;justify-content:center;z-index:60;}\n' +
'.crumb{font-size:13px;color:var(--muted);margin-bottom:12px;}\n' +
'.crumb a{color:var(--sage);font-weight:600;text-decoration:none;cursor:pointer;}\n' +
'</style>\n</head>\n<body>\n' +
'<div class="top"><b>NOSH7 Blog CMS</b><span>nosh7.in</span><div class="right"><button class="btn-o" id="logoutBtn" style="display:none;padding:6px 12px;font-size:12px;">Logout</button></div></div>\n' +
'<div class="wrap" id="app"></div>\n' +
'<script>\n' +
'(function(){\n' +
'var app=document.getElementById("app");\n' +
'var KEY=sessionStorage.getItem("n7cmsKey")||"";\n' +
'var state={articles:[],path:null,raw:"",pre:"",post:"",blocks:[],pending:{},tokenOk:true,dirty:false};\n' +
'function esc(s){return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");}\n' +
'function toast(msg,err){var t=document.createElement("div");t.className="toast"+(err?" err":"");t.textContent=msg;document.body.appendChild(t);setTimeout(function(){t.remove();},err?5000:3000);}\n' +
'function api(p,opts){opts=opts||{};opts.headers=opts.headers||{};opts.headers["x-cms-key"]=KEY;if(opts.body){opts.headers["Content-Type"]="application/json";}return fetch(p,opts).then(function(r){return r.json().then(function(d){if(!r.ok)throw new Error(d.error||("HTTP "+r.status));return d;});});}\n' +
'function prettify(slug){return slug.replace(/^blog-/,"").replace(/-ahmedabad\\.html$/,"").replace(/\\.html$/,"").replace(/-/g," ").replace(/\\b\\w/g,function(c){return c.toUpperCase();});}\n' +
'\n' +
'/* ---------- LOGIN ---------- */\n' +
'function showLogin(){\n' +
'  document.getElementById("logoutBtn").style.display="none";\n' +
'  app.innerHTML=\'<div class="login card"><h1>Blog C-Panel</h1><p>Enter the admin passcode to edit nosh7.in articles.</p><input type="password" id="pc" placeholder="Passcode" autofocus /><button class="btn-g" id="go" style="width:100%;">Open Panel</button></div>\';\n' +
'  var go=function(){var v=document.getElementById("pc").value;fetch("/api/login",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({passcode:v})}).then(function(r){if(r.ok){KEY=v;sessionStorage.setItem("n7cmsKey",v);boot();}else{toast("Wrong passcode",true);}});};\n' +
'  document.getElementById("go").onclick=go;\n' +
'  document.getElementById("pc").addEventListener("keydown",function(e){if(e.key==="Enter")go();});\n' +
'}\n' +
'document.getElementById("logoutBtn").onclick=function(){sessionStorage.removeItem("n7cmsKey");KEY="";showLogin();};\n' +
'\n' +
'/* ---------- ARTICLE LIST ---------- */\n' +
'function boot(){\n' +
'  document.getElementById("logoutBtn").style.display="";\n' +
'  app.innerHTML="<p style=\\"color:#777;\\">Loading articles...</p>";\n' +
'  Promise.all([api("/api/articles"),api("/api/status")]).then(function(res){\n' +
'    state.articles=res[0].articles;state.tokenOk=res[1].tokenConfigured;showList();\n' +
'  }).catch(function(e){if(String(e.message).indexOf("Unauthorized")>-1){showLogin();}else{app.innerHTML="<div class=\\"card\\">Error: "+esc(e.message)+"</div>";}});\n' +
'}\n' +
'function showList(){\n' +
'  var h="";\n' +
'  if(!state.tokenOk){h+=\'<div class="banner"><b>Publishing is locked.</b> The GitHub token is not configured yet. You can browse and prepare edits, but Publish will fail. One-time setup: create a fine-grained GitHub token for <code>hii2023/nosh7-in</code> (Contents: read &amp; write) and run <code>npx wrangler secret put GITHUB_TOKEN</code> in the cms-worker folder.</div>\';}\n' +
'  h+=\'<div class="crumb">\'+state.articles.length+\' articles &middot; tap one to edit</div><div class="alist">\';\n' +
'  state.articles.forEach(function(a){h+=\'<a data-p="\'+esc(a.path)+\'">\'+esc(prettify(a.path))+\'<small>\'+esc(a.path)+\'</small></a>\';});\n' +
'  h+="</div>";\n' +
'  app.innerHTML=h;\n' +
'  Array.prototype.forEach.call(app.querySelectorAll(".alist a"),function(el){el.onclick=function(){openArticle(el.getAttribute("data-p"));};});\n' +
'}\n' +
'\n' +
'/* ---------- EDITOR ---------- */\n' +
'function openArticle(p){\n' +
'  app.innerHTML="<p style=\\"color:#777;\\">Loading "+esc(p)+"...</p>";\n' +
'  api("/api/article?path="+encodeURIComponent(p)).then(function(d){\n' +
'    var raw=d.html;\n' +
'    var m=raw.match(/(<div class="article-wrap"[^>]*>)([\\s\\S]*?)(<\\/div>\\s*<footer)/);\n' +
'    if(!m){toast("Could not find the article body in this page",true);showList();return;}\n' +
'    state.path=p;state.raw=raw;state.pending={};state.dirty=false;\n' +
'    state.pre=raw.slice(0,m.index)+m[1];\n' +
'    state.post=m[3]+raw.slice(m.index+m[0].length);\n' +
'    var host=document.createElement("div");host.innerHTML=m[2];\n' +
'    state.blocks=Array.prototype.slice.call(host.children);\n' +
'    renderEditor();\n' +
'  }).catch(function(e){toast(e.message,true);});\n' +
'}\n' +
'function tagLabel(el){\n' +
'  if(el.tagName==="H2")return "Heading";\n' +
'  if(el.tagName==="P")return el.className==="intro"?"Intro":"Paragraph";\n' +
'  if(el.tagName==="UL"||el.tagName==="OL")return "List";\n' +
'  if(el.tagName==="TABLE")return "Table";\n' +
'  if(el.tagName==="FIGURE")return "Image";\n' +
'  if(el.tagName==="DIV"){if(el.className.indexOf("cta")>-1)return "CTA";if(el.className.indexOf("related")>-1)return "Related";if(el.className.indexOf("tip")>-1)return "Tip Box";if(el.className.indexOf("pull-quote")>-1)return "Quote";return "Block";}\n' +
'  return el.tagName;\n' +
'}\n' +
'function previewHTML(el){\n' +
'  var c=el.cloneNode(true);\n' +
'  Array.prototype.forEach.call(c.querySelectorAll?c.querySelectorAll("img"):[],function(im){\n' +
'    var src=im.getAttribute("src")||"";var name=src.split("/").pop();\n' +
'    if(state.pending[name]){im.src=state.pending[name].url;}\n' +
'    else if(src.charAt(0)==="/"){im.src="https://nosh7.in"+src;}\n' +
'  });\n' +
'  return c.outerHTML;\n' +
'}\n' +
'function renderEditor(){\n' +
'  var h=\'<div class="crumb"><a id="backBtn">&larr; All articles</a> &nbsp;/&nbsp; \'+esc(state.path)+\' &nbsp;&middot;&nbsp; <a href="https://nosh7.in/\'+esc(state.path)+\'" target="_blank">view live &nearr;</a></div>\';\n' +
'  if(!state.tokenOk){h+=\'<div class="banner"><b>Publishing locked</b> until the GitHub token is configured (see article list page).</div>\';}\n' +
'  h+=\'<div class="addbar"><button class="btn-o" data-add="0">+ Add image here</button></div>\';\n' +
'  state.blocks.forEach(function(b,i){\n' +
'    h+=\'<div class="blk"><div class="blk-head"><span class="blk-tag">\'+tagLabel(b)+\'</span><span class="sp">\'+\n' +
'      \'<button class="btn-o" data-up="\'+i+\'" title="Move up">&uarr;</button>\'+\n' +
'      \'<button class="btn-o" data-dn="\'+i+\'" title="Move down">&darr;</button>\'+\n' +
'      \'<button class="btn-o" data-ed="\'+i+\'">Edit</button>\'+\n' +
'      \'<button class="btn-r" data-del="\'+i+\'">Delete</button>\'+\n' +
'      \'</span></div><div class="blk-body">\'+previewHTML(b)+\'</div></div>\';\n' +
'    h+=\'<div class="addbar"><button class="btn-o" data-add="\'+(i+1)+\'">+ Add image here</button></div>\';\n' +
'  });\n' +
'  h+=\'<div style="height:52px;"></div>\';\n' +
'  app.innerHTML=h;\n' +
'  var bar=document.createElement("div");bar.className="pubbar";\n' +
'  bar.innerHTML=\'<button class="btn-g" id="pubBtn"\'+(state.dirty?"":" disabled")+\'>Publish to nosh7.in</button>\';\n' +
'  var old=document.querySelector(".pubbar");if(old)old.remove();\n' +
'  document.body.appendChild(bar);\n' +
'  document.getElementById("backBtn").onclick=function(){if(state.dirty&&!confirm("Discard unpublished changes?"))return;var pb=document.querySelector(".pubbar");if(pb)pb.remove();showList();};\n' +
'  document.getElementById("pubBtn").onclick=publish;\n' +
'  Array.prototype.forEach.call(app.querySelectorAll("[data-ed]"),function(el){el.onclick=function(){editBlock(+el.getAttribute("data-ed"));};});\n' +
'  Array.prototype.forEach.call(app.querySelectorAll("[data-del]"),function(el){el.onclick=function(){var i=+el.getAttribute("data-del");if(confirm("Delete this block?")){state.blocks.splice(i,1);state.dirty=true;renderEditor();}};});\n' +
'  Array.prototype.forEach.call(app.querySelectorAll("[data-up]"),function(el){el.onclick=function(){var i=+el.getAttribute("data-up");if(i>0){var b=state.blocks.splice(i,1)[0];state.blocks.splice(i-1,0,b);state.dirty=true;renderEditor();}};});\n' +
'  Array.prototype.forEach.call(app.querySelectorAll("[data-dn]"),function(el){el.onclick=function(){var i=+el.getAttribute("data-dn");if(i<state.blocks.length-1){var b=state.blocks.splice(i,1)[0];state.blocks.splice(i+1,0,b);state.dirty=true;renderEditor();}};});\n' +
'  Array.prototype.forEach.call(app.querySelectorAll("[data-add]"),function(el){el.onclick=function(){addImage(+el.getAttribute("data-add"));};});\n' +
'}\n' +
'\n' +
'/* ---------- EDIT BLOCK ---------- */\n' +
'function modal(inner){var bg=document.createElement("div");bg.className="modal-bg";bg.innerHTML=\'<div class="modal">\'+inner+"</div>";document.body.appendChild(bg);bg.addEventListener("click",function(e){if(e.target===bg)bg.remove();});return bg;}\n' +
'function editBlock(i){\n' +
'  var bg=modal(\'<h3>Edit block (HTML)</h3><textarea id="bhtml"></textarea><p class="hint">Edit the text between the tags. Keep the tags themselves intact.</p><div class="row"><button class="btn-o" id="cxl">Cancel</button><button class="btn-g" id="sav">Apply</button></div>\');\n' +
'  bg.querySelector("#bhtml").value=state.blocks[i].outerHTML;\n' +
'  bg.querySelector("#cxl").onclick=function(){bg.remove();};\n' +
'  bg.querySelector("#sav").onclick=function(){\n' +
'    var v=bg.querySelector("#bhtml").value;var t=document.createElement("div");t.innerHTML=v;\n' +
'    if(t.children.length!==1){toast("Block must be exactly one HTML element",true);return;}\n' +
'    state.blocks[i]=t.children[0];state.dirty=true;bg.remove();renderEditor();\n' +
'  };\n' +
'}\n' +
'\n' +
'/* ---------- ADD IMAGE ---------- */\n' +
'function slugify(s){return s.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"").slice(0,40)||"blog-image";}\n' +
'function addImage(pos){\n' +
'  var bg=modal(\'<h3>Add image</h3><input type="file" id="imf" accept="image/*" /><img class="imgprev" id="imp" style="display:none;" /><div id="imsz" class="hint"></div><label>Alt text (required, include keyword + Ahmedabad)</label><input id="ima" placeholder="e.g. high protein salad bowl Ahmedabad" /><label>Caption (optional, shows under the image)</label><input id="imc" placeholder="optional" /><div class="row"><button class="btn-o" id="cxl">Cancel</button><button class="btn-g" id="ins" disabled>Insert Image</button></div>\');\n' +
'  var blob=null,w=0,hgt=0;\n' +
'  bg.querySelector("#cxl").onclick=function(){bg.remove();};\n' +
'  bg.querySelector("#imf").onchange=function(e){\n' +
'    var f=e.target.files[0];if(!f)return;\n' +
'    var img=new Image();\n' +
'    img.onload=function(){\n' +
'      var scale=Math.min(1,1200/img.width);\n' +
'      w=Math.round(img.width*scale);hgt=Math.round(img.height*scale);\n' +
'      var cv=document.createElement("canvas");cv.width=w;cv.height=hgt;\n' +
'      cv.getContext("2d").drawImage(img,0,0,w,hgt);\n' +
'      var qs=[0.82,0.72,0.6,0.5,0.4],qi=0;\n' +
'      (function tryQ(){\n' +
'        cv.toBlob(function(b){\n' +
'          if(!b){toast("Image conversion failed",true);return;}\n' +
'          if(b.size>200*1024&&qi<qs.length-1){qi++;tryQ();return;}\n' +
'          blob=b;\n' +
'          bg.querySelector("#imp").src=URL.createObjectURL(b);bg.querySelector("#imp").style.display="";\n' +
'          bg.querySelector("#imsz").textContent=w+"x"+hgt+" WebP, "+Math.round(b.size/1024)+" KB"+(b.size>200*1024?" (still over 200KB - consider a smaller image)":"");\n' +
'          bg.querySelector("#ins").disabled=false;\n' +
'        },"image/webp",qs[qi]);\n' +
'      })();\n' +
'    };\n' +
'    img.src=URL.createObjectURL(f);\n' +
'  };\n' +
'  bg.querySelector("#ins").onclick=function(){\n' +
'    var alt=bg.querySelector("#ima").value.trim();\n' +
'    if(!alt){toast("Alt text is required for SEO",true);return;}\n' +
'    if(!blob){toast("Choose an image first",true);return;}\n' +
'    var cap=bg.querySelector("#imc").value.trim();\n' +
'    var name="n7-"+slugify(alt)+"-"+Date.now().toString(36)+".webp";\n' +
'    var rd=new FileReader();\n' +
'    rd.onload=function(){\n' +
'      var b64=String(rd.result).split(",")[1];\n' +
'      state.pending[name]={base64:b64,url:URL.createObjectURL(blob)};\n' +
'      var fig=document.createElement("figure");\n' +
'      fig.setAttribute("style","margin:2rem 0;text-align:center;");\n' +
'      var imh=\'<img src="/assets/blog/\'+name+\'" alt="\'+esc(alt)+\'" width="\'+w+\'" height="\'+hgt+\'" loading="lazy" decoding="async" style="max-width:100%;height:auto;border-radius:14px;" />\';\n' +
'      if(cap){imh+=\'<figcaption style="font-size:.85rem;color:#777;margin-top:.55rem;">\'+esc(cap)+"</figcaption>";}\n' +
'      fig.innerHTML=imh;\n' +
'      state.blocks.splice(pos,0,fig);state.dirty=true;bg.remove();renderEditor();\n' +
'    };\n' +
'    rd.readAsDataURL(blob);\n' +
'  };\n' +
'}\n' +
'\n' +
'/* ---------- PUBLISH ---------- */\n' +
'function publish(){\n' +
'  var btn=document.getElementById("pubBtn");btn.disabled=true;btn.textContent="Publishing...";\n' +
'  var inner="\\n\\n  "+state.blocks.map(function(b){return b.outerHTML;}).join("\\n\\n  ")+"\\n\\n";\n' +
'  var html=state.pre+inner+state.post;\n' +
'  var today=new Date().toISOString().slice(0,10);\n' +
'  html=html.replace(/"dateModified":\\s*"[^"]*"/,\'"dateModified": "\'+today+\'"\');\n' +
'  var used={};state.blocks.forEach(function(b){var t=document.createElement("div");t.appendChild(b.cloneNode(true));Array.prototype.forEach.call(t.querySelectorAll("img"),function(im){used[(im.getAttribute("src")||"").split("/").pop()]=1;});});\n' +
'  var images=Object.keys(state.pending).filter(function(n){return used[n];}).map(function(n){return{name:n,base64:state.pending[n].base64};});\n' +
'  api("/api/publish",{method:"POST",body:JSON.stringify({path:state.path,html:html,images:images})}).then(function(){\n' +
'    state.dirty=false;state.pending={};\n' +
'    btn.textContent="Publish to nosh7.in";\n' +
'    toast("Published. Site rebuilds in ~1-2 min. Cached pages may take longer (or purge Cloudflare cache).");\n' +
'    renderEditor();\n' +
'  }).catch(function(e){btn.disabled=false;btn.textContent="Publish to nosh7.in";toast(e.message,true);});\n' +
'}\n' +
'\n' +
'if(KEY){boot();}else{showLogin();}\n' +
'})();\n' +
'</script>\n</body>\n</html>';
