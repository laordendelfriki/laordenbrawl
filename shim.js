/* Adaptador web: da al juego las mismas piezas que tenía dentro de Claude (usuario, base de datos y salas),
   pero con Firebase (login con Google o email, Firestore para perfiles/ranking y Realtime Database para las salas). */
(function(){
 const CFG=window.FB_CONFIG;
 if(!CFG||!window.firebase){return;}
 firebase.initializeApp(CFG);
 const auth=firebase.auth();
 let fs=null,rt=null;
 const ready=new Promise(res=>{const off=auth.onAuthStateChanged(u=>{off();res(u);});});
 auth.getRedirectResult().catch(e=>setTimeout(()=>showErr(e),400));
 // ---------- UI de login ----------
 const ERR={'auth/invalid-email':'Ese email no es válido.','auth/user-not-found':'No hay ninguna cuenta con ese email.','auth/wrong-password':'Contraseña incorrecta.','auth/invalid-credential':'Email o contraseña incorrectos.','auth/email-already-in-use':'Ya existe una cuenta con ese email. Pulsa «Entrar».','auth/weak-password':'La contraseña tiene que tener al menos 6 caracteres.','auth/popup-closed-by-user':'Has cerrado la ventana de Google.','auth/network-request-failed':'Sin conexión. Prueba otra vez.','auth/too-many-requests':'Demasiados intentos. Espera un poco.','auth/unauthorized-domain':'Este dominio no está autorizado en Firebase.'};
 function showErr(e){const m=document.getElementById('wlMsg');if(m)m.textContent=ERR[e&&e.code]||('No se ha podido: '+((e&&e.message)||e));}
 function modal(){
  let el=document.getElementById('wlogin');if(el)return el;
  el=document.createElement('div');el.id='wlogin';el.hidden=true;
  el.innerHTML=`<div class="wl"><h2>Tu cuenta</h2><p class="hint">Inicia sesión para guardar tu progreso en la nube, salir en el ranking y jugar online.</p>
  <button class="btn" id="wlG" type="button"><svg viewBox="0 0 48 48" width="22" height="22" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg> Entrar con Google</button>
  <div class="wlsep">o con tu email</div>
  <input id="wlE" type="email" autocomplete="email" placeholder="Email" aria-label="Email">
  <input id="wlP" type="password" autocomplete="current-password" placeholder="Contraseña (mínimo 6)" aria-label="Contraseña">
  <div class="row"><button class="btn sec" id="wlIn" type="button">Entrar</button><button class="btn online" id="wlUp" type="button">Crear cuenta</button></div>
  <button class="wllink" id="wlRe" type="button">¿Has olvidado la contraseña?</button>
  <p class="hint" id="wlMsg" role="status"></p>
  <button class="btn sec" id="wlX" type="button">Cerrar</button></div>`;
  document.getElementById('app').appendChild(el);
  const E=()=>document.getElementById('wlE').value.trim(),P=()=>document.getElementById('wlP').value;
  const done=()=>location.reload();
  document.getElementById('wlG').onclick=()=>{const pr=new firebase.auth.GoogleAuthProvider();auth.signInWithPopup(pr).then(done).catch(e=>{if(e.code==='auth/popup-blocked'||e.code==='auth/operation-not-supported-in-this-environment')auth.signInWithRedirect(pr);else showErr(e);});};
  document.getElementById('wlIn').onclick=()=>auth.signInWithEmailAndPassword(E(),P()).then(done).catch(showErr);
  document.getElementById('wlUp').onclick=()=>auth.createUserWithEmailAndPassword(E(),P()).then(done).catch(showErr);
  document.getElementById('wlRe').onclick=()=>{if(!E()){showErr({code:'auth/invalid-email'});return;}auth.sendPasswordResetEmail(E()).then(()=>{document.getElementById('wlMsg').textContent='Te hemos enviado un email para cambiar la contraseña.';}).catch(showErr);};
  document.getElementById('wlX').onclick=()=>{el.hidden=true;};
  return el;}
 window.WEBAUTH={open(){modal().hidden=false;},logout(){auth.signOut().then(()=>location.reload());}};

 // ---------- Salas con Realtime Database ----------
 function makeRoom(user){
  const me='p'+Math.random().toString(36).slice(2,10);
  let pres={},rc=null,watched=null,ref=null,cache=Object.freeze([]),others={},hs=[],conn=false,ch=[],pend=null,myRef=null;
  const self=()=>({peer:me,presence:pres,sameTab:true,isMe:true,kind:'viewer',guest:false,by:user.uid,updatedAt:Date.now()});
  const rebuild=()=>{cache=Object.freeze([self(),...Object.entries(others).map(([peer,o])=>({peer,presence:o.p||{},sameTab:false,isMe:false,kind:'viewer',guest:false,by:o.uid||null,updatedAt:o.t||0}))]);const c={peers:cache,joined:[],left:[],updated:[]};hs.forEach(h=>{try{h(c);}catch(e){console.error(e);}});};
  function watch(code){if(watched===code)return;if(ref)ref.off();others={};watched=code;if(!code){ref=null;rebuild();return;}
   ref=rt.ref('brawl/rooms/'+code);ref.on('value',sn=>{const v=sn.val()||{};others={};for(const k in v){if(k===me)continue;others[k]=v[k];}rebuild();},e=>console.warn(e));}
  function flush(){pend=null;if(!rc){if(myRef){myRef.remove();myRef.onDisconnect().cancel();myRef=null;}return;}
   const path='brawl/rooms/'+rc+'/'+me;if(!myRef||myRef.toString().indexOf(path)<0){if(myRef)myRef.remove();myRef=rt.ref(path);myRef.onDisconnect().remove();}
   myRef.set({uid:user.uid,t:firebase.database.ServerValue.TIMESTAMP,p:JSON.parse(JSON.stringify(pres))}).catch(e=>console.warn(e));}
  rt.ref('.info/connected').on('value',sn=>{conn=!!sn.val();ch.forEach(h=>{try{h(conn);}catch(e){}});});
  return {
   presence(patch){pres=Object.assign({},pres);for(const k in patch){if(patch[k]===null)delete pres[k];else pres[k]=patch[k];}
    const nrc=typeof pres.rc==='string'?pres.rc.replace(/[^A-Za-z0-9]/g,'').slice(0,8):null;if(nrc!==rc){if(myRef){myRef.remove();myRef.onDisconnect().cancel();myRef=null;}rc=nrc;watch(rc);}
    rebuild();if(!pend)pend=setTimeout(flush,45);return Promise.resolve();},
   peers(){return cache;},
   onPeers(h){hs.push(h);setTimeout(()=>h({peers:cache,joined:cache,left:[],updated:[]}),0);return ()=>{hs=hs.filter(x=>x!==h);};},
   connected(){return conn;},
   onConnection(h){ch.push(h);setTimeout(()=>h(conn),0);return ()=>{ch=ch.filter(x=>x!==h);};},
   watch(code){watch(code?String(code).replace(/[^A-Za-z0-9]/g,'').slice(0,8):null);},
   emit(){return Promise.resolve();},on(){return ()=>{};},
   join(){return Promise.reject({code:'not_permitted'});}
  };}

 const cache={};
 window.claude={use:async(name)=>{
  const u=await ready;if(!u)return null;
  if(name==='user')return cache.user||(cache.user={me:async()=>({id:u.uid,name:u.displayName||(u.email||'').split('@')[0],avatarUrl:u.photoURL||'',isOwner:false}),id:async()=>u.uid,profiles:async()=>({}),canEdit:()=>false});
  if(name==='db'){if(!fs){fs=firebase.firestore();try{fs.settings({ignoreUndefinedProperties:true,merge:true});}catch(e){}}return fs;}
  if(name==='room'){if(!rt)rt=firebase.database();return cache.room||(cache.room=makeRoom(u));}
  return null;}};
})();
