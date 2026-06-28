"use client";
import { useEffect, useState } from "react";
import { db } from "../../lib/firebase";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";

function rankedList(list) {
  return [...list].sort((a, b) => {
    if ((b.score || 0) !== (a.score || 0)) return (b.score || 0) - (a.score || 0);
    const at = a.submittedAt?.seconds ?? Infinity;
    const bt = b.submittedAt?.seconds ?? Infinity;
    return at - bt;
  });
}

export default function Admin() {
  const [logged, setLogged] = useState(false);
  const [pass, setPass] = useState("");
  const [qs, setQs] = useState([]);
  const [students, setStudents] = useState([]);
  const [status, setStatus] = useState({ active: false, duration: 300 });
  const [q, setQ] = useState({
    question: "",
    optionA: "",
    optionB: "",
    optionC: "",
    optionD: "",
    answer: "A",
  });
  const [editing, setEditing] = useState(null);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    setLogged(localStorage.getItem("hitsAdmin") === "yes");
  }, []);

  useEffect(
    () =>
      onSnapshot(query(collection(db, "questions")), (s) =>
        setQs(s.docs.map((d) => ({ id: d.id, ...d.data() })))
      ),
    []
  );

  useEffect(
    () =>
      onSnapshot(
        query(collection(db, "students"), orderBy("score", "desc")),
        (s) => setStudents(s.docs.map((d) => ({ id: d.id, ...d.data() })))
      ),
    []
  );

  useEffect(
    () =>
      onSnapshot(doc(db, "settings", "quiz"), (s) =>
        setStatus(s.exists() ? s.data() : { active: false, duration: 300 })
      ),
    []
  );

  function login() {
    if (pass === (process.env.NEXT_PUBLIC_ADMIN_PASSWORD || "hits2026")) {
      localStorage.setItem("hitsAdmin", "yes");
      setLogged(true);
    } else {
      setMsg("Wrong password");
    }
  }

  async function saveQ() {
    if (!q.question || !q.optionA || !q.optionB || !q.optionC || !q.optionD) {
      setMsg("Fill all question fields");
      return;
    }

    if (editing) {
      await updateDoc(doc(db, "questions", editing), q);
      setEditing(null);
    } else {
      await addDoc(collection(db, "questions"), {
        ...q,
        createdAt: serverTimestamp(),
      });
    }

    setQ({
      question: "",
      optionA: "",
      optionB: "",
      optionC: "",
      optionD: "",
      answer: "A",
    });

    setMsg("Question saved");
  }

  function edit(x) {
    setEditing(x.id);
    setQ({
      question: x.question,
      optionA: x.optionA,
      optionB: x.optionB,
      optionC: x.optionC,
      optionD: x.optionD,
      answer: x.answer || "A",
    });
  }

  async function launch() {
    await setDoc(
      doc(db, "settings", "quiz"),
      {
        active: true,
        duration: Number(status.duration || 300),
        startTime: serverTimestamp(),
      },
      { merge: true }
    );
    setMsg("Quiz launched. Timer started for all students.");
  }

  async function updateDuration() {
    await setDoc(
      doc(db, "settings", "quiz"),
      { duration: Number(status.duration || 300) },
      { merge: true }
    );
    setMsg("Duration updated. Students' timer will adjust immediately.");
  }

  async function stop() {
    await setDoc(doc(db, "settings", "quiz"), { active: false }, { merge: true });
  }

  async function deleteStudent(id) {
    if (!confirm("Delete this student?")) return;
    await deleteDoc(doc(db, "students", id));
  }

  async function clearStudents() {
    if (!confirm("Delete ALL registered students?")) return;

    const snap = await getDocs(collection(db, "students"));

    for (const d of snap.docs) {
      await deleteDoc(doc(db, "students", d.id));
    }

    alert("All students deleted.");
  }

  if (!logged) {
    return (
      <>
        <Header />
        <main className="main">
          <section className="card" style={{ maxWidth: 460, margin: "auto" }}>
            <span className="pill">Admin Only</span>
            <h2>Admin Login</h2>

            <input
              className="input"
              type="password"
              placeholder="Admin Password"
              value={pass}
              onChange={(e) => setPass(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") login();
              }}
            />

            <button className="btn full" onClick={login}>
              Login
            </button>

            {msg && <div className="notice">{msg}</div>}
          </section>
        </main>
      </>
    );
  }

  return (
    <>
      <Header />

      <main className="main">
        <div className="grid">
          <section className="card">
            <div className="nav">
              <div>
                <span className={status.active ? "pill live" : "pill"}>
                  {status.active ? "Quiz LIVE" : "Quiz STOPPED"}
                </span>
                <h2>Admin Dashboard</h2>
              </div>

              <button
                className="btn2"
                onClick={() => {
                  localStorage.removeItem("hitsAdmin");
                  location.reload();
                }}
              >
                Logout
              </button>
            </div>

            <div className="row">
              <input
                className="input"
                type="number"
                placeholder="Duration seconds"
                value={status.duration || 300}
                onChange={(e) =>
                  setStatus({ ...status, duration: e.target.value })
                }
              />

              <div className="admin-actions">
                <button className="btn green" onClick={launch}>
                  {status.active ? "Re-Launch (resets timer)" : "Launch Quiz"}
                </button>

                {status.active && (
                  <button className="btn2" onClick={updateDuration}>
                    Update Time
                  </button>
                )}

                <button className="btn danger" onClick={stop}>
                  Stop
                </button>
              </div>
            </div>

            <div className="row">
              {[5, 10, 15, 20, 30].map((mins) => (
                <button
                  key={mins}
                  className="smallbtn"
                  onClick={() =>
                    setStatus({ ...status, duration: mins * 60 })
                  }
                >
                  {mins} min
                </button>
              ))}
            </div>

            <p className="muted">
              Currently set to{" "}
              {Math.floor((status.duration || 300) / 60)} min{" "}
              {(status.duration || 300) % 60
                ? `${(status.duration || 300) % 60} sec`
                : ""}
              . Use the seconds box or presets above, then{" "}
              <b>{status.active ? "Update Time" : "Launch Quiz"}</b> to apply.
              {status.active &&
                " 'Update Time' changes duration without restarting the timer. 'Re-Launch' restarts everyone's timer from zero."}
            </p>

            <h3>{editing ? "Edit Question" : "Add Question"}</h3>

            <textarea
              className="textarea"
              placeholder="Question"
              value={q.question}
              onChange={(e) => setQ({ ...q, question: e.target.value })}
            />

            <div className="row">
              <input
                className="input"
                placeholder="Option A"
                value={q.optionA}
                onChange={(e) => setQ({ ...q, optionA: e.target.value })}
              />

              <input
                className="input"
                placeholder="Option B"
                value={q.optionB}
                onChange={(e) => setQ({ ...q, optionB: e.target.value })}
              />

              <input
                className="input"
                placeholder="Option C"
                value={q.optionC}
                onChange={(e) => setQ({ ...q, optionC: e.target.value })}
              />

              <input
                className="input"
                placeholder="Option D"
                value={q.optionD}
                onChange={(e) => setQ({ ...q, optionD: e.target.value })}
              />
            </div>

            <select
              className="select"
              value={q.answer}
              onChange={(e) => setQ({ ...q, answer: e.target.value })}
            >
              {["A", "B", "C", "D"].map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>

            <button className="btn" onClick={saveQ}>
              {editing ? "Update Question" : "Add Question"}
            </button>

            {editing && (
              <button
                className="btn2"
                onClick={() => {
                  setEditing(null);
                  setQ({
                    question: "",
                    optionA: "",
                    optionB: "",
                    optionC: "",
                    optionD: "",
                    answer: "A",
                  });
                }}
              >
                Cancel
              </button>
            )}

            {msg && <div className="notice">{msg}</div>}

            <h3>Questions ({qs.length})</h3>

            {qs.map((x, i) => (
              <div className="q" key={x.id}>
                <b>
                  {i + 1}. {x.question}
                </b>
                <p className="muted">Answer: {x.answer}</p>

                <button className="smallbtn" onClick={() => edit(x)}>
                  Edit
                </button>{" "}

                <button
                  className="smallbtn"
                  onClick={() => deleteDoc(doc(db, "questions", x.id))}
                >
                  Delete
                </button>
              </div>
            ))}
          </section>

          <StudentManager
            data={students}
            onDelete={deleteStudent}
            onClear={clearStudents}
          />
        </div>
      </main>
    </>
  );
}

function Header() {
  return (
    <header className="top">
      <div className="wrap nav">
        <div>
          <div className="brand">HITS Quiz Portal</div>
          <div className="sub">Admin Control Panel</div>
        </div>

        <a className="btn2" href="/">
          Student Page
        </a>
      </div>
    </header>
  );
}

function StudentManager({ data, onDelete, onClear }) {
  const ranked = rankedList(data);
  const submittedCount = data.filter((s) => s.submitted).length;

  return (
    <aside className="card">
      <div className="nav">
        <div>
          <h3>🏆 Scoreboard</h3>
          <p className="muted">
            Total: {data.length} &middot; Submitted: {submittedCount} &middot;
            Pending: {data.length - submittedCount}
          </p>
        </div>

        <button className="btn danger" onClick={onClear}>
          Clear All
        </button>
      </div>

      <div className="table-wrap">
        <table className="leader">
          <thead>
            <tr>
              <th>Rank</th>
              <th>Name</th>
              <th>Dept</th>
              <th>Score</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>

          <tbody>
            {ranked.map((s, i) => (
              <tr key={s.id}>
                <td>
                  {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : i + 1}
                </td>
                <td>{s.name}</td>
                <td>{s.dept}</td>
                <td>{s.score || 0}</td>
                <td>
                  {s.submitted ? (
                    <span className="pill">✅ Submitted</span>
                  ) : (
                    <span className="pill live">⏳ In progress</span>
                  )}
                </td>
                <td>
                  <button className="smallbtn" onClick={() => onDelete(s.id)}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </aside>
  );
}
