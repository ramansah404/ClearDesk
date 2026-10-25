"use client";

import React, { useState } from "react";
import { Trash2, AlertTriangle, X, Check } from "lucide-react";
import { resetWorkspaceData } from "@/lib/workspace";
import { deleteWorkspace } from "@/lib/api";

interface DeleteDataModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDeleted: (newWorkspaceId: string) => void;
  workspaceId: string;
}

export function DeleteDataModal({
  isOpen,
  onClose,
  onDeleted,
  workspaceId,
}: DeleteDataModalProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleDelete = async () => {
    setIsDeleting(true);
    setError(null);
    try {
      if (workspaceId) {
        await deleteWorkspace(workspaceId);
      }
      const newId = resetWorkspaceData();
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        setIsDeleting(false);
        onDeleted(newId);
        onClose();
      }, 900);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to delete workspace data.";
      setError(msg);
      setIsDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
      <div className="w-full max-w-md rounded-[6px] bg-white p-5 shadow-[0_16px_40px_rgba(15,23,42,0.22)] border border-[#D8E1EE] animate-in fade-in zoom-in-95 duration-100">
        <div className="flex items-center justify-between pb-3 border-b border-[#D8E1EE]">
          <div className="flex items-center gap-2 text-[#C43D4B]">
            <AlertTriangle className="h-4 w-4" />
            <h3 className="text-sm font-semibold text-[#17243B]">Reset Workspace Data</h3>
          </div>
          <button
            onClick={onClose}
            className="text-[#5B6880] hover:text-[#17243B] hover:bg-[#F7F9FD] rounded-[4px] p-1 transition cursor-pointer"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {error && (
          <div className="mt-3 rounded-[6px] bg-[#FDF2F2] p-2.5 text-xs text-[#C43D4B] border border-[#C43D4B]/30">
            {error}
          </div>
        )}

        {success ? (
          <div className="py-6 text-center text-[#16805D] space-y-2">
            <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-[#EAF6F1] text-[#16805D] mb-1">
              <Check className="h-5 w-5" />
            </div>
            <p className="text-sm font-semibold text-[#17243B]">Workspace Reset</p>
            <p className="text-xs text-[#5B6880]">All local documents, vectors, and tables wiped cleanly.</p>
          </div>
        ) : (
          <>
            <div className="py-3.5 space-y-3 text-xs text-[#5B6880] leading-relaxed">
              <p className="text-[#17243B] font-medium">
                Are you sure you want to permanently erase this workspace? This action purges all uploaded documents, notes, extracted actions, exam plans, and quizzes.
              </p>
              <div className="rounded-[6px] bg-[#F7F9FD] p-3 border border-[#D8E1EE] text-[#5B6880] text-[11.5px] leading-normal">
                <span className="font-semibold text-[#17243B]">Privacy Guarantee:</span> Your documents are never used for model training. Resetting purges all SQLite metadata, vector embeddings in ChromaDB, and stored files on disk.
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#D8E1EE]">
              <button
                type="button"
                onClick={onClose}
                disabled={isDeleting}
                className="px-3.5 py-1.5 text-xs font-medium text-[#17243B] bg-white hover:bg-[#F7F9FD] rounded-[6px] border border-[#D8E1EE] shadow-xs transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={isDeleting}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-[#C43D4B] hover:bg-[#9F2C38] rounded-[6px] shadow-xs transition cursor-pointer disabled:opacity-50"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>{isDeleting ? "Wiping Data..." : "Erase All Data"}</span>
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
