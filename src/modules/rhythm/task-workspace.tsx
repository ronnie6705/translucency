"use client";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useRhythmLibrary } from "./use-library";
import { AddTaskOverlay, SpaceEditor } from "./components/task-dialogs";
import { DeleteSpaceDialog } from './components/DeleteSpaceDialog';
import { deleteSpace, spaceContents } from './delete-space';
import type { Space } from "./types";
import "./tasks.css";

type Library = ReturnType<typeof useRhythmLibrary>;
interface Workspace {
  library: Library;
  activeSpaceId: string | null;
  showCompleted: boolean;
  selectCompleted(): void;
  selectSpace(id: string | null): void;
  openTask(): void;
  openSpace(space?: Space): void;
}
const Context = createContext<Workspace | null>(null);
export function useTaskWorkspace() {
  const value = useContext(Context);
  if (!value) throw new Error("Task workspace is missing");
  return value;
}
export function TaskWorkspaceProvider({
  page,
  children,
}: {
  page: string;
  children: ReactNode;
}) {
  const library = useRhythmLibrary();
  const [selected, setSelected] = useState<string | null>(null);
  const [showCompleted, setShowCompleted] = useState(false);
  const [adding, setAdding] = useState(false);
  const [editingSpace, setEditingSpace] = useState<Space | "new" | null>(null);
  const [deletingSpace, setDeletingSpace] = useState<{space:Space; taskCount:number; listCount:number; fingerprint:string} | null>(null);
  const activeSpaceId =
    page === "rhythm-tasks" && library.spaces?.some((s) => s.id === selected)
      ? selected
      : null;
  useEffect(() => {
    try {
      setSelected(sessionStorage.getItem("rhythm:space"));
    } catch {}
  }, []);
  const selectSpace = (id: string | null) => {
    setShowCompleted(false);
    setSelected(id);
    try {
      if (id) sessionStorage.setItem("rhythm:space", id);
      else sessionStorage.removeItem("rhythm:space");
    } catch {}
  };
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (
        e.code === "Space" &&
        (e.metaKey || e.ctrlKey) &&
        !e.altKey &&
        !e.shiftKey &&
        !e.repeat &&
        !e.isComposing
      ) {
        e.preventDefault();
        if (!document.querySelector("dialog[open]")) setAdding(true);
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);
  return (
    <Context.Provider
      value={{
        library,
        activeSpaceId,
        showCompleted,
        selectCompleted: () => { selectSpace(null); setShowCompleted(true); },
        selectSpace,
        openTask: () => setAdding(true),
        openSpace: (space) => setEditingSpace(space ?? "new"),
      }}
    >
      {children}
      {adding && (
        <AddTaskOverlay
          library={library}
          spaceId={activeSpaceId}
          onClose={() => setAdding(false)}
        />
      )}
      {editingSpace && (
        <SpaceEditor
          initial={editingSpace === "new" ? undefined : editingSpace}
          onClose={() => setEditingSpace(null)}
          onSave={async (space) => {
            const ok = await library.save((d) => ({
              ...d,
              spaces:
                editingSpace === "new"
                  ? [...(d.spaces ?? []), space]
                  : (d.spaces ?? []).map((s) =>
                      s.id === space.id
                        ? {
                            ...s,
                            name: space.name,
                            icon: space.icon,
                            color: space.color,
                          }
                        : s,
                    ),
            }));
            return ok;
          }}
          onDelete={editingSpace === "new" ? undefined : () => {
            const space = library.spaces?.find(space => space.id === editingSpace.id);
            if (!space) { setEditingSpace(null); return; }
            setDeletingSpace({space,...spaceContents(library,space.id)});
            setEditingSpace(null);
          }}
          error={library.error}
        />
      )}
      {deletingSpace && <DeleteSpaceDialog space={deletingSpace.space}
        destinations={(library.spaces ?? []).filter(space=>space.id!==deletingSpace.space.id)}
        taskCount={deletingSpace.taskCount} listCount={deletingSpace.listCount} error={library.error}
        onClose={()=>setDeletingSpace(null)} onDelete={async (mode,destinationId)=>{
          const id = deletingSpace.space.id;
          const fallback = {id:crypto.randomUUID(),name:'General',icon:'general',color:'#9a9eff',createdAt:new Date().toISOString(),tasks:[]};
          const ok = await library.save(data=>deleteSpace(data,id,mode==='delete'
            ? {mode,expectedContents:deletingSpace.fingerprint}
            : {mode,destinationId,...(!destinationId ? {newSpace:fallback} : {})}));
          if(ok && selected===id) selectSpace(null);
          return ok;
        }}/>}
    </Context.Provider>
  );
}
