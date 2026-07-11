/* 拆页共用：读 query 参数 + 挂载单屏 + 单栏文档（无导航栏，返回=文首一行小字） */
function qp(name,def){return new URLSearchParams(location.search).get(name)||def;}
function mount(html){
  const s=document.createElement('div');s.className='screen';s.innerHTML=html;
  document.getElementById('app').appendChild(s);
  requestAnimationFrame(()=>s.classList.add('in'));
  return s;
}
function doc(main){return `<div class="scroll"><div class="doc">${main}<div class="colophon">✦</div></div></div>`;}
function backlink(label,href){return `<a class="backlink" href="${href}">← ${label}</a>`;}
