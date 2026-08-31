"use client";

import React, { useState, useEffect, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Header from "@/components/Header";
import VerticalNav from "@/components/VerticalNav";
import CreateFolderModal from "@/components/groups/CreateFolderModal";
import AddBookToGroupModal from "@/components/groups/AddBookToGroupModal";
import InviteMemberModal from "@/components/groups/InviteMemberModal";
import GroupMembersModal from "@/components/groups/GroupMembersModal";
import {
  UsersIcon,
  FolderIcon,
  BookOpenIcon,
  PlusIcon,
  UserPlusIcon,
  FolderPlusIcon,
  CopyIcon,
  CheckIcon,
  TrashIcon,
  LockIcon,
  CrownIcon,
  ArrowLeftIcon,
} from "@/components/ui/icons";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function GroupDetailPage({ params }: PageProps) {
  const { id } = use(params);
  const router = useRouter();
  const { data: session } = useSession();

  const [groupData, setGroupData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedFolderId, setSelectedFolderId] = useState<string>("ALL");
  const [copiedCode, setCopiedCode] = useState(false);

  // Modals state
  const [isFolderModalOpen, setIsFolderModalOpen] = useState(false);
  const [isAddBookModalOpen, setIsAddBookModalOpen] = useState(false);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [isMembersModalOpen, setIsMembersModalOpen] = useState(false);

  const fetchGroup = async () => {
    try {
      const res = await fetch(`/api/groups/${id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load group");
      setGroupData(data.group);
    } catch (err: any) {
      setError(err.message || "Failed to load group");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGroup();
  }, [id]);

  const handleCopyCode = () => {
    if (!groupData?.code) return;
    navigator.clipboard.writeText(groupData.code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleDeleteFolder = async (folderId: string) => {
    if (!confirm("Are you sure you want to delete this folder?")) return;
    try {
      const res = await fetch(`/api/groups/${id}/folders?folderId=${folderId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        if (selectedFolderId === folderId) setSelectedFolderId("ALL");
        fetchGroup();
      }
    } catch {
      // ignore
    }
  };

  const handleRemoveBook = async (bookId: string) => {
    if (!confirm("Remove this book from group?")) return;
    try {
      const res = await fetch(`/api/groups/${id}/folders?bookId=${bookId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        fetchGroup();
      }
    } catch {
      // ignore
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col">
        <Header />
        <VerticalNav />
        <main className="flex-1 max-w-6xl mx-auto px-4 py-8 md:pl-24 w-full animate-pulse">
          <div className="h-40 rounded-3xl bg-slate-200 dark:bg-slate-800 mb-6" />
          <div className="h-10 w-64 rounded-2xl bg-slate-200 dark:bg-slate-800 mb-6" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-60 rounded-2xl bg-slate-200 dark:bg-slate-800" />
            ))}
          </div>
        </main>
      </div>
    );
  }

  if (error || !groupData) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col">
        <Header />
        <VerticalNav />
        <main className="flex-1 max-w-4xl mx-auto px-4 py-16 md:pl-24 text-center">
          <div className="rounded-3xl border border-red-200 bg-red-50 p-8 dark:border-red-900/50 dark:bg-red-950/50">
            <h2 className="text-lg font-bold text-red-600 dark:text-red-400">
              {error || "Group not found"}
            </h2>
            <Link
              href="/groups"
              className="mt-4 inline-flex items-center gap-2 text-xs font-bold text-slate-700 hover:underline dark:text-slate-300"
            >
              <ArrowLeftIcon size={14} /> Back to Groups
            </Link>
          </div>
        </main>
      </div>
    );
  }

  // Filter books by selected folder
  const allGroupBooks = groupData.books || [];
  const currentBooks =
    selectedFolderId === "ALL"
      ? allGroupBooks
      : allGroupBooks.filter((b: any) => b.groupFolderId === selectedFolderId);

  const currentUserId = session?.user?.id;
  const myMembership = groupData.members?.find(
    (m: any) => m.userId === currentUserId || m.user?.id === currentUserId
  );
  const isOwnerOrAdmin =
    groupData.ownerId === currentUserId ||
    myMembership?.role === "OWNER" ||
    myMembership?.role === "ADMIN";

  const FOLDER_COLOR_THEMES: Record<
    string,
    {
      dot: string;
      iconText: string;
      activeBg: string;
      inactiveBorder: string;
      badgeBg: string;
    }
  > = {
    blue: {
      dot: "bg-blue-500",
      iconText: "text-blue-500 dark:text-blue-400",
      activeBg: "bg-blue-600 text-white shadow-md shadow-blue-500/25",
      inactiveBorder: "border-blue-200/80 dark:border-blue-900/60 hover:border-blue-400",
      badgeBg: "bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300",
    },
    emerald: {
      dot: "bg-emerald-500",
      iconText: "text-emerald-500 dark:text-emerald-400",
      activeBg: "bg-emerald-600 text-white shadow-md shadow-emerald-500/25",
      inactiveBorder: "border-emerald-200/80 dark:border-emerald-900/60 hover:border-emerald-400",
      badgeBg: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300",
    },
    purple: {
      dot: "bg-purple-500",
      iconText: "text-purple-500 dark:text-purple-400",
      activeBg: "bg-purple-600 text-white shadow-md shadow-purple-500/25",
      inactiveBorder: "border-purple-200/80 dark:border-purple-900/60 hover:border-purple-400",
      badgeBg: "bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300",
    },
    amber: {
      dot: "bg-amber-500",
      iconText: "text-amber-500 dark:text-amber-400",
      activeBg: "bg-amber-600 text-white shadow-md shadow-amber-500/25",
      inactiveBorder: "border-amber-200/80 dark:border-amber-900/60 hover:border-amber-400",
      badgeBg: "bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300",
    },
    rose: {
      dot: "bg-rose-500",
      iconText: "text-rose-500 dark:text-rose-400",
      activeBg: "bg-rose-600 text-white shadow-md shadow-rose-500/25",
      inactiveBorder: "border-rose-200/80 dark:border-rose-900/60 hover:border-rose-400",
      badgeBg: "bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300",
    },
    indigo: {
      dot: "bg-indigo-500",
      iconText: "text-indigo-500 dark:text-indigo-400",
      activeBg: "bg-indigo-600 text-white shadow-md shadow-indigo-500/25",
      inactiveBorder: "border-indigo-200/80 dark:border-indigo-900/60 hover:border-indigo-400",
      badgeBg: "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300",
    },
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans">
      <Header />
      <VerticalNav />

      <main className="flex-1 w-full max-w-6xl mx-auto px-3 sm:px-6 py-3 sm:py-6 md:pl-24">
        {/* Navigation Breadcrumb & Code */}
        <div className="flex items-center justify-between gap-2 mb-2.5 sm:mb-4">
          <Link
            href="/groups"
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-white/80 border border-slate-200/80 hover:bg-slate-100 text-xs font-bold text-slate-700 dark:bg-slate-900/80 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800 transition-all shadow-xs"
          >
            <ArrowLeftIcon size={13} />
            <span>Groups</span>
          </Link>

          {isOwnerOrAdmin && (
            <button
              onClick={handleCopyCode}
              title="Click to copy invite code"
              className="inline-flex items-center gap-1.5 rounded-xl bg-white/90 px-2.5 py-1 text-xs font-mono font-bold text-slate-800 shadow-xs border border-slate-200 hover:border-brand-300 transition-all dark:bg-slate-900 dark:text-slate-200 dark:border-slate-700"
            >
              <span className="text-slate-400 font-sans font-normal text-[10px]">Code:</span>
              <span className="tracking-wider">{groupData.code}</span>
              {copiedCode ? <CheckIcon size={12} className="text-emerald-500" /> : <CopyIcon size={12} />}
            </button>
          )}
        </div>

        {/* Compact Hero Card */}
        <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl border border-slate-200/80 bg-gradient-to-br from-white via-brand-50/15 to-indigo-50/20 p-3.5 sm:p-5 shadow-sm backdrop-blur-xl dark:border-slate-800/80 dark:from-slate-900/90 dark:via-slate-900/60 dark:to-indigo-950/20 mb-3.5 sm:mb-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 relative z-10">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 flex-wrap mb-1">
                <span
                  className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[9px] sm:text-[10px] font-extrabold tracking-wide uppercase ${
                    groupData.privacy === "PUBLIC"
                      ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200/60"
                      : "bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200/60"
                  }`}
                >
                  {groupData.privacy === "PUBLIC" ? (
                    <>
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                      Public
                    </>
                  ) : (
                    <>
                      <LockIcon size={9} />
                      Private
                    </>
                  )}
                </span>

                {myMembership && (
                  <span className="inline-flex items-center gap-1 rounded-md bg-brand-50 px-2 py-0.5 text-[9px] sm:text-[10px] font-bold text-brand-700 dark:bg-brand-950/60 dark:text-brand-300 border border-brand-200/60 dark:border-brand-900/60 uppercase">
                    {isOwnerOrAdmin && <CrownIcon size={9} className="text-amber-500" />}
                    {myMembership.role}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2.5">
                <h1 className="text-lg sm:text-2xl font-black tracking-tight text-slate-900 dark:text-slate-100 truncate">
                  {groupData.name}
                </h1>

                <button
                  onClick={() => setIsMembersModalOpen(true)}
                  className="flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-white/80 border border-slate-200 shadow-xs hover:border-brand-400 transition dark:bg-slate-800 dark:border-slate-700"
                  title="View members"
                >
                  <div className="flex -space-x-1.5 overflow-hidden">
                    {groupData.members?.slice(0, 3).map((m: any) => (
                      <div
                        key={m.id}
                        className="inline-block h-4 w-4 rounded-full ring-1 ring-white dark:ring-slate-900 bg-gradient-to-tr from-brand-600 to-indigo-500 text-white flex items-center justify-center font-bold text-[7px]"
                      >
                        {m.user?.name?.[0]?.toUpperCase() || "U"}
                      </div>
                    ))}
                  </div>
                  <span className="text-[10px] sm:text-xs font-bold text-slate-600 dark:text-slate-300">
                    {groupData.members?.length || 1}
                  </span>
                </button>
              </div>

              {groupData.description && (
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400 line-clamp-1 max-w-xl">
                  {groupData.description}
                </p>
              )}
            </div>

            {/* Compact Action Buttons */}
            {isOwnerOrAdmin && (
              <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100 dark:border-slate-800/60">
                <button
                  onClick={() => setIsAddBookModalOpen(true)}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-gradient-to-r from-brand-600 to-indigo-600 text-xs font-bold text-white shadow-xs shadow-brand-500/25 transition-all hover:scale-105 active:scale-95 whitespace-nowrap"
                >
                  <PlusIcon size={13} />
                  <span>Add Book</span>
                </button>

                <button
                  onClick={() => setIsFolderModalOpen(true)}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 shadow-xs transition-all active:scale-95 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 whitespace-nowrap"
                >
                  <FolderPlusIcon size={13} />
                  <span>Folder</span>
                </button>

                <button
                  onClick={() => setIsInviteModalOpen(true)}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 shadow-xs transition-all active:scale-95 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 whitespace-nowrap"
                >
                  <UserPlusIcon size={13} />
                  <span>Invite</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Folders Navigation Bar */}
        <div className="flex items-center justify-between gap-2 overflow-x-auto pb-1.5 mb-3.5 sm:mb-5 scrollbar-none">
          <div className="flex items-center gap-1.5">
            {/* All Books Tab */}
            <button
              onClick={() => setSelectedFolderId("ALL")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                selectedFolderId === "ALL"
                  ? "bg-brand-600 text-white shadow-xs shadow-brand-500/20"
                  : "bg-white/80 border border-slate-200 text-slate-700 hover:bg-slate-50 dark:bg-slate-900/80 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800"
              }`}
            >
              <BookOpenIcon size={13} />
              <span>All Books ({allGroupBooks.length})</span>
            </button>

            {/* Group Sub-folders with Color Tag Indicators */}
            {groupData.folders?.map((folder: any) => {
              const count = allGroupBooks.filter((b: any) => b.groupFolderId === folder.id).length;
              const isActive = selectedFolderId === folder.id;
              const colorTheme = FOLDER_COLOR_THEMES[folder.color || "blue"] || FOLDER_COLOR_THEMES.blue;

              return (
                <div
                  key={folder.id}
                  className={`group/f flex items-center rounded-xl transition-all ${
                    isActive
                      ? colorTheme.activeBg
                      : `bg-white/80 border ${colorTheme.inactiveBorder} text-slate-700 hover:bg-slate-50 dark:bg-slate-900/80 dark:text-slate-300 dark:hover:bg-slate-800`
                  }`}
                >
                  <button
                    onClick={() => setSelectedFolderId(folder.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold whitespace-nowrap"
                  >
                    <span className={`h-2 w-2 rounded-full ${colorTheme.dot} ${isActive ? "ring-2 ring-white/60" : ""}`} />
                    <FolderIcon size={13} className={isActive ? "text-white" : colorTheme.iconText} />
                    <span>{folder.name} ({count})</span>
                  </button>

                  {isOwnerOrAdmin && (
                    <button
                      onClick={() => handleDeleteFolder(folder.id)}
                      title="Delete folder"
                      className={`pr-2 opacity-0 group-hover/f:opacity-100 transition-opacity ${
                        isActive ? "text-white/80 hover:text-white" : "text-slate-400 hover:text-red-500"
                      }`}
                    >
                      <TrashIcon size={11} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {isOwnerOrAdmin && (
            <button
              onClick={() => setIsFolderModalOpen(true)}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-dashed border-slate-300 text-xs font-semibold text-slate-500 hover:border-brand-400 hover:text-brand-600 dark:border-slate-700 dark:text-slate-400 whitespace-nowrap"
            >
              <PlusIcon size={12} />
              <span>Folder</span>
            </button>
          )}
        </div>

        {/* Bookshelf Grid */}
        {currentBooks.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2.5 sm:gap-4">
            {currentBooks.map((item: any) => (
              <GroupBookCard
                key={item.id}
                item={item}
                groupId={groupData.id}
                isOwnerOrAdmin={isOwnerOrAdmin}
                onRemove={handleRemoveBook}
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center rounded-2xl sm:rounded-3xl border border-dashed border-slate-200 bg-white/50 p-8 sm:p-12 text-center dark:border-slate-800 dark:bg-slate-900/50">
            <BookOpenIcon size={32} className="text-slate-300 dark:text-slate-600 mb-2.5" />
            <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100">
              No Books in this Folder Yet
            </h3>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 max-w-sm">
              {isOwnerOrAdmin
                ? "Add books from your library so everyone in this group can read them together."
                : "No books have been shared in this folder yet. Check back soon!"}
            </p>
            {isOwnerOrAdmin && (
              <button
                onClick={() => setIsAddBookModalOpen(true)}
                className="mt-4 flex items-center gap-1.5 px-4 py-2 rounded-xl bg-brand-600 text-xs font-bold text-white shadow-xs shadow-brand-500/20 hover:bg-brand-500 transition"
              >
                <PlusIcon size={14} />
                <span>Add Book to Group</span>
              </button>
            )}
          </div>
        )}
      </main>

      {/* Modals */}
      <CreateFolderModal
        isOpen={isFolderModalOpen}
        groupId={groupData.id}
        onClose={() => setIsFolderModalOpen(false)}
        onSuccess={() => fetchGroup()}
      />

      <AddBookToGroupModal
        isOpen={isAddBookModalOpen}
        groupId={groupData.id}
        folders={groupData.folders || []}
        defaultFolderId={selectedFolderId !== "ALL" ? selectedFolderId : undefined}
        onClose={() => setIsAddBookModalOpen(false)}
        onSuccess={() => fetchGroup()}
      />

      <InviteMemberModal
        isOpen={isInviteModalOpen}
        groupId={groupData.id}
        groupName={groupData.name}
        inviteCode={groupData.code}
        onClose={() => setIsInviteModalOpen(false)}
        onSuccess={() => fetchGroup()}
      />

      <GroupMembersModal
        isOpen={isMembersModalOpen}
        groupId={groupData.id}
        groupName={groupData.name}
        members={groupData.members || []}
        ownerId={groupData.ownerId}
        currentUserId={currentUserId}
        isOwner={isOwnerOrAdmin}
        onClose={() => setIsMembersModalOpen(false)}
        onRefresh={() => fetchGroup()}
      />
    </div>
  );
}

function GroupBookCard({
  item,
  groupId,
  isOwnerOrAdmin,
  onRemove,
}: {
  item: any;
  groupId: string;
  isOwnerOrAdmin: boolean;
  onRemove: (bookId: string) => void;
}) {
  const [imgFailed, setImgFailed] = useState(false);
  const book = item.book;
  if (!book) return null;

  const authors = book.authors?.map((a: any) => a.author?.name || a.name).join(", ");
  const readUrl = `/read/${book.driveFileId || book.id}?from=${encodeURIComponent(`/groups/${groupId}`)}`;
  const coverSrc = book.coverUrl || `/api/books/${book.id}/thumb`;

  return (
    <div className="group relative flex flex-col overflow-hidden rounded-xl sm:rounded-2xl border border-slate-200/80 bg-white/90 shadow-xs backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-md hover:shadow-brand-500/10 dark:border-slate-800/80 dark:bg-slate-900/80">
      {/* Book Cover */}
      <Link
        href={readUrl}
        className="relative block aspect-[3/4] w-full overflow-hidden bg-slate-100 dark:bg-slate-800"
      >
        {!imgFailed ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={coverSrc}
            alt={book.title}
            onError={() => setImgFailed(true)}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center p-3 text-center">
            <BookOpenIcon size={24} className="text-slate-300 dark:text-slate-600 mb-1.5" />
            <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300 line-clamp-2">
              {book.title}
            </span>
          </div>
        )}

        {/* Hover Read Overlay */}
        <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <span className="px-2.5 py-1 rounded-full bg-white text-slate-900 text-[10px] sm:text-xs font-extrabold shadow-sm">
            Read
          </span>
        </div>
      </Link>

      {/* Book Details */}
      <div className="p-2 sm:p-2.5 flex flex-col flex-1 justify-between">
        <div>
          <Link
            href={readUrl}
            className="block text-[11px] sm:text-xs font-bold text-slate-900 dark:text-slate-100 line-clamp-1 hover:text-brand-600 transition-colors"
          >
            {book.title}
          </Link>
          <p className="text-[9px] sm:text-[10px] text-slate-500 dark:text-slate-400 line-clamp-1 mt-0.5">
            {authors || "Unknown Author"}
          </p>
        </div>

        <div className="mt-2 pt-1.5 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[9px] sm:text-[10px] text-slate-400">
          <span>{book.pageCount ? `${book.pageCount} pgs` : "PDF"}</span>
          {isOwnerOrAdmin && (
            <button
              onClick={() => onRemove(book.id)}
              title="Remove from group"
              className="p-1 rounded text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
            >
              <TrashIcon size={11} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
