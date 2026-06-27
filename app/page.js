'use client';
import { useEffect, useMemo, useState } from 'react';
import { db } from '@/lib/firebase';
import { addDoc, collection, doc, getDoc, onSnapshot, orderBy, query, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';

const departments = ['CSE','ECE','EEE','MECH','CIVIL','AIDS','IT','MBA','MCA','Others'];

export default function Home(){
  const [student,setStudent]=useState(null);
  const [form,setForm]=useState({name:'',regNo:'',department:'CSE'});
  const [settings,setSettings]=useState({launched:false,duration:5});
  const [questions,setQuestions]=useState([]);
  const [answers,setAnswers]=useState({});
  const [timeLeft,setTimeLeft]=useState(null);
  const [submitted,setSubmitted]=useState(false);
  const [leaderboard,setLeaderboard]=useState([]);

  useEffect(()=>{
    const unsub1=onSnapshot(doc(db,'quiz','settings'),s=>{ if(s.exists()) setSettings(s.data()); });
    const unsub2=onSnapshot(query(collection(db,'questions'), orderBy('createdAt','asc')),snap=>setQuestions(snap.docs.map(d=>({id:d.id,...d.data()}))));
    const unsub3=onSnapshot(query(collection(db,'students'), orderBy('score','desc')),snap=>setLeaderboard(snap.docs.map((d,i)=>({rank:i+1,id:d.id,...d.data()}))));
    const saved=localStorage.getItem('hits_student'); if(saved) setStudent(JSON.parse(saved));
    return()=>{unsub1();unsub2();unsub3();};
  },[]);

  useEffect(()=>{
    if(!student || !settings.launched || submitted) return;
    const key='hits_quiz_start_'+student.id;
    let started=localStorage.getItem(key);
    if(!started){started=String(Date.now()); localStorage.setItem(key,started);}
    const tick=()=>{
      const total=(Number(settings.duration)||5)*60;
      const elapsed=Math.floor((Date.now()-Number(started))/1000);
      const left=Math.max(0,total-elapsed);
      setTimeLeft(left);
      if(left===0) submitQuiz();
    };
    tick(); const int=setInterval(tick,1000); return()=>clearInterval(int);
  },[student,settings.launched,submitted,settings.duration,questions,answers]);

  const score=useMemo(()=> questions.reduce((s,q)=>s+(answers[q.id]===q.answer?1:0),0),[answers,questions]);

  async function register(e){
    e.preventDefault();
    if(!form.name.trim() || !form.regNo.trim()) return alert('Enter name and register number');
    const ref=await addDoc(collection(db,'students'),{...form,score:0,submitted:false,createdAt:serverTimestamp()});
    const data={id:ref.id,...form}; localStorage.setItem('hits_student',JSON.stringify(data)); setStudent(data);
  }
  async function submitQuiz(){
    if(!student || submitted) return;
    const finalScore=questions.reduce((s,q)=>s+(answers[q.id]===q.answer?1:0),0);
    await updateDoc(doc(db,'students',student.id),{score:finalScore,submitted:true,submittedAt:serverTimestamp()});
    setSubmitted(true);
  }
  function fmt(sec){const m=Math.floor((sec||0)/60),s=(sec||0)%60;return `${m}:${String(s).padStart(2,'0')}`;}

  if(!student) return <main className="hero"><section className="card"><h1 className="title">HITS Quiz Portal</h1><p className="subtitle">Register and wait for admin to launch the quiz.</p><form onSubmit={register} className="grid"><input placeholder="Student Name" value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/><input placeholder="Register Number" value={form.regNo} onChange={e=>setForm({...form,regNo:e.target.value})}/><select value={form.department} onChange={e=>setForm({...form,department:e.target.value})}>{departments.map(d=><option key={d}>{d}</option>)}</select><button className="btn">Register</button></form><div className="spacer"/><a className="muted small" href="/admin">Admin Login</a></section></main>;

  if(submitted || student.submitted) return <><Top/><main className="wrap center"><section className="card"><h1>Quiz Submitted ✅</h1><p>Your Score</p><h2>{score} / {questions.length}</h2><Leaderboard data={leaderboard}/></section></main></>;

  if(!settings.launched) return <><Top/><main className="wrap"><section className="card center"><h1>Welcome, {student.name}</h1><p className="subtitle">Please wait. Quiz has not been launched yet.</p><span className="pill">Waiting for Admin Launch</span></section><div className="spacer"/><Leaderboard data={leaderboard}/></main></>;

  return <><Top right={<span className="pill">Time: {fmt(timeLeft)}</span>}/><main className="wrap"><section className="card"><h2>Quiz Live</h2><p className="muted">Answer all questions and submit before timer ends.</p>{questions.map((q,i)=><div className="question" key={q.id}><b>{i+1}. {q.question}</b><div className="options">{['A','B','C','D'].map(opt=><button key={opt} className={'option '+(answers[q.id]===opt?'active':'')} onClick={()=>setAnswers({...answers,[q.id]:opt})}>{opt}. {q['option'+opt]}</button>)}</div></div>)}<button className="btn success" onClick={submitQuiz}>Submit Quiz</button></section></main></>;
}
function Top({right}){return <header className="topbar"><b>HITS Quiz Portal</b>{right}</header>}
function Leaderboard({data}){return <section className="card"><h2>Live Leaderboard</h2><table className="table"><thead><tr><th>Rank</th><th>Name</th><th>Dept</th><th>Score</th></tr></thead><tbody>{data.slice(0,20).map(s=><tr key={s.id}><td>{s.rank}</td><td>{s.name}</td><td>{s.department}</td><td>{s.score||0}</td></tr>)}</tbody></table></section>}
