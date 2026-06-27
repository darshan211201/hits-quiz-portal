
'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { initializeApp, getApps } from 'firebase/app';
import {
  getFirestore, doc, setDoc, getDoc, onSnapshot, collection,
  serverTimestamp, query, orderBy, getDocs, deleteDoc, writeBatch
} from 'firebase/firestore';
import * as XLSX from 'xlsx';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const db = getFirestore(app);

const ADMIN_PASSWORD = process.env.NEXT_PUBLIC_ADMIN_PASSWORD || 'hits2026';

const defaultQuestions = [];

const quizDefaults = {
  title: 'HITS Quiz Portal',
  subject: 'Common Quiz',
  targetDepartment: 'All Departments'
};
const departments = [
  'B.Sc CSE (CS)','B.Sc CSE (General)','B.Sc AIDA','B.Sc DS','BCA','MCA',
  'B.Sc Food Technology','B.Sc Psychology','M.Sc AIDA','M.Sc Food Technology',
  'M.Sc Computer Science','M.Sc Computer Applications','M.Sc Psychology','M.Sc Maths'
];

function cleanRoll(roll) { return String(roll || '').trim().replaceAll('/', '-').replaceAll(' ', '').toLowerCase(); }

function totalMarks(questions) { return questions.reduce((s, q) => s + Number(q.marks || 0), 0); }

function calculateStudent(student, questions, answers) {
  let score = 0, correct = 0, answered = 0, totalTime = 0;
  for (const q of questions) {
    const a = answers?.[q.id];
    if (a) {
      answered++;
      totalTime += Number(a.timeTaken || 0);
      if (String(a.answer) === String(q.answer)) {
        score += Number(q.marks || 0);
        correct++;
      }
    }
  }
  return { ...student, score, correct, answered, totalTime };
}

function rankStudents(students, questions) {
  return students.map(s => calculateStudent(s, questions, s.answers || {}))
    .sort((a, b) => b.score - a.score || a.totalTime - b.totalTime || (a.joinedAtMs || 0) - (b.joinedAtMs || 0))
    .map((s, i) => ({ ...s, rank: i + 1 }));
}

function remainingSeconds(state) {
  if (!state?.startedAtMs) return state?.durationSeconds || 900;
  const elapsed = Math.floor((Date.now() - state.startedAtMs) / 1000);
  return Math.max(0, Number(state.durationSeconds || 900) - elapsed);
}

async function ensureQuizDoc() {
  const ref = doc(db, 'quiz', 'main');
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, {
      ...quizDefaults,
      started: false,
      ended: false,
      durationSeconds: 900,
      questions: defaultQuestions,
      createdAt: serverTimestamp()
    });
    return;
  }

  const data = snap.data();
  const oldBrand = String(data?.title || '').toLowerCase().includes('math');
  if (oldBrand) {
    await setDoc(ref, {
      ...quizDefaults,
      started: false,
      ended: false,
      startedAtMs: null,
      durationSeconds: Number(data?.durationSeconds || 900),
      questions: [],
      migratedAt: serverTimestamp()
    }, { merge: true });
  }
}
export default function Page() {
  const [mode, setMode] = useState('student');
  const [quiz, setQuiz] = useState(null);
  const [students, setStudents] = useState([]);
  const [registered, setRegistered] = useState(null);
  const [admin, setAdmin] = useState(false);
  const [adminPass, setAdminPass] = useState('');
  const [current, setCurrent] = useState(0);
  const [selected, setSelected] = useState('');
  const [qStart, setQStart] = useState(Date.now());
  const [timer, setTimer] = useState(900);
  const [big, setBig] = useState(false);
  const [form, setForm] = useState({ text: '', a: '', b: '', c: '', d: '', answer: '', level: 'Easy', marks: 1, image: '' });

  const questions = quiz?.questions || defaultQuestions;
  const ranked = useMemo(() => rankStudents(students, questions), [students, questions]);
  const top5 = ranked.slice(0,5);
  const myRank = registered ? ranked.find(s => s.rollKey === registered.rollKey) : null;

  useEffect(() => {
    ensureQuizDoc();
    const unsubQuiz = onSnapshot(doc(db, 'quiz', 'main'), snap => {
      if (snap.exists()) setQuiz(snap.data());
    });
    const unsubStudents = onSnapshot(collection(db, 'students'), snap => {
      setStudents(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    const saved = localStorage.getItem('hitsStudent');
    if (saved) {
      try { setRegistered(JSON.parse(saved)); } catch {}
    }
    return () => { unsubQuiz(); unsubStudents(); };
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      const left = remainingSeconds(quiz);
      setTimer(left);
      if (quiz?.started && !quiz?.ended && left <= 0) {
        setDoc(doc(db, 'quiz', 'main'), { ...quiz, ended: true }, { merge: true });
      }
    }, 500);
    return () => clearInterval(interval);
  }, [quiz]);

  async function registerStudent() {
    const name = document.getElementById('name').value.trim();
    const rollno = document.getElementById('rollno').value.trim();
    const department = document.getElementById('department').value;
    const year = document.getElementById('year').value;
    if (!name || !rollno || !department || !year) return alert('All fields required');
    const rollKey = cleanRoll(rollno);
    const data = { name, rollno, rollKey, department, year, joinedAtMs: Date.now(), answers: {} };
    await setDoc(doc(db, 'students', rollKey), data, { merge: true });
    localStorage.setItem('hitsStudent', JSON.stringify(data));
    setRegistered(data);
  }

  async function submitAnswer() {
    if (!registered || !selected) return;
    const q = questions[current];
    const timeTaken = Math.floor((Date.now() - qStart) / 1000);
    const studentRef = doc(db, 'students', registered.rollKey);
    const snap = await getDoc(studentRef);
    const currentData = snap.data() || registered;
    const existingAnswers = currentData.answers || {};
    if (!existingAnswers[q.id]) {
      await setDoc(studentRef, {
        ...currentData,
        answers: {
          ...existingAnswers,
          [q.id]: { answer: selected, timeTaken, submittedAtMs: Date.now() }
        }
      }, { merge: true });
    }
    setSelected('');
    if (current < questions.length - 1) {
      setCurrent(current + 1);
      setQStart(Date.now());
    } else {
      await setDoc(studentRef, { completedAtMs: Date.now() }, { merge: true });
      alert('Quiz submitted successfully!');
    }
  }

  async function startQuiz() {
    await setDoc(doc(db, 'quiz', 'main'), {
      started: true,
      ended: false,
      startedAtMs: Date.now(),
      durationSeconds: Number(document.getElementById('duration')?.value || 15) * 60
    }, { merge: true });
  }

  async function endQuiz() {
    await setDoc(doc(db, 'quiz', 'main'), { ended: true }, { merge: true });
  }


  async function clearQuestions() {
    if (!confirm('Clear all quiz questions?')) return;
    await setDoc(doc(db, 'quiz', 'main'), { questions: [] }, { merge: true });
  }

  async function saveQuizInfo() {
    const title = document.getElementById('quizTitle')?.value || 'HITS Quiz Portal';
    const subject = document.getElementById('quizSubject')?.value || 'Common Quiz';
    const targetDepartment = document.getElementById('quizDepartment')?.value || 'All Departments';
    await setDoc(doc(db, 'quiz', 'main'), { title, subject, targetDepartment }, { merge: true });
    alert('Quiz details saved');
  }

  async function resetAll() {
    if (!confirm('Reset all students and answers?')) return;
    const batch = writeBatch(db);
    const docs = await getDocs(collection(db, 'students'));
    docs.forEach(d => batch.delete(d.ref));
    await batch.commit();
    await setDoc(doc(db, 'quiz', 'main'), {
      started: false, ended: false, startedAtMs: null, durationSeconds: 900, questions: [], ...quizDefaults
    }, { merge: true });
  }

  async function saveQuestions(qs) {
    await setDoc(doc(db, 'quiz', 'main'), { questions: qs.map((q, i) => ({ ...q, id: i + 1 })) }, { merge: true });
  }

  async function addQuestion() {
    const q = {
      id: questions.length + 1,
      text: form.text,
      options: [form.a, form.b, form.c, form.d],
      answer: form.answer,
      level: form.level,
      marks: Number(form.marks),
      image: form.image
    };
    if (!q.text || q.options.some(x => !x) || !q.answer) return alert('Fill all fields');
    await saveQuestions([...questions, q]);
    setForm({ text: '', a: '', b: '', c: '', d: '', answer: '', level: 'Easy', marks: 1, image: '' });
  }

  function exportExcel() {
    const rows = ranked.map(s => ({
      Rank: s.rank, Name: s.name, RollNo: s.rollno, Department: s.department, Year: s.year,
      Score: s.score, TotalMarks: totalMarks(questions), Correct: s.correct, Answered: s.answered, TimeSeconds: s.totalTime
    }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Results');
    XLSX.writeFile(wb, 'HITS_Quiz_Portal_Results.xlsx');
  }

  const q = questions[current];

  return (
    <main>
      <div className="bg" />
      <div className="wrap">
        <header className="brand card">
          <img src="/hits-logo.png" className="logo" />
          <div>
            <h1>{quiz?.title || 'HITS Quiz Portal'}</h1>
            <h3>HINDUSTAN INSTITUTE OF TECHNOLOGY AND SCIENCE</h3>
            <p>{quiz?.subject || 'Common Quiz'} • {quiz?.targetDepartment || 'All Departments'} • Live Ranking</p>
          </div>
        </header>

        <div className="tabs">
          <button onClick={() => setMode('student')}>Student</button>
          <button onClick={() => setMode('admin')}>Admin</button>
        </div>

        {mode === 'student' && (
          <>
            {!registered && (
              <section className="card">
                <h2>Student Registration</h2>
                <div className="grid">
                  <input id="name" placeholder="Full Name" />
                  <input id="rollno" placeholder="Roll Number" />
                  <select id="department"><option value="">Select Department</option>{departments.map(d => <option key={d}>{d}</option>)}</select>
                  <select id="year"><option value="">Select Year</option>{['1st Year','2nd Year','3rd Year','4th Year','5th Year'].map(y => <option key={y}>{y}</option>)}</select>
                </div>
                <button onClick={registerStudent}>Register & Join</button>
              </section>
            )}

            {registered && !quiz?.started && (
              <section className="card center">
                <div className="loader" />
                <h2>Waiting for Admin to Launch Quiz...</h2>
                <p>Participants Joined: <b>{students.length}</b></p>
              </section>
            )}

            {registered && quiz?.started && !quiz?.ended && !q && (
              <section className="card center">
                <h2>No Questions Added Yet</h2>
                <p>Please wait while the admin adds quiz questions.</p>
              </section>
            )}

            {registered && quiz?.started && !quiz?.ended && q && (
              <section className="card">
                <div className="topbar">
                  <b>Question {current + 1} / {questions.length}</b>
                  <b className="timer">{String(Math.floor(timer/60)).padStart(2,'0')}:{String(timer%60).padStart(2,'0')}</b>
                </div>
                <div className="progress"><div style={{width: `${((current+1)/questions.length)*100}%`}} /></div>
                <span className="pill">{q.level} • {q.marks} Marks</span>
                {q.image && <img src={q.image} className="qimage" />}
                <h2>{q.text}</h2>
                {q.options.map(opt => (
                  <button key={opt} onClick={() => setSelected(opt)} className={`option ${selected === opt ? 'selected' : ''}`}>{opt}</button>
                ))}
                <button disabled={!selected} onClick={submitAnswer}>{current === questions.length - 1 ? 'Submit Quiz' : 'Next'}</button>
                <p className="muted">Once you click Next, you cannot go back.</p>
              </section>
            )}

            {registered && quiz?.ended && (
              <section className="card center">
                <h2>Quiz Completed ✅</h2>
                <div className="resultGrid">
                  <div><p>Your Score</p><h1>{myRank?.score ?? 0}/{totalMarks(questions)}</h1></div>
                  <div><p>Your Rank</p><h1>{myRank?.rank ?? '-'}/{students.length}</h1></div>
                </div>
                <p>Correct Answers: <b>{myRank?.correct ?? 0}/{questions.length}</b></p>
                <p>Time Taken: <b>{myRank?.totalTime ?? 0} sec</b></p>
              </section>
            )}
          </>
        )}

        {mode === 'admin' && (
          <>
            {!admin && (
              <section className="card">
                <h2>Admin Login</h2>
                <input type="password" placeholder="Admin Password" value={adminPass} onChange={e => setAdminPass(e.target.value)} />
                <button onClick={() => adminPass === ADMIN_PASSWORD ? setAdmin(true) : alert('Wrong password')}>Login</button>
              </section>
            )}

            {admin && (
              <>
                <div className="grid">
                  <section className="card">
                    <h2>Controls</h2>
                    <input id="quizTitle" placeholder="Quiz Title" defaultValue={quiz?.title || 'HITS Quiz Portal'} />
                    <input id="quizSubject" placeholder="Subject / Event Name" defaultValue={quiz?.subject || 'Common Quiz'} />
                    <select id="quizDepartment" defaultValue={quiz?.targetDepartment || 'All Departments'}>
                      <option>All Departments</option>
                      {departments.map(d => <option key={d}>{d}</option>)}
                    </select>
                    <input id="duration" type="number" defaultValue="15" min="1" max="120" />
                    <button onClick={saveQuizInfo}>Save Quiz Details</button>
                    <button onClick={startQuiz}>Launch Quiz</button>
                    <button className="danger" onClick={endQuiz}>End Quiz</button>
                    <button className="danger2" onClick={clearQuestions}>Clear Questions</button>
                    <button className="danger2" onClick={resetAll}>Reset All</button>
                    <button onClick={exportExcel}>Export Excel</button>
                    <button onClick={() => setBig(!big)}>Big Screen Top 5</button>
                  </section>
                  <section className="card">
                    <h2>Live Status</h2>
                    <p>Participants: <b>{students.length}</b></p>
                    <p>Quiz Status: <b>{quiz?.ended ? 'Ended' : quiz?.started ? 'Started' : 'Waiting'}</b></p>
                    <p>Timer: <b>{String(Math.floor(timer/60)).padStart(2,'0')}:{String(timer%60).padStart(2,'0')}</b></p>
                  </section>
                </div>

                {big && (
                  <section className="card bigScreen">
                    <h1>🏆 LIVE TOP 5</h1>
                    {top5.map(s => <div className="bigRank" key={s.rollKey}><span>{s.rank <= 3 ? ['🥇','🥈','🥉'][s.rank-1] : s.rank}</span><b>{s.name}</b><strong>{s.score}</strong></div>)}
                  </section>
                )}

                <section className="card">
                  <h2>🏆 Live Top 5</h2>
                  <table><thead><tr><th>Rank</th><th>Name</th><th>Roll</th><th>Dept</th><th>Year</th><th>Score</th><th>Time</th></tr></thead>
                  <tbody>{top5.map(s => <tr key={s.rollKey}><td>{s.rank}</td><td>{s.name}</td><td>{s.rollno}</td><td>{s.department}</td><td>{s.year}</td><td><b>{s.score}</b></td><td>{s.totalTime}s</td></tr>)}</tbody></table>
                </section>

                <section className="card">
                  <h2>Add Quiz Question</h2>
                  <input placeholder="Question" value={form.text} onChange={e => setForm({...form, text: e.target.value})} />
                  <div className="grid">
                    {['a','b','c','d'].map(k => <input key={k} placeholder={`Option ${k.toUpperCase()}`} value={form[k]} onChange={e => setForm({...form, [k]: e.target.value})} />)}
                    <select value={form.answer} onChange={e => setForm({...form, answer: e.target.value})}>
                      <option value="">Correct Answer</option>
                      {[form.a,form.b,form.c,form.d].filter(Boolean).map(o => <option key={o}>{o}</option>)}
                    </select>
                    <select value={form.level} onChange={e => setForm({...form, level: e.target.value})}><option>Easy</option><option>Moderate</option><option>Tough</option></select>
                    <input type="number" value={form.marks} onChange={e => setForm({...form, marks: e.target.value})} />
                    <input placeholder="Image URL optional" value={form.image} onChange={e => setForm({...form, image: e.target.value})} />
                  </div>
                  <button onClick={addQuestion}>Add Quiz Question</button>
                </section>

                <section className="card">
                  <h2>Quiz Question List</h2>
                  {questions.length === 0 && <p className="muted">No questions added. Add questions manually from this admin panel.</p>}
                  {questions.map((q, i) => (
                    <div className="qItem" key={q.id}>
                      <b>{i+1}. {q.text}</b>
                      <p>{q.level} • {q.marks} marks • Answer: <b>{q.answer}</b></p>
                      <button className="danger2" onClick={() => saveQuestions(questions.filter((_, idx) => idx !== i))}>Delete</button>
                    </div>
                  ))}
                </section>
              </>
            )}
          </>
        )}
      </div>
    </main>
  );
}
