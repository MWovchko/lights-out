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

(function(){
  var $=function(id){return document.getElementById(id)};
  var store={get:function(k){try{return localStorage.getItem(k)}catch(e){return null}},set:function(k,v){try{localStorage.setItem(k,v)}catch(e){}}};

  /* old Stripe return URL -> thank-you page */
  if (/[?&]checkout=complete/.test(location.search)) { location.replace("/thank-you"); return; }

  if (!SALES_PAUSED) document.querySelectorAll("[data-paused]").forEach(function(el){el.hidden=true});

  /* ---------- delivery countdown: "Will be to you within" 24 hours, ticking down ---------- */
  var etaEls=document.querySelectorAll("[data-eta]");
  if(etaEls.length){
    var end=Date.now()+24*3600*1000, pad=function(n){return (n<10?"0":"")+n};
    var tick=function(){
      var ms=end-Date.now(); if(ms<=0){end=Date.now()+24*3600*1000; ms=end-Date.now();}
      var t=Math.floor(ms/1000), h=Math.floor(t/3600), m=Math.floor(t%3600/60), sec=t%60;
      var txt=h+"h "+pad(m)+"m "+pad(sec)+"s";
      etaEls.forEach(function(el){el.textContent=txt});
    };
    tick(); setInterval(tick,1000);
  }

  /* ---------- analytics (Vercel Web Analytics), only after cookie consent ---------- */
  var analyticsLoaded=false;
  function loadAnalytics(){
    if(analyticsLoaded) return; analyticsLoaded=true;
    // Load @vercel/analytics using dynamic import
    import('/js/analytics.mjs').then(function(module){
      module.inject();
    }).catch(function(err){
      console.warn('Failed to load analytics:', err);
    });
  }
  function track(name){ 
    if(analyticsLoaded && window.va) window.va("event",{name:name}); 
  }

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
      if(!SALES_PAUSED && PAYMENT_LINK){ location.href=PAYMENT_LINK; return; }
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
