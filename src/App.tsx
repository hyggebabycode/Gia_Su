import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  CalendarDays,
  CheckCircle2,
  Clipboard,
  CircleDollarSign,
  Download,
  Edit3,
  Leaf,
  Plus,
  Save,
  Search,
  Trash2,
  Upload,
  UsersRound,
  X,
} from "lucide-react";

type Lesson = {
  id: string;
  studentName: string;
  date: string;
  slot: string;
  startTime: string;
  endTime: string;
  tuition: number;
  paid: boolean;
  note: string;
};

type LessonForm = Omit<Lesson, "id">;

type StudentShortcut = {
  id: string;
  name: string;
  tuition: number;
};

type LessonPreset = {
  id: string;
  label: string;
  slot: string;
  startTime: string;
  endTime: string;
};

type ListMode = "student" | "date";
type SortMode = "sessions" | "name" | "total" | "newest";

type BackupData = {
  version: number;
  exportedAt: string;
  lessons: Lesson[];
  savedStudents: StudentShortcut[];
  lessonPresets: LessonPreset[];
};

const STORAGE_KEY = "tutor-salary-book-lessons";
const STUDENTS_KEY = "tutor-salary-book-students";
const PRESETS_KEY = "tutor-salary-book-presets";

const today = new Date().toISOString().slice(0, 10);
const currentMonth = today.slice(0, 7);

const emptyForm: LessonForm = {
  studentName: "",
  date: today,
  slot: "Ca 1",
  startTime: "18:00",
  endTime: "19:30",
  tuition: 200000,
  paid: true,
  note: "",
};

const defaultLessonPresets: LessonPreset[] = [
  {
    id: "afternoon",
    label: "Ca chiều",
    slot: "Ca 1",
    startTime: "17:30",
    endTime: "19:00",
  },
  {
    id: "evening",
    label: "Ca tối",
    slot: "Ca 2",
    startTime: "19:00",
    endTime: "20:30",
  },
  {
    id: "late",
    label: "Ca muộn",
    slot: "Ca 3",
    startTime: "20:30",
    endTime: "22:00",
  },
];

const tuitionPresets = [150000, 200000, 250000, 300000];

const currency = new Intl.NumberFormat("vi-VN", {
  style: "currency",
  currency: "VND",
  maximumFractionDigits: 0,
});

function getWeekday(date: string) {
  if (!date) return "";
  return new Intl.DateTimeFormat("vi-VN", { weekday: "long" }).format(
    new Date(`${date}T00:00:00`),
  );
}

function getReadableDate(date: string) {
  if (!date) return "";
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(`${date}T00:00:00`));
}

function getDateInputValue(date: Date) {
  const year = date.getFullYear();
  const monthValue = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${monthValue}-${day}`;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function formatClock(time: string) {
  const [hour = "", minute = ""] = time.split(":");
  return `${hour}h${minute}`;
}

function getTimeRange(lesson: Lesson) {
  return `${formatClock(lesson.startTime)} - ${formatClock(lesson.endTime)}`;
}

function getShortDate(date: Date) {
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
  }).format(date);
}

function getWeekStart(date: string) {
  const value = new Date(`${date}T00:00:00`);
  const day = value.getDay() || 7;
  value.setDate(value.getDate() - day + 1);
  value.setHours(0, 0, 0, 0);
  return value;
}

function getWeekLabel(date: string) {
  const start = getWeekStart(date);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return `${getShortDate(start)}-${getShortDate(end)}`;
}

function normalizeMoney(value: number) {
  return Number.isFinite(value) && value >= 0 ? value : 0;
}

function makeId() {
  return crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
}

function readStoredItems<T>(key: string, fallback: T[]): T[] {
  const raw = localStorage.getItem(key);
  if (!raw) return fallback;

  try {
    const parsed = JSON.parse(raw) as T[];
    return Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function App() {
  const [lessons, setLessons] = useState<Lesson[]>(() =>
    readStoredItems<Lesson>(STORAGE_KEY, []),
  );
  const [savedStudents, setSavedStudents] = useState<StudentShortcut[]>(() =>
    readStoredItems<StudentShortcut>(STUDENTS_KEY, []),
  );
  const [lessonPresets, setLessonPresets] = useState<LessonPreset[]>(() =>
    readStoredItems<LessonPreset>(PRESETS_KEY, defaultLessonPresets),
  );
  const [form, setForm] = useState<LessonForm>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [month, setMonth] = useState(currentMonth);
  const [query, setQuery] = useState("");
  const [listMode, setListMode] = useState<ListMode>("student");
  const [sortMode, setSortMode] = useState<SortMode>("sessions");
  const [reportStudent, setReportStudent] = useState("");
  const [showDetails, setShowDetails] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [weekStart, setWeekStart] = useState(() =>
    getDateInputValue(getWeekStart(today)),
  );
  const [backupMessage, setBackupMessage] = useState("");
  const backupInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(lessons));
  }, [lessons]);

  useEffect(() => {
    localStorage.setItem(STUDENTS_KEY, JSON.stringify(savedStudents));
  }, [savedStudents]);

  useEffect(() => {
    localStorage.setItem(PRESETS_KEY, JSON.stringify(lessonPresets));
  }, [lessonPresets]);

  const studentOptions = useMemo(() => {
    const byName = new Map<string, StudentShortcut>();

    savedStudents.forEach((student) => {
      const name = student.name.trim();
      if (!name) return;
      byName.set(name.toLowerCase(), {
        ...student,
        name,
        tuition: normalizeMoney(student.tuition),
      });
    });

    lessons.forEach((lesson) => {
      const name = lesson.studentName.trim();
      const key = name.toLowerCase();
      if (!name || byName.has(key)) return;
      byName.set(key, {
        id: `lesson-${key}`,
        name,
        tuition: normalizeMoney(lesson.tuition),
      });
    });

    return Array.from(byName.values()).sort((a, b) =>
      a.name.localeCompare(b.name, "vi"),
    );
  }, [lessons, savedStudents]);

  const filteredLessons = useMemo(() => {
    return lessons
      .filter((lesson) => lesson.date.startsWith(month))
      .filter((lesson) =>
        lesson.studentName.toLowerCase().includes(query.trim().toLowerCase()),
      )
      .sort((a, b) => {
        const byDate = b.date.localeCompare(a.date);
        return byDate || b.startTime.localeCompare(a.startTime);
      });
  }, [lessons, month, query]);

  const studentGroups = useMemo(() => {
    const grouped = new Map<
      string,
      {
        studentName: string;
        lessons: Lesson[];
        sessions: number;
        total: number;
        paid: number;
        weekCounts: Map<string, number>;
      }
    >();

    filteredLessons.forEach((lesson) => {
      const key = lesson.studentName.trim().toLowerCase();
      const current = grouped.get(key) ?? {
        studentName: lesson.studentName.trim(),
        lessons: [],
        sessions: 0,
        total: 0,
        paid: 0,
        weekCounts: new Map<string, number>(),
      };
      const weekLabel = getWeekLabel(lesson.date);

      current.lessons.push(lesson);
      current.sessions += 1;
      current.total += lesson.tuition;
      current.paid += lesson.paid ? lesson.tuition : 0;
      current.weekCounts.set(weekLabel, (current.weekCounts.get(weekLabel) ?? 0) + 1);
      grouped.set(key, current);
    });

    return Array.from(grouped.values())
      .map((student) => ({
        ...student,
        unpaid: student.total - student.paid,
        weekSummary: Array.from(student.weekCounts.entries()).map(
          ([label, sessions]) => ({ label, sessions }),
        ),
        lessons: student.lessons.sort((a, b) => {
          const byDate = b.date.localeCompare(a.date);
          return byDate || b.startTime.localeCompare(a.startTime);
        }),
      }))
      .sort((a, b) => {
        if (sortMode === "name") {
          return a.studentName.localeCompare(b.studentName, "vi");
        }

        if (sortMode === "total") {
          return b.total - a.total;
        }

        if (sortMode === "newest") {
          return b.lessons[0]?.date.localeCompare(a.lessons[0]?.date ?? "") ?? 0;
        }

        return b.sessions - a.sessions;
      });
  }, [filteredLessons, sortMode]);

  const monthLessons = useMemo(
    () => lessons.filter((lesson) => lesson.date.startsWith(month)),
    [lessons, month],
  );

  const stats = useMemo(() => {
    const total = monthLessons.reduce((sum, lesson) => sum + lesson.tuition, 0);
    const paid = monthLessons
      .filter((lesson) => lesson.paid)
      .reduce((sum, lesson) => sum + lesson.tuition, 0);
    const studentCount = new Set(
      monthLessons.map((lesson) => lesson.studentName.trim().toLowerCase()),
    ).size;

    return {
      total,
      paid,
      unpaid: total - paid,
      sessions: monthLessons.length,
      studentCount,
    };
  }, [monthLessons]);

  const studentSummary = useMemo(() => {
    const grouped = new Map<
      string,
      { sessions: number; total: number; weekCounts: Map<string, number> }
    >();

    monthLessons.forEach((lesson) => {
      const key = lesson.studentName.trim();
      const current = grouped.get(key) ?? {
        sessions: 0,
        total: 0,
        weekCounts: new Map<string, number>(),
      };
      const weekLabel = getWeekLabel(lesson.date);

      current.weekCounts.set(weekLabel, (current.weekCounts.get(weekLabel) ?? 0) + 1);
      grouped.set(key, {
        sessions: current.sessions + 1,
        total: current.total + lesson.tuition,
        weekCounts: current.weekCounts,
      });
    });

    return Array.from(grouped.entries())
      .map(([studentName, value]) => ({
        studentName,
        sessions: value.sessions,
        total: value.total,
        maxWeekSessions: Math.max(0, ...value.weekCounts.values()),
      }))
      .sort((a, b) => b.total - a.total);
  }, [monthLessons]);

  const reportStudentName = studentSummary.some(
    (student) => student.studentName === reportStudent,
  )
    ? reportStudent
    : studentSummary[0]?.studentName ?? "";

  const reportLessons = useMemo(() => {
    return monthLessons
      .filter((lesson) => lesson.studentName.trim() === reportStudentName)
      .sort((a, b) => {
        const byDate = a.date.localeCompare(b.date);
        return byDate || a.startTime.localeCompare(b.startTime);
      });
  }, [monthLessons, reportStudentName]);

  const weekDays = useMemo(() => {
    const start = new Date(`${weekStart}T00:00:00`);
    return Array.from({ length: 7 }, (_, index) => {
      const date = addDays(start, index);
      const value = getDateInputValue(date);
      const dayLessons = lessons
        .filter((lesson) => lesson.date === value)
        .filter((lesson) =>
          lesson.studentName.toLowerCase().includes(query.trim().toLowerCase()),
        )
        .sort((a, b) => a.startTime.localeCompare(b.startTime));

      return {
        value,
        label: getWeekday(value),
        shortDate: getShortDate(date),
        lessons: dayLessons,
      };
    });
  }, [lessons, query, weekStart]);

  const weekStats = useMemo(() => {
    const weekLessons = weekDays.flatMap((day) => day.lessons);
    return {
      sessions: weekLessons.length,
      total: weekLessons.reduce((sum, lesson) => sum + lesson.tuition, 0),
    };
  }, [weekDays]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const lesson: Lesson = {
      ...form,
      id: editingId ?? makeId(),
      studentName: form.studentName.trim(),
      tuition: normalizeMoney(form.tuition),
      note: form.note.trim(),
    };

    if (!lesson.studentName || !lesson.date || !lesson.startTime || !lesson.endTime) {
      return;
    }

    if (editingId) {
      setLessons((current) =>
        current.map((item) => (item.id === editingId ? lesson : item)),
      );
      setEditingId(null);
    } else {
      setLessons((current) => [lesson, ...current]);
    }

    setForm({ ...emptyForm, date: form.date, tuition: form.tuition });
  }

  function chooseStudent(student: StudentShortcut) {
    setForm((current) => ({
      ...current,
      studentName: student.name,
      tuition: student.tuition || current.tuition,
    }));
  }

  function saveCurrentStudent() {
    const name = form.studentName.trim();
    if (!name) return;

    setSavedStudents((current) => {
      const existing = current.find(
        (student) => student.name.trim().toLowerCase() === name.toLowerCase(),
      );

      if (existing) {
        return current.map((student) =>
          student.id === existing.id
            ? { ...student, name, tuition: normalizeMoney(form.tuition) }
            : student,
        );
      }

      return [
        ...current,
        { id: makeId(), name, tuition: normalizeMoney(form.tuition) },
      ];
    });
  }

  function deleteSavedStudent(id: string) {
    setSavedStudents((current) => current.filter((student) => student.id !== id));
  }

  function choosePreset(preset: LessonPreset) {
    setForm((current) => ({
      ...current,
      slot: preset.slot,
      startTime: preset.startTime,
      endTime: preset.endTime,
    }));
  }

  function saveCurrentPreset() {
    const label = form.slot.trim() || `${form.startTime}-${form.endTime}`;
    const preset: LessonPreset = {
      id: makeId(),
      label,
      slot: form.slot.trim() || "Ca riêng",
      startTime: form.startTime,
      endTime: form.endTime,
    };

    setLessonPresets((current) => {
      const exists = current.some(
        (item) =>
          item.slot.toLowerCase() === preset.slot.toLowerCase() &&
          item.startTime === preset.startTime &&
          item.endTime === preset.endTime,
      );

      return exists ? current : [...current, preset];
    });
  }

  function deletePreset(id: string) {
    setLessonPresets((current) => current.filter((preset) => preset.id !== id));
  }

  function editLesson(lesson: Lesson) {
    setEditingId(lesson.id);
    setForm({
      studentName: lesson.studentName,
      date: lesson.date,
      slot: lesson.slot,
      startTime: lesson.startTime,
      endTime: lesson.endTime,
      tuition: lesson.tuition,
      paid: lesson.paid,
      note: lesson.note,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function deleteLesson(id: string) {
    setLessons((current) => current.filter((lesson) => lesson.id !== id));
    if (editingId === id) {
      setEditingId(null);
      setForm(emptyForm);
    }
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(emptyForm);
  }

  function exportCsv() {
    const rows = [
      [
        "Hoc sinh",
        "Ngay",
        "Thu",
        "Ca",
        "Bat dau",
        "Ket thuc",
        "Hoc phi",
        "Da thu",
        "Ghi chu",
      ],
      ...monthLessons.map((lesson) => [
        lesson.studentName,
        lesson.date,
        getWeekday(lesson.date),
        lesson.slot,
        lesson.startTime,
        lesson.endTime,
        lesson.tuition.toString(),
        lesson.paid ? "Co" : "Chua",
        lesson.note,
      ]),
    ];

    const csv = rows
      .map((row) =>
        row
          .map((cell) => `"${String(cell).replaceAll('"', '""')}"`)
          .join(","),
      )
      .join("\n");
    const blob = new Blob([`\uFEFF${csv}`], {
      type: "text/csv;charset=utf-8;",
    });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `so-day-hoc-${month}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  function getReportRows() {
    return [
      ["Thứ", "Ngày", "Khung giờ"],
      ...reportLessons.map((lesson) => [
        getWeekday(lesson.date),
        getReadableDate(lesson.date),
        getTimeRange(lesson),
      ]),
      ["Tổng cộng:", "", `${String(reportLessons.length).padStart(2, "0")} buổi`],
    ];
  }

  function copyReportTable() {
    const text = getReportRows()
      .map((row) => row.join("\t"))
      .join("\n");

    if (navigator.clipboard) {
      void navigator.clipboard.writeText(text);
      return;
    }

    const textarea = document.createElement("textarea");
    textarea.value = text;
    document.body.append(textarea);
    textarea.select();
    document.execCommand("copy");
    textarea.remove();
  }

  function exportReportCsv() {
    const csv = getReportRows()
      .map((row) =>
        row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(","),
      )
      .join("\n");
    const blob = new Blob([`\uFEFF${csv}`], {
      type: "text/csv;charset=utf-8;",
    });
    const link = document.createElement("a");
    const studentSlug = reportStudentName
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

    link.href = URL.createObjectURL(blob);
    link.download = `lich-hoc-${studentSlug || "hoc-sinh"}-${month}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  function exportBackup() {
    const backup: BackupData = {
      version: 1,
      exportedAt: new Date().toISOString(),
      lessons,
      savedStudents,
      lessonPresets,
    };
    const blob = new Blob([JSON.stringify(backup, null, 2)], {
      type: "application/json;charset=utf-8;",
    });
    const link = document.createElement("a");

    link.href = URL.createObjectURL(blob);
    link.download = `so-day-hoc-backup-${getDateInputValue(new Date())}.json`;
    link.click();
    URL.revokeObjectURL(link.href);
    setBackupMessage("Đã xuất backup JSON.");
  }

  async function importBackup(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    try {
      const data = JSON.parse(await file.text()) as Partial<BackupData>;
      const nextLessons = Array.isArray(data.lessons) ? data.lessons : null;
      const nextStudents = Array.isArray(data.savedStudents)
        ? data.savedStudents
        : [];
      const nextPresets = Array.isArray(data.lessonPresets)
        ? data.lessonPresets
        : defaultLessonPresets;

      if (!nextLessons) {
        setBackupMessage("File backup không đúng định dạng.");
        return;
      }

      const accepted = window.confirm(
        "Nhập backup sẽ thay dữ liệu hiện tại trên trình duyệt này. Tiếp tục?",
      );
      if (!accepted) return;

      setLessons(nextLessons);
      setSavedStudents(nextStudents);
      setLessonPresets(nextPresets.length ? nextPresets : defaultLessonPresets);
      setEditingId(null);
      setForm(emptyForm);
      setBackupMessage("Đã nhập backup thành công.");
    } catch {
      setBackupMessage("Không đọc được file backup.");
    }
  }

  return (
    <main className="app-shell">
      <section className="app-header">
        <div className="brand-row">
          <span className="brand-mark">
            <Leaf size={20} aria-hidden="true" />
          </span>
          <span>Sổ dạy học</span>
        </div>
      </section>

      <section className="workspace" aria-label="Quan ly buoi day">
        <aside className="form-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">{editingId ? "Đang sửa" : "Thêm mới"}</p>
              <h2>{editingId ? "Cập nhật buổi dạy" : "Nhập buổi dạy"}</h2>
            </div>
            {editingId ? (
              <button className="icon-button" type="button" onClick={cancelEdit} title="Hủy sửa">
                <X size={18} aria-hidden="true" />
              </button>
            ) : null}
          </div>

          <form className="lesson-form" onSubmit={handleSubmit}>
            <label>
              <span>Tên học sinh</span>
              <input
                required
                list="student-suggestions"
                value={form.studentName}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    studentName: event.target.value,
                  }))
                }
                placeholder="Ví dụ: Minh Anh"
              />
              <datalist id="student-suggestions">
                {studentOptions.map((student) => (
                  <option value={student.name} key={student.id} />
                ))}
              </datalist>
            </label>

            <div className="quick-group">
              <div className="quick-label">
                <span>Học sinh quen</span>
                <button
                  className="tiny-action"
                  type="button"
                  onClick={saveCurrentStudent}
                  title="Lưu học sinh hiện tại"
                >
                  <Plus size={14} aria-hidden="true" />
                  <span>Lưu</span>
                </button>
              </div>

              {studentOptions.length ? (
                <div className="student-shortcuts">
                  {studentOptions.map((student) => {
                    const saved = !student.id.startsWith("lesson-");
                    const selected =
                      student.name.toLowerCase() ===
                      form.studentName.trim().toLowerCase();

                    return (
                      <div
                        className={`student-shortcut ${
                          selected ? "is-selected" : ""
                        }`}
                        key={student.id}
                      >
                        <button
                          className="student-pick"
                          type="button"
                          onClick={() => chooseStudent(student)}
                        >
                          <span>{student.name}</span>
                          <small>{currency.format(student.tuition)}</small>
                        </button>
                        {saved ? (
                          <button
                            className="mini-delete"
                            type="button"
                            onClick={() => deleteSavedStudent(student.id)}
                            title="Xóa khỏi danh sách"
                          >
                            <X size={14} aria-hidden="true" />
                          </button>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <small className="field-hint">
                  Nhập tên và học phí rồi bấm Lưu để tạo danh sách chọn nhanh.
                </small>
              )}
            </div>

            <label>
              <span>Ngày đi dạy</span>
              <input
                required
                type="date"
                value={form.date}
                onChange={(event) =>
                  setForm((current) => ({ ...current, date: event.target.value }))
                }
              />
              <small className="field-hint">{getWeekday(form.date)}</small>
            </label>

            <div className="quick-group">
              <div className="quick-label">
                <span>Ca thường dạy</span>
                <small>
                  {form.slot} · {form.startTime} - {form.endTime}
                </small>
              </div>
              <div className="quick-buttons">
                {lessonPresets.map((preset) => {
                  const selected =
                    form.slot === preset.slot &&
                    form.startTime === preset.startTime &&
                    form.endTime === preset.endTime;

                  return (
                    <div className="preset-card" key={preset.id}>
                      <button
                        className={`quick-chip ${selected ? "is-selected" : ""}`}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => choosePreset(preset)}
                      >
                        <span>{preset.label}</span>
                        <small>
                          {preset.startTime} - {preset.endTime}
                        </small>
                      </button>
                      <button
                        className="mini-delete"
                        type="button"
                        onClick={() => deletePreset(preset.id)}
                        title="Xóa ca này"
                      >
                        <X size={14} aria-hidden="true" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            <details className="optional-box">
              <summary>Chỉnh ca/giờ thủ công</summary>
              <div className="three-columns">
                <label>
                  <span>Ca</span>
                  <select
                    value={form.slot}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, slot: event.target.value }))
                    }
                  >
                    <option>Ca 1</option>
                    <option>Ca 2</option>
                    <option>Ca 3</option>
                    <option>Ca tối</option>
                    <option>Ca riêng</option>
                  </select>
                </label>
                <label>
                  <span>Bắt đầu</span>
                  <input
                    required
                    type="time"
                    value={form.startTime}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        startTime: event.target.value,
                      }))
                    }
                  />
                </label>
                <label>
                  <span>Kết thúc</span>
                  <input
                    required
                    type="time"
                    value={form.endTime}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        endTime: event.target.value,
                      }))
                    }
                  />
                </label>
              </div>
              <button
                className="mini-save-button"
                type="button"
                onClick={saveCurrentPreset}
              >
                <Save size={15} aria-hidden="true" />
                <span>Lưu ca này vào danh sách</span>
              </button>
            </details>

            <div className="two-columns">
              <label className="money-field">
                <span>Học phí / buổi</span>
                <input
                  required
                  min={0}
                  step={10000}
                  type="number"
                  value={form.tuition}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      tuition: event.target.valueAsNumber,
                    }))
                  }
                />
                <div className="money-presets" aria-label="Chọn nhanh học phí">
                  {tuitionPresets.map((amount) => (
                    <button
                      className={`money-chip ${
                        form.tuition === amount ? "is-selected" : ""
                      }`}
                      type="button"
                      key={amount}
                      onClick={() =>
                        setForm((current) => ({ ...current, tuition: amount }))
                      }
                    >
                      {amount / 1000}k
                    </button>
                  ))}
                </div>
              </label>
              <label className="switch-label">
                <span>Trạng thái</span>
                <button
                  className={`switch ${form.paid ? "is-on" : ""}`}
                  type="button"
                  onClick={() =>
                    setForm((current) => ({ ...current, paid: !current.paid }))
                  }
                  aria-pressed={form.paid}
                >
                  <span>{form.paid ? "Đã thu" : "Chưa thu"}</span>
                </button>
              </label>
            </div>

            <details className="optional-box">
              <summary>Ghi chú thêm</summary>
              <label>
                <span>Ghi chú</span>
                <textarea
                  rows={3}
                  value={form.note}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, note: event.target.value }))
                  }
                  placeholder="Bài đã học, bài tập, nhắc phụ huynh..."
                />
              </label>
            </details>

            <button className="primary-button" type="submit">
              {editingId ? <Save size={18} /> : <Plus size={18} />}
              <span>{editingId ? "Lưu thay đổi" : "Thêm buổi dạy"}</span>
            </button>
          </form>
        </aside>

        <section className="dashboard">
          <div className="toolbar">
            <label className="month-picker">
              <CalendarDays size={18} aria-hidden="true" />
              <input
                type="month"
                value={month}
                onChange={(event) => setMonth(event.target.value)}
              />
            </label>

            <label className="search-box">
              <Search size={18} aria-hidden="true" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Tìm học sinh"
              />
            </label>

            <button className="ghost-button" type="button" onClick={exportCsv}>
              <Download size={18} aria-hidden="true" />
              <span>CSV</span>
            </button>
          </div>

          <div className="stat-grid">
            <article className="stat-card accent-gold">
              <CircleDollarSign size={22} aria-hidden="true" />
              <span>Tổng lương</span>
              <strong>{currency.format(stats.total)}</strong>
            </article>
            <article className="stat-card accent-green">
              <CheckCircle2 size={22} aria-hidden="true" />
              <span>Đã thu</span>
              <strong>{currency.format(stats.paid)}</strong>
            </article>
            <article className="stat-card accent-coral">
              <CalendarDays size={22} aria-hidden="true" />
              <span>Số buổi</span>
              <strong>{stats.sessions}</strong>
            </article>
            <article className="stat-card accent-blue">
              <UsersRound size={22} aria-hidden="true" />
              <span>Học sinh</span>
              <strong>{stats.studentCount}</strong>
            </article>
          </div>

          <section className="week-panel" aria-label="Lich day trong tuan">
            <div className="section-heading week-heading">
              <div>
                <p className="eyebrow">Lịch tuần</p>
                <h2>
                  {getReadableDate(weekStart)} -{" "}
                  {getReadableDate(getDateInputValue(addDays(new Date(`${weekStart}T00:00:00`), 6)))}
                </h2>
              </div>
              <div className="week-tools">
                <button
                  className="icon-button"
                  type="button"
                  onClick={() =>
                    setWeekStart((current) =>
                      getDateInputValue(addDays(new Date(`${current}T00:00:00`), -7)),
                    )
                  }
                  title="Tuần trước"
                >
                  <span aria-hidden="true">‹</span>
                </button>
                <input
                  type="date"
                  value={weekStart}
                  onChange={(event) =>
                    setWeekStart(getDateInputValue(getWeekStart(event.target.value)))
                  }
                  aria-label="Chọn tuần"
                />
                <button
                  className="icon-button"
                  type="button"
                  onClick={() =>
                    setWeekStart((current) =>
                      getDateInputValue(addDays(new Date(`${current}T00:00:00`), 7)),
                    )
                  }
                  title="Tuần sau"
                >
                  <span aria-hidden="true">›</span>
                </button>
              </div>
            </div>

            <div className="week-summary">
              <span>{weekStats.sessions} buổi trong tuần</span>
              <span>{currency.format(weekStats.total)}</span>
            </div>

            <div className="week-grid">
              {weekDays.map((day) => (
                <article className="day-column" key={day.value}>
                  <div className="day-heading">
                    <strong>{day.label}</strong>
                    <span>{day.shortDate}</span>
                  </div>

                  {day.lessons.length ? (
                    <div className="day-lessons">
                      {day.lessons.map((lesson) => (
                        <button
                          className="day-lesson"
                          type="button"
                          onClick={() => editLesson(lesson)}
                          key={lesson.id}
                          title="Sửa buổi này"
                        >
                          <strong>{lesson.studentName}</strong>
                          <span>
                            {formatClock(lesson.startTime)} - {formatClock(lesson.endTime)}
                          </span>
                          <small>{currency.format(lesson.tuition)}</small>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="day-empty">Trống</p>
                  )}
                </article>
              ))}
            </div>
          </section>

          <section className="backup-panel" aria-label="Sao luu du lieu">
            <div>
              <p className="eyebrow">Sao lưu</p>
              <h2>Dữ liệu cá nhân</h2>
              {backupMessage ? <span>{backupMessage}</span> : null}
            </div>
            <div className="backup-actions">
              <button className="ghost-button" type="button" onClick={exportBackup}>
                <Download size={18} aria-hidden="true" />
                <span>Xuất backup</span>
              </button>
              <button
                className="ghost-button"
                type="button"
                onClick={() => backupInputRef.current?.click()}
              >
                <Upload size={18} aria-hidden="true" />
                <span>Nhập backup</span>
              </button>
              <input
                ref={backupInputRef}
                className="hidden-file"
                type="file"
                accept="application/json,.json"
                onChange={importBackup}
              />
            </div>
          </section>

          <button
            className="details-toggle"
            type="button"
            onClick={() => setShowReport((current) => !current)}
          >
            <span>{showReport ? "Ẩn bảng xuất" : "Xem bảng xuất"}</span>
            <small>
              {reportStudentName
                ? `${reportStudentName}: ${reportLessons.length} buổi`
                : "Chưa có dữ liệu tháng này"}
            </small>
          </button>

          {showReport ? (
            <section className="report-panel" aria-label="Bang xuat lich hoc">
              <div className="section-heading report-heading">
                <div>
                  <p className="eyebrow">Bảng xuất</p>
                  <h2>Lịch học theo học sinh</h2>
                </div>

                <div className="report-actions">
                  <label className="report-student-select">
                    <span>Học sinh</span>
                    <select
                      value={reportStudentName}
                      onChange={(event) => setReportStudent(event.target.value)}
                    >
                      {studentSummary.map((student) => (
                        <option value={student.studentName} key={student.studentName}>
                          {student.studentName}
                        </option>
                      ))}
                    </select>
                  </label>

                  <button
                    className="ghost-button"
                    type="button"
                    onClick={copyReportTable}
                    disabled={!reportLessons.length}
                  >
                    <Clipboard size={18} aria-hidden="true" />
                    <span>Copy bảng</span>
                  </button>

                  <button
                    className="ghost-button"
                    type="button"
                    onClick={exportReportCsv}
                    disabled={!reportLessons.length}
                  >
                    <Download size={18} aria-hidden="true" />
                    <span>CSV học sinh</span>
                  </button>
                </div>
              </div>

              {reportLessons.length ? (
                <div className="export-table-wrap">
                  <table className="export-table">
                    <thead>
                      <tr>
                        <th>Thứ</th>
                        <th>Ngày</th>
                        <th>Khung giờ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reportLessons.map((lesson) => (
                        <tr key={lesson.id}>
                          <td>{getWeekday(lesson.date)}</td>
                          <td>{getReadableDate(lesson.date)}</td>
                          <td>{getTimeRange(lesson)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td>Tổng cộng:</td>
                        <td></td>
                        <td>{String(reportLessons.length).padStart(2, "0")} buổi</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              ) : (
                <div className="empty-state compact-empty">
                  <CalendarDays size={30} aria-hidden="true" />
                  <p>Chọn tháng có dữ liệu để xuất bảng.</p>
                </div>
              )}
            </section>
          ) : null}

          <button
            className="details-toggle"
            type="button"
            onClick={() => setShowDetails((current) => !current)}
          >
            <span>
              {showDetails ? "Ẩn danh sách chi tiết" : "Xem danh sách chi tiết"}
            </span>
            <small>{filteredLessons.length} buổi trong bộ lọc hiện tại</small>
          </button>

          {showDetails ? (
            <div className="content-grid">
            <section className="lesson-list" aria-label="Danh sach buoi day">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">Chi tiết</p>
                  <h2>{listMode === "student" ? "Sắp theo học sinh" : "Buổi dạy trong tháng"}</h2>
                </div>
                <span>{currency.format(stats.unpaid)} chưa thu</span>
              </div>

              <div className="list-controls">
                <div className="segmented-control" aria-label="Chế độ xem">
                  <button
                    className={listMode === "student" ? "is-active" : ""}
                    type="button"
                    onClick={() => setListMode("student")}
                  >
                    Theo học sinh
                  </button>
                  <button
                    className={listMode === "date" ? "is-active" : ""}
                    type="button"
                    onClick={() => setListMode("date")}
                  >
                    Theo ngày
                  </button>
                </div>

                <label className="sort-select">
                  <span>Sắp xếp</span>
                  <select
                    value={sortMode}
                    onChange={(event) => setSortMode(event.target.value as SortMode)}
                  >
                    <option value="sessions">Nhiều buổi nhất</option>
                    <option value="total">Lương cao nhất</option>
                    <option value="name">Tên A-Z</option>
                    <option value="newest">Mới dạy gần nhất</option>
                  </select>
                </label>
              </div>

              {filteredLessons.length ? (
                listMode === "student" ? (
                  <div className="student-groups">
                    {studentGroups.map((student, index) => (
                      <details className="student-group" key={student.studentName} open={index < 2}>
                        <summary>
                          <div className="student-group-title">
                            <strong>{student.studentName}</strong>
                            <span>
                              {student.sessions} buổi · {currency.format(student.total)}
                            </span>
                          </div>
                          <div className="student-group-meta">
                            <b>{student.weekSummary[0]?.sessions ?? 0} buổi tuần gần nhất</b>
                            {student.unpaid ? (
                              <span>{currency.format(student.unpaid)} chưa thu</span>
                            ) : (
                              <span>Đã thu đủ</span>
                            )}
                          </div>
                        </summary>

                        <div className="week-strip">
                          {student.weekSummary.map((week) => (
                            <span key={week.label}>
                              {week.label}: <b>{week.sessions}</b> buổi
                            </span>
                          ))}
                        </div>

                        <div className="lesson-cards">
                          {student.lessons.map((lesson) => (
                            <article className="lesson-card" key={lesson.id}>
                              <div>
                                <strong>{getReadableDate(lesson.date)}</strong>
                                <span>{getWeekday(lesson.date)}</span>
                              </div>
                              <div>
                                <strong>{lesson.slot}</strong>
                                <span>
                                  {lesson.startTime} - {lesson.endTime}
                                </span>
                              </div>
                              <div>
                                <strong>{currency.format(lesson.tuition)}</strong>
                                <span>{lesson.paid ? "Đã thu" : "Chưa thu"}</span>
                              </div>
                              <div className="row-actions">
                                <button
                                  className="icon-button"
                                  type="button"
                                  onClick={() => editLesson(lesson)}
                                  title="Sửa"
                                >
                                  <Edit3 size={17} aria-hidden="true" />
                                </button>
                                <button
                                  className="icon-button danger"
                                  type="button"
                                  onClick={() => deleteLesson(lesson.id)}
                                  title="Xóa"
                                >
                                  <Trash2 size={17} aria-hidden="true" />
                                </button>
                              </div>
                              {lesson.note ? <p>{lesson.note}</p> : null}
                            </article>
                          ))}
                        </div>
                      </details>
                    ))}
                  </div>
                ) : (
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Học sinh</th>
                          <th>Ngày</th>
                          <th>Ca</th>
                          <th>Học phí</th>
                          <th>Thu</th>
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredLessons.map((lesson) => (
                          <tr key={lesson.id}>
                            <td>
                              <strong>{lesson.studentName}</strong>
                              {lesson.note ? <small>{lesson.note}</small> : null}
                            </td>
                            <td>
                              {getReadableDate(lesson.date)}
                              <small>{getWeekday(lesson.date)}</small>
                            </td>
                            <td>
                              {lesson.slot}
                              <small>
                                {lesson.startTime} - {lesson.endTime}
                              </small>
                            </td>
                            <td>{currency.format(lesson.tuition)}</td>
                            <td>
                              <span
                                className={`status-pill ${
                                  lesson.paid ? "paid" : "unpaid"
                                }`}
                              >
                                {lesson.paid ? "Đã thu" : "Chưa"}
                              </span>
                            </td>
                            <td className="row-actions">
                              <button
                                className="icon-button"
                                type="button"
                                onClick={() => editLesson(lesson)}
                                title="Sửa"
                              >
                                <Edit3 size={17} aria-hidden="true" />
                              </button>
                              <button
                                className="icon-button danger"
                                type="button"
                                onClick={() => deleteLesson(lesson.id)}
                                title="Xóa"
                              >
                                <Trash2 size={17} aria-hidden="true" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )
              ) : (
                <div className="empty-state">
                  <CalendarDays size={36} aria-hidden="true" />
                  <p>Chưa có buổi dạy nào khớp bộ lọc.</p>
                </div>
              )}
            </section>

            <aside className="summary-panel">
              <div className="section-heading compact">
                <div>
                  <p className="eyebrow">Theo học sinh</p>
                  <h2>Tổng nhanh</h2>
                </div>
              </div>

              {studentSummary.length ? (
                <div className="student-stack">
                  {studentSummary.map((student) => (
                    <article className="student-row" key={student.studentName}>
                      <div>
                        <strong>{student.studentName}</strong>
                        <span>
                          {student.sessions} buổi · cao nhất {student.maxWeekSessions} buổi/tuần
                        </span>
                      </div>
                      <b>{currency.format(student.total)}</b>
                    </article>
                  ))}
                </div>
              ) : (
                <p className="mini-empty">Chưa có dữ liệu cho tháng này.</p>
              )}
            </aside>
          </div>
          ) : null}
        </section>
      </section>
    </main>
  );
}

export default App;
