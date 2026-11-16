import { useEffect, useRef, useState } from "react";
import "./App.css";
import { matchesTitle } from "./search";

type Task = { id: number; title: string; completed: boolean; dueDate: string | null };

export default function App() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [draftDueDate, setDraftDueDate] = useState("");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<"registered" | "due">("registered");
  const [editing, setEditing] = useState<number | null>(null);
  const restoreFocus = useRef<number | null>(null);
  const restoreListOnUpdate = useRef(false);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [statuses, setStatuses] = useState({ incomplete: true, complete: false });
  const visibleTasks = tasks
    .filter(
      (task) =>
        (task.completed ? statuses.complete : statuses.incomplete) &&
        matchesTitle(task.title, search),
    )
    .sort((a, b) => {
      if (sort === "due") {
        if (a.dueDate === null && b.dueDate !== null) return 1;
        if (a.dueDate !== null && b.dueDate === null) return -1;
        if (a.dueDate !== null && b.dueDate !== null && a.dueDate !== b.dueDate)
          return a.dueDate < b.dueDate ? -1 : 1;
      }
      return a.id - b.id;
    });

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/tasks", { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error();
        return response.json() as Promise<Task[]>;
      })
      .then((loadedTasks) => {
        setTasks(loadedTasks);
        setLoaded(true);
      })
      .catch(() => {
        if (!controller.signal.aborted) setError("タスクの読み込みに失敗しました。");
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (editing === null && restoreFocus.current !== null) {
      const button = document.getElementById(`edit-button-${restoreFocus.current}`);
      (button ?? document.getElementById("search-title"))?.focus();
      restoreFocus.current = null;
    }
  }, [editing]);

  useEffect(() => {
    if (restoreListOnUpdate.current) {
      if (document.activeElement === document.body)
        document.getElementById("search-title")?.focus();
      restoreListOnUpdate.current = false;
    }
  }, [tasks]);

  async function save(value: string, date: string, id?: number) {
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
        body: JSON.stringify({ title: value, dueDate: date || null }),
      });
      if (!response.ok) throw new Error();
      const task = (await response.json()) as Task;
      setTasks((current) =>
        id === undefined
          ? [...current, task]
          : current.map((item) => (item.id === id ? task : item)),
      );
      setTitle("");
      setDueDate("");
      setLoaded(true);
      if (id !== undefined) restoreFocus.current = id;
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
      restoreListOnUpdate.current = true;
      setTasks((current) => current.map((item) => (item.id === task.id ? updated : item)));
    } catch {
      setError("保存に失敗しました。もう一度お試しください。");
    } finally {
      setBusy(false);
    }
  }

  async function deleteTask(task: Task) {
    if (!window.confirm(`「${task.title}」を削除しますか？`)) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/tasks/${task.id}`, { method: "DELETE" });
      if (!response.ok) throw new Error();
      restoreListOnUpdate.current = true;
      setTasks((current) => current.filter((item) => item.id !== task.id));
    } catch {
      setError("削除に失敗しました。もう一度お試しください。");
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
            void save(title, dueDate);
          }}
        >
          <label htmlFor="new-due">期限（任意）</label>
          <input
            id="new-due"
            type="date"
            value={dueDate}
            onChange={(event) => setDueDate(event.target.value)}
          />
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
          <span className="task-count" aria-live="polite">
            {visibleTasks.length} 件
          </span>
        </div>
        <label htmlFor="sort-tasks">並び順</label>
        <select
          id="sort-tasks"
          value={sort}
          onChange={(event) => setSort(event.target.value as "registered" | "due")}
        >
          <option value="registered">登録順</option>
          <option value="due">期限順</option>
        </select>
        <label htmlFor="search-title">タイトルを検索</label>
        <input
          id="search-title"
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <fieldset className="filters" aria-describedby="status-hint">
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
        <p id="status-hint" className="filter-hint">
          ステータスを1つ以上選択してください。
        </p>
        {!loaded ? null : visibleTasks.length === 0 ? (
          <div className="empty" role="status">
            <p>表示するタスクはありません。</p>
            <p>
              {tasks.length === 0
                ? "上のフォームからタスクを追加しましょう。"
                : "検索語やステータスを変更してください。"}
            </p>
          </div>
        ) : (
          <ul>
            {visibleTasks.map((task) => (
              <li key={task.id}>
                {editing === task.id ? (
                  <form
                    className="edit"
                    onSubmit={(event) => {
                      event.preventDefault();
                      void save(draft, draftDueDate, task.id);
                    }}
                  >
                    <label className="sr-only" htmlFor={`edit-${task.id}`}>
                      タイトルを編集
                    </label>
                    <input
                      id={`edit-${task.id}`}
                      autoFocus
                      value={draft}
                      onChange={(event) => setDraft(event.target.value)}
                    />
                    <label htmlFor={`due-${task.id}`}>期限を編集</label>
                    <input
                      id={`due-${task.id}`}
                      type="date"
                      value={draftDueDate}
                      onChange={(event) => setDraftDueDate(event.target.value)}
                    />
                    <button disabled={busy}>保存</button>
                    <button
                      className="secondary"
                      type="button"
                      onClick={() => {
                        restoreFocus.current = task.id;
                        setEditing(null);
                      }}
                    >
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
                      <div className="task-details">
                        <span className="task-title">{task.title}</span>
                        <span className="task-due">期限: {task.dueDate ?? "なし"}</span>
                      </div>
                    </div>
                    <div className="task-actions">
                      <button
                        className="secondary"
                        type="button"
                        id={`edit-button-${task.id}`}
                        onClick={() => {
                          setEditing(task.id);
                          setDraft(task.title);
                          setDraftDueDate(task.dueDate ?? "");
                          setError("");
                        }}
                      >
                        編集
                      </button>
                      <button
                        className="secondary"
                        type="button"
                        disabled={busy}
                        onClick={() => void deleteTask(task)}
                      >
                        削除
                      </button>
                    </div>
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
