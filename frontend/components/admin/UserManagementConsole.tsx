"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import {
  AdminStudentItem,
  AdminStudentDetailResponse,
  AdminStudentCreate,
  AdminStudentUpdate,
  AdminStudentDeleteRequest,
  AdminMentorItem,
  AdminMentorDetailResponse,
  AdminMentorCreate,
  AdminMentorUpdate,
  AdminMentorDeleteRequest,
  AdminHODItem,
  AdminHODCreate,
  AdminHODUpdate,
  AdminHODDeleteRequest,
  AdminOperationResult,
} from "@/types/auth";
import { api } from "@/lib/api-client";
import { DesignationBadge } from "@/components/DesignationBadge";
import {
  ViewStudentModal,
  AddStudentModal,
  EditStudentModal,
  DeleteStudentModal,
} from "./StudentModals";
import {
  ViewMentorModal,
  AddMentorModal,
  EditMentorModal,
  ReassignStudentsModal,
  DeleteMentorModal,
} from "./MentorModals";
import {
  ViewHODModal,
  AddHODModal,
  EditHODModal,
  DeleteHODModal,
} from "./HODModals";
import { BulkProvisioningModal } from "./BulkProvisioningModal";
import { EditUserEmailModal, TargetUserInfo } from "./EditUserEmailModal";

export type ActiveTab = "students" | "mentors" | "hods";

export interface UserManagementConsoleProps {
  initialTab?: ActiveTab;
  onTabChange?: (tab: ActiveTab) => void;
  openAddModal?: "student" | "mentor" | "hod" | "provisioning" | null;
  onClearAddModal?: () => void;
}

export const UserManagementConsole: React.FC<UserManagementConsoleProps> = ({
  initialTab = "students",
  onTabChange,
  openAddModal,
  onClearAddModal,
}) => {
  const { user, token } = useAuth();

  // Active Tab
  const [activeTab, setActiveTab] = useState<ActiveTab>(initialTab);

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  useEffect(() => {
    if (openAddModal === "student") setShowAddStudent(true);
    else if (openAddModal === "mentor") setShowAddMentor(true);
    else if (openAddModal === "hod") setShowAddHOD(true);
    else if (openAddModal === "provisioning") setShowProvisioningModal(true);

    if (openAddModal && onClearAddModal) {
      onClearAddModal();
    }
  }, [openAddModal, onClearAddModal]);

  // Data states
  const [students, setStudents] = useState<AdminStudentItem[]>([]);
  const [mentors, setMentors] = useState<AdminMentorItem[]>([]);
  const [hods, setHods] = useState<AdminHODItem[]>([]);

  // Loading & error states
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [operationResult, setOperationResult] = useState<AdminOperationResult | null>(null);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState("");
  const [deptFilter, setDeptFilter] = useState("all");
  const [yearFilter, setYearFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [mentorFilter, setMentorFilter] = useState("all");

  // Modals state - Students
  const [selectedStudentDetail, setSelectedStudentDetail] = useState<AdminStudentDetailResponse | null>(null);
  const [studentToEdit, setStudentToEdit] = useState<AdminStudentItem | null>(null);
  const [studentToDelete, setStudentToDelete] = useState<AdminStudentItem | null>(null);
  const [showAddStudent, setShowAddStudent] = useState(false);

  // Modals state - Mentors
  const [selectedMentorDetail, setSelectedMentorDetail] = useState<AdminMentorDetailResponse | null>(null);
  const [mentorToEdit, setMentorToEdit] = useState<AdminMentorItem | null>(null);
  const [mentorToDelete, setMentorToDelete] = useState<AdminMentorItem | null>(null);
  const [mentorToReassign, setMentorToReassign] = useState<AdminMentorItem | null>(null);
  const [showAddMentor, setShowAddMentor] = useState(false);

  // Modals state - HODs
  const [selectedHODDetail, setSelectedHODDetail] = useState<AdminHODItem | null>(null);
  const [hodToEdit, setHodToEdit] = useState<AdminHODItem | null>(null);
  const [hodToDelete, setHodToDelete] = useState<AdminHODItem | null>(null);
  const [showAddHOD, setShowAddHOD] = useState(false);

  // Bulk Login Provisioning Modal
  const [showProvisioningModal, setShowProvisioningModal] = useState(false);

  // Security - Edit User Email Modal
  const [userToEditEmail, setUserToEditEmail] = useState<TargetUserInfo | null>(null);

  // Fetch all user lists
  const fetchAllData = useCallback(async () => {
    if (!token) return;
    try {
      setRefreshing(true);
      setGlobalError(null);

      const [studentsRes, mentorsRes, hodsRes] = await Promise.all([
        api.adminGetStudents(undefined, token),
        api.adminGetMentors(undefined, token),
        api.adminGetHods(undefined, token),
      ]);

      setStudents(studentsRes);
      setMentors(mentorsRes);
      setHods(hodsRes);
    } catch (err: unknown) {
      const errObj = err as { response?: { data?: { detail?: string } }; message?: string };
      setGlobalError(
        errObj.response?.data?.detail ||
          errObj.message ||
          "Failed to load user management records from the server."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  // Distinct departments
  const distinctDepartments = useMemo(() => {
    const set = new Set<string>(["AI&DS", "CCE", "CSE", "IT", "ECE", "EEE", "MECH", "CIVIL"]);
    students.forEach((s) => s.department && set.add(s.department));
    mentors.forEach((m) => m.department && set.add(m.department));
    hods.forEach((h) => h.department && set.add(h.department));
    return Array.from(set);
  }, [students, mentors, hods]);

  // Display toast / notification
  const notifySuccess = (msg: string, result?: AdminOperationResult) => {
    setSuccessMessage(msg);
    if (result) {
      setOperationResult(result);
    }
    setTimeout(() => {
      setSuccessMessage(null);
    }, 6000);
  };

  // ==========================================
  // STUDENT HANDLERS
  // ==========================================
  const handleViewStudent = async (studentId: string) => {
    if (!token) return;
    try {
      const detail = await api.adminGetStudent(studentId, token);
      setSelectedStudentDetail(detail);
    } catch (err: unknown) {
      const errObj = err as { response?: { data?: { detail?: string } }; message?: string };
      setGlobalError(errObj.response?.data?.detail || "Failed to load student details.");
    }
  };

  const handleAddStudent = async (data: AdminStudentCreate) => {
    if (!token) return;
    const res = await api.adminCreateStudent(data, token);
    notifySuccess(`Student ${res.full_name} created successfully.`);
    fetchAllData();
  };

  const handleEditStudent = async (id: string, data: AdminStudentUpdate) => {
    if (!token) return;
    const res = await api.adminUpdateStudent(id, data, token);
    notifySuccess(`Student ${res.full_name} updated successfully.`);
    fetchAllData();
  };

  const handleToggleStudentStatus = async (student: AdminStudentItem) => {
    if (!token) return;
    try {
      const newStatus = !student.is_active;
      await api.adminUpdateStudentStatus(student.id, newStatus, token);
      notifySuccess(`Student ${student.full_name} marked as ${newStatus ? "Active" : "Inactive"}.`);
      fetchAllData();
    } catch (err: unknown) {
      const errObj = err as { response?: { data?: { detail?: string } }; message?: string };
      setGlobalError(errObj.response?.data?.detail || "Failed to change student status.");
    }
  };

  const handleDeleteStudent = async (id: string, req: AdminStudentDeleteRequest) => {
    if (!token) return;
    const res = await api.adminDeleteStudent(id, req, token);
    notifySuccess(res.message, res);
    fetchAllData();
  };

  // ==========================================
  // MENTOR HANDLERS
  // ==========================================
  const handleViewMentor = async (mentorId: string) => {
    if (!token) return;
    try {
      const detail = await api.adminGetMentor(mentorId, token);
      setSelectedMentorDetail(detail);
    } catch (err: unknown) {
      const errObj = err as { response?: { data?: { detail?: string } }; message?: string };
      setGlobalError(errObj.response?.data?.detail || "Failed to load mentor details.");
    }
  };

  const handleAddMentor = async (data: AdminMentorCreate) => {
    if (!token) return;
    const res = await api.adminCreateMentor(data, token);
    notifySuccess(`Faculty mentor ${res.full_name} created successfully.`);
    fetchAllData();
  };

  const handleEditMentor = async (id: string, data: AdminMentorUpdate) => {
    if (!token) return;
    const res = await api.adminUpdateMentor(id, data, token);
    notifySuccess(`Faculty mentor ${res.full_name} updated successfully.`);
    fetchAllData();
  };

  const handleToggleMentorStatus = async (mentor: AdminMentorItem) => {
    if (!token) return;
    try {
      const newStatus = !mentor.is_active;
      await api.adminUpdateMentorStatus(mentor.id, newStatus, token);
      notifySuccess(`Mentor ${mentor.full_name} marked as ${newStatus ? "Active" : "Inactive"}.`);
      fetchAllData();
    } catch (err: unknown) {
      const errObj = err as { response?: { data?: { detail?: string } }; message?: string };
      setGlobalError(errObj.response?.data?.detail || "Failed to change mentor status.");
    }
  };

  const handleReassignMentorStudents = async (sourceMentorId: string, targetMentorId: string) => {
    if (!token) return;
    const res = await api.adminReassignMentorStudents(sourceMentorId, targetMentorId, undefined, token);
    notifySuccess(res.message, res);
    fetchAllData();
  };

  const handleDeleteMentor = async (id: string, req: AdminMentorDeleteRequest) => {
    if (!token) return;
    const res = await api.adminDeleteMentor(id, req, token);
    notifySuccess(res.message, res);
    fetchAllData();
  };

  // ==========================================
  // HOD HANDLERS
  // ==========================================
  const handleViewHOD = async (hodId: string) => {
    if (!token) return;
    try {
      const detail = await api.adminGetHod(hodId, token);
      setSelectedHODDetail(detail);
    } catch (err: unknown) {
      const errObj = err as { response?: { data?: { detail?: string } }; message?: string };
      setGlobalError(errObj.response?.data?.detail || "Failed to load HOD details.");
    }
  };

  const handleAddHOD = async (data: AdminHODCreate) => {
    if (!token) return;
    const res = await api.adminCreateHod(data, token);
    notifySuccess(`HOD ${res.full_name} created successfully.`);
    fetchAllData();
  };

  const handleEditHOD = async (id: string, data: AdminHODUpdate) => {
    if (!token) return;
    const res = await api.adminUpdateHod(id, data, token);
    notifySuccess(`HOD ${res.full_name} updated successfully.`);
    fetchAllData();
  };

  const handleToggleHODStatus = async (hod: AdminHODItem) => {
    if (!token) return;
    try {
      const newStatus = !hod.is_active;
      await api.adminUpdateHodStatus(hod.id, newStatus, token);
      notifySuccess(`HOD ${hod.full_name} marked as ${newStatus ? "Active" : "Inactive"}.`);
      fetchAllData();
    } catch (err: unknown) {
      const errObj = err as { response?: { data?: { detail?: string } }; message?: string };
      setGlobalError(errObj.response?.data?.detail || "Failed to change HOD status.");
    }
  };

  const handleDeleteHOD = async (id: string, req: AdminHODDeleteRequest) => {
    if (!token) return;
    const res = await api.adminDeleteHod(id, req, token);
    notifySuccess(res.message, res);
    fetchAllData();
  };

  // Drive Cleanup Retry
  const handleRetryDriveCleanup = async (driveFileId: string) => {
    if (!token) return;
    try {
      const res = await api.adminRetryDriveCleanup(driveFileId, token);
      notifySuccess(res.message, res);
      // Remove from failed list if successful
      if (operationResult && operationResult.failed_drive_file_ids) {
        setOperationResult({
          ...operationResult,
          failed_drive_file_ids: operationResult.failed_drive_file_ids.filter((f) => f !== driveFileId),
        });
      }
    } catch (err: unknown) {
      const errObj = err as { response?: { data?: { detail?: string } }; message?: string };
      setGlobalError(errObj.response?.data?.detail || "Drive cleanup retry failed.");
    }
  };

  // Filtered Students
  const filteredStudents = useMemo(() => {
    return students.filter((s) => {
      const q = searchQuery.toLowerCase().trim();
      const matchQuery =
        !q ||
        s.full_name.toLowerCase().includes(q) ||
        s.email.toLowerCase().includes(q) ||
        (s.register_number && s.register_number.toLowerCase().includes(q));

      const matchDept = deptFilter === "all" || s.department === deptFilter;
      const matchYear = yearFilter === "all" || s.year.toString() === yearFilter;
      const matchStatus =
        statusFilter === "all" ||
        (statusFilter === "active" && s.is_active) ||
        (statusFilter === "inactive" && !s.is_active);

      const studentMentorId = s.assigned_mentor?.mentor_id;
      const matchMentor =
        mentorFilter === "all" ||
        (mentorFilter === "unassigned" && !studentMentorId) ||
        studentMentorId === mentorFilter;

      return matchQuery && matchDept && matchYear && matchStatus && matchMentor;
    });
  }, [students, searchQuery, deptFilter, yearFilter, statusFilter, mentorFilter]);

  // Filtered Mentors
  const filteredMentors = useMemo(() => {
    return mentors.filter((m) => {
      const q = searchQuery.toLowerCase().trim();
      const matchQuery =
        !q ||
        m.full_name.toLowerCase().includes(q) ||
        m.email.toLowerCase().includes(q) ||
        (m.staff_id && m.staff_id.toLowerCase().includes(q));

      const matchDept = deptFilter === "all" || m.department === deptFilter;
      const matchStatus =
        statusFilter === "all" ||
        (statusFilter === "active" && m.is_active) ||
        (statusFilter === "inactive" && !m.is_active);

      return matchQuery && matchDept && matchStatus;
    });
  }, [mentors, searchQuery, deptFilter, statusFilter]);

  // Filtered HODs
  const filteredHods = useMemo(() => {
    return hods.filter((h) => {
      const q = searchQuery.toLowerCase().trim();
      const matchQuery =
        !q ||
        h.full_name.toLowerCase().includes(q) ||
        h.email.toLowerCase().includes(q) ||
        (h.staff_id && h.staff_id.toLowerCase().includes(q));

      const matchDept = deptFilter === "all" || h.department === deptFilter;
      const matchStatus =
        statusFilter === "all" ||
        (statusFilter === "active" && h.is_active) ||
        (statusFilter === "inactive" && !h.is_active);

      return matchQuery && matchDept && matchStatus;
    });
  }, [hods, searchQuery, deptFilter, statusFilter]);

  return (
    <div className="space-y-6">
      {/* Toast / Notification Banners */}
      {successMessage && (
        <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-sm flex items-center justify-between shadow-sm animate-fade-in">
          <div className="flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center text-xs font-bold">
              ✓
            </span>
            <span>{successMessage}</span>
          </div>
          <button
            onClick={() => setSuccessMessage(null)}
            className="text-xs text-emerald-700 dark:text-emerald-400 hover:underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {operationResult?.retry_drive_cleanup_needed && operationResult.failed_drive_file_ids && operationResult.failed_drive_file_ids.length > 0 && (
        <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200 text-xs space-y-2 shadow-sm animate-fade-in">
          <div className="flex items-center justify-between">
            <span className="font-bold flex items-center gap-2">
              <span className="text-amber-600 font-bold">⚠</span>
              Google Drive Evidence File Cleanup Advisory
            </span>
            <button
              onClick={() => setOperationResult(null)}
              className="text-slate-400 hover:text-slate-600"
            >
              &times;
            </button>
          </div>
          <p>
            Database records were permanently removed, but {operationResult.failed_drive_file_ids.length} Google Drive binary file(s) encountered API throttling or network issues. You can retry cleanup anytime:
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            {operationResult.failed_drive_file_ids.map((id) => (
              <button
                key={id}
                onClick={() => handleRetryDriveCleanup(id)}
                className="px-2.5 py-1 bg-amber-200/60 dark:bg-amber-900/40 hover:bg-amber-300 text-amber-900 dark:text-amber-200 rounded text-[11px] font-mono border border-amber-400/50 flex items-center gap-1 transition"
              >
                <span>Retry Drive File ID: {id.slice(0, 10)}...</span>
                <span>↻</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {globalError && (
        <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300 text-sm flex items-center justify-between shadow-sm animate-fade-in">
          <div className="flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-rose-500 text-white flex items-center justify-center text-xs font-bold">
              !
            </span>
            <span>{globalError}</span>
          </div>
          <button
            onClick={() => setGlobalError(null)}
            className="text-xs text-rose-700 dark:text-rose-400 hover:underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Header & Main Tabs */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-6 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">
              Institutional User Management
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Role-based directory management, credentials provisioning, mentor allocations, and safety-verified lifecycle operations
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowProvisioningModal(true)}
              id="btn-provision-accounts"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-gradient-to-r from-cyan-600 via-blue-600 to-indigo-600 hover:from-cyan-700 hover:to-indigo-700 rounded-lg shadow-sm shadow-blue-500/20 transition cursor-pointer"
            >
              <span>⚡</span>
              <span>Provision Login Accounts</span>
            </button>

            <button
              onClick={() => fetchAllData()}
              disabled={refreshing}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 transition disabled:opacity-60"
            >
              <span className={refreshing ? "animate-spin" : ""}>↻</span>
              <span>{refreshing ? "Refreshing..." : "Refresh"}</span>
            </button>

            {activeTab === "students" && (
              <button
                onClick={() => setShowAddStudent(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm shadow-blue-500/20 transition"
              >
                <span>+</span>
                <span>Add Student</span>
              </button>
            )}

            {activeTab === "mentors" && (
              <button
                onClick={() => setShowAddMentor(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded-lg shadow-sm shadow-amber-500/20 transition"
              >
                <span>+</span>
                <span>Add Faculty Mentor</span>
              </button>
            )}

            {activeTab === "hods" && (
              <button
                onClick={() => setShowAddHOD(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-purple-600 hover:bg-purple-700 rounded-lg shadow-sm shadow-purple-500/20 transition"
              >
                <span>+</span>
                <span>Add HOD</span>
              </button>
            )}
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 mt-4">
          <button
            onClick={() => {
              setActiveTab("students");
              onTabChange?.("students");
              setSearchQuery("");
            }}
            className={`flex items-center gap-2 py-3 px-5 border-b-2 font-medium text-xs transition ${
              activeTab === "students"
                ? "border-blue-600 text-blue-600 dark:text-blue-400 font-semibold"
                : "border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
            }`}
          >
            <span>Students</span>
            <span
              className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                activeTab === "students"
                  ? "bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300"
                  : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
              }`}
            >
              {students.length}
            </span>
          </button>

          <button
            onClick={() => {
              setActiveTab("mentors");
              onTabChange?.("mentors");
              setSearchQuery("");
            }}
            className={`flex items-center gap-2 py-3 px-5 border-b-2 font-medium text-xs transition ${
              activeTab === "mentors"
                ? "border-amber-600 text-amber-600 dark:text-amber-400 font-semibold"
                : "border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
            }`}
          >
            <span>Faculty Mentors</span>
            <span
              className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                activeTab === "mentors"
                  ? "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
                  : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
              }`}
            >
              {mentors.length}
            </span>
          </button>

          <button
            onClick={() => {
              setActiveTab("hods");
              onTabChange?.("hods");
              setSearchQuery("");
            }}
            className={`flex items-center gap-2 py-3 px-5 border-b-2 font-medium text-xs transition ${
              activeTab === "hods"
                ? "border-purple-600 text-purple-600 dark:text-purple-400 font-semibold"
                : "border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
            }`}
          >
            <span>Department Heads (HOD)</span>
            <span
              className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                activeTab === "hods"
                  ? "bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300"
                  : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
              }`}
            >
              {hods.length}
            </span>
          </button>
        </div>

        {/* Account Management → Email Verification */}
        <div className="mt-4 p-3.5 rounded-xl border border-blue-200/80 dark:border-blue-900/50 bg-blue-50/50 dark:bg-blue-950/20 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="p-1.5 rounded-lg bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-300">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </span>
            <div>
              <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                Account Management &bull; Firebase Email Verification
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Inspect verification status, send verification emails, or check account sync with Firebase Authentication
              </p>
            </div>
          </div>
          <Link
            href="/verify-email"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 shadow-xs transition shrink-0"
            id="btn-open-email-verification"
          >
            <span>Open Email Verification Portal</span>
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </Link>
        </div>

        {/* Filter & Search Bar */}
        <div className="pt-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3 text-xs">
          <div className="col-span-1 sm:col-span-2">
            <input
              type="text"
              placeholder={`Search ${activeTab} by name, email${activeTab === "students" ? ", register number..." : " or staff ID..."}`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <select
              value={deptFilter}
              onChange={(e) => setDeptFilter(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Departments</option>
              {distinctDepartments.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>

          <div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Statuses</option>
              <option value="active">Active Accounts Only</option>
              <option value="inactive">Inactive Accounts Only</option>
            </select>
          </div>

          {activeTab === "students" && (
            <div>
              <select
                value={yearFilter}
                onChange={(e) => setYearFilter(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Academic Years</option>
                <option value="1">Year 1</option>
                <option value="2">Year 2 (Cohort)</option>
                <option value="3">Year 3</option>
                <option value="4">Year 4</option>
              </select>
            </div>
          )}

          {activeTab === "students" && (
            <div className="sm:col-span-2 md:col-span-1">
              <select
                value={mentorFilter}
                onChange={(e) => setMentorFilter(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Mentors</option>
                <option value="unassigned">Unassigned Mentors Only</option>
                {mentors.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.full_name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Table Content */}
      <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 overflow-hidden">
        {loading ? (
          <div className="p-12 flex flex-col items-center justify-center space-y-3">
            <div className="w-8 h-8 rounded-full border-4 border-blue-600 border-t-transparent animate-spin" />
            <p className="text-xs text-slate-500 dark:text-slate-400">Loading directory database...</p>
          </div>
        ) : activeTab === "students" ? (
          /* ========================================== */
          /* STUDENTS TABLE */
          /* ========================================== */
          filteredStudents.length === 0 ? (
            <div className="p-12 text-center space-y-2">
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                No student records found
              </p>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                No students match your query. Try broadening your search or resetting filters.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800 font-medium">
                  <tr>
                    <th className="px-4 py-3">Register No</th>
                    <th className="px-4 py-3">Student Name & Email</th>
                    <th className="px-4 py-3">Dept & Class</th>
                    <th className="px-4 py-3">Assigned Mentor</th>
                    <th className="px-4 py-3">Submissions</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredStudents.map((s) => {
                    const mentorDisplayName = s.assigned_mentor?.full_name || s.original_mentor_name;
                    return (
                      <tr
                        key={s.id}
                        className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition group"
                      >
                        <td className="px-4 py-3 font-mono font-medium text-slate-900 dark:text-slate-200 whitespace-nowrap">
                          {s.register_number || <span className="text-slate-400 italic">None</span>}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-semibold text-slate-900 dark:text-white">
                              {s.full_name}
                            </span>
                            <DesignationBadge designation="Change Maker" size="sm" />
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate max-w-[200px]">
                            {s.email}
                          </div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className="font-semibold text-slate-800 dark:text-slate-300">
                            {s.department}
                          </span>
                          <span className="text-slate-400 ml-1">
                            (Yr {s.year} {s.section ? `• Sec ${s.section}` : ""})
                          </span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {mentorDisplayName ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/40 px-2 py-0.5 rounded-md border border-blue-200 dark:border-blue-900/40">
                              {mentorDisplayName}
                            </span>
                          ) : (
                            <span className="text-slate-400 italic text-[11px]">Unassigned</span>
                          )}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className="inline-flex items-center gap-1 font-mono text-[11px]">
                            <span className="font-bold text-slate-900 dark:text-white">
                              {s.submission_count}
                            </span>
                            <span className="text-slate-400 text-[10px]">
                              ({s.approved_count} app / {s.pending_count} pend)
                            </span>
                          </span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <button
                            onClick={() => handleToggleStudentStatus(s)}
                            title="Click to toggle active status"
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium transition ${
                              s.is_active
                                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-400 hover:bg-emerald-200"
                                : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 hover:bg-slate-200"
                            }`}
                          >
                            <span
                              className={`h-1.5 w-1.5 rounded-full ${
                                s.is_active ? "bg-emerald-500" : "bg-slate-400"
                              }`}
                            />
                            {s.is_active ? "Active" : "Inactive"}
                          </button>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleViewStudent(s.id)}
                              className="px-2.5 py-1 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded font-medium transition"
                            >
                              View
                            </button>
                            <button
                              onClick={() => setStudentToEdit(s)}
                              className="px-2.5 py-1 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded font-medium transition"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() =>
                                setUserToEditEmail({
                                  id: s.id,
                                  full_name: s.full_name,
                                  email: s.email,
                                  role: s.role,
                                })
                              }
                              className="px-2.5 py-1 text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40 rounded font-medium transition"
                              title="Edit user registered email"
                            >
                              Edit Email
                            </button>
                            <button
                              onClick={() => setStudentToDelete(s)}
                              className="px-2.5 py-1 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded font-medium transition"
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )
        ) : activeTab === "mentors" ? (
          /* ========================================== */
          /* MENTORS TABLE & 3-TIER HIERARCHY */
          /* ========================================== */
          <div className="p-4 sm:p-6 space-y-6">
            {/* 3-Tier Academic Mentorship Structure Banner */}
            <div className="bg-gradient-to-r from-blue-50 via-indigo-50/50 to-purple-50/40 dark:from-slate-800/80 dark:via-indigo-950/20 dark:to-purple-950/20 border border-blue-200/80 dark:border-blue-900/50 rounded-2xl p-5 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-blue-700 dark:text-blue-400">Academic Governance Structure</span>
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/60 text-blue-800 dark:text-blue-300 font-semibold">Tier 1 • Tier 2 • Supervisory</span>
                  </div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white mt-1">
                    3-Tier Mentorship &amp; Supervisory Academic Hierarchy
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                    Students are directly assigned to Faculty Mentors 1 &amp; 2, with the Department HOD serving as the institutional 3rd Supervisory Mentor across all department mentees.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                {/* Mentor 1 */}
                <div className="bg-white dark:bg-slate-800/90 rounded-xl p-3.5 border border-slate-200/80 dark:border-slate-700 shadow-xs flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between gap-1 mb-1.5">
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-blue-100 text-blue-800 dark:bg-blue-950/70 dark:text-blue-300">
                        Mentor 1 (Primary)
                      </span>
                      <DesignationBadge designation="Torch Bearer" size="sm" />
                    </div>
                    <div className="font-bold text-sm text-slate-900 dark:text-white">
                      {mentors[0]?.full_name || "P. LEKHA"}
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">
                      {mentors[0]?.department || "CCE"} • {mentors[0]?.email || "lekha.cce@sairam.edu.in"}
                    </div>
                  </div>
                  <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-700/60 flex items-center justify-between text-xs text-slate-600 dark:text-slate-300">
                    <span>Direct Cohort</span>
                    <span className="font-semibold text-blue-600 dark:text-blue-400">{mentors[0]?.assigned_student_count ?? 30} Mentees</span>
                  </div>
                </div>

                {/* Mentor 2 */}
                <div className="bg-white dark:bg-slate-800/90 rounded-xl p-3.5 border border-slate-200/80 dark:border-slate-700 shadow-xs flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between gap-1 mb-1.5">
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-indigo-100 text-indigo-800 dark:bg-indigo-950/70 dark:text-indigo-300">
                        Mentor 2 (Co-Mentor)
                      </span>
                      <DesignationBadge designation="Torch Bearer" size="sm" />
                    </div>
                    <div className="font-bold text-sm text-slate-900 dark:text-white">
                      {mentors[1]?.full_name || "LURDHUMARY J"}
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">
                      {mentors[1]?.department || "CCE"} • {mentors[1]?.email || "lurdhumary.cce@sairam.edu.in"}
                    </div>
                  </div>
                  <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-700/60 flex items-center justify-between text-xs text-slate-600 dark:text-slate-300">
                    <span>Direct Cohort</span>
                    <span className="font-semibold text-indigo-600 dark:text-indigo-400">{mentors[1]?.assigned_student_count ?? 31} Mentees</span>
                  </div>
                </div>

                {/* Mentor 3 / HOD Supervisory */}
                <div className="bg-white dark:bg-slate-800/90 rounded-xl p-3.5 border border-purple-200/80 dark:border-purple-800/50 shadow-xs flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between gap-1 mb-1.5">
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-purple-100 text-purple-800 dark:bg-purple-950/70 dark:text-purple-300">
                        Mentor 3 (Supervisory HOD)
                      </span>
                      <DesignationBadge designation="Torch Bearer" size="sm" />
                    </div>
                    <div className="font-bold text-sm text-slate-900 dark:text-white">
                      {hods[0]?.full_name || "Dr. Pachaiammal Alias Priya"}
                    </div>
                    <div className="text-[11px] text-purple-700 dark:text-purple-400 font-medium">
                      Head of Department • Department Supervisory Authority
                    </div>
                  </div>
                  <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-700/60 flex items-center justify-between text-xs text-slate-600 dark:text-slate-300">
                    <span>Department Scope</span>
                    <span className="font-semibold text-purple-600 dark:text-purple-400">All 61 Department Students</span>
                  </div>
                </div>
              </div>
            </div>

            {filteredMentors.length === 0 ? (
              <div className="p-12 text-center space-y-2">
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                  No faculty mentors found
                </p>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  No mentors match your query. Try broadening your search or resetting filters.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800 font-medium">
                    <tr>
                      <th className="px-4 py-3">Staff ID</th>
                      <th className="px-4 py-3">Mentor Name &amp; Designation</th>
                      <th className="px-4 py-3">Department &amp; Title</th>
                      <th className="px-4 py-3">Assigned Mentees</th>
                      <th className="px-4 py-3">Review Decisions</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {filteredMentors.map((m) => (
                      <tr
                        key={m.id}
                        className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition group"
                      >
                        <td className="px-4 py-3 font-mono font-medium text-slate-900 dark:text-slate-200 whitespace-nowrap">
                          {m.staff_id || <span className="text-slate-400 italic">None</span>}
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-semibold text-slate-900 dark:text-white flex items-center gap-1.5 flex-wrap">
                            {m.full_name}
                            <DesignationBadge designation="Torch Bearer" size="sm" />
                          </div>
                          <div className="text-[11px] text-slate-500 truncate max-w-[200px]">
                            {m.email}
                          </div>
                        </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="font-semibold text-slate-800 dark:text-slate-300">
                          {m.department}
                        </span>
                        <div className="text-slate-400 text-[11px]">
                          {m.designation || "Faculty Mentor"}
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-bold text-xs ${
                            m.assigned_student_count > 0
                              ? "bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300"
                              : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                          }`}
                        >
                          {m.assigned_student_count} Students
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="font-mono text-slate-700 dark:text-slate-300 font-semibold">
                          {m.reviews_count}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <button
                          onClick={() => handleToggleMentorStatus(m)}
                          title="Click to toggle active status"
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium transition ${
                            m.is_active
                              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-400 hover:bg-emerald-200"
                              : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 hover:bg-slate-200"
                          }`}
                        >
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${
                              m.is_active ? "bg-emerald-500" : "bg-slate-400"
                            }`}
                          />
                          {m.is_active ? "Active" : "Inactive"}
                        </button>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleViewMentor(m.id)}
                            className="px-2.5 py-1 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded font-medium transition"
                          >
                            View
                          </button>
                          <button
                            onClick={() => setMentorToReassign(m)}
                            className="px-2.5 py-1 text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-950/40 rounded font-medium transition"
                            title="Reassign mentees to another faculty member"
                          >
                            Reassign
                          </button>
                          <button
                            onClick={() => setMentorToEdit(m)}
                            className="px-2.5 py-1 text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40 rounded font-medium transition"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() =>
                              setUserToEditEmail({
                                id: m.id,
                                full_name: m.full_name,
                                email: m.email,
                                role: m.role,
                              })
                            }
                            className="px-2.5 py-1 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-950/60 rounded font-medium transition"
                            title="Edit mentor registered email"
                          >
                            Edit Email
                          </button>
                          <button
                            onClick={() => setMentorToDelete(m)}
                            className="px-2.5 py-1 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded font-medium transition"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
          /* ========================================== */
          /* HOD TABLE */
          /* ========================================== */
          filteredHods.length === 0 ? (
            <div className="p-12 text-center space-y-2">
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                No Head of Department records found
              </p>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                No HOD accounts match your query. Try resetting filters or adding an HOD for your departments.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800 font-medium">
                  <tr>
                    <th className="px-4 py-3">Staff ID</th>
                    <th className="px-4 py-3">HOD Name & Email</th>
                    <th className="px-4 py-3">Department & Designation</th>
                    <th className="px-4 py-3">Department Reviews</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredHods.map((h) => (
                    <tr
                      key={h.id}
                      className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition group"
                    >
                      <td className="px-4 py-3 font-mono font-medium text-slate-900 dark:text-slate-200 whitespace-nowrap">
                        {h.staff_id || <span className="text-slate-400 italic">None</span>}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-900 dark:text-white flex items-center gap-1.5 flex-wrap">
                          {h.full_name}
                          <DesignationBadge designation="Torch Bearer" size="sm" />
                        </div>
                        <div className="text-[11px] text-slate-500 truncate max-w-[200px]">
                          {h.email}
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="font-semibold text-purple-700 dark:text-purple-300">
                          {h.department}
                        </span>
                        <div className="text-slate-400 text-[11px]">
                          {h.designation || "Professor & Head"}
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="font-mono text-slate-700 dark:text-slate-300 font-semibold">
                          {h.reviews_count}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <button
                          onClick={() => handleToggleHODStatus(h)}
                          title="Click to toggle active status"
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium transition ${
                            h.is_active
                              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-400 hover:bg-emerald-200"
                              : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 hover:bg-slate-200"
                          }`}
                        >
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${
                              h.is_active ? "bg-emerald-500" : "bg-slate-400"
                            }`}
                          />
                          {h.is_active ? "Active" : "Inactive"}
                        </button>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleViewHOD(h.id)}
                            className="px-2.5 py-1 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded font-medium transition"
                          >
                            View
                          </button>
                          <button
                            onClick={() => setHodToEdit(h)}
                            className="px-2.5 py-1 text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-950/40 rounded font-medium transition"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() =>
                              setUserToEditEmail({
                                id: h.id,
                                full_name: h.full_name,
                                email: h.email,
                                role: h.role,
                              })
                            }
                            className="px-2.5 py-1 text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40 rounded font-medium transition"
                            title="Edit HOD registered email"
                          >
                            Edit Email
                          </button>
                          <button
                            onClick={() => setHodToDelete(h)}
                            className="px-2.5 py-1 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded font-medium transition"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}
      </div>

      {/* ========================================== */}
      {/* STUDENT MODALS */}
      {/* ========================================== */}
      <ViewStudentModal
        student={selectedStudentDetail}
        onClose={() => setSelectedStudentDetail(null)}
      />

      {showAddStudent && (
        <AddStudentModal
          mentors={mentors}
          onClose={() => setShowAddStudent(false)}
          onSubmit={handleAddStudent}
        />
      )}

      <EditStudentModal
        student={studentToEdit}
        mentors={mentors}
        onClose={() => setStudentToEdit(null)}
        onSubmit={handleEditStudent}
      />

      <DeleteStudentModal
        student={studentToDelete}
        onClose={() => setStudentToDelete(null)}
        onConfirm={handleDeleteStudent}
      />

      {/* ========================================== */}
      {/* MENTOR MODALS */}
      {/* ========================================== */}
      <ViewMentorModal
        mentor={selectedMentorDetail}
        onClose={() => setSelectedMentorDetail(null)}
      />

      {showAddMentor && (
        <AddMentorModal
          onClose={() => setShowAddMentor(false)}
          onSubmit={handleAddMentor}
        />
      )}

      <EditMentorModal
        mentor={mentorToEdit}
        onClose={() => setMentorToEdit(null)}
        onSubmit={handleEditMentor}
      />

      <ReassignStudentsModal
        sourceMentor={mentorToReassign}
        allMentors={mentors}
        onClose={() => setMentorToReassign(null)}
        onSubmit={handleReassignMentorStudents}
      />

      <DeleteMentorModal
        mentor={mentorToDelete}
        allMentors={mentors}
        onClose={() => setMentorToDelete(null)}
        onConfirm={handleDeleteMentor}
      />

      {/* ========================================== */}
      {/* HOD MODALS */}
      {/* ========================================== */}
      <ViewHODModal
        hod={selectedHODDetail}
        onClose={() => setSelectedHODDetail(null)}
      />

      <AddHODModal
        isOpen={showAddHOD}
        onClose={() => setShowAddHOD(false)}
        onSubmit={handleAddHOD}
        existingDepartments={distinctDepartments}
      />

      <EditHODModal
        hod={hodToEdit}
        onClose={() => setHodToEdit(null)}
        onSubmit={handleEditHOD}
        existingDepartments={distinctDepartments}
      />

      <DeleteHODModal
        hod={hodToDelete}
        currentUser={user}
        allMentors={mentors}
        allHODs={hods}
        onClose={() => setHodToDelete(null)}
        onConfirm={handleDeleteHOD}
      />

      <BulkProvisioningModal
        isOpen={showProvisioningModal}
        onClose={() => {
          setShowProvisioningModal(false);
          fetchAllData();
        }}
        onSuccess={() => fetchAllData()}
      />

      <EditUserEmailModal
        user={userToEditEmail}
        onClose={() => setUserToEditEmail(null)}
        onSuccess={(res) => {
          setSuccessMessage(
            `Email for ${res.full_name} updated to ${res.new_email} (${res.status === "pending_verification" ? "pending verification" : "completed"}).`
          );
          fetchAllData();
        }}
      />
    </div>
  );
};
