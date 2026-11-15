import { useEffect, useState } from "react";
import "./App.css";
import { matchesTitle } from "./search";

type Task = { id: number; title: string; completed: boolean };

export default function App() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [title, setTitle] = useState("");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<number | null>(null);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [statuses, setStatuses] = useState({ incomplete: true, complete: false });
  const visibleTasks = tasks.filter(
    (task) =>
      (task.completed ? statuses.complete : statuses.incomplete) &&
      matchesTitle(task.title, search),
  );

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/tasks", { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error();
        return response.json() as Promise<Task[]>;
      })
      .then(setTasks)
      .catch(() => {
        if (!controller.signal.aborted) setError("タスクの読み込みに失敗しました。");
      });
    return () => controller.abort();
  }, []);

  async function save(value: string, id?: number) {
    if (!value.trim()) {
      setError("タイトルを入力してください。");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const response = await fetch(id === undefined ? "/api/tasks" : `/api/tasks/${id}`, {
        method: id === undefined ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: value }),
      });
      if (!response.ok) throw new Error();
      const task = (await response.json()) as Task;
      setTasks((current) =>
        id === undefined
          ? [...current, task]
          : current.map((item) => (item.id === id ? task : item)),
      );
      setTitle("");
      setEditing(null);
    } catch {
      setError("保存に失敗しました。もう一度お試しください。");
    } finally {
      setBusy(false);
    }
  }

  async function toggleCompletion(task: Task) {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completed: !task.completed }),
      });
      if (!response.ok) throw new Error();
      const updated = (await response.json()) as Task;
      setTasks((current) => current.map((item) => (item.id === task.id ? updated : item)));
    } catch {
      setError("保存に失敗しました。もう一度お試しください。");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main>
      <header>
        <p className="eyebrow">TASK WORKSPACE</p>
        <h1>タスク管理</h1>
        <p>やることを書き留めて、ひとつずつ進めましょう。</p>
      </header>
      <section aria-labelledby="new-heading" className="card">
        <h2 id="new-heading">タスクを追加</h2>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void save(title);
          }}
        >
          <label htmlFor="new-title">タイトル</label>
          <div className="row">
            <input
              id="new-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="例：プロジェクトの準備"
            />
            <button disabled={busy}>追加</button>
          </div>
        </form>
      </section>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      <section aria-labelledby="list-heading" className="card">
        <div className="list-heading">
          <h2 id="list-heading">タスク一覧</h2>
          <span>{visibleTasks.length} 件</span>
        </div>
        <label htmlFor="search-title">タイトルを検索</label>
        <input
          id="search-title"
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <fieldset className="filters">
          <legend>ステータス</legend>
          <label>
            <input
              type="checkbox"
              checked={statuses.incomplete}
              onChange={() =>
                setStatuses((current) =>
                  current.incomplete && !current.complete
                    ? current
                    : { ...current, incomplete: !current.incomplete },
                )
              }
            />
            未完了
          </label>
          <label>
            <input
              type="checkbox"
              checked={statuses.complete}
              onChange={() =>
                setStatuses((current) =>
                  current.complete && !current.incomplete
                    ? current
                    : { ...current, complete: !current.complete },
                )
              }
            />
            完了
          </label>
        </fieldset>
        {visibleTasks.length === 0 ? (
          <p className="empty">表示するタスクはありません。</p>
        ) : (
          <ul>
            {visibleTasks.map((task) => (
              <li key={task.id}>
                {editing === task.id ? (
                  <form
                    className="edit"
                    onSubmit={(event) => {
                      event.preventDefault();
                      void save(draft, task.id);
                    }}
                  >
                    <label className="sr-only" htmlFor={`edit-${task.id}`}>
                      タイトルを編集
                    </label>
                    <input
                      id={`edit-${task.id}`}
                      value={draft}
                      onChange={(event) => setDraft(event.target.value)}
                    />
                    <button disabled={busy}>保存</button>
                    <button className="secondary" type="button" onClick={() => setEditing(null)}>
                      キャンセル
                    </button>
                  </form>
                ) : (
                  <>
                    <div className="task-info">
                      <label className="task-status">
                        <input
                          type="checkbox"
                          checked={task.completed}
                          disabled={busy}
                          onChange={() => void toggleCompletion(task)}
                          aria-label={`${task.title}を完了`}
                        />
                        {task.completed ? "完了" : "未完了"}
                      </label>
                      <span>{task.title}</span>
                    </div>
                    <button
                      className="secondary"
                      type="button"
                      onClick={() => {
                        setEditing(task.id);
                        setDraft(task.title);
                        setError("");
                      }}
                    >
                      編集
                    </button>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
