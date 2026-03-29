import { useState, useCallback, useEffect } from "react";
import { initializeApp } from 'firebase/app';
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, updateProfile, sendEmailVerification } from 'firebase/auth';
import { getFirestore, enableIndexedDbPersistence, doc, onSnapshot, setDoc } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';

// ── FIREBASE CONFIG ─────────────────────────────────────
const firebaseConfig = {
  apiKey: "AIzaSyB7yFQR1ffwP1kZHe74meZoefd1osLqs8c",
  authDomain: "franc-90338.firebaseapp.com",
  projectId: "franc-90338",
  storageBucket: "franc-90338.firebasestorage.app",
  messagingSenderId: "179043115496",
  appId: "1:179043115496:web:1c7d050b8da45c4244445d",
  measurementId: "G-4R8B5HZJNQ"
};

const isFirebaseConfigured = firebaseConfig.apiKey !== "REPLACE_ME" && firebaseConfig.apiKey !== "";

let app, auth, db, storage;
if (isFirebaseConfigured) {
  try {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
    storage = getStorage(app);
    try {
      enableIndexedDbPersistence(db).catch(console.warn);
    } catch(e) {}
  } catch (err) {
    console.error("Firebase init error", err);
  }
}

// ── CONSTANTS ────────────────────────────────────────────
const MONTHS_SHORT = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
const MONTHS_FULL  = ['January','February','March','April','May','June','July','August','September','October','November','December'];

const DEFAULT_CATS = [
  {id:'food',          name:'Food & Drinks',     emoji:'🍽'},
  {id:'transport',     name:'Transport',          emoji:'🚌'},
  {id:'data',          name:'Data & Airtime',     emoji:'📱'},
  {id:'school',        name:'Education / Art',    emoji:'📚'},
  {id:'personal',      name:'Personal Care',      emoji:'🧴'},
  {id:'entertainment', name:'Entertainment',      emoji:'🎮'},
  {id:'others',        name:'Others / Misc',      emoji:'📦'}
];

const DEFAULT_SOURCES = ['Parents / Family', 'Freelance / Clients', 'Business Sales'];

const DEFAULT_ALLOCATIONS = [
  { id: 'biz', name: 'Business / Reinvest', pct: 40 },
  { id: 'per', name: 'Personal Stuff', pct: 30 },
  { id: 'inv', name: 'Investments', pct: 20 },
  { id: 'emg', name: 'Emergency Fund', pct: 10 }
];

const KEYWORDS = {
  transport:     ['taxi','moto','bike','bus','drop','fare','transport','road','trip','uber','bolt','ride','car','vehicle','fuel','petrol','gas','motor','journey','travel','park','station','checkpoint','bukwai','buea','limbe','bamenda','douala','route','conductor','agence'],
  food:          ['food','eat','drink','lunch','dinner','breakfast','suya','rice','bread','water','juice','beer','wine','snack','biscuit','cake','chicken','fish','beans','plantain','yam','pepper','tomato','onion','indomie','noodle','restaurant','cafe','canteen','chop','meat','egg','milk','coffee','tea','soda','fanta','coke','malt','groundnut','fruit','vegetable','market','grocery','groceries','bottle','sachet'],
  data:          ['data','airtime','mtn','orange','camtel','nextel','recharge','bundle','mb','gb','internet','wifi','network','credit','sms','topup','phone credit','sim','subscription','streaming','forfait'],
  school:        ['school','university','ub','college','class','course','lecture','book','textbook','pen','pencil','notebook','exercise','assignment','project','print','photocopy','exam','test','fee','tuition','registration','lab','library','stationery','calculator','study','lesson','tutorial','academic','art','paint','colors','brush','canvas','draw'],
  personal:      ['soap','lotion','cream','shampoo','deodorant','perfume','cologne','haircut','barber','salon','hair','nail','razor','blade','toothpaste','toothbrush','hygiene','medicine','drug','pharmacy','clinic','doctor','hospital','paracetamol','tablet','panadol','medical'],
  entertainment: ['cinema','movie','film','game','gaming','play','fun','outing','party','club','concert','show','event','sport','football','basketball','match','bet','betting','leisure','hangout','date','hobby','music','headphone','earphone','controller'],
};

function autoCategory(desc, categories) {
  const d = desc.toLowerCase();
  const scores = {};
  for (const [catId, words] of Object.entries(KEYWORDS)) {
    scores[catId] = 0;
    for (const w of words) {
      if (d.includes(w)) scores[catId] += w.length > 4 ? 3 : 2;
    }
  }
  let best = null, bestScore = 0;
  for (const [catId, score] of Object.entries(scores)) {
    if (score > bestScore) { bestScore = score; best = catId; }
  }
  if (best && categories.find(c => c.id === best)) return best;
  return categories.find(c => c.id === 'others')?.id || categories[0]?.id || 'food';
}

function fmt(n) {
  return Number(n || 0).toLocaleString('fr-CM');
}

function getKey(m, y) {
  return `${y}-${String(m + 1).padStart(2, '0')}`;
}

const PIE_COLORS = ['#f87171', '#60a5fa', '#facc15', '#34d399', '#c084fc', '#fb923c', '#e879f9'];

// ── STYLES CLOSURE ─────────────────────────────────────────
const getStyles = (isDark) => {
  const bg = isDark ? '#080810' : '#f0f0f5';
  const cardBg = isDark ? '#10101a' : '#ffffff';
  const inputBg = isDark ? '#18182a' : '#e6e6f0';
  const textMain = isDark ? '#eeeef5' : '#111118';
  const textSub = isDark ? '#7777aa' : '#555577';
  const border = isDark ? '#ffffff1a' : '#00000018';
  const borderFaint = isDark ? '#ffffff0d' : '#0000000a';
  const accent = isDark ? '#c8f542' : '#8ab000'; 
  const accentLight = isDark ? '#c8f54218' : '#8ab0001a';

  return {
    app: { background:bg, minHeight:'100vh', color:textMain, fontFamily:"'Segoe UI', system-ui, sans-serif", maxWidth:480, margin:'0 auto', display:'flex', flexDirection:'column', transition:'all 0.3s ease' },
    header: { padding:'20px 16px 12px', display:'flex', alignItems:'center', justifyContent:'space-between', borderBottom:`1px solid ${borderFaint}`, position:'sticky', top:0, background:bg, zIndex:100, transition:'all 0.3s ease' },
    logo: { fontSize:20, fontWeight:800, color:accent, letterSpacing:-0.5 },
    logoSub: { color:textSub, fontWeight:400, fontSize:11, marginLeft:6, fontFamily:'monospace' },
    monthNav: { display:'flex', alignItems:'center', gap:4 },
    monthBtn: { background:'none', border:'none', color:textSub, cursor:'pointer', fontSize:16, padding:'4px 8px', touchAction:'manipulation' },
    monthLabel: { fontFamily:'monospace', fontSize:11, color:textMain, minWidth:68, textAlign:'center' },
    tabs: { display:'flex', gap:3, padding:'12px 16px 0', background:bg, position:'sticky', top:57, zIndex:99, borderBottom:`1px solid ${borderFaint}`, paddingBottom:10, transition:'all 0.3s ease' },
    tab: (active) => ({ flex:1, padding:'8px 0', textAlign:'center', fontSize:9, fontWeight:700, letterSpacing:0.4, borderRadius:6, cursor:'pointer', color: active ? accent : textSub, background: active ? inputBg : 'transparent', border: active ? `1px solid ${border}` : '1px solid transparent', fontFamily:'inherit', touchAction:'manipulation' }),
    section: { padding:'16px 16px 100px', flex:1 },
    card: { background:cardBg, border:`1px solid ${border}`, borderRadius:14, padding:18, marginBottom:12, position:'relative', overflow:'hidden', transition:'all 0.3s ease' },
    cardLabel: { fontFamily:'monospace', fontSize:10, color:textSub, letterSpacing:1, textTransform:'uppercase', marginBottom:6 },
    cardBig: (color) => ({ fontSize:32, fontWeight:800, letterSpacing:-1, color: color || textMain }),
    cardSub: { fontFamily:'monospace', fontSize:11, color:textSub, marginTop:5 },
    statGrid: { display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:12 },
    stat: (color) => ({ background:cardBg, border:`1px solid ${color}30`, borderRadius:8, padding:14, transition:'all 0.3s ease' }),
    statLabel: { fontFamily:'monospace', fontSize:10, color:textSub, marginBottom:4, letterSpacing:0.5 },
    statVal: (color) => ({ fontSize:17, fontWeight:700, color }),
    secTitle: { fontFamily:'monospace', fontSize:10, color:textSub, letterSpacing:1, textTransform:'uppercase', marginBottom:10 },
    catRow: { display:'flex', alignItems:'center', gap:10, marginBottom:10 },
    catIcon: { fontSize:17, width:30, textAlign:'center' },
    catInfo: { flex:1 },
    catNameRow: { display:'flex', justifyContent:'space-between', fontSize:12, fontWeight:600, marginBottom:4 },
    catAmt: { fontFamily:'monospace', fontSize:11, color:textSub },
    barBg: { height:3, background:inputBg, borderRadius:2, overflow:'hidden' },
    barFill: (pct) => ({ height:'100%', borderRadius:2, background:accent, width:`${pct}%`, transition:'width .6s ease' }),
    formBlock: { background:cardBg, border:`1px solid ${border}`, borderRadius:14, padding:16, marginBottom:12, transition:'all 0.3s ease' },
    formLabel: { fontFamily:'monospace', fontSize:10, color:textSub, letterSpacing:0.8, marginBottom:5, display:'block' },
    input: { width:'100%', background:inputBg, border:`1px solid ${borderFaint}`, borderRadius:8, padding:'11px 13px', color:textMain, fontFamily:'monospace', fontSize:13, outline:'none', boxSizing:'border-box', marginBottom:10 },
    row: { display:'flex', gap:8 },
    btnAccent: { padding:'12px 16px', borderRadius:8, border:'none', fontFamily:'inherit', fontSize:12, fontWeight:700, cursor:'pointer', background:accent, color:isDark?'#080810':'#ffffff', whiteSpace:'nowrap', height:40, touchAction:'manipulation' },
    btnGhost: { padding:'12px 16px', borderRadius:8, border:`1px solid ${border}`, fontFamily:'inherit', fontSize:12, fontWeight:700, cursor:'pointer', background:inputBg, color:textMain, whiteSpace:'nowrap', touchAction:'manipulation' },
    btnFull: { width:'100%', padding:13, borderRadius:8, border:'none', fontFamily:'inherit', fontSize:13, fontWeight:700, cursor:'pointer', background:accent, color:isDark?'#080810':'#ffffff', touchAction:'manipulation' },
    btnAnalyze: { width:'100%', padding:13, background:accentLight, border:`1px solid ${accent}`, borderRadius:8, color:accent, fontFamily:'inherit', fontSize:13, fontWeight:700, cursor:'pointer', marginBottom:14, letterSpacing:0.5, touchAction:'manipulation' },
    txItem: { display:'flex', alignItems:'center', gap:10, padding:'12px 0', borderBottom:`1px solid ${borderFaint}` },
    txIcon: { fontSize:17, width:30, textAlign:'center' },
    txInfo: { flex:1 },
    txDesc: { fontSize:13, fontWeight:600 },
    txMeta: { fontFamily:'monospace', fontSize:10, color:textSub, marginTop:2 },
    txAmtOut: { fontFamily:'monospace', fontSize:13, fontWeight:500, color:'#f87171' },
    txAmtIn: { fontFamily:'monospace', fontSize:13, fontWeight:500, color:'#34d399' },
    txDel: { background:'none', border:'none', color:textSub, cursor:'pointer', fontSize:13, padding:4, touchAction:'manipulation' },
    bsTable: { width:'100%', borderCollapse:'collapse', marginBottom:12 },
    srcRow: { display:'flex', alignItems:'center', justifyContent:'space-between', padding:'11px 0', borderBottom:`1px solid ${borderFaint}`, fontSize:13, fontWeight:600 },
    delBtn: { background:'none', border:'none', color:textSub, cursor:'pointer', fontSize:13, touchAction:'manipulation' },
    empty: { textAlign:'center', padding:'32px 16px', color:textSub, fontFamily:'monospace', fontSize:12, lineHeight:1.8 },
    toast: (show) => ({ position:'fixed', bottom:100, left:'50%', transform:`translateX(-50%) translateY(${show?0:16}px)`, background:inputBg, border:`1px solid ${border}`, color:textMain, fontFamily:'monospace', fontSize:11, padding:'9px 18px', borderRadius:20, opacity: show?1:0, transition:'all .3s', pointerEvents:'none', zIndex:9999, whiteSpace:'nowrap' }),
  };
};

// ── MAIN APP ─────────────────────────────────────────────
export default function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPass, setLoginPass] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [authError, setAuthError] = useState('');

  // UI States
  const [isDark, setIsDark] = useState(() => {
    const saved = localStorage.getItem('franc_theme');
    return saved !== null ? saved === 'true' : window.matchMedia('(prefers-color-scheme: dark)').matches;
  });
  const now = new Date();
  const [curM, setCurM] = useState(now.getMonth());
  const [curY, setCurY] = useState(now.getFullYear());
  const [tab, setTab] = useState('overview');
  const [toast, setToast] = useState({ show:false, msg:'' });

  // Core Data States
  const [categories, setCategories] = useState(DEFAULT_CATS);
  const [sources, setSources] = useState(DEFAULT_SOURCES);
  const [allocations, setAllocations] = useState(DEFAULT_ALLOCATIONS);
  const [preferences, setPreferences] = useState({ showAlloc: true });
  const [ledger, setLedger] = useState({});

  // Form states
  const [incAmt, setIncAmt] = useState('');
  const [incSrc, setIncSrc] = useState('');
  const [incNote, setIncNote] = useState('');
  
  const [expDesc, setExpDesc] = useState('');
  const [expAmt, setExpAmt] = useState('');
  const [expCat, setExpCat] = useState(''); 

  const [newSrc, setNewSrc] = useState('');
  const [newCatEmoji, setNewCatEmoji] = useState('');
  const [newCatName, setNewCatName] = useState('');

  const [draftAllocations, setDraftAllocations] = useState([]);

  // Account Form states
  const [profileName, setProfileName] = useState('');
  const [profilePic, setProfilePic] = useState('');
  const [uploadingImage, setUploadingImage] = useState(false);

  const S = getStyles(isDark);

  // ── INJECT GLOBAL 'NATIVE APP' STYLES ──────
  useEffect(() => {
    const style = document.createElement('style');
    style.innerHTML = `
      body, html { margin: 0; padding: 0; overflow-x: hidden; -webkit-tap-highlight-color: transparent; }
      ::-webkit-scrollbar { display: none; }
      * { scrollbar-width: none; }
    `;
    document.head.appendChild(style);
    return () => document.head.removeChild(style);
  }, []);

  // Sync profile fields when user loads
  useEffect(() => {
    if (currentUser) {
      setProfileName(currentUser.displayName || '');
      setProfilePic(currentUser.photoURL || '');
    }
  }, [currentUser]);

  const toggleTheme = () => {
    const next = !isDark;
    setIsDark(next);
    localStorage.setItem('franc_theme', String(next));
  };

  useEffect(() => {
    if (tab === 'log' && expDesc.trim().length > 2) {
      setExpCat(autoCategory(expDesc, categories));
    } else if (expDesc.trim() === '') {
      setExpCat(''); 
    }
  }, [expDesc, categories, tab]);

  // ── FIREBASE AUTHENTICATION ───────────────
  useEffect(() => {
    if (!auth) {
      setAuthLoading(false);
      return;
    }
    const unsub = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setAuthLoading(false);
    });
    return () => unsub();
  }, []);

  // ── FIREBASE FIRESTORE SYNC ───────────────
  useEffect(() => {
    if (!currentUser || !db) return;
    const userRef = doc(db, 'users', currentUser.uid);
    const unsub = onSnapshot(userRef, (snapshot) => {
      if (snapshot.exists()) {
        const d = snapshot.data();
        setCategories(d.categories || DEFAULT_CATS);
        setSources(d.sources || DEFAULT_SOURCES);
        setAllocations(d.allocations || DEFAULT_ALLOCATIONS);
        setPreferences(d.preferences || { showAlloc: true });
        setDraftAllocations(d.allocations || DEFAULT_ALLOCATIONS);
        setLedger(d.ledger || {});
        if (!incSrc && (d.sources || DEFAULT_SOURCES).length > 0) {
           setIncSrc((d.sources || DEFAULT_SOURCES)[0]);
        }
      } else {
        setDoc(userRef, {
          categories: DEFAULT_CATS,
          sources: DEFAULT_SOURCES,
          allocations: DEFAULT_ALLOCATIONS,
          preferences: { showAlloc: true },
          ledger: {}
        });
        setIncSrc(DEFAULT_SOURCES[0]);
      }
    });
    return () => unsub();
  }, [currentUser]);

  useEffect(() => {
    if (!incSrc && sources.length > 0) {
      setIncSrc(sources[0]);
    }
  }, [sources, incSrc]);

  const showToast = useCallback((msg) => {
    setToast({ show:true, msg });
    setTimeout(() => setToast({ show:false, msg }), 2200);
  }, []);

  const updateCloudData = async (payload) => {
    if (!currentUser || !db) return;
    try {
      await setDoc(doc(db, 'users', currentUser.uid), payload, { merge: true });
    } catch(e) {
      showToast('⚠ Sync Error - You might be offline');
    }
  };

  const handleAuthSubmit = async () => {
    setAuthError('');
    try {
      if (isSignUp) {
        const cred = await createUserWithEmailAndPassword(auth, loginEmail, loginPass);
        try { await sendEmailVerification(cred.user); } catch(e){} // silently fail if verification block
        showToast('✓ Account created! Welcome Email sent.');
      }
      else await signInWithEmailAndPassword(auth, loginEmail, loginPass);
    } catch(err) {
      setAuthError(err.message.replace('Firebase:', 'Auth:'));
    }
  };

  // ── ACCOUNT HANDLERS ────────────
  const handleUpdateProfile = async () => {
    if (!currentUser) return;
    try {
      await updateProfile(currentUser, { displayName: profileName, photoURL: profilePic });
      showToast('✓ Profile Updated');
      setCurrentUser(Object.assign({}, currentUser, { displayName: profileName, photoURL: profilePic }));
    } catch (e) {
      showToast('⚠ Error updating profile');
    }
  };

  const handleSendVerification = async () => {
    if (!currentUser) return;
    try {
      await sendEmailVerification(currentUser);
      showToast('✓ Verification Email Sent!');
    } catch (e) {
      if (e.code === 'auth/too-many-requests') showToast('⚠ Wait before sending again');
      else showToast('⚠ Error sending email');
    }
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || !currentUser || !storage) return;
    setUploadingImage(true);
    try {
      const storageRef = ref(storage, `profiles/${currentUser.uid}_${Date.now()}`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      setProfilePic(url);
      showToast('✓ Image uploaded! Click Save Profile.');
    } catch (err) {
      console.error(err);
      showToast('⚠ Upload failed. Is Firebase Storage enabled?');
    }
    setUploadingImage(false);
  };

  // ── RENDER COMPONENT GUARDS ────────────
  if (!isFirebaseConfigured) return null;

  if (authLoading) {
    return (
      <div style={{...S.app, justifyContent:'center', alignItems:'center'}}>
        <div style={S.logo}>FRANC...</div>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div style={{...S.app, justifyContent:'center', padding: 20}}>
        <div style={{textAlign:'center', marginBottom:40}}>
          <div style={S.logo}>FRANC <span style={S.logoSub}>/ os auth</span></div>
        </div>
        <div style={S.card}>
          <div style={S.secTitle}>{isSignUp ? 'CREATE ACCOUNT' : 'LOGIN TO FRANC'}</div>
          <input style={S.input} type="email" placeholder="Email" value={loginEmail} onChange={e=>setLoginEmail(e.target.value)} />
          <input style={S.input} type="password" placeholder="Password" value={loginPass} onChange={e=>setLoginPass(e.target.value)} />
          {authError && <div style={{color:'#f87171', fontSize:12, marginBottom:15, fontFamily:'monospace'}}>{authError}</div>}
          <button style={S.btnFull} onClick={handleAuthSubmit}>{isSignUp ? 'CREATE ACCOUNT' : 'LOGIN'}</button>
          <button style={{...S.btnGhost, width:'100%', marginTop:10}} onClick={() => setIsSignUp(!isSignUp)}>
             {isSignUp ? 'Already have an account? Login' : 'Need an account? Sign up'}
          </button>
        </div>
      </div>
    );
  }

  // ── DATA HELPERS ───────────────
  const changeMonth = (dir) => {
    let m = curM + dir, y = curY;
    if (m > 11) { m = 0; y++; }
    if (m < 0)  { m = 11; y--; }
    setCurM(m); setCurY(y);
  };

  const key = getKey(curM, curY);
  const curLedger = ledger[key] || { income:[], expenses:[] };
  const prevMY = () => { let m = curM-1, y = curY; if(m<0){m=11;y--;} return {m,y}; };
  const {m:pm, y:py} = prevMY();
  const prevKey = getKey(pm, py);
  const prevLedger = ledger[prevKey] || { income:[], expenses:[] };

  const totalIn  = curLedger.income.reduce((s,e) => s+e.amt, 0);
  const totalOut = curLedger.expenses.reduce((s,e) => s+e.amt, 0);
  const net = totalIn - totalOut;

  const catTotals = {};
  categories.forEach(c => { catTotals[c.id] = 0; });
  curLedger.expenses.forEach(e => { if (catTotals[e.cat] !== undefined) catTotals[e.cat] += e.amt; });

  // ── ACTIONS ───────────────────────────────────────────
  const logIncome = () => {
    const a = parseFloat(incAmt);
    if (!a || a <= 0 || !incSrc) { showToast('⚠ Fill amount and source'); return; }
    const entry = { id: Date.now().toString(), amt:a, src:incSrc, note:incNote, date:new Date().toLocaleDateString('en-GB') };
    
    const curMonthLedger = ledger[key] || {income:[], expenses:[]};
    const newLedger = { ...ledger, [key]: { ...curMonthLedger, income: [...curMonthLedger.income, entry] } };
    
    setLedger(newLedger); 
    updateCloudData({ ledger: newLedger });
    
    setIncAmt(''); setIncNote('');
    showToast('✓ Income logged! Allocations updated.');
  };

  const logExpense = () => {
    const a = parseFloat(expAmt);
    if (!expDesc.trim() || !a || a <= 0) { showToast('⚠ Fill description and amount'); return; }
    
    const finalCatId = expCat || autoCategory(expDesc, categories);
    const cat = categories.find(c => c.id === finalCatId) || categories[0];

    const entry = { id: Date.now().toString(), desc:expDesc.trim(), amt:a, cat:finalCatId, date:new Date().toLocaleDateString('en-GB') };
    
    const curMonthLedger = ledger[key] || {income:[], expenses:[]};
    const newLedger = { ...ledger, [key]: { ...curMonthLedger, expenses: [...curMonthLedger.expenses, entry] } };

    setLedger(newLedger);
    updateCloudData({ ledger: newLedger });

    setExpDesc(''); setExpAmt(''); setExpCat('');
    showToast(`✓ Logged as "${cat.name}"`);
  };

  const deleteTx = (type, id) => {
    const curMonthLedger = ledger[key] || {income:[], expenses:[]};
    let newMonth;
    if (type === 'inc') newMonth = { ...curMonthLedger, income: curMonthLedger.income.filter(e=>e.id!==id) };
    else newMonth = { ...curMonthLedger, expenses: curMonthLedger.expenses.filter(e=>e.id!==id) };
    
    const newLedger = { ...ledger, [key]: newMonth };
    setLedger(newLedger);
    updateCloudData({ ledger: newLedger });
  };

  const addSource = () => {
    if (!newSrc.trim()) return;
    const ns = [...sources, newSrc.trim()];
    setSources(ns); updateCloudData({ sources: ns });
    setNewSrc(''); showToast(`✓ "${newSrc.trim()}" added`);
  };

  const addCategory = () => {
    if (!newCatName.trim()) return;
    const id = newCatName.toLowerCase().replace(/\s+/g,'_') + '_' + Date.now();
    const nc = [...categories, { id, name:newCatName.trim(), emoji:newCatEmoji||'🏷' }];
    setCategories(nc); updateCloudData({ categories: nc });
    setNewCatEmoji(''); setNewCatName(''); showToast(`✓ "${newCatName}" added`);
  };

  const saveAllocations = () => {
    const totalPct = draftAllocations.reduce((s, a) => s + Number(a.pct), 0);
    if (totalPct !== 100) {
       showToast(`⚠ Total equals ${totalPct}%. Must be exactly 100%.`);
       return;
    }
    setAllocations(draftAllocations);
    updateCloudData({ allocations: draftAllocations });
    showToast('✓ Rules Saved!');
  };

  const updateDraftAlloc = (id, field, val) => {
    setDraftAllocations(prev => prev.map(a => a.id === id ? { ...a, [field]: val } : a));
  };

  const addDraftAlloc = () => {
    setDraftAllocations([...draftAllocations, { id: Date.now().toString(), name: 'New Split', pct: 0 }]);
  };

  const removeDraftAlloc = (id) => {
    setDraftAllocations(draftAllocations.filter(a => a.id !== id));
  };


  // ── RENDER SECTIONS ───────────────────────────────────
  const allTx = [...curLedger.income.map(e=>({...e,type:'inc'})), ...curLedger.expenses.map(e=>({...e,type:'exp'}))].sort((a,b)=>b.id-a.id);
  const nonZeroCats = categories.filter(c=>catTotals[c.id]>0).sort((a,b)=>catTotals[b.id]-catTotals[a.id]);

  return (
    <div style={S.app}>
      <div style={S.header}>
        <div style={{display:'flex', alignItems:'center'}}>
           <div style={S.logo}>FRANC <span style={S.logoSub}>/ finance os</span></div>
           <div style={{width:8, height:8, background:'#34d399', borderRadius:'50%', marginLeft:10, boxShadow:'0 0 6px #34d399'}}></div>
        </div>
        <div style={{display:'flex', gap: 15, alignItems:'center'}}>
           <button style={{background:'none', border:'none', cursor:'pointer', fontSize:18, padding:0, touchAction:'manipulation'}} onClick={toggleTheme}>
             {isDark ? '☀️' : '🌙'}
           </button>
           <div style={S.monthNav}>
             <button style={S.monthBtn} onClick={()=>changeMonth(-1)}>←</button>
             <div style={S.monthLabel}>{MONTHS_SHORT[curM]} {curY}</div>
             <button style={S.monthBtn} onClick={()=>changeMonth(1)}>→</button>
           </div>
        </div>
      </div>

      <div style={S.tabs}>
        {[['overview','OVERVIEW'],['log','LOG'],['sheet','BALANCE'],['settings','SETTINGS']].map(([id,label])=>(
          <button key={id} style={S.tab(tab===id)} onClick={()=>setTab(id)}>{label}</button>
        ))}
      </div>

      {tab==='overview' && (
        <div style={S.section}>
          <div style={{...S.card, background: isDark ? '#10101a' : '#ffffff'}}>
            <div style={{position:'absolute',top:-40,right:-40,width:150,height:150,background: isDark ? '#c8f54230' : '#8ab00020',borderRadius:'50%',filter:'blur(50px)',pointerEvents:'none'}} />
            <div style={S.cardLabel}>NET POSITION THIS MONTH</div>
            <div style={S.cardBig(net>=0 ? (isDark?'#c8f542':'#8ab000') : '#f87171')}>XAF {fmt(Math.abs(net))}</div>
            <div style={S.cardSub}>{net>=0?`You are XAF ${fmt(net)} ahead`:`You are XAF ${fmt(Math.abs(net))} in the hole`}</div>
          </div>
          <div style={S.statGrid}>
            <div style={S.stat('#34d399')}>
              <div style={S.statLabel}>TOTAL IN</div>
              <div style={S.statVal('#34d399')}>XAF {fmt(totalIn)}</div>
            </div>
            <div style={S.stat('#f87171')}>
              <div style={S.statLabel}>TOTAL OUT</div>
              <div style={S.statVal('#f87171')}>XAF {fmt(totalOut)}</div>
            </div>
          </div>

          <div style={S.secTitle}>SPENDING BY CATEGORY</div>
          {nonZeroCats.length === 0
            ? <div style={S.empty}>📊<br/>No expenses yet this month.</div>
            : nonZeroCats.map(c => (
              <div key={c.id} style={S.catRow}>
                <div style={S.catIcon}>{c.emoji}</div>
                <div style={S.catInfo}>
                  <div style={S.catNameRow}>
                    <span>{c.name}</span>
                    <span style={S.catAmt}>XAF {fmt(catTotals[c.id])}</span>
                  </div>
                  <div style={S.barBg}><div style={S.barFill(totalOut>0?(catTotals[c.id]/totalOut*100):0)} /></div>
                </div>
              </div>
            ))
          }
        </div>
      )}

      {tab==='log' && (
        <div style={S.section}>
          <div style={S.secTitle}>LOG INCOME</div>
          <div style={S.formBlock}>
            <label style={S.formLabel}>AMOUNT (XAF)</label>
            <input style={S.input} type="number" placeholder="e.g. 25000" value={incAmt} onChange={e=>setIncAmt(e.target.value)} />
            <label style={S.formLabel}>SOURCE</label>
            <div style={S.row}>
              <select style={{...S.input, flex:1, marginBottom:0}} value={incSrc} onChange={e=>setIncSrc(e.target.value)}>
                {sources.map(s=><option key={s} value={s}>{s}</option>)}
              </select>
              <button style={{...S.btnAccent, height: 'auto'}} onClick={logIncome}>+ ADD</button>
            </div>
          </div>

          <div style={S.secTitle}>LOG EXPENSE</div>
          <div style={S.formBlock}>
            <label style={S.formLabel}>WHAT DID YOU SPEND ON?</label>
            <input style={S.input} placeholder="e.g. Art supplies, Taxi, Suya..." value={expDesc} onChange={e=>setExpDesc(e.target.value)} />
            
            <div style={S.row}>
               <div style={{flex: 1}}>
                  <label style={S.formLabel}>CATEGORY OVERRIDE</label>
                  <select style={{...S.input, marginBottom:12}} value={expCat} onChange={e=>setExpCat(e.target.value)}>
                    <option value="" disabled>Select Category...</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.emoji} {c.name}</option>)}
                  </select>
               </div>
               <div style={{width: 100}}>
                  <label style={S.formLabel}>AMOUNT</label>
                  <input style={{...S.input, marginBottom:12}} type="number" placeholder="XAF" value={expAmt} onChange={e=>setExpAmt(e.target.value)} />
               </div>
            </div>

            <button style={S.btnFull} onClick={logExpense}>+ LOG EXPENSE</button>
          </div>

          <div style={S.secTitle}>THIS MONTH'S TRANSACTIONS (JOURNAL)</div>
          {allTx.length === 0
            ? <div style={S.empty}>📋<br/>No transactions logged yet.</div>
            : allTx.map(tx => {
              const cat = categories.find(c=>c.id===tx.cat);
              return (
                <div key={tx.id} style={S.txItem}>
                  <div style={S.txIcon}>{tx.type==='inc'?'💵':cat?.emoji||'📦'}</div>
                  <div style={S.txInfo}>
                    <div style={S.txDesc}>{tx.type==='inc'?tx.src:tx.desc}</div>
                    <div style={S.txMeta}>{tx.type==='inc'?(tx.note||'Income'):cat?.name||'Misc'} · {tx.date}</div>
                  </div>
                  <div style={tx.type==='inc'?S.txAmtIn:S.txAmtOut}>{tx.type==='inc'?'+':'−'}{fmt(tx.amt)}</div>
                  <button style={S.txDel} onClick={()=>deleteTx(tx.type==='inc'?'inc':'exp', tx.id)}>✕</button>
                </div>
              );
            })
          }
        </div>
      )}

      {tab==='sheet' && (
        <div style={S.section}>
          
          {preferences.showAlloc && (
            <div style={S.card}>
              <div style={S.cardLabel}>TARGET ALLOCATIONS THIS MONTH</div>
              <div style={{fontFamily:'monospace',fontSize:10,color:S.app.color,marginBottom:12, lineHeight:1.5}}>
                Based on your rules and Total Income of XAF {fmt(totalIn)}, your ideal distribution:
              </div>
              {allocations.map(al => {
                 const targetAmt = (totalIn * al.pct) / 100;
                 return (
                   <div key={al.id} style={S.srcRow}>
                     <span>{al.name} <span style={{color:S.app.color,fontSize:10}}>({al.pct}%)</span></span>
                     <span style={{color:'#34d399',fontFamily:'monospace',fontWeight:700}}>XAF {fmt(targetAmt)}</span>
                   </div>
                 );
              })}
            </div>
          )}

          <div style={S.card}>
            <div style={S.cardLabel}>BALANCE SHEET & VISUALS</div>
            
            {/* CSS Pie Chart generated dynamically based on actual out-going percentages */}
            {totalOut > 0 && (() => {
              let currentAngle = 0;
              const gradients = nonZeroCats.map((c, i) => {
                const pct = (catTotals[c.id] / totalOut) * 100;
                const start = currentAngle;
                currentAngle += pct;
                return `${PIE_COLORS[i % PIE_COLORS.length]} ${start}% ${currentAngle}%`;
              });
              
              return (
                <div style={{display:'flex', alignItems:'center', gap:20, marginTop:14, paddingBottom: 16, borderBottom:`1px solid ${isDark?'#ffffff0d':'#0000000d'}`}}>
                  <div style={{ width: 100, height: 100, borderRadius: '50%', background: `conic-gradient(${gradients.join(', ')})`, filter: 'drop-shadow(0 0 10px rgba(0,0,0,0.1))' }} />
                  <div style={{flex: 1}}>
                    {nonZeroCats.slice(0, 4).map((c, i) => (
                       <div key={c.id} style={{display:'flex', alignItems:'center', gap:8, marginBottom:6, fontSize:11, fontFamily:'monospace', color:isDark?'#eeeef5':'#111118', fontWeight:600}}>
                          <div style={{width:10,height:10,borderRadius:'50%',background:PIE_COLORS[i%PIE_COLORS.length]}}/>
                          <span style={{flex:1, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>{c.name}</span>
                          <span>{((catTotals[c.id]/totalOut)*100).toFixed(0)}%</span>
                       </div>
                    ))}
                  </div>
                </div>
              );
            })()}
            
            <div style={{...S.secTitle, marginTop: totalOut > 0 ? 16 : 12}}>INCOME (MONEY IN)</div>
            <table style={S.bsTable}>
              <tbody>
                {curLedger.income.length === 0
                  ? <tr><td colSpan={2} style={{fontFamily:'monospace',fontSize:11,padding:'10px 0'}}>No income logged</td></tr>
                  : (() => {
                    const g={};
                    curLedger.income.forEach(e=>{g[e.src]=(g[e.src]||0)+e.amt;});
                    return Object.entries(g).map(([src,amt])=>(
                      <tr key={src}>
                        <td style={{fontSize:12,fontWeight:600,padding:'9px 0',borderBottom:`1px solid ${isDark?'#ffffff0d':'#0000000d'}`}}>{src}</td>
                        <td style={{fontFamily:'monospace',fontSize:12,color:'#34d399',textAlign:'right',padding:'9px 0',borderBottom:`1px solid ${isDark?'#ffffff0d':'#0000000d'}`}}>{fmt(amt)}</td>
                      </tr>
                    ));
                  })()
                }
                <tr>
                  <td style={{fontSize:12,fontWeight:700,padding:'12px 0 4px', color:isDark?'#ffffff':'#000000'}}>TOTAL</td>
                  <td style={{fontFamily:'monospace',fontSize:13,fontWeight:700,color:'#34d399',textAlign:'right',padding:'12px 0 4px'}}>XAF {fmt(totalIn)}</td>
                </tr>
              </tbody>
            </table>

            <div style={{...S.secTitle, marginTop:24}}>EXPENSES (MONEY OUT)</div>
            <table style={S.bsTable}>
              <tbody>
                {nonZeroCats.length === 0
                  ? <tr><td colSpan={2} style={{fontFamily:'monospace',fontSize:11,padding:'10px 0'}}>No expenses logged</td></tr>
                  : nonZeroCats.map(c => {
                    return (
                      <tr key={c.id}>
                        <td style={{fontSize:12,fontWeight:600,padding:'9px 0',borderBottom:`1px solid ${isDark?'#ffffff0d':'#0000000d'}`}}>{c.emoji} {c.name}</td>
                        <td style={{fontFamily:'monospace',fontSize:12,color:'#f87171',textAlign:'right',padding:'9px 0',borderBottom:`1px solid ${isDark?'#ffffff0d':'#0000000d'}`}}>{fmt(catTotals[c.id])}</td>
                      </tr>
                    );
                  })
                }
                <tr>
                  <td style={{fontSize:12,fontWeight:700,padding:'12px 0 4px', color:isDark?'#ffffff':'#000000'}}>TOTAL</td>
                  <td style={{fontFamily:'monospace',fontSize:13,fontWeight:700,color:'#f87171',textAlign:'right',padding:'12px 0 4px'}}>XAF {fmt(totalOut)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab==='settings' && (
        <div style={S.section}>
          {/* PROFILE SECTION CONSOLIDATED INTO SETTINGS */}
          <div style={S.secTitle}>ACCOUNT PROFILE</div>
          <div style={S.formBlock}>
            <div style={{display:'flex', alignItems:'center', gap:15, marginBottom:20}}>
               <label style={{position:'relative', width:60, height:60, cursor:'pointer', display:'block', flexShrink:0}}>
                 <div style={{width:'100%', height:'100%', borderRadius:'50%', background: isDark?'#ffffff1a':'#0000001a', display:'flex', alignItems:'center', justifyContent:'center', fontSize:24, overflow:'hidden'}}>
                   {currentUser.photoURL ? <img src={currentUser.photoURL} width="100%" height="100%" style={{objectFit:'cover'}} alt="profile"/> : '👤'}
                   {uploadingImage && <div style={{position:'absolute', inset:0, background:'rgba(0,0,0,0.5)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:14}}>⏳</div>}
                 </div>
                 <div style={{position:'absolute', bottom:0, right:-4, width:20, height:20, borderRadius:'50%', background:S.app.color, color:S.app.background, display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, fontWeight:'700', border:`2px solid ${isDark?'#10101a':'#ffffff'}`}}>+</div>
                 <input type="file" accept="image/*" style={{display:'none'}} onChange={handleImageUpload} />
               </label>
               <div style={{overflow:'hidden'}}>
                 <div style={{fontSize:16, fontWeight:700, whiteSpace:'nowrap', textOverflow:'ellipsis', overflow:'hidden'}}>{currentUser.displayName || 'Anonymous User'}</div>
                 <div style={{fontSize:12, color:S.app.color, opacity:0.7, fontFamily:'monospace', marginTop:2, whiteSpace:'nowrap', textOverflow:'ellipsis', overflow:'hidden'}}>{currentUser.email}</div>
                 {currentUser.emailVerified ? 
                   <span style={{fontSize:10, color:'#34d399', fontWeight:600, fontFamily:'monospace'}}>✓ VERIFIED ACCOUNT</span> :
                   <button onClick={handleSendVerification} style={{background:'none',border:'none',color:'#f87171',fontSize:10,fontFamily:'monospace',padding:0,cursor:'pointer',textDecoration:'underline',marginTop:2}}>Send Verification Email</button>
                 }
               </div>
            </div>

            <label style={S.formLabel}>DISPLAY NAME</label>
            <input style={{...S.input, marginBottom:16}} placeholder="e.g. John Doe" value={profileName} onChange={e=>setProfileName(e.target.value)} />
            
            <button style={S.btnFull} onClick={handleUpdateProfile}>SAVE PROFILE</button>
          </div>

          <div style={S.secTitle}>GLOBAL PREFERENCES</div>
          <div style={S.formBlock}>
             <div style={{...S.srcRow, borderBottom:'none', padding:0}}>
               <span style={{fontSize:12, fontWeight:700}}>Show 'Target Allocations' in Balance</span>
               <button 
                 onClick={() => {
                    const next = !preferences.showAlloc;
                    setPreferences({...preferences, showAlloc: next});
                    updateCloudData({ preferences: { showAlloc: next } });
                 }} 
                 style={{...S.btnAccent, height:'auto', padding:'6px 12px', background: preferences.showAlloc ? S.app.color : 'transparent', color: preferences.showAlloc ? S.app.background : S.app.color, border: `1px solid ${S.app.color}`}}
               >
                 {preferences.showAlloc ? 'ON' : 'OFF'}
               </button>
             </div>
          </div>

          {preferences.showAlloc && (
            <>
              <div style={S.secTitle}>YOUR CUSTOM ALLOCATIONS (TOTAL: 100%)</div>
              <div style={S.formBlock}>
                 {draftAllocations.map(al => (
                   <div key={al.id} style={{display:'flex', gap:8, marginBottom:10}}>
                      <input style={{...S.input, marginBottom:0, width:60}} type="number" placeholder="%" value={al.pct} onChange={e=>updateDraftAlloc(al.id, 'pct', Number(e.target.value))} />
                      <input style={{...S.input, marginBottom:0, flex:1}} placeholder="Name (e.g. Business)" value={al.name} onChange={e=>updateDraftAlloc(al.id, 'name', e.target.value)} />
                      <button style={S.delBtn} onClick={() => removeDraftAlloc(al.id)}>✕</button>
                   </div>
                 ))}
                 <div style={{display:'flex', gap:10, marginTop:15}}>
                    <button style={{...S.btnGhost, flex:1}} onClick={addDraftAlloc}>+ SPLIT</button>
                    <button style={{...S.btnAccent, flex:1}} onClick={saveAllocations}>SAVE RULES</button>
                 </div>
              </div>
            </>
          )}

          <div style={S.secTitle}>EXPENSE CATEGORIES</div>
          {categories.map(c=>(
            <div key={c.id} style={S.srcRow}>
              <span>{c.emoji} {c.name}</span>
              <button style={S.delBtn} onClick={()=>{ if(categories.length>1){ const nc=categories.filter(x=>x.id!==c.id); setCategories(nc); updateCloudData({categories:nc}); } }}>✕</button>
            </div>
          ))}
          <div style={{...S.row, marginTop:10, marginBottom:16}}>
            <input style={{...S.input, width:48, flex:'none', textAlign:'center', marginBottom:0}} placeholder="🏷" maxLength={2} value={newCatEmoji} onChange={e=>setNewCatEmoji(e.target.value)} />
            <input style={{...S.input, flex:1, marginBottom:0}} placeholder="Category name…" value={newCatName} onChange={e=>setNewCatName(e.target.value)} />
            <button style={{...S.btnAccent, height: 'auto'}} onClick={addCategory}>ADD</button>
          </div>

          <button style={{...S.btnGhost, borderColor:'#f8717140', color:'#f87171', width:'100%', marginTop:10, padding:14}} onClick={() => signOut(auth)}>
            LOG OUT ({currentUser.email})
          </button>
        </div>
      )}

      {/* TOAST */}
      <div style={S.toast(toast.show)}>{toast.msg}</div>
    </div>
  );
}
