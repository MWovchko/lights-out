/* ============================================================
   DARKDORMS SITE SETTINGS
   SALES_PAUSED: true while the Stripe link is turned off. Preorder buttons then
   show a short loading spinner and scroll to the "preorders are paused" note.
   Set it to false when you reactivate the Stripe Payment Link.
   PAYMENT_LINK: the live $10.99 Stripe Payment Link. Never put the private
   discount link here. Set the link's confirmation page to redirect to
   https://darkdorms.com/thank-you
   ============================================================ */
var SALES_PAUSED = false;
var PAYMENT_LINK = "https://buy.stripe.com/dRm5kEdrI0Kcay33ao1oI00";
var CONTACT_EMAIL = "me@darkdorms.com";
/* REFERRALS: a rep's link is darkdorms.com/r/CODE (or /?ref=CODE). The code is
   remembered for REF_DAYS and sent to Stripe as client_reference_id, so the
   private tracker at /referrals can count their strips. Last link clicked wins. */
var REF_DAYS = 30;
/* Reps with a personal welcome line on the page. Code -> first name shown. */
var REF_NAMES = { julia: "Julia" };

(function(){
  var $=function(id){return document.getElementById(id)};
  var store={get:function(k){try{return localStorage.getItem(k)}catch(e){return null}},set:function(k,v){try{localStorage.setItem(k,v)}catch(e){}}};

  /* old Stripe return URL -> thank-you page */
  if (/[?&]checkout=complete/.test(location.search)) { location.replace("/thank-you"); return; }

  /* ---------- referral code: ?ref=CODE -> remembered -> Stripe client_reference_id ---------- */
  var cleanRef=function(v){v=String(v||"").trim().toLowerCase().replace(/[^a-z0-9_-]/g,"").slice(0,40);return v||null};
  var urlRef=cleanRef(new URLSearchParams(location.search).get("ref"));
  if(urlRef){
    store.set("dd-ref",JSON.stringify({code:urlRef,at:Date.now()}));
    if(history.replaceState){var u=new URL(location.href);u.searchParams.delete("ref");history.replaceState(null,"",u.pathname+u.search+u.hash);}
  }
  function currentRef(){
    try{var r=JSON.parse(store.get("dd-ref")||"null");if(r&&r.code&&Date.now()-r.at<REF_DAYS*864e5)return cleanRef(r.code)}catch(e){}
    return null;
  }
  function checkoutUrl(){
    var ref=currentRef(); if(!ref) return PAYMENT_LINK;
    return PAYMENT_LINK+(PAYMENT_LINK.indexOf("?")<0?"?":"&")+"client_reference_id="+encodeURIComponent("ref_"+ref);
  }

  /* personal welcome for a known rep's visitors */
  var refName=REF_NAMES[currentRef()||""];
  if(refName){
    var h=document.querySelector(".hero h1");
    if(h){var p=document.createElement("p");p.className="refnote";p.textContent=refName+" sent you. Thanks for stopping by!";h.parentNode.insertBefore(p,h);}
  }

  if (!SALES_PAUSED) document.querySelectorAll("[data-paused]").forEach(function(el){el.hidden=true});

  /* ---------- analytics (Vercel Web Analytics), only after cookie consent ---------- */
  var analyticsLoaded=false;
  function loadAnalytics(){
    if(analyticsLoaded) return; analyticsLoaded=true;
    window.va=window.va||function(){(window.vaq=window.vaq||[]).push(arguments)};
    var s=document.createElement("script"); s.defer=true; s.src="/_vercel/insights/script.js"; document.head.appendChild(s);
  }
  function track(name){ if(analyticsLoaded && window.va) window.va("event",{name:name}); }

  /* ---------- preorder buttons: loading state ---------- */
  document.querySelectorAll("[data-buy]").forEach(function(b){
    b.addEventListener("click",function(e){
      e.preventDefault();
      if(b.getAttribute("aria-busy")==="true") return;
      track("Preorder click");
      var html=b.innerHTML;
      b.style.minWidth=b.offsetWidth+"px";
      b.setAttribute("aria-busy","true");
      b.innerHTML='<span class="spin" aria-hidden="true"></span>Opening secure checkout…';
      if(!SALES_PAUSED && PAYMENT_LINK){ location.href=checkoutUrl(); return; }
      setTimeout(function(){
        b.innerHTML=html; b.removeAttribute("aria-busy"); b.style.minWidth="";
        var n=$("pausedNote"); if(n) n.scrollIntoView({behavior:"smooth",block:"center"});
      },900);
    });
  });
  /* back/forward cache: reset any spinning button */
  window.addEventListener("pageshow",function(){document.querySelectorAll('[aria-busy="true"]').forEach(function(b){b.removeAttribute("aria-busy")})});

  /* ---------- restock form: error, loading and done states ---------- */
  var form=$("alertForm");
  if(form){
    var setErr=function(input,errEl,msg){input.setAttribute("aria-invalid",msg?"true":"false");errEl.textContent=msg||"";errEl.hidden=!msg;};
    form.addEventListener("submit",function(e){
      e.preventDefault();
      var name=$("aName"),phone=$("aPhone"),ok=true,first=null;
      var nm=name.value.trim(),digits=phone.value.replace(/\D/g,"");
      if(!nm){setErr(name,$("aNameErr"),"Add your first name so we know who we're texting.");ok=false;first=first||name}else setErr(name,$("aNameErr"));
      if(!digits){setErr(phone,$("aPhoneErr"),"Add your phone number. That's where the text goes.");ok=false;first=first||phone}
      else if(digits.length<10||digits.length>11){setErr(phone,$("aPhoneErr"),"That number looks short. Use 10 digits, like 918 555 0142.");ok=false;first=first||phone}
      else setErr(phone,$("aPhoneErr"));
      if(!ok){first.focus();return;}
      var btn=$("alertBtn"),html=btn.innerHTML;
      btn.setAttribute("aria-busy","true");btn.innerHTML='<span class="spin" aria-hidden="true"></span>Opening your email…';
      track("Restock signup");
      var body="Text me when DarkDorms preorders open.\n\nName: "+nm+"\nPhone: "+phone.value.trim()+"\nDorm: "+($("aDorm").value.trim()||"-");
      location.href="mailto:"+CONTACT_EMAIL+"?subject="+encodeURIComponent("Restock alert: "+nm)+"&body="+encodeURIComponent(body);
      setTimeout(function(){
        btn.innerHTML=html;btn.removeAttribute("aria-busy");
        $("alertDone").textContent="Your email app should have opened with your details. Hit send and you're on the list. If nothing opened, email "+CONTACT_EMAIL+".";
        $("alertDone").hidden=false;
      },900);
    });
    ["aName","aPhone"].forEach(function(id){$(id).addEventListener("input",function(){if(this.getAttribute("aria-invalid")==="true") setErr(this,$(id+"Err"))})});
  }

  /* ---------- sticky phone CTA ---------- */
  var sticky=$("sticky");
  if(sticky && "IntersectionObserver" in window){
    var heroVisible=true,orderVisible=false;
    var upd=function(){var on=!heroVisible&&!orderVisible;sticky.classList.toggle("on",on);sticky.setAttribute("aria-hidden",on?"false":"true");sticky.querySelector("a").tabIndex=on?0:-1;};
    new IntersectionObserver(function(es){heroVisible=es[0].isIntersecting;upd()}).observe($("heroCtas"));
    new IntersectionObserver(function(es){orderVisible=es[0].isIntersecting;upd()}).observe($("buyCard"));
  }

  /* ---------- cookie banner ---------- */
  var cookie=$("cookie");
  function choose(v){store.set("dd-cookie",v);cookie.hidden=true;if(v==="yes")loadAnalytics();}
  $("ckYes").addEventListener("click",function(){choose("yes")});
  $("ckNo").addEventListener("click",function(){choose("no")});
  $("cookieLink").addEventListener("click",function(e){e.preventDefault();cookie.hidden=false});
  var saved=store.get("dd-cookie");
  if(saved==="yes") loadAnalytics(); else if(!saved) cookie.hidden=false;
})();
