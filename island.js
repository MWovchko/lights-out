/* Agent Island panel for DarkDorms. Ranks agents the way a notch panel should:
   whoever needs you first, then whoever is working, then scheduled, new and done. */
(function(){
"use strict";
const SEEN = "darkdormsIsland.v1.seen";
const PHASE = {
  waiting:  {rank:0, label:"Needs you",   c:"var(--is-need)"},
  working:  {rank:1, label:"Working",     c:"var(--is-work)"},
  scheduled:{rank:2, label:"Scheduled",   c:"var(--is-sched)"},
  new:      {rank:3, label:"Not started", c:"var(--is-new)"},
  done:     {rank:4, label:"Done",        c:"var(--is-done)"},
};
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const PROJECT="https://claude.ai/code/project/chan_01DWJNahrsmHXUPwCMnYHJf4?thread=";
function ph(a){ return PHASE[a.status]||PHASE.new; }
function color(a){ return a.color || (a.look&&a.look.shirt) || "#4f7fd6"; }
function evidence(a){ return a.custom ? "Added in this browser. Paste its start prompt to begin." : a.thread ? "Source: project thread" : "Source: scheduled task"; }
function sorted(list){ return [...list].sort((a,b)=>ph(a).rank-ph(b).rank || a.name.localeCompare(b.name)); }
function summary(list){
  const need=list.filter(a=>a.status==="waiting"), work=list.filter(a=>a.status==="working");
  const asks=list.reduce((n,a)=>n+((a.needs&&a.needs.length)||0),0);
  return {need, work, asks};
}
function loadSeen(){ try{ return JSON.parse(localStorage.getItem(SEEN)||"{}"); }catch(e){ return {}; } }
function saveSeen(m){ try{ localStorage.setItem(SEEN, JSON.stringify(m)); }catch(e){} }

const views=[]; let agents=[], meta={}, openId=null;

function rowHTML(a, hi){
  const p=ph(a);
  return `<li><button type="button" class="isl-row${hi?" hi":""}" data-id="${esc(a.id)}" style="--c:${p.c}" aria-expanded="${openId===a.id}">
    <span class="isl-av" style="--av:${esc(color(a))}">${esc(a.name[0]||"?")}</span>
    <span class="isl-main"><span class="isl-name">${esc(a.name)} <span>${esc(a.role)}</span></span><span class="isl-st">${esc(a.statusText||p.label)}</span></span>
    <span class="isl-tag">${p.label}${a.needs&&a.needs.length?` · ${a.needs.length}`:""}</span></button>
    <div class="isl-detail${openId===a.id?" show":""}">
      ${esc(a.task)}
      ${a.latest?`<div style="margin-top:6px"><b>Latest:</b> ${esc(a.latest)}</div>`:""}
      ${a.needs&&a.needs.length?`<div style="margin-top:6px"><b>Needs from you:</b><ul>${a.needs.map(n=>`<li>${esc(n)}</li>`).join("")}</ul></div>`:""}
      <div class="ev">${esc(evidence(a))}${a.thread?` · <a href="${PROJECT+esc(a.thread)}" target="_blank" rel="noopener">Open thread</a>`:""}</div>
    </div></li>`;
}

function render(){
  const s=summary(agents), list=sorted(agents);
  views.forEach(v=>{
    if(v.mode==="notch"){
      v.dots.innerHTML=list.map(a=>`<i class="isl-dot ${a.status}" style="--c:${ph(a).c}" title="${esc(a.name)}"></i>`).join("");
      v.sum.innerHTML = s.need.length ? `<span class="need">${s.need.length} need you</span> · ${s.work.length} working` : (s.work.length?`${s.work.length} working · all clear`:"All quiet on the island");
      v.count.textContent = `${agents.length} agents`;
    } else {
      v.sum.innerHTML = s.need.length ? `<b style="color:var(--is-need)">${s.need.length} agents need you</b> (${s.asks} things) · ${s.work.length} working` : `${s.work.length} working · nothing needs you`;
    }
    v.list.innerHTML=list.map(a=>rowHTML(a, v.spotId===a.id)).join("");
    if(v.updated) v.updated.textContent = meta.updated ? "Updated "+new Date(meta.updated).toLocaleString([], {month:"short",day:"numeric",hour:"numeric",minute:"2-digit"}) : "";
  });
}

function spotlight(changes){
  if(!changes.length) return;
  const a=changes[0];
  views.forEach(v=>{
    if(v.mode==="notch"){
      v.spot.innerHTML=`<div style="--c:${ph(a).c}"><b>${esc(a.name)}</b>: ${ph(a).label}${changes.length>1?` (+${changes.length-1} more)`:""}<br><span style="color:var(--is-mute)">${esc(a.statusText||"")}</span></div>`;
      v.root.classList.add("spot"); clearTimeout(v.spotT); v.spotT=setTimeout(()=>v.root.classList.remove("spot"),6000);
    }
    v.spotId=a.id; clearTimeout(v.hiT); v.hiT=setTimeout(()=>{ v.spotId=null; render(); },6000);
  });
  render();
  if(document.hidden && "Notification" in window && Notification.permission==="granted"){
    try{ new Notification(`${a.name}: ${ph(a).label}`, {body:a.statusText||"", icon:"/icon-192.png", tag:"island-"+a.id}); }catch(e){}
  }
}

function update(list, m){
  agents=list.slice(); meta=m||{};
  const seen=loadSeen(), changes=[], next={};
  agents.forEach(a=>{ next[a.id]=a.status; if(seen[a.id] && seen[a.id]!==a.status) changes.push(a); });
  const first=!Object.keys(seen).length; saveSeen(next);
  render(); if(!first) spotlight(sorted(changes));
}

function wireList(v, onPick){
  v.list.addEventListener("click",e=>{
    if(e.target.closest("a")) return;
    const b=e.target.closest(".isl-row"); if(!b) return;
    const id=b.dataset.id; openId = openId===id?null:id; render();
    if(onPick) onPick(id);
  });
}

function mountNotch(el, opts={}){
  el.innerHTML=`<div class="isl isl-notch" role="region" aria-label="Agent island">
    <button type="button" class="isl-pill" aria-expanded="false" title="Agent island (Option-N)"><span class="isl-dots"></span><span class="isl-sum"></span><span class="isl-count"></span></button>
    <div class="isl-spot"></div>
    <div class="isl-body"><ul class="isl-list"></ul>
      <div class="isl-foot"><span class="isl-upd"></span><a href="/island" >Open as window</a></div></div></div>`;
  const root=el.firstElementChild, pill=root.querySelector(".isl-pill");
  const v={mode:"notch",root,dots:root.querySelector(".isl-dots"),sum:root.querySelector(".isl-sum"),count:root.querySelector(".isl-count"),spot:root.querySelector(".isl-spot"),list:root.querySelector(".isl-list"),updated:root.querySelector(".isl-upd")};
  const setOpen=o=>{ root.classList.toggle("open",o); pill.setAttribute("aria-expanded",String(o)); };
  pill.addEventListener("click",()=>setOpen(!root.classList.contains("open")));
  let hoverT; const fine=matchMedia("(hover:hover)").matches;
  if(fine){ root.addEventListener("mouseenter",()=>{ clearTimeout(hoverT); hoverT=setTimeout(()=>setOpen(true),180); });
    root.addEventListener("mouseleave",()=>{ clearTimeout(hoverT); hoverT=setTimeout(()=>setOpen(false),350); }); }
  document.addEventListener("keydown",e=>{ if(e.key==="Escape") setOpen(false); if(e.altKey && e.code==="KeyN"){ e.preventDefault(); setOpen(!root.classList.contains("open")); } });
  document.addEventListener("click",e=>{ if(!e.composedPath().includes(root)) setOpen(false); });
  wireList(v, id=>{ window.dispatchEvent(new CustomEvent("island:pick",{detail:id})); opts.onPick&&opts.onPick(id); });
  views.push(v); render(); return v;
}

function mountPanel(el, opts={}){
  const v={mode:"panel",root:el,sum:el.querySelector("[data-sum]"),list:el.querySelector("[data-list]"),updated:el.querySelector("[data-upd]")};
  wireList(v, opts.onPick); views.push(v); render(); return v;
}

window.Island={update, mountNotch, mountPanel, sorted, PHASE};

// The village page has a #notch slot; mount there automatically.
const slot=document.getElementById("notch"); if(slot) mountNotch(slot);
window.dispatchEvent(new Event("island:ready"));
})();
