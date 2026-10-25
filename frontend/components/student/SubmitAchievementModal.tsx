"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import { PGPAComponentResponse, AchievementCreate, SemesterResponse } from "@/types/achievement";
import { api } from "@/lib/api-client";

interface SubmitAchievementModalProps {
  isOpen: boolean;
  onClose: () => void;
  components: PGPAComponentResponse[];
  initialComponentId?: string | null;
  onSubmit: (
    data: AchievementCreate,
    evidenceFile: File | null,
    submitImmediately: boolean
  ) => Promise<void>;
}

interface FormContentProps {
  components: PGPAComponentResponse[];
  initialComponentId?: string | null;
  onSubmit: (
    data: AchievementCreate,
    evidenceFile: File | null,
    submitImmediately: boolean
  ) => Promise<void>;
  onClose: () => void;
}

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MiB

const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

// ==============================================================================
// Authoritative Evaluation & Rubric Helpers
// ==============================================================================

// Table 7.1 Clubs & Cells Point Allocation
export const calculateTable71Points = (roleCategory: string, eventLevel?: string): number => {
  const cat = (roleCategory || "").trim().toLowerCase();
  const lvl = (eventLevel || "").trim().toLowerCase();

  if (cat.includes("magic")) return 200;
  if (cat.includes("coordinator")) return 200;
  if (cat.includes("volunteer")) return 100;
  if (cat.includes("member") && !cat.includes("participation") && !cat.includes("winner")) return 100;

  if (cat.includes("winner")) {
    if (lvl.includes("other country")) return 700;
    if (lvl.includes("international")) return 600;
    if (lvl.includes("national")) return 500;
    if (lvl.includes("state")) return 300;
    return 200; // Within College
  }

  if (cat.includes("participation") || cat.includes("participant") || cat.includes("event")) {
    if (lvl.includes("other country")) return 500;
    if (lvl.includes("international")) return 400;
    if (lvl.includes("national")) return 300;
    if (lvl.includes("state")) return 200;
    return 100; // Within College
  }

  return 100;
};

// Table B Score/GPA to Grade Mapping
export const scoreToGradeTableB = (score: number): { grade: string; points: number } => {
  if (score >= 9.0) return { grade: "O", points: 10 };
  if (score >= 7.0) return { grade: "A+", points: 9 };
  if (score >= 4.0) return { grade: "A", points: 7 };
  if (score >= 2.0) return { grade: "B+", points: 5 };
  if (score >= 1.0) return { grade: "B", points: 3 };
  return { grade: "C", points: 1 };
};

// Institutional Clubs list
const INSTITUTIONAL_CLUBS = [
  "Rotaract Club",
  "Leo Club",
  "IEEE Student Branch",
  "CSI Student Chapter",
  "NCC (National Cadet Corps)",
  "NSS (National Service Scheme)",
  "EDC (Entrepreneurship Development Cell)",
  "Women Empowerment Cell",
  "Fine Arts Club",
  "Tamil Mandram",
  "English Literary Club",
  "Yuva Tourism Club",
  "Other Club / Cell",
];

const SubmitAchievementFormContent: React.FC<FormContentProps> = ({
  components,
  initialComponentId,
  onSubmit,
  onClose,
}) => {
  const [componentId, setComponentId] = useState<string>(
    () => initialComponentId || components[0]?.id || ""
  );
  const [activeComponents, setActiveComponents] = useState<PGPAComponentResponse[]>(components);
  const [semesters, setSemesters] = useState<SemesterResponse[]>([]);
  const [semesterLoading, setSemesterLoading] = useState<boolean>(true);
  const [semesterId, setSemesterId] = useState<string>("");

  // Component-specific form state fields
  // 1. Academics
  const [gpa, setGpa] = useState<string>("");

  // 2. Clubs & Cells
  const [clubName, setClubName] = useState<string>(INSTITUTIONAL_CLUBS[0]);
  const [customClubName, setCustomClubName] = useState<string>("");
  const [clubRoleCategory, setClubRoleCategory] = useState<string>("Member");
  const [clubEventLevel, setClubEventLevel] = useState<string>("Within College");
  const [clubActivityTitle, setClubActivityTitle] = useState<string>("");
  const [clubDate, setClubDate] = useState<string>(() => new Date().toISOString().split("T")[0]);

  // 3. Skillrack
  const [skillrackPoints, setSkillrackPoints] = useState<string>("");
  const [skillrackMilestone, setSkillrackMilestone] = useState<string>("");
  const [skillrackDate, setSkillrackDate] = useState<string>(() => new Date().toISOString().split("T")[0]);

  // 4. AMCAT
  const [amcatScore, setAmcatScore] = useState<string>("");
  const [amcatTitle, setAmcatTitle] = useState<string>("");
  const [amcatDate, setAmcatDate] = useState<string>(() => new Date().toISOString().split("T")[0]);

  // 5. Internship
  const [internCompany, setInternCompany] = useState<string>("");
  const [internClassification, setInternClassification] = useState<string>("Core / with stipend");
  const [internDomain, setInternDomain] = useState<string>("");
  const [internDuration, setInternDuration] = useState<string>("8 Weeks");
  const [internPerformanceGrade, setInternPerformanceGrade] = useState<string>("O");
  const [internDate, setInternDate] = useState<string>(() => new Date().toISOString().split("T")[0]);

  // 6. Sairam SDG Action Programme
  const [sapCategory, setSapCategory] = useState<string>("16h Drill (40 pts)");
  const [sapPoints, setSapPoints] = useState<string>("40");
  const [sapTitle, setSapTitle] = useState<string>("");
  const [sapDate, setSapDate] = useState<string>(() => new Date().toISOString().split("T")[0]);

  // 7. Sairam Innovation Eco-System
  const [innovEventName, setInnovEventName] = useState<string>("Innovathon");
  const [innovCategory, setInnovCategory] = useState<string>("SDG wise winners 51 teams");
  const [innovTitle, setInnovTitle] = useState<string>("");
  const [innovDate, setInnovDate] = useState<string>(() => new Date().toISOString().split("T")[0]);

  // 8. SAIL
  const [sailPoints, setSailPoints] = useState<string>("");
  const [sailModule, setSailModule] = useState<string>("");
  const [sailDate, setSailDate] = useState<string>(() => new Date().toISOString().split("T")[0]);

  // 9. Sports & Games
  const [sportName, setSportName] = useState<string>("");
  const [sportLevel, setSportLevel] = useState<string>("State Level");
  const [sportIsInternational, setSportIsInternational] = useState<boolean>(false);
  const [sportPoints, setSportPoints] = useState<string>("95");
  const [sportDate, setSportDate] = useState<string>(() => new Date().toISOString().split("T")[0]);

  // 10. Online Certifications
  const [onlineCourse, setOnlineCourse] = useState<string>("");
  const [onlineProvider, setOnlineProvider] = useState<string>("IITB Spoken Tutorials");
  const [onlineCategory, setOnlineCategory] = useState<string>("Elite with Gold");
  const [onlineDate, setOnlineDate] = useState<string>(() => new Date().toISOString().split("T")[0]);

  // 11. NPTEL
  const [nptelCourse, setNptelCourse] = useState<string>("");
  const [nptelDuration, setNptelDuration] = useState<string>("12 Weeks");
  const [nptelCategory, setNptelCategory] = useState<string>("Elite (60-74%)");
  const [nptelScore, setNptelScore] = useState<string>("");
  const [nptelDate, setNptelDate] = useState<string>(() => new Date().toISOString().split("T")[0]);

  // 12. GATE
  const [gateRegNumber, setGateRegNumber] = useState<string>("");
  const [gateCategory, setGateCategory] = useState<string>("Score (>400)");
  const [gateScore, setGateScore] = useState<string>("");
  const [gateDate, setGateDate] = useState<string>(() => new Date().toISOString().split("T")[0]);

  // 13. Scouts for SDGs
  const [scoutsCategory, setScoutsCategory] = useState<string>("Service (20 hrs)");
  const [scoutsHours, setScoutsHours] = useState<string>("20");
  const [scoutsTitle, setScoutsTitle] = useState<string>("");
  const [scoutsDate, setScoutsDate] = useState<string>(() => new Date().toISOString().split("T")[0]);

  // 14. FIT INDIA
  const [fitIndiaTitle, setFitIndiaTitle] = useState<string>("");
  const [fitIndiaScore, setFitIndiaScore] = useState<string>("");
  const [fitIndiaDate, setFitIndiaDate] = useState<string>(() => new Date().toISOString().split("T")[0]);

  // Evidence PDF file state
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submissionStep, setSubmissionStep] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  // Load available semesters on mount
  useEffect(() => {
    let isMounted = true;
    api.studentGetSemesters()
      .then((sems) => {
        if (!isMounted) return;
        setSemesters(sems);
        if (sems.length > 0) {
          setSemesterId(sems[0].id);
        }
      })
      .catch((err) => {
        console.error("Failed to load available semesters:", err);
      })
      .finally(() => {
        if (isMounted) setSemesterLoading(false);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  // When semesterId changes, load components and availability for that semester
  useEffect(() => {
    if (!semesterId) return;
    let isMounted = true;
    api.getComponents(semesterId)
      .then((comps) => {
        if (!isMounted) return;
        setActiveComponents(comps);
        if (comps.length > 0 && !comps.some((c) => c.id === componentId)) {
          setComponentId(comps[0].id);
        }
      })
      .catch((err) => {
        console.error("Failed to load components for semester:", err);
      });
    return () => {
      isMounted = false;
    };
  }, [semesterId]);

  const currentComponent = useMemo(() => {
    return activeComponents.find((c) => c.id === componentId) || activeComponents[0] || components[0];
  }, [activeComponents, componentId, components]);

  const pdfRequirement = currentComponent?.pdf_requirement || (currentComponent?.pdf_required ? "required" : "optional");
  const isPdfRequired = pdfRequirement === "required";
  const isPdfDisabled = pdfRequirement === "disabled";
  const allowOtherEvidence = currentComponent?.allow_other_evidence_types ?? false;

  const isComponentLocked = useMemo(() => {
    if (!currentComponent) return false;
    return currentComponent.is_enabled_for_semester === false || currentComponent.submission_mode === "hod_excel_import";
  }, [currentComponent]);

  const currentSlug = currentComponent?.slug?.toLowerCase() || "";
  const selectedSemester = semesters.find((s) => s.id === semesterId);

  // Clean reinitialization when componentId changes
  useEffect(() => {
    setError(null);
    setFileError(null);
  }, [componentId]);

  // Sync SAP points default when SAP category changes
  useEffect(() => {
    if (sapCategory.includes("10 pts")) setSapPoints("10");
    else if (sapCategory.includes("15 pts")) setSapPoints("15");
    else if (sapCategory.includes("30 pts")) setSapPoints("30");
    else if (sapCategory.includes("40 pts")) setSapPoints("40");
    else if (sapCategory.includes("75 pts")) setSapPoints("75");
  }, [sapCategory]);

  // Table 7.1 Calculated points for Clubs & Cells
  const clubsCalculatedPoints = useMemo(() => {
    return calculateTable71Points(clubRoleCategory, clubEventLevel);
  }, [clubRoleCategory, clubEventLevel]);

  // Validate and set chosen file
  const handleFileSelect = (file: File | null) => {
    if (!file) {
      setEvidenceFile(null);
      setFileError(null);
      return;
    }

    const fileNameLower = file.name.toLowerCase();
    const hasPdfExtension = fileNameLower.endsWith(".pdf");
    const isPdfMime = file.type === "application/pdf" || file.type === "";
    const isImage = file.type.startsWith("image/") || /\.(png|jpe?g|webp)$/i.test(fileNameLower);

    if (!allowOtherEvidence && !hasPdfExtension && !isPdfMime) {
      setEvidenceFile(null);
      setFileError("Only PDF documents (.pdf) are accepted for this component. Please select a valid PDF file.");
      return;
    }

    if (allowOtherEvidence && !hasPdfExtension && !isPdfMime && !isImage) {
      setEvidenceFile(null);
      setFileError("Accepted file formats are PDF or image files (.pdf, .png, .jpg). Please select a valid document.");
      return;
    }

    if (file.size === 0) {
      setEvidenceFile(null);
      setFileError("The selected evidence file is empty (0 bytes). Please select a valid evidence document.");
      return;
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      setEvidenceFile(null);
      setFileError(
        `File size (${(file.size / (1024 * 1024)).toFixed(2)} MB) exceeds the maximum allowed limit of 5 MB.`
      );
      return;
    }

    setEvidenceFile(file);
    setFileError(null);
    setError(null);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  // Build component-specific submission payload
  const buildPayload = (): AchievementCreate => {
    const semNumber = selectedSemester?.semester_number || 1;
    let payload: AchievementCreate = {
      component_id: componentId,
      semester_id: semesterId,
      title: "",
      component_metadata: {},
    };

    switch (currentSlug) {
      case "academics-gpa": {
        const numGpa = parseFloat(gpa);
        if (isNaN(numGpa) || numGpa < 0.0 || numGpa > 10.0) {
          throw new Error("Please enter a valid GPA between 0.00 and 10.00.");
        }
        payload = {
          component_id: componentId,
          semester_id: semesterId,
          title: `Semester ${semNumber} GPA: ${numGpa.toFixed(2)}`,
          activity_type: "Semester GPA",
          outcome: numGpa.toFixed(2),
          component_metadata: {
            gpa: numGpa,
          },
        };
        break;
      }

      case "clubs-and-cells": {
        const effectiveClub = clubName === "Other Club / Cell" ? customClubName.trim() : clubName;
        if (!effectiveClub) {
          throw new Error("Please select or enter the Club / Cell name.");
        }
        const effectiveTitle = clubActivityTitle.trim() || `${effectiveClub} ${clubRoleCategory}`;
        payload = {
          component_id: componentId,
          semester_id: semesterId,
          title: effectiveTitle,
          activity_type: clubRoleCategory,
          organizer: effectiveClub,
          event_date: clubDate || undefined,
          outcome: `${clubsCalculatedPoints} Points (${clubRoleCategory})`,
          component_metadata: {
            club_name: effectiveClub,
            role_category: clubRoleCategory,
            event_level: (clubRoleCategory === "Event Participation" || clubRoleCategory === "Winner") ? clubEventLevel : undefined,
            activity_title: clubActivityTitle.trim(),
            points: clubsCalculatedPoints,
          },
        };
        break;
      }

      case "skillrack": {
        const pts = parseFloat(skillrackPoints);
        if (isNaN(pts) || pts < 0) {
          throw new Error("Please enter valid cumulative Skillrack points (>= 0).");
        }
        const title = skillrackMilestone.trim() || `Skillrack Coding Practice (${pts} pts)`;
        payload = {
          component_id: componentId,
          semester_id: semesterId,
          title,
          activity_type: "Coding Assessment",
          organizer: "Skillrack",
          event_date: skillrackDate || undefined,
          outcome: `${pts} Points`,
          component_metadata: {
            points: pts,
            milestone_title: skillrackMilestone.trim(),
          },
        };
        break;
      }

      case "amcat": {
        const sc = parseFloat(amcatScore);
        if (isNaN(sc) || sc < 0.0 || sc > 10.0) {
          throw new Error("Please enter a valid AMCAT score between 0.0 and 10.0.");
        }
        const title = amcatTitle.trim() || `AMCAT Assessment — Score ${sc.toFixed(1)}/10.0`;
        payload = {
          component_id: componentId,
          semester_id: semesterId,
          title,
          activity_type: "Employability Assessment",
          organizer: "Aspiring Minds / SHL AMCAT",
          event_date: amcatDate || undefined,
          outcome: `Score ${sc.toFixed(1)} / 10.0`,
          component_metadata: {
            score: sc,
            assessment_title: amcatTitle.trim(),
          },
        };
        break;
      }

      case "internship": {
        if (!internCompany.trim()) {
          throw new Error("Please enter the Host Company / Organization name.");
        }
        const title = `Internship at ${internCompany.trim()} (${internClassification})`;
        payload = {
          component_id: componentId,
          semester_id: semesterId,
          title,
          activity_type: internClassification,
          organizer: internCompany.trim(),
          event_date: internDate || undefined,
          outcome: internClassification,
          component_metadata: {
            organizer: internCompany.trim(),
            company_type: internClassification,
            domain: internDomain.trim(),
            duration: internDuration.trim(),
            performance_grade: internPerformanceGrade || undefined,
          },
        };
        break;
      }

      case "sairam-sdg-action-programme": {
        const pts = parseFloat(sapPoints);
        if (isNaN(pts) || pts < 0) {
          throw new Error("Please enter valid SAP points (>= 0).");
        }
        const title = sapTitle.trim() || `Sairam SAP: ${sapCategory}`;
        payload = {
          component_id: componentId,
          semester_id: semesterId,
          title,
          activity_type: sapCategory,
          organizer: "Sairam SDG Action Cell",
          event_date: sapDate || undefined,
          outcome: `${pts} Points`,
          component_metadata: {
            category: sapCategory,
            points: pts,
            activity_title: sapTitle.trim(),
          },
        };
        break;
      }

      case "sairam-innovation-eco-system": {
        if (!innovTitle.trim()) {
          throw new Error("Please enter the Project / Innovation Title.");
        }
        const title = `${innovEventName}: ${innovTitle.trim()}`;
        payload = {
          component_id: componentId,
          semester_id: semesterId,
          title,
          activity_type: innovCategory,
          organizer: "Sairam Innovation Eco-System",
          event_date: innovDate || undefined,
          outcome: innovCategory,
          component_metadata: {
            event_name: innovEventName,
            category: innovCategory,
            project_title: innovTitle.trim(),
          },
        };
        break;
      }

      case "sail": {
        const pts = parseFloat(sailPoints);
        if (isNaN(pts) || pts < 0) {
          throw new Error("Please enter valid cumulative SAIL points (>= 0).");
        }
        const title = sailModule.trim() || `SAIL AI Learning Milestone (${pts} pts)`;
        payload = {
          component_id: componentId,
          semester_id: semesterId,
          title,
          activity_type: "AI Learning Module",
          organizer: "SAIL",
          event_date: sailDate || undefined,
          outcome: `${pts} Points`,
          component_metadata: {
            points: pts,
            module_title: sailModule.trim(),
          },
        };
        break;
      }

      case "sports-and-games": {
        if (!sportName.trim()) {
          throw new Error("Please enter the Sport / Game Discipline.");
        }
        const pts = parseFloat(sportPoints);
        if (isNaN(pts) || pts < 0) {
          throw new Error("Please enter valid sports points (>= 0).");
        }
        const title = `${sportName.trim()} — ${sportLevel}`;
        payload = {
          component_id: componentId,
          semester_id: semesterId,
          title,
          activity_type: sportLevel,
          organizer: "Sports & Athletics Department",
          event_date: sportDate || undefined,
          outcome: `${pts} Points${sportIsInternational ? " (International)" : ""}`,
          component_metadata: {
            sport_name: sportName.trim(),
            event_level: sportLevel,
            is_international: sportIsInternational,
            points: pts,
          },
        };
        break;
      }

      case "online-certifications": {
        if (!onlineCourse.trim()) {
          throw new Error("Please enter the certification course title.");
        }
        const title = `${onlineCourse.trim()} (${onlineProvider})`;
        payload = {
          component_id: componentId,
          semester_id: semesterId,
          title,
          activity_type: onlineProvider,
          organizer: onlineProvider,
          event_date: onlineDate || undefined,
          outcome: onlineCategory,
          component_metadata: {
            course_name: onlineCourse.trim(),
            provider: onlineProvider,
            category: onlineCategory,
          },
        };
        break;
      }

      case "nptel-non-credit-transfer": {
        if (!nptelCourse.trim()) {
          throw new Error("Please enter the NPTEL Course Title.");
        }
        const title = `NPTEL: ${nptelCourse.trim()} (${nptelDuration})`;
        const numScore = nptelScore.trim() ? parseFloat(nptelScore) : undefined;
        payload = {
          component_id: componentId,
          semester_id: semesterId,
          title,
          activity_type: "NPTEL Course",
          organizer: "NPTEL / SWAYAM",
          event_date: nptelDate || undefined,
          outcome: nptelCategory,
          component_metadata: {
            course_name: nptelCourse.trim(),
            duration: nptelDuration,
            category: nptelCategory,
            score: numScore,
          },
        };
        break;
      }

      case "gate": {
        if (!gateRegNumber.trim()) {
          throw new Error("Please enter the official GATE registration or roll number.");
        }
        const title = `GATE Examination — ${gateCategory}`;
        const numScore = gateScore.trim() ? parseFloat(gateScore) : undefined;
        payload = {
          component_id: componentId,
          semester_id: semesterId,
          title,
          activity_type: "National Entrance Exam",
          organizer: "IIT GATE Organizing Committee",
          event_date: gateDate || undefined,
          outcome: gateCategory,
          component_metadata: {
            registration_number: gateRegNumber.trim(),
            category: gateCategory,
            score: numScore,
          },
        };
        break;
      }

      case "scouts-for-sdgs": {
        const title = scoutsTitle.trim() || `Scouts for SDGs: ${scoutsCategory}`;
        const numHours = scoutsHours.trim() ? parseFloat(scoutsHours) : undefined;
        payload = {
          component_id: componentId,
          semester_id: semesterId,
          title,
          activity_type: scoutsCategory,
          organizer: "The Bharat Scouts & Guides",
          event_date: scoutsDate || undefined,
          outcome: scoutsCategory,
          component_metadata: {
            category: scoutsCategory,
            hours: numHours,
            activity_title: scoutsTitle.trim(),
          },
        };
        break;
      }

      case "fit-india-certifications": {
        if (!fitIndiaTitle.trim()) {
          throw new Error("Please enter the Fit India Challenge / Activity Name.");
        }
        const pts = parseFloat(fitIndiaScore);
        if (isNaN(pts) || pts < 0) {
          throw new Error("Please enter a valid Fit India score (>= 0).");
        }
        const title = `FIT INDIA: ${fitIndiaTitle.trim()}`;
        payload = {
          component_id: componentId,
          semester_id: semesterId,
          title,
          activity_type: "Fitness Initiative",
          organizer: "Ministry of Youth Affairs and Sports",
          event_date: fitIndiaDate || undefined,
          outcome: `Score ${pts} / 100`,
          component_metadata: {
            activity_title: fitIndiaTitle.trim(),
            score: pts,
          },
        };
        break;
      }

      default: {
        payload = {
          component_id: componentId,
          semester_id: semesterId,
          title: `${currentComponent.name} Submission`,
          component_metadata: {},
        };
        break;
      }
    }

    return payload;
  };

  const handleSubmit = async (submitImmediately: boolean) => {
    if (!semesterId) {
      setError("Please select an academic semester.");
      return;
    }
    if (!componentId) {
      setError("Please select a PGPA component.");
      return;
    }
    if (isComponentLocked) {
      const reason = currentComponent?.lock_reason || `This component is currently unavailable for ${selectedSemester?.display_name || "the selected semester"}.`;
      setError(reason);
      return;
    }
    if (isPdfRequired && submitImmediately && !evidenceFile) {
      const evidenceName = currentSlug === "academics-gpa" ? "Semester Marksheet / Grade Sheet PDF" : "Supporting Evidence PDF";
      setError(`${evidenceName} is required by institutional policy for ${currentComponent.name}. Please attach a valid PDF document before submitting.`);
      setFileError(`${evidenceName} is required.`);
      if (fileInputRef.current) {
        fileInputRef.current.focus();
      }
      return;
    }
    if (fileError) {
      setError(fileError);
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      setSubmissionStep(
        evidenceFile
          ? submitImmediately
            ? "Uploading evidence to Google Drive and submitting for mentor review..."
            : "Uploading evidence to Google Drive and saving draft..."
          : submitImmediately
            ? "Submitting achievement for mentor review..."
            : "Saving draft achievement..."
      );

      const payload = buildPayload();
      await onSubmit(payload, evidenceFile, submitImmediately);
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to record achievement and upload evidence.";
      setError(msg);
    } finally {
      setIsSubmitting(false);
      setSubmissionStep("");
    }
  };

  return (
    <div className="relative w-full max-w-xl max-h-[92vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl bg-white dark:bg-[#171E28] p-5 sm:p-7 text-left shadow-2xl transition-all border border-slate-200 dark:border-[#2B3543] custom-scrollbar">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-[#2B3543]">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-[#E8EDF4]">
              {currentSlug === "academics-gpa" ? "Record Semester GPA" : "Submit PGPA Achievement"}
            </h2>
            <span className="rounded-full bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 text-[10px] font-bold text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
              {currentComponent?.credit_value ?? 3} Credits
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-[#7E8B9C] mt-0.5">
            {currentSlug === "academics-gpa"
              ? "Enter your verified university semester GPA and attach your marksheet."
              : `Component-driven evaluation form for ${currentComponent?.name || "selected activity"}.`}
          </p>
        </div>

        <button
          type="button"
          onClick={onClose}
          disabled={isSubmitting}
          className="rounded-lg p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#1C2531] transition-colors cursor-pointer min-h-[36px] min-w-[36px] flex items-center justify-center"
          aria-label="Close modal"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Form Body */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSubmit(true);
        }}
        className="mt-4 space-y-4 text-xs"
      >
        {error && (
          <div className="rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50/80 dark:bg-rose-950/40 p-3 text-xs text-rose-700 dark:text-rose-300 flex items-start gap-2">
            <svg className="h-4 w-4 shrink-0 text-rose-500 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div className="flex-1 font-medium leading-relaxed">{error}</div>
          </div>
        )}

        {/* Top Selectors: Semester and Component */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Semester Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-[#A0ACBC] uppercase tracking-wider mb-1">
              Academic Semester *
            </label>
            <select
              value={semesterId}
              onChange={(e) => setSemesterId(e.target.value)}
              disabled={isSubmitting || semesterLoading || semesters.length === 0}
              required
              className="w-full rounded-xl border border-slate-300 dark:border-[#2B3543] bg-white dark:bg-[#1C2531] px-3 py-2 text-xs font-semibold text-slate-900 dark:text-[#E8EDF4] focus:border-blue-500 focus:ring-1 focus:ring-blue-500 min-h-[38px]"
            >
              {semesterLoading ? (
                <option value="">Loading active semesters...</option>
              ) : semesters.length === 0 ? (
                <option value="">No semesters currently open</option>
              ) : (
                semesters.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.display_name} (Semester {s.semester_number})
                  </option>
                ))
              )}
            </select>
          </div>

          {/* Component Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-[#A0ACBC] uppercase tracking-wider mb-1">
              PGPA Component *
            </label>
            <select
              value={componentId}
              onChange={(e) => setComponentId(e.target.value)}
              disabled={isSubmitting}
              required
              className="w-full rounded-xl border border-slate-300 dark:border-[#2B3543] bg-white dark:bg-[#1C2531] px-3 py-2 text-xs font-semibold text-slate-900 dark:text-[#E8EDF4] focus:border-blue-500 focus:ring-1 focus:ring-blue-500 min-h-[38px]"
            >
              {activeComponents.map((c) => {
                const isLocked = c.is_enabled_for_semester === false || c.submission_mode === "hod_excel_import";
                return (
                  <option key={c.id} value={c.id}>
                    #{String(c.display_order).padStart(2, "0")} — {c.name} {isLocked ? `🔒 [Locked for ${selectedSemester?.display_name || "Semester"}]` : `(${c.credit_value ?? 3} Cr)`}
                  </option>
                );
              })}
            </select>
          </div>
        </div>

        {/* Lock Warning Banner if selected component is unavailable */}
        {isComponentLocked && (
          <div className="rounded-xl border border-amber-300 dark:border-amber-700/60 bg-amber-50 dark:bg-amber-950/40 p-3.5 text-xs text-amber-800 dark:text-amber-200 flex items-start gap-2.5">
            <svg className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            <div>
              <div className="font-bold text-amber-900 dark:text-amber-100 flex items-center gap-1.5">
                <span>Component Locked</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-200 dark:bg-amber-900/60 font-semibold">
                  {selectedSemester?.display_name || "Selected Semester"}
                </span>
              </div>
              <p className="mt-1 leading-relaxed">
                {currentComponent?.lock_reason || `This component is currently unavailable for ${selectedSemester?.display_name || "the selected semester"}.`}
              </p>
            </div>
          </div>
        )}

        {/* ==================================================================== */}
        {/* Component-Specific Form Sections (Render ONLY Relevant Fields)     */}
        {/* ==================================================================== */}

        {/* 1. ACADEMICS (GPA ONLY) */}
        {currentSlug === "academics-gpa" && (
          <div className="rounded-xl border border-indigo-200 dark:border-indigo-900/60 bg-indigo-50/40 dark:bg-indigo-950/20 p-4 space-y-3.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-indigo-900 dark:text-indigo-300 uppercase tracking-wider">
                University Semester GPA Evaluation
              </span>
              <span className="text-[10px] font-semibold text-indigo-700 dark:text-indigo-400">
                Table B Scale &bull; 40% PGPA Weight
              </span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-[#A0ACBC] mb-1">
                Semester Grade Point Average (GPA) *
              </label>
              <input
                type="number"
                step="0.01"
                min="0.00"
                max="10.00"
                required
                disabled={isSubmitting}
                placeholder="e.g. 8.75"
                value={gpa}
                onChange={(e) => setGpa(e.target.value)}
                className="w-full rounded-xl border border-slate-300 dark:border-[#2B3543] bg-white dark:bg-[#1C2531] px-3 py-2 text-sm font-semibold text-slate-900 dark:text-[#E8EDF4] focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 min-h-[40px]"
              />
              <span className="text-[11px] text-slate-500 dark:text-[#7E8B9C] mt-1 block">
                Official university GPA on a 10.0 scale as published on your Anna University marksheet.
              </span>
            </div>

            {/* Live Table B Preview */}
            {gpa && !isNaN(parseFloat(gpa)) && parseFloat(gpa) >= 0 && parseFloat(gpa) <= 10 && (
              <div className="p-3 rounded-lg bg-white dark:bg-[#1C2531] border border-indigo-200/80 dark:border-indigo-900/40 flex items-center justify-between">
                <div>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 block">Table B Evaluation Grade:</span>
                  <span className="text-sm font-bold text-indigo-700 dark:text-indigo-300">
                    Grade {scoreToGradeTableB(parseFloat(gpa)).grade} ({scoreToGradeTableB(parseFloat(gpa)).points} Grade Points)
                  </span>
                </div>
                <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                  Valid Scale (0.00 – 10.00)
                </span>
              </div>
            )}
          </div>
        )}

        {/* 2. CLUBS & CELLS (TABLE 7.1 POINT ALLOCATION) */}
        {currentSlug === "clubs-and-cells" && (
          <div className="rounded-xl border border-blue-200 dark:border-blue-900/60 bg-blue-50/40 dark:bg-blue-950/20 p-4 space-y-3.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-blue-900 dark:text-blue-300 uppercase tracking-wider">
                Table 7.1 Clubs &amp; Cells Activity Evaluation
              </span>
              <span className="text-[10px] font-semibold text-blue-700 dark:text-blue-400">
                3 Credits &bull; Table 7.2 Cumulative
              </span>
            </div>

            {/* Club Name */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-[#A0ACBC] mb-1">
                Club / Cell Name *
              </label>
              <select
                value={clubName}
                onChange={(e) => setClubName(e.target.value)}
                disabled={isSubmitting}
                className="w-full rounded-xl border border-slate-300 dark:border-[#2B3543] bg-white dark:bg-[#1C2531] px-3 py-2 text-xs font-semibold text-slate-900 dark:text-[#E8EDF4] focus:border-blue-500 focus:ring-1 focus:ring-blue-500 min-h-[38px]"
              >
                {INSTITUTIONAL_CLUBS.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              {clubName === "Other Club / Cell" && (
                <input
                  type="text"
                  required
                  placeholder="Enter custom Club / Cell name..."
                  value={customClubName}
                  onChange={(e) => setCustomClubName(e.target.value)}
                  className="mt-2 w-full rounded-xl border border-slate-300 dark:border-[#2B3543] bg-white dark:bg-[#1C2531] px-3 py-2 text-xs text-slate-900 dark:text-[#E8EDF4]"
                />
              )}
            </div>

            {/* Role / Participation Category */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-[#A0ACBC] mb-1">
                  Participation Category (Table 7.1) *
                </label>
                <select
                  value={clubRoleCategory}
                  onChange={(e) => setClubRoleCategory(e.target.value)}
                  disabled={isSubmitting}
                  className="w-full rounded-xl border border-slate-300 dark:border-[#2B3543] bg-white dark:bg-[#1C2531] px-3 py-2 text-xs font-semibold text-slate-900 dark:text-[#E8EDF4] focus:border-blue-500 focus:ring-1 focus:ring-blue-500 min-h-[38px]"
                >
                  <option value="Member">Member (100 pts)</option>
                  <option value="Event Participation">Event Participation (100–500 pts)</option>
                  <option value="Winner">Winner (200–700 pts)</option>
                  <option value="MAGIC">MAGIC (200 pts)</option>
                  <option value="Event Coordinator">Event Coordinator (200 pts)</option>
                  <option value="Volunteer">Volunteer (100 pts)</option>
                </select>
              </div>

              {/* Event Level (conditionally displayed for Event Participation or Winner) */}
              {(clubRoleCategory === "Event Participation" || clubRoleCategory === "Winner") ? (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-[#A0ACBC] mb-1">
                    Event Level *
                  </label>
                  <select
                    value={clubEventLevel}
                    onChange={(e) => setClubEventLevel(e.target.value)}
                    disabled={isSubmitting}
                    className="w-full rounded-xl border border-slate-300 dark:border-[#2B3543] bg-white dark:bg-[#1C2531] px-3 py-2 text-xs font-semibold text-slate-900 dark:text-[#E8EDF4] focus:border-blue-500 focus:ring-1 focus:ring-blue-500 min-h-[38px]"
                  >
                    <option value="Within College">Within College ({clubRoleCategory === "Winner" ? "200" : "100"} pts)</option>
                    <option value="Within State (Other College)">Within State / Other College ({clubRoleCategory === "Winner" ? "300" : "200"} pts)</option>
                    <option value="National Level (Other State)">National Level / Other State ({clubRoleCategory === "Winner" ? "500" : "300"} pts)</option>
                    <option value="International Level (In College / Others)">International Level / In College ({clubRoleCategory === "Winner" ? "600" : "400"} pts)</option>
                    <option value="International Level (Other Country)">International Level / Other Country ({clubRoleCategory === "Winner" ? "700" : "500"} pts)</option>
                  </select>
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-[#A0ACBC] mb-1">
                    Completion / Induction Date *
                  </label>
                  <input
                    type="date"
                    value={clubDate}
                    onChange={(e) => setClubDate(e.target.value)}
                    disabled={isSubmitting}
                    className="w-full rounded-xl border border-slate-300 dark:border-[#2B3543] bg-white dark:bg-[#1C2531] px-3 py-2 text-xs text-slate-900 dark:text-[#E8EDF4] min-h-[38px]"
                  />
                </div>
              )}
            </div>

            {/* Event Title and Date for Participation / Winner */}
            {(clubRoleCategory === "Event Participation" || clubRoleCategory === "Winner") && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-[#A0ACBC] mb-1">
                    Event / Activity Title *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Inter-College Hackathon / Quiz"
                    value={clubActivityTitle}
                    onChange={(e) => setClubActivityTitle(e.target.value)}
                    disabled={isSubmitting}
                    className="w-full rounded-xl border border-slate-300 dark:border-[#2B3543] bg-white dark:bg-[#1C2531] px-3 py-2 text-xs text-slate-900 dark:text-[#E8EDF4] min-h-[38px]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-[#A0ACBC] mb-1">
                    Event Date *
                  </label>
                  <input
                    type="date"
                    value={clubDate}
                    onChange={(e) => setClubDate(e.target.value)}
                    disabled={isSubmitting}
                    className="w-full rounded-xl border border-slate-300 dark:border-[#2B3543] bg-white dark:bg-[#1C2531] px-3 py-2 text-xs text-slate-900 dark:text-[#E8EDF4] min-h-[38px]"
                  />
                </div>
              </div>
            )}

            {/* Live Table 7.1 Allocation Indicator */}
            <div className="p-3 rounded-lg bg-white dark:bg-[#1C2531] border border-blue-200/80 dark:border-blue-900/40 flex items-center justify-between">
              <div>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 block">Authoritative Table 7.1 Points:</span>
                <span className="text-sm font-bold text-blue-700 dark:text-blue-300">
                  {clubsCalculatedPoints} Points Awarded
                </span>
              </div>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 text-right">
                Mentor will verify evidence before final award
              </span>
            </div>
          </div>
        )}

        {/* 3. SKILLRACK */}
        {currentSlug === "skillrack" && (
          <div className="rounded-xl border border-slate-200 dark:border-[#2B3543] bg-slate-50/50 dark:bg-[#1C2531]/40 p-4 space-y-3.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-700 dark:text-[#A0ACBC] uppercase tracking-wider">
                Skillrack Coding Assessment (Table 1.1)
              </span>
              <span className="text-[10px] font-semibold text-blue-600 dark:text-blue-400">
                3 Credits &bull; Semester Thresholds
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-[#A0ACBC] mb-1">
                  Cumulative Skillrack Points *
                </label>
                <input
                  type="number"
                  min="0"
                  required
                  placeholder="e.g. 2450"
                  value={skillrackPoints}
                  onChange={(e) => setSkillrackPoints(e.target.value)}
                  disabled={isSubmitting}
                  className="w-full rounded-xl border border-slate-300 dark:border-[#2B3543] bg-white dark:bg-[#1C2531] px-3 py-2 text-xs font-semibold text-slate-900 dark:text-[#E8EDF4] min-h-[38px]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-[#A0ACBC] mb-1">
                  Milestone / Assessment Date *
                </label>
                <input
                  type="date"
                  value={skillrackDate}
                  onChange={(e) => setSkillrackDate(e.target.value)}
                  disabled={isSubmitting}
                  className="w-full rounded-xl border border-slate-300 dark:border-[#2B3543] bg-white dark:bg-[#1C2531] px-3 py-2 text-xs text-slate-900 dark:text-[#E8EDF4] min-h-[38px]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-[#A0ACBC] mb-1">
                Assessment / Track Title (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. Daily Challenge 100-Day Streak & Advanced Track Tests"
                value={skillrackMilestone}
                onChange={(e) => setSkillrackMilestone(e.target.value)}
                disabled={isSubmitting}
                className="w-full rounded-xl border border-slate-300 dark:border-[#2B3543] bg-white dark:bg-[#1C2531] px-3 py-2 text-xs text-slate-900 dark:text-[#E8EDF4] min-h-[38px]"
              />
            </div>
          </div>
        )}

        {/* 4. AMCAT */}
        {currentSlug === "amcat" && (
          <div className="rounded-xl border border-slate-200 dark:border-[#2B3543] bg-slate-50/50 dark:bg-[#1C2531]/40 p-4 space-y-3.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-700 dark:text-[#A0ACBC] uppercase tracking-wider">
                AMCAT Employability Assessment (Table 2.1)
              </span>
              <span className="text-[10px] font-semibold text-blue-600 dark:text-blue-400">
                3 Credits &bull; 0.0 – 10.0 Scale
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-[#A0ACBC] mb-1">
                  AMCAT Overall Score (0.0 – 10.0) *
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0.0"
                  max="10.0"
                  required
                  placeholder="e.g. 8.5"
                  value={amcatScore}
                  onChange={(e) => setAmcatScore(e.target.value)}
                  disabled={isSubmitting}
                  className="w-full rounded-xl border border-slate-300 dark:border-[#2B3543] bg-white dark:bg-[#1C2531] px-3 py-2 text-xs font-semibold text-slate-900 dark:text-[#E8EDF4] min-h-[38px]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-[#A0ACBC] mb-1">
                  Assessment Date *
                </label>
                <input
                  type="date"
                  value={amcatDate}
                  onChange={(e) => setAmcatDate(e.target.value)}
                  disabled={isSubmitting}
                  className="w-full rounded-xl border border-slate-300 dark:border-[#2B3543] bg-white dark:bg-[#1C2531] px-3 py-2 text-xs text-slate-900 dark:text-[#E8EDF4] min-h-[38px]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-[#A0ACBC] mb-1">
                Assessment Batch / Cycle Title
              </label>
              <input
                type="text"
                placeholder="e.g. AMCAT Employability Assessment Cycle 1"
                value={amcatTitle}
                onChange={(e) => setAmcatTitle(e.target.value)}
                disabled={isSubmitting}
                className="w-full rounded-xl border border-slate-300 dark:border-[#2B3543] bg-white dark:bg-[#1C2531] px-3 py-2 text-xs text-slate-900 dark:text-[#E8EDF4] min-h-[38px]"
              />
            </div>
          </div>
        )}

        {/* 5. INTERNSHIP */}
        {currentSlug === "internship" && (
          <div className="rounded-xl border border-slate-200 dark:border-[#2B3543] bg-slate-50/50 dark:bg-[#1C2531]/40 p-4 space-y-3.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-700 dark:text-[#A0ACBC] uppercase tracking-wider">
                Industrial Internship Evaluation (Table 3.3)
              </span>
              <span className="text-[10px] font-semibold text-blue-600 dark:text-blue-400">
                3 Credits &bull; Core / Others
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-[#A0ACBC] mb-1">
                  Host Company / Organization *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Zoho Corporation, L&T, BSNL"
                  value={internCompany}
                  onChange={(e) => setInternCompany(e.target.value)}
                  disabled={isSubmitting}
                  className="w-full rounded-xl border border-slate-300 dark:border-[#2B3543] bg-white dark:bg-[#1C2531] px-3 py-2 text-xs text-slate-900 dark:text-[#E8EDF4] min-h-[38px]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-[#A0ACBC] mb-1">
                  Company Classification *
                </label>
                <select
                  value={internClassification}
                  onChange={(e) => setInternClassification(e.target.value)}
                  disabled={isSubmitting}
                  className="w-full rounded-xl border border-slate-300 dark:border-[#2B3543] bg-white dark:bg-[#1C2531] px-3 py-2 text-xs font-semibold text-slate-900 dark:text-[#E8EDF4] min-h-[38px]"
                >
                  <option value="Core / with stipend">Core / with stipend (Min A+ Grade)</option>
                  <option value="Others">Others (Upto A Grade)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-[#A0ACBC] mb-1">
                  Domain / Role
                </label>
                <input
                  type="text"
                  placeholder="e.g. Full-Stack Developer"
                  value={internDomain}
                  onChange={(e) => setInternDomain(e.target.value)}
                  disabled={isSubmitting}
                  className="w-full rounded-xl border border-slate-300 dark:border-[#2B3543] bg-white dark:bg-[#1C2531] px-3 py-2 text-xs text-slate-900 dark:text-[#E8EDF4] min-h-[38px]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-[#A0ACBC] mb-1">
                  Duration
                </label>
                <input
                  type="text"
                  placeholder="e.g. 8 Weeks"
                  value={internDuration}
                  onChange={(e) => setInternDuration(e.target.value)}
                  disabled={isSubmitting}
                  className="w-full rounded-xl border border-slate-300 dark:border-[#2B3543] bg-white dark:bg-[#1C2531] px-3 py-2 text-xs text-slate-900 dark:text-[#E8EDF4] min-h-[38px]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-[#A0ACBC] mb-1">
                  Completion Date *
                </label>
                <input
                  type="date"
                  value={internDate}
                  onChange={(e) => setInternDate(e.target.value)}
                  disabled={isSubmitting}
                  className="w-full rounded-xl border border-slate-300 dark:border-[#2B3543] bg-white dark:bg-[#1C2531] px-3 py-2 text-xs text-slate-900 dark:text-[#E8EDF4] min-h-[38px]"
                />
              </div>
            </div>
          </div>
        )}

        {/* 6. SAIRAM SDG ACTION PROGRAMME */}
        {currentSlug === "sairam-sdg-action-programme" && (
          <div className="rounded-xl border border-slate-200 dark:border-[#2B3543] bg-slate-50/50 dark:bg-[#1C2531]/40 p-4 space-y-3.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-700 dark:text-[#A0ACBC] uppercase tracking-wider">
                Sairam SDG Action Programme (Table 4.1 &amp; 4.2)
              </span>
              <span className="text-[10px] font-semibold text-blue-600 dark:text-blue-400">
                3 Credits &bull; Service &amp; Drill
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-[#A0ACBC] mb-1">
                  SAP Activity Category *
                </label>
                <select
                  value={sapCategory}
                  onChange={(e) => setSapCategory(e.target.value)}
                  disabled={isSubmitting}
                  className="w-full rounded-xl border border-slate-300 dark:border-[#2B3543] bg-white dark:bg-[#1C2531] px-3 py-2 text-xs font-semibold text-slate-900 dark:text-[#E8EDF4] min-h-[38px]"
                >
                  <option value="Member (10 pts)">Member (10 pts)</option>
                  <option value="1 Activity (15 pts)">1 Activity (15 pts)</option>
                  <option value="2 Activities (30 pts)">2 Activities (30 pts)</option>
                  <option value="16h Drill (40 pts)">16h Drill (40 pts)</option>
                  <option value="25h Drill (75 pts)">25h Drill (75 pts)</option>
                  <option value="Best Unit / RD Parade (75 pts)">Best Unit / RD Parade (75 pts)</option>
                  <option value="Other Approved SAP Action">Other Approved SAP Action</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-[#A0ACBC] mb-1">
                  SAP Points Awarded *
                </label>
                <input
                  type="number"
                  min="0"
                  required
                  value={sapPoints}
                  onChange={(e) => setSapPoints(e.target.value)}
                  disabled={isSubmitting}
                  className="w-full rounded-xl border border-slate-300 dark:border-[#2B3543] bg-white dark:bg-[#1C2531] px-3 py-2 text-xs font-semibold text-slate-900 dark:text-[#E8EDF4] min-h-[38px]"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-[#A0ACBC] mb-1">
                  Initiative / Project Details
                </label>
                <input
                  type="text"
                  placeholder="e.g. SDG 6 Clean Water Community Outreach"
                  value={sapTitle}
                  onChange={(e) => setSapTitle(e.target.value)}
                  disabled={isSubmitting}
                  className="w-full rounded-xl border border-slate-300 dark:border-[#2B3543] bg-white dark:bg-[#1C2531] px-3 py-2 text-xs text-slate-900 dark:text-[#E8EDF4] min-h-[38px]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-[#A0ACBC] mb-1">
                  Date of Activity *
                </label>
                <input
                  type="date"
                  value={sapDate}
                  onChange={(e) => setSapDate(e.target.value)}
                  disabled={isSubmitting}
                  className="w-full rounded-xl border border-slate-300 dark:border-[#2B3543] bg-white dark:bg-[#1C2531] px-3 py-2 text-xs text-slate-900 dark:text-[#E8EDF4] min-h-[38px]"
                />
              </div>
            </div>
          </div>
        )}

        {/* 7. SAIRAM INNOVATION ECO-SYSTEM */}
        {currentSlug === "sairam-innovation-eco-system" && (
          <div className="rounded-xl border border-slate-200 dark:border-[#2B3543] bg-slate-50/50 dark:bg-[#1C2531]/40 p-4 space-y-3.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-700 dark:text-[#A0ACBC] uppercase tracking-wider">
                Innovation Eco-System (Table 5.1)
              </span>
              <span className="text-[10px] font-semibold text-blue-600 dark:text-blue-400">
                4 Credits &bull; Stage Outcomes
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-[#A0ACBC] mb-1">
                  Innovation Event *
                </label>
                <select
                  value={innovEventName}
                  onChange={(e) => setInnovEventName(e.target.value)}
                  disabled={isSubmitting}
                  className="w-full rounded-xl border border-slate-300 dark:border-[#2B3543] bg-white dark:bg-[#1C2531] px-3 py-2 text-xs font-semibold text-slate-900 dark:text-[#E8EDF4] min-h-[38px]"
                >
                  <option value="Ideathon">Ideathon</option>
                  <option value="Solvethon">Solvethon</option>
                  <option value="Innovathon">Innovathon</option>
                  <option value="Inspirathon">Inspirathon</option>
                  <option value="Other Innovation Challenge">Other Innovation Challenge</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-[#A0ACBC] mb-1">
                  Achievement Outcome (Table 5.1) *
                </label>
                <select
                  value={innovCategory}
                  onChange={(e) => setInnovCategory(e.target.value)}
                  disabled={isSubmitting}
                  className="w-full rounded-xl border border-slate-300 dark:border-[#2B3543] bg-white dark:bg-[#1C2531] px-3 py-2 text-xs font-semibold text-slate-900 dark:text-[#E8EDF4] min-h-[38px]"
                >
                  <option value="Overall Winners 3 Teams">Overall Winners 3 Teams (Grade O, 10 GP)</option>
                  <option value="SDG wise winners 51 teams">SDG wise winners 51 teams (Grade A+, 9 GP)</option>
                  <option value="12 Teams eliminated out of top 15">Round 2 Finalist / Top 15 (Grade A, 7 GP)</option>
                  <option value="10 Teams eliminated out of top 25">Round 1 Finalist / Top 25 (Grade B+, 5 GP)</option>
                  <option value="Participants who will submit the proposal in time">Proposal Submitted In Time (Grade B, 3 GP)</option>
                  <option value="Participants who will submit the proposal after the due date">Proposal Submitted After Due Date (Grade C, 1 GP)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-[#A0ACBC] mb-1">
                  Project / Innovation Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. IoT AI Precision Irrigation Controller"
                  value={innovTitle}
                  onChange={(e) => setInnovTitle(e.target.value)}
                  disabled={isSubmitting}
                  className="w-full rounded-xl border border-slate-300 dark:border-[#2B3543] bg-white dark:bg-[#1C2531] px-3 py-2 text-xs text-slate-900 dark:text-[#E8EDF4] min-h-[38px]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-[#A0ACBC] mb-1">
                  Event / Presentation Date *
                </label>
                <input
                  type="date"
                  value={innovDate}
                  onChange={(e) => setInnovDate(e.target.value)}
                  disabled={isSubmitting}
                  className="w-full rounded-xl border border-slate-300 dark:border-[#2B3543] bg-white dark:bg-[#1C2531] px-3 py-2 text-xs text-slate-900 dark:text-[#E8EDF4] min-h-[38px]"
                />
              </div>
            </div>
          </div>
        )}

        {/* 8. SAIL */}
        {currentSlug === "sail" && (
          <div className="rounded-xl border border-slate-200 dark:border-[#2B3543] bg-slate-50/50 dark:bg-[#1C2531]/40 p-4 space-y-3.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-700 dark:text-[#A0ACBC] uppercase tracking-wider">
                Sairam AI Learning — SAIL (Table 6.2)
              </span>
              <span className="text-[10px] font-semibold text-blue-600 dark:text-blue-400">
                3 Credits &bull; Semester Milestones
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-[#A0ACBC] mb-1">
                  Cumulative SAIL Points *
                </label>
                <input
                  type="number"
                  min="0"
                  required
                  placeholder="e.g. 210"
                  value={sailPoints}
                  onChange={(e) => setSailPoints(e.target.value)}
                  disabled={isSubmitting}
                  className="w-full rounded-xl border border-slate-300 dark:border-[#2B3543] bg-white dark:bg-[#1C2531] px-3 py-2 text-xs font-semibold text-slate-900 dark:text-[#E8EDF4] min-h-[38px]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-[#A0ACBC] mb-1">
                  Completion Date *
                </label>
                <input
                  type="date"
                  value={sailDate}
                  onChange={(e) => setSailDate(e.target.value)}
                  disabled={isSubmitting}
                  className="w-full rounded-xl border border-slate-300 dark:border-[#2B3543] bg-white dark:bg-[#1C2531] px-3 py-2 text-xs text-slate-900 dark:text-[#E8EDF4] min-h-[38px]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-[#A0ACBC] mb-1">
                AI Track / Module Name
              </label>
              <input
                type="text"
                placeholder="e.g. Deep Learning & Computer Vision Specialization Track"
                value={sailModule}
                onChange={(e) => setSailModule(e.target.value)}
                disabled={isSubmitting}
                className="w-full rounded-xl border border-slate-300 dark:border-[#2B3543] bg-white dark:bg-[#1C2531] px-3 py-2 text-xs text-slate-900 dark:text-[#E8EDF4] min-h-[38px]"
              />
            </div>
          </div>
        )}

        {/* 9. SPORTS & GAMES */}
        {currentSlug === "sports-and-games" && (
          <div className="rounded-xl border border-slate-200 dark:border-[#2B3543] bg-slate-50/50 dark:bg-[#1C2531]/40 p-4 space-y-3.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-700 dark:text-[#A0ACBC] uppercase tracking-wider">
                Sports &amp; Games Competition (Table 8.1)
              </span>
              <span className="text-[10px] font-semibold text-blue-600 dark:text-blue-400">
                3 Credits &bull; Table 8.1 Thresholds
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-[#A0ACBC] mb-1">
                  Sport / Discipline Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Athletics 400m, Badminton, Cricket"
                  value={sportName}
                  onChange={(e) => setSportName(e.target.value)}
                  disabled={isSubmitting}
                  className="w-full rounded-xl border border-slate-300 dark:border-[#2B3543] bg-white dark:bg-[#1C2531] px-3 py-2 text-xs text-slate-900 dark:text-[#E8EDF4] min-h-[38px]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-[#A0ACBC] mb-1">
                  Competition Level *
                </label>
                <select
                  value={sportLevel}
                  onChange={(e) => setSportLevel(e.target.value)}
                  disabled={isSubmitting}
                  className="w-full rounded-xl border border-slate-300 dark:border-[#2B3543] bg-white dark:bg-[#1C2531] px-3 py-2 text-xs font-semibold text-slate-900 dark:text-[#E8EDF4] min-h-[38px]"
                >
                  <option value="Sports Day (Intra-College)">Sports Day (Intra-College)</option>
                  <option value="Zonal Level">Zonal Level</option>
                  <option value="State Level">State Level</option>
                  <option value="National Level">National Level</option>
                  <option value="International Level">International Level</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-[#A0ACBC] mb-1">
                  Sports Points Earned (Table 8.1) *
                </label>
                <input
                  type="number"
                  min="0"
                  required
                  placeholder="e.g. 100"
                  value={sportPoints}
                  onChange={(e) => setSportPoints(e.target.value)}
                  disabled={isSubmitting}
                  className="w-full rounded-xl border border-slate-300 dark:border-[#2B3543] bg-white dark:bg-[#1C2531] px-3 py-2 text-xs font-semibold text-slate-900 dark:text-[#E8EDF4] min-h-[38px]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-[#A0ACBC] mb-1">
                  Event Date *
                </label>
                <input
                  type="date"
                  value={sportDate}
                  onChange={(e) => setSportDate(e.target.value)}
                  disabled={isSubmitting}
                  className="w-full rounded-xl border border-slate-300 dark:border-[#2B3543] bg-white dark:bg-[#1C2531] px-3 py-2 text-xs text-slate-900 dark:text-[#E8EDF4] min-h-[38px]"
                />
              </div>
            </div>

            <label className="flex items-center gap-2 cursor-pointer pt-1">
              <input
                type="checkbox"
                checked={sportIsInternational}
                onChange={(e) => setSportIsInternational(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-xs font-semibold text-slate-700 dark:text-[#A0ACBC]">
                International Participant / Record Maker (Auto-awarded &apos;O&apos; Grade)
              </span>
            </label>
          </div>
        )}

        {/* 10. ONLINE CERTIFICATIONS */}
        {currentSlug === "online-certifications" && (
          <div className="rounded-xl border border-slate-200 dark:border-[#2B3543] bg-slate-50/50 dark:bg-[#1C2531]/40 p-4 space-y-3.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-700 dark:text-[#A0ACBC] uppercase tracking-wider">
                Online Course Certifications (IITB Spoken Tutorials &amp; MOOCs)
              </span>
              <span className="text-[10px] font-semibold text-blue-600 dark:text-blue-400">
                2 Credits &bull; Categorical
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-[#A0ACBC] mb-1">
                  Course Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Python for Data Science and Machine Learning"
                  value={onlineCourse}
                  onChange={(e) => setOnlineCourse(e.target.value)}
                  disabled={isSubmitting}
                  className="w-full rounded-xl border border-slate-300 dark:border-[#2B3543] bg-white dark:bg-[#1C2531] px-3 py-2 text-xs text-slate-900 dark:text-[#E8EDF4] min-h-[38px]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-[#A0ACBC] mb-1">
                  Platform / Provider *
                </label>
                <select
                  value={onlineProvider}
                  onChange={(e) => setOnlineProvider(e.target.value)}
                  disabled={isSubmitting}
                  className="w-full rounded-xl border border-slate-300 dark:border-[#2B3543] bg-white dark:bg-[#1C2531] px-3 py-2 text-xs font-semibold text-slate-900 dark:text-[#E8EDF4] min-h-[38px]"
                >
                  <option value="IITB Spoken Tutorials">IITB Spoken Tutorials</option>
                  <option value="Coursera">Coursera</option>
                  <option value="edX">edX</option>
                  <option value="Udemy">Udemy</option>
                  <option value="AWS / Google Cloud / Microsoft">AWS / Google Cloud / Microsoft</option>
                  <option value="Other Approved Platform">Other Approved Platform</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-[#A0ACBC] mb-1">
                  Certification Outcome / Result *
                </label>
                <select
                  value={onlineCategory}
                  onChange={(e) => setOnlineCategory(e.target.value)}
                  disabled={isSubmitting}
                  className="w-full rounded-xl border border-slate-300 dark:border-[#2B3543] bg-white dark:bg-[#1C2531] px-3 py-2 text-xs font-semibold text-slate-900 dark:text-[#E8EDF4] min-h-[38px]"
                >
                  <option value="Topper">Topper (Grade O, 10 GP)</option>
                  <option value="Elite with Gold">Elite with Gold (Grade O, 10 GP)</option>
                  <option value="Gold">Gold (Grade A+, 9 GP)</option>
                  <option value="Silver">Silver (Grade A, 7 GP)</option>
                  <option value="Elite">Elite (Grade B+, 5 GP)</option>
                  <option value="Completed">Completed / Pass (Grade B, 3 GP)</option>
                  <option value="Attended">Attended (Grade C, 1 GP)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-[#A0ACBC] mb-1">
                  Completion Date *
                </label>
                <input
                  type="date"
                  value={onlineDate}
                  onChange={(e) => setOnlineDate(e.target.value)}
                  disabled={isSubmitting}
                  className="w-full rounded-xl border border-slate-300 dark:border-[#2B3543] bg-white dark:bg-[#1C2531] px-3 py-2 text-xs text-slate-900 dark:text-[#E8EDF4] min-h-[38px]"
                />
              </div>
            </div>
          </div>
        )}

        {/* 11. NPTEL */}
        {currentSlug === "nptel-non-credit-transfer" && (
          <div className="rounded-xl border border-slate-200 dark:border-[#2B3543] bg-slate-50/50 dark:bg-[#1C2531]/40 p-4 space-y-3.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-700 dark:text-[#A0ACBC] uppercase tracking-wider">
                NPTEL Non-Credit Transfer (Table 10.1)
              </span>
              <span className="text-[10px] font-semibold text-blue-600 dark:text-blue-400">
                4 Credits &bull; Table 10.1 Tiers
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-[#A0ACBC] mb-1">
                  NPTEL Course Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Cloud Computing / Developing Soft Skills"
                  value={nptelCourse}
                  onChange={(e) => setNptelCourse(e.target.value)}
                  disabled={isSubmitting}
                  className="w-full rounded-xl border border-slate-300 dark:border-[#2B3543] bg-white dark:bg-[#1C2531] px-3 py-2 text-xs text-slate-900 dark:text-[#E8EDF4] min-h-[38px]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-[#A0ACBC] mb-1">
                  Course Duration *
                </label>
                <select
                  value={nptelDuration}
                  onChange={(e) => setNptelDuration(e.target.value)}
                  disabled={isSubmitting}
                  className="w-full rounded-xl border border-slate-300 dark:border-[#2B3543] bg-white dark:bg-[#1C2531] px-3 py-2 text-xs font-semibold text-slate-900 dark:text-[#E8EDF4] min-h-[38px]"
                >
                  <option value="4 Weeks">4 Weeks</option>
                  <option value="8 Weeks">8 Weeks</option>
                  <option value="12 Weeks">12 Weeks</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 dark:text-[#A0ACBC] mb-1">
                  Certificate Classification (Table 10.1) *
                </label>
                <select
                  value={nptelCategory}
                  onChange={(e) => setNptelCategory(e.target.value)}
                  disabled={isSubmitting}
                  className="w-full rounded-xl border border-slate-300 dark:border-[#2B3543] bg-white dark:bg-[#1C2531] px-3 py-2 text-xs font-semibold text-slate-900 dark:text-[#E8EDF4] min-h-[38px]"
                >
                  <option value="Topper">Topper (Grade O, 10 GP)</option>
                  <option value="Gold (>=90%)">Gold &gt;= 90% (Grade A+, 9 GP)</option>
                  <option value="Silver (75-89%)">Silver 75%–89% (Grade A, 7 GP)</option>
                  <option value="Elite (60-74%)">Elite 60%–74% (Grade B+, 5 GP)</option>
                  <option value="Successfully Completed (40-59%)">Successfully Completed 40%–59% (Grade B, 3 GP)</option>
                  <option value="Attended (<40%)">Attended &lt; 40% (Grade C, 1 GP)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-[#A0ACBC] mb-1">
                  Final Exam Date *
                </label>
                <input
                  type="date"
                  value={nptelDate}
                  onChange={(e) => setNptelDate(e.target.value)}
                  disabled={isSubmitting}
                  className="w-full rounded-xl border border-slate-300 dark:border-[#2B3543] bg-white dark:bg-[#1C2531] px-3 py-2 text-xs text-slate-900 dark:text-[#E8EDF4] min-h-[38px]"
                />
              </div>
            </div>
          </div>
        )}

        {/* 12. GATE */}
        {currentSlug === "gate" && (
          <div className="rounded-xl border border-slate-200 dark:border-[#2B3543] bg-slate-50/50 dark:bg-[#1C2531]/40 p-4 space-y-3.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-700 dark:text-[#A0ACBC] uppercase tracking-wider">
                GATE Examination (Table 11.1)
              </span>
              <span className="text-[10px] font-semibold text-blue-600 dark:text-blue-400">
                4 Credits &bull; Percentile / Score
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-[#A0ACBC] mb-1">
                  GATE Registration / Roll Number *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. CS25S12345678"
                  value={gateRegNumber}
                  onChange={(e) => setGateRegNumber(e.target.value)}
                  disabled={isSubmitting}
                  className="w-full rounded-xl border border-slate-300 dark:border-[#2B3543] bg-white dark:bg-[#1C2531] px-3 py-2 text-xs text-slate-900 dark:text-[#E8EDF4] min-h-[38px]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-[#A0ACBC] mb-1">
                  Exam Result Category (Table 11.1) *
                </label>
                <select
                  value={gateCategory}
                  onChange={(e) => setGateCategory(e.target.value)}
                  disabled={isSubmitting}
                  className="w-full rounded-xl border border-slate-300 dark:border-[#2B3543] bg-white dark:bg-[#1C2531] px-3 py-2 text-xs font-semibold text-slate-900 dark:text-[#E8EDF4] min-h-[38px]"
                >
                  <option value="Percentile (>90)">Percentile &gt; 90 (Grade O, 10 GP)</option>
                  <option value="Score (>400)">Score &gt; 400 (Grade A+, 9 GP)</option>
                  <option value="Qualified">Qualified (Grade A, 7 GP)</option>
                  <option value="Not Qualified">Not Qualified (Grade B+, 5 GP)</option>
                  <option value="Attended">Attended (Grade B, 3 GP)</option>
                  <option value="Registration">Registration (Grade C, 1 GP)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-[#A0ACBC] mb-1">
                  GATE Score (Optional)
                </label>
                <input
                  type="number"
                  min="0"
                  placeholder="e.g. 485"
                  value={gateScore}
                  onChange={(e) => setGateScore(e.target.value)}
                  disabled={isSubmitting}
                  className="w-full rounded-xl border border-slate-300 dark:border-[#2B3543] bg-white dark:bg-[#1C2531] px-3 py-2 text-xs text-slate-900 dark:text-[#E8EDF4] min-h-[38px]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-[#A0ACBC] mb-1">
                  Exam Date / Session *
                </label>
                <input
                  type="date"
                  value={gateDate}
                  onChange={(e) => setGateDate(e.target.value)}
                  disabled={isSubmitting}
                  className="w-full rounded-xl border border-slate-300 dark:border-[#2B3543] bg-white dark:bg-[#1C2531] px-3 py-2 text-xs text-slate-900 dark:text-[#E8EDF4] min-h-[38px]"
                />
              </div>
            </div>
          </div>
        )}

        {/* 13. SCOUTS FOR SDGS */}
        {currentSlug === "scouts-for-sdgs" && (
          <div className="rounded-xl border border-slate-200 dark:border-[#2B3543] bg-slate-50/50 dark:bg-[#1C2531]/40 p-4 space-y-3.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-700 dark:text-[#A0ACBC] uppercase tracking-wider">
                Scouts for SDGs (Table 12.1)
              </span>
              <span className="text-[10px] font-semibold text-blue-600 dark:text-blue-400">
                3 Credits &bull; Service Hours
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-[#A0ACBC] mb-1">
                  Activity Classification *
                </label>
                <select
                  value={scoutsCategory}
                  onChange={(e) => setScoutsCategory(e.target.value)}
                  disabled={isSubmitting}
                  className="w-full rounded-xl border border-slate-300 dark:border-[#2B3543] bg-white dark:bg-[#1C2531] px-3 py-2 text-xs font-semibold text-slate-900 dark:text-[#E8EDF4] min-h-[38px]"
                >
                  <option value="Service (20 hrs)">Service (20 hrs) (Grade O, 10 GP)</option>
                  <option value="Scout Online Courses (2)">Scout Online Courses (2) (Grade A+, 9 GP)</option>
                  <option value="Work on activity">Work on activity (Grade A, 7 GP)</option>
                  <option value="Enroll">Enroll (Grade B, 3 GP)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-[#A0ACBC] mb-1">
                  Service Hours Logged
                </label>
                <input
                  type="number"
                  min="0"
                  placeholder="e.g. 20"
                  value={scoutsHours}
                  onChange={(e) => setScoutsHours(e.target.value)}
                  disabled={isSubmitting}
                  className="w-full rounded-xl border border-slate-300 dark:border-[#2B3543] bg-white dark:bg-[#1C2531] px-3 py-2 text-xs font-semibold text-slate-900 dark:text-[#E8EDF4] min-h-[38px]"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-[#A0ACBC] mb-1">
                  Initiative / Project Details
                </label>
                <input
                  type="text"
                  placeholder="e.g. Community Plastic Waste Audit &amp; Cleanup"
                  value={scoutsTitle}
                  onChange={(e) => setScoutsTitle(e.target.value)}
                  disabled={isSubmitting}
                  className="w-full rounded-xl border border-slate-300 dark:border-[#2B3543] bg-white dark:bg-[#1C2531] px-3 py-2 text-xs text-slate-900 dark:text-[#E8EDF4] min-h-[38px]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-[#A0ACBC] mb-1">
                  Date of Activity *
                </label>
                <input
                  type="date"
                  value={scoutsDate}
                  onChange={(e) => setScoutsDate(e.target.value)}
                  disabled={isSubmitting}
                  className="w-full rounded-xl border border-slate-300 dark:border-[#2B3543] bg-white dark:bg-[#1C2531] px-3 py-2 text-xs text-slate-900 dark:text-[#E8EDF4] min-h-[38px]"
                />
              </div>
            </div>
          </div>
        )}

        {/* 14. FIT INDIA */}
        {currentSlug === "fit-india-certifications" && (
          <div className="rounded-xl border border-slate-200 dark:border-[#2B3543] bg-slate-50/50 dark:bg-[#1C2531]/40 p-4 space-y-3.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-700 dark:text-[#A0ACBC] uppercase tracking-wider">
                Fit India Initiatives (Table 13.1)
              </span>
              <span className="text-[10px] font-semibold text-blue-600 dark:text-blue-400">
                3 Credits &bull; Score &gt;= 100 for &apos;O&apos;
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-[#A0ACBC] mb-1">
                  Fitness Challenge / Quiz Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Fit India Freedom Run / School Fitness Assessment Quiz"
                  value={fitIndiaTitle}
                  onChange={(e) => setFitIndiaTitle(e.target.value)}
                  disabled={isSubmitting}
                  className="w-full rounded-xl border border-slate-300 dark:border-[#2B3543] bg-white dark:bg-[#1C2531] px-3 py-2 text-xs text-slate-900 dark:text-[#E8EDF4] min-h-[38px]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-[#A0ACBC] mb-1">
                  FIT INDIA Score (Table 13.1) *
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  required
                  placeholder="e.g. 85"
                  value={fitIndiaScore}
                  onChange={(e) => setFitIndiaScore(e.target.value)}
                  disabled={isSubmitting}
                  className="w-full rounded-xl border border-slate-300 dark:border-[#2B3543] bg-white dark:bg-[#1C2531] px-3 py-2 text-xs font-semibold text-slate-900 dark:text-[#E8EDF4] min-h-[38px]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-[#A0ACBC] mb-1">
                Event / Quiz Date *
              </label>
              <input
                type="date"
                value={fitIndiaDate}
                onChange={(e) => setFitIndiaDate(e.target.value)}
                disabled={isSubmitting}
                className="w-full rounded-xl border border-slate-300 dark:border-[#2B3543] bg-white dark:bg-[#1C2531] px-3 py-2 text-xs text-slate-900 dark:text-[#E8EDF4] min-h-[38px]"
              />
            </div>
          </div>
        )}

        {/* ==================================================================== */}
        {/* Supporting Evidence PDF Upload (Tailored Label)                      */}
        {/* ==================================================================== */}
        <div>
          <div className="flex items-center justify-between">
            <label className="block text-xs font-semibold text-slate-700 dark:text-[#A0ACBC] uppercase tracking-wider">
              {currentSlug === "academics-gpa"
                ? isPdfRequired
                  ? "Semester Marksheet / Grade Sheet (PDF Required) *"
                  : isPdfDisabled
                  ? "Semester Marksheet / Evidence (Disabled)"
                  : "Semester Marksheet / Grade Sheet (Optional PDF)"
                : isPdfRequired
                ? "Supporting Evidence PDF (Required) *"
                : isPdfDisabled
                ? "Supporting Evidence (Disabled)"
                : "Supporting Evidence (Optional)"}
            </label>
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-semibold border ${
                isPdfRequired
                  ? "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800"
                  : isPdfDisabled
                  ? "bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700"
                  : "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800"
              }`}
            >
              {isPdfRequired
                ? "Mandatory Evidence • Up to 5 MB"
                : isPdfDisabled
                ? "Evidence Disabled • Direct Submit"
                : "Optional Evidence • Up to 5 MB"}
            </span>
          </div>

          <p className="text-[11px] text-slate-500 dark:text-[#7E8B9C] mt-0.5 mb-1.5">
            {isPdfDisabled
              ? "System Admin policy: Evidence document upload is disabled for this component. You can proceed with submission directly."
              : currentSlug === "academics-gpa"
              ? isPdfRequired
                ? "Attach your official university marksheet or grade report PDF for faculty verification (Mandatory)."
                : "Attach your official university marksheet or grade report PDF if available (Optional for this component)."
              : isPdfRequired
              ? "Attach official certificate, event receipt, score card, or completion record (Mandatory PDF)."
              : "Attach official certificate, event receipt, or completion record if available (Optional for this component)."}
          </p>

          {!isPdfDisabled && (
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept={allowOtherEvidence ? ".pdf,application/pdf,image/png,image/jpeg,.png,.jpg,.jpeg" : ".pdf,application/pdf"}
                disabled={isSubmitting}
                onChange={(e) => {
                  if (e.target.files && e.target.files.length > 0) {
                    handleFileSelect(e.target.files[0]);
                  }
                }}
                className="hidden"
                id="evidence-pdf-input"
              />

              {!evidenceFile ? (
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => {
                    if (!isSubmitting && fileInputRef.current) {
                      fileInputRef.current.click();
                    }
                  }}
                  className={`rounded-xl border-2 border-dashed p-4 text-center cursor-pointer transition-all ${
                    isDragging
                      ? "border-blue-500 bg-blue-50/50 dark:bg-blue-950/20"
                      : fileError
                      ? "border-rose-300 dark:border-rose-900/60 bg-rose-50/50 dark:bg-rose-950/20"
                      : "border-slate-300 dark:border-[#2B3543] hover:border-blue-400 dark:hover:border-blue-500 bg-slate-50/40 dark:bg-[#1C2531]/40"
                  }`}
                >
                  <div className="mx-auto flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 mb-2">
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                  </div>
                  <p className="text-xs font-semibold text-slate-800 dark:text-[#E8EDF4]">
                    {isPdfRequired ? "Click to browse or drop your mandatory PDF here" : "Click to browse or drop optional PDF here"}
                  </p>
                  <p className="text-[11px] text-slate-400 dark:text-[#7E8B9C] mt-0.5">
                    {allowOtherEvidence ? "PDF, PNG, JPEG format • Up to 5 MB" : "PDF format only • Up to 5 MB"}
                  </p>
                </div>
              ) : (
                <div className="flex items-center justify-between p-3 rounded-xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/60 dark:bg-emerald-950/30">
                  <div className="flex items-center gap-2.5 truncate">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-600 text-white font-bold text-[9px] shrink-0">
                      FILE
                    </div>
                    <div className="truncate">
                      <p className="text-xs font-bold text-slate-900 dark:text-[#E8EDF4] truncate">
                        {evidenceFile.name}
                      </p>
                      <p className="text-[10px] text-slate-500 dark:text-[#7E8B9C]">
                        {formatFileSize(evidenceFile.size)} &bull; Ready for upload
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleFileSelect(null)}
                    disabled={isSubmitting}
                    className="rounded-lg p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-white dark:hover:bg-[#1C2531] transition-colors cursor-pointer"
                    title="Remove selected file"
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              )}

              {fileError && (
                <p className="text-[11px] text-rose-600 dark:text-rose-400 mt-1 font-medium">{fileError}</p>
              )}
            </>
          )}
        </div>

        {/* Progress Step while Submitting */}
        {isSubmitting && submissionStep && (
          <div className="rounded-xl border border-blue-200 dark:border-blue-900/60 bg-blue-50/60 dark:bg-blue-950/30 p-3 flex items-center gap-2.5 text-xs text-blue-800 dark:text-blue-300">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-blue-600 border-t-transparent shrink-0" />
            <span className="font-medium">{submissionStep}</span>
          </div>
        )}

        {/* Action Buttons */}
        <div className="pt-2 flex items-center justify-end gap-2.5 border-t border-slate-200 dark:border-[#2B3543]">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded-xl border border-slate-300 dark:border-[#2B3543] bg-white dark:bg-[#1C2531] px-4 py-2 text-xs font-semibold text-slate-700 dark:text-[#E8EDF4] hover:bg-slate-50 dark:hover:bg-[#232E3E] transition-colors cursor-pointer min-h-[38px]"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={() => handleSubmit(false)}
            disabled={isSubmitting || semesterLoading || isComponentLocked}
            className="rounded-xl border border-slate-300 dark:border-[#2B3543] bg-slate-50 dark:bg-[#1C2531] hover:bg-slate-100 dark:hover:bg-[#232E3E] px-4 py-2 text-xs font-semibold text-slate-700 dark:text-[#E8EDF4] transition-colors cursor-pointer min-h-[38px] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Save as Draft
          </button>

          <button
            type="submit"
            disabled={isSubmitting || semesterLoading || isComponentLocked}
            id="btn-submit-achievement"
            className={`inline-flex items-center gap-2 rounded-xl px-5 py-2 text-xs font-bold text-white shadow-xs transition-colors min-h-[38px] ${
              isComponentLocked
                ? "bg-slate-400 dark:bg-slate-600 cursor-not-allowed opacity-60"
                : "bg-blue-600 hover:bg-blue-700 active:bg-blue-800 cursor-pointer"
            }`}
          >
            {isComponentLocked ? (
              <>
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
                <span>Component Locked</span>
              </>
            ) : isSubmitting ? (
              <>
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                <span>Submitting...</span>
              </>
            ) : (
              <>
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
                <span>Submit for Mentor Verification</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export const SubmitAchievementModal: React.FC<SubmitAchievementModalProps> = ({
  isOpen,
  onClose,
  components,
  initialComponentId,
  onSubmit,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto" role="dialog" aria-modal="true">
      <div
        onClick={onClose}
        className="fixed inset-0 bg-slate-900/60 dark:bg-black/80 backdrop-blur-xs transition-opacity"
      />
      <div className="flex min-h-full items-end sm:items-center justify-center p-0 sm:p-4 text-center">
        <SubmitAchievementFormContent
          components={components}
          initialComponentId={initialComponentId}
          onSubmit={onSubmit}
          onClose={onClose}
        />
      </div>
    </div>
  );
};
