"use client";

import React, { useState } from "react";
import { Trash2, AlertTriangle, X, Check } from "lucide-react";
import { resetWorkspaceData } from "@/lib/workspace";

interface DeleteDataModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDeleted: (newWorkspaceId: string) => void;
}

export function DeleteDataModal({ isOpen, onClose, onDeleted }: DeleteDataModalProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [success, setSuccess] = useState(false);

  if (!isOpen) return null;

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      // In Phase 0, we reset the client workspace session and localStorage.
      // In Phase 1+, this will call DELETE /workspace on the backend.
      const newId = resetWorkspaceData();
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        setIsDeleting(false);
        onDeleted(newId);
        onClose();
      }, 1000);
    } catch {
      setIsDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-start justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2 text-rose-600">
            <AlertTriangle className="h-5 w-5" />
            <h3 className="font-semibold text-slate-900">Delete Workspace Data</h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 rounded-md p-1 transition"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {success ? (
          <div className="py-6 text-center text-emerald-600 space-y-2">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 mb-1">
              <Check className="h-6 w-6" />
            </div>
            <p className="font-medium">Data wiped successfully!</p>
            <p className="text-sm text-slate-500">Your workspace has been cleanly reset.</p>
          </div>
        ) : (
          <>
            <div className="py-4 space-y-3 text-sm text-slate-600 leading-relaxed">
              <p>
                Are you sure you want to permanently erase all workspace documents, notes, questions, and action items?
              </p>
              <div className="rounded-lg bg-amber-50 p-3 border border-amber-200/60 text-amber-800 text-xs flex gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
                <span>
                  <strong>Privacy Promise</strong>: ClearDesk does not train on your files. Deleting your workspace purges all SQLite metadata, vector embeddings, and uploaded files.
                </span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={onClose}
                disabled={isDeleting}
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={isDeleting}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-rose-600 hover:bg-rose-700 active:bg-rose-800 rounded-lg shadow-xs transition disabled:opacity-50"
              >
                <Trash2 className="h-4 w-4" />
                {isDeleting ? "Wiping Data..." : "Delete All Data"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
