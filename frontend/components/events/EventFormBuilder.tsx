"use client";

import React, { useState, useMemo } from "react";
import {
  EventFormField,
  FormFieldType,
  FormFieldOption,
  EventItem,
  FormSection,
  ConditionalRule,
  RatingConfig,
  RepeatableConfig,
  FormLayoutMode,
} from "@/types/events";
import { eventsApi } from "@/lib/events-api";

interface EventFormBuilderProps {
  event: EventItem;
  initialFields?: EventFormField[];
  initialSections?: FormSection[];
  onSaved?: () => void;
  onBack?: () => void;
}

// -----------------------------------------------------------------------------
// Field Palette Definitions Categorized
// -----------------------------------------------------------------------------
interface PaletteItem {
  type: FormFieldType;
  label: string;
  category: "basic" | "datetime" | "choice" | "rating" | "upload" | "layout" | "advanced";
  icon: string;
  defaultLabel: string;
  description: string;
}

const FIELD_PALETTE: PaletteItem[] = [
  // Basic Fields
  { type: "text", label: "Short Text", category: "basic", icon: "Aa", defaultLabel: "Full Name", description: "Single-line text input" },
  { type: "textarea", label: "Paragraph / Long Text", category: "basic", icon: "¶", defaultLabel: "Statement of Purpose", description: "Multi-line text area" },
  { type: "number", label: "Number", category: "basic", icon: "#", defaultLabel: "Experience in Years", description: "Numeric value with optional bounds" },
  { type: "email", label: "Email Address", category: "basic", icon: "@", defaultLabel: "College Email", description: "Validates email format" },
  { type: "phone", label: "Phone Number", category: "basic", icon: "📞", defaultLabel: "WhatsApp / Contact Number", description: "10-digit telephone format" },
  { type: "url", label: "Website / URL", category: "basic", icon: "🔗", defaultLabel: "Portfolio or GitHub URL", description: "Validates web URL" },
  { type: "rich_text", label: "Rich Text Input", category: "basic", icon: "📝", defaultLabel: "Project Description", description: "Formatted text with bold/bullets" },

  // Date & Time
  { type: "date", label: "Date Picker", category: "datetime", icon: "📅", defaultLabel: "Date of Birth", description: "Calendar date selector" },
  { type: "time", label: "Time Picker", category: "datetime", icon: "⏰", defaultLabel: "Preferred Time Slot", description: "Time of day selector" },
  { type: "datetime", label: "Date & Time", category: "datetime", icon: "🗓", defaultLabel: "Appointment Slot", description: "Combined date and time" },
  { type: "date_range", label: "Date Range", category: "datetime", icon: "↔", defaultLabel: "Internship Duration", description: "Start and end date pair" },

  // Selection
  { type: "dropdown", label: "Dropdown Select", category: "choice", icon: "▼", defaultLabel: "Select Your Track", description: "Single choice from dropdown list" },
  { type: "radio", label: "Radio Buttons", category: "choice", icon: "◉", defaultLabel: "T-Shirt Size", description: "Single choice from radio buttons" },
  { type: "checkbox", label: "Checkbox Group", category: "choice", icon: "☑", defaultLabel: "Areas of Interest", description: "Multiple choices from checkboxes" },
  { type: "yes_no", label: "Yes / No Buttons", category: "choice", icon: "⚖", defaultLabel: "Will you bring your own laptop?", description: "Fast boolean toggle buttons" },
  { type: "multi_select", label: "Multi-Select Tags", category: "choice", icon: "🏷", defaultLabel: "Preferred Technologies", description: "Multiple tag selection" },

  // Feedback & Rating
  { type: "star_rating", label: "1–5 Star Rating", category: "rating", icon: "★", defaultLabel: "Overall Content Quality", description: "Interactive star evaluation" },
  { type: "numeric_rating", label: "Numeric Scale (1–10)", category: "rating", icon: "🔟", defaultLabel: "Likelihood to Recommend (NPS)", description: "0-10 or 1-10 numerical scale" },
  { type: "satisfaction_rating", label: "Satisfaction Scale", category: "rating", icon: "😊", defaultLabel: "Overall Satisfaction", description: "Poor to Excellent scale" },
  { type: "difficulty_rating", label: "Difficulty Rating", category: "rating", icon: "⚡", defaultLabel: "Session Difficulty Level", description: "Beginner, Intermediate, Advanced" },
  { type: "custom_scale", label: "Custom Scale", category: "rating", icon: "📊", defaultLabel: "Pacing of the Workshop", description: "Configurable discrete scale" },

  // Uploads
  { type: "file", label: "Document Upload (PDF/Word)", category: "upload", icon: "📄", defaultLabel: "Upload Resume / ID Card", description: "Document file attachment" },
  { type: "image_upload", label: "Image / Screenshot", category: "upload", icon: "🖼", defaultLabel: "Payment Receipt / ID Photo", description: "PNG, JPG, or WebP image" },
  { type: "pdf_upload", label: "PDF Document Only", category: "upload", icon: "📕", defaultLabel: "Upload Signed NOC (PDF)", description: "Strict PDF document upload" },
  { type: "camera_capture", label: "Live Camera Snapshot", category: "upload", icon: "📷", defaultLabel: "Take Live Photo", description: "Direct camera photo capture" },

  // Geo-tagged Photo
  { type: "geo_photo", label: "Geo-tagged Photo", category: "advanced", icon: "📍", defaultLabel: "Venue Check-in Photo with GPS", description: "Photo with optional verified coordinates" },

  // Repeatable Sections
  { type: "repeatable_group", label: "Repeatable Group", category: "advanced", icon: "👥", defaultLabel: "Team Members List", description: "Dynamic add/remove member rows" },

  // Layout Blocks
  { type: "heading", label: "Section Heading", category: "layout", icon: "H", defaultLabel: "Participant Information", description: "Visual bold title separator" },
  { type: "subheading", label: "Subheading", category: "layout", icon: "h2", defaultLabel: "Academic & Contact Details", description: "Secondary section subtitle" },
  { type: "divider", label: "Horizontal Divider", category: "layout", icon: "—", defaultLabel: "Divider", description: "Visual separation line" },
  { type: "info_card", label: "Information Notice", category: "layout", icon: "ℹ", defaultLabel: "Please ensure all details match college records.", description: "Blue informative callout card" },
  { type: "notice", label: "Warning / Important Notice", category: "layout", icon: "⚠️", defaultLabel: "Late registrations will not be entertained.", description: "Amber warning highlight box" },
];

// -----------------------------------------------------------------------------
// 8 Starter Form Templates
// -----------------------------------------------------------------------------
interface FormTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  icon: string;
  layout_mode: FormLayoutMode;
  sections: FormSection[];
  fields: EventFormField[];
}

const STARTER_TEMPLATES: FormTemplate[] = [
  {
    id: "general_reg",
    name: "General Event Registration",
    description: "Standard event sign-up with participant information and preferences.",
    category: "General",
    icon: "📋",
    layout_mode: "single_page",
    sections: [
      { id: "sec_info", title: "Participant Information", description: "Enter your official student credentials", order: 0 },
      { id: "sec_prefs", title: "Attendance & Preferences", description: "Logistical preferences for the event", order: 1 },
    ],
    fields: [
      { id: "g_1", field_key: "full_name", field_type: "text", label: "Student Full Name", placeholder: "e.g. John Doe", required: true, display_order: 0, enabled: true, section_id: "sec_info" },
      { id: "g_2", field_key: "register_number", field_type: "text", label: "Register Number", placeholder: "e.g. SEC25CO001", required: true, display_order: 1, enabled: true, section_id: "sec_info" },
      { id: "g_3", field_key: "email", field_type: "email", label: "College Email", placeholder: "student@sairamtap.edu.in", required: true, display_order: 2, enabled: true, section_id: "sec_info" },
      { id: "g_4", field_key: "phone", field_type: "phone", label: "WhatsApp Contact Number", placeholder: "10-digit mobile number", required: true, display_order: 3, enabled: true, section_id: "sec_info" },
      {
        id: "g_5", field_key: "attendance_mode", field_type: "radio", label: "Mode of Attendance", required: true, display_order: 4, enabled: true, section_id: "sec_prefs",
        options_config: [{ label: "In-Person (On-Campus)", value: "in_person" }, { label: "Online (Virtual Stream)", value: "online" }]
      },
      {
        id: "g_6", field_key: "dietary_preference", field_type: "dropdown", label: "Dietary Preference (for lunch)", required: false, display_order: 5, enabled: true, section_id: "sec_prefs",
        options_config: [{ label: "Vegetarian", value: "veg" }, { label: "Non-Vegetarian", value: "non_veg" }]
      },
      { id: "g_7", field_key: "expectations", field_type: "textarea", label: "What do you hope to learn or experience?", placeholder: "Share your goals...", required: false, display_order: 6, enabled: true, section_id: "sec_prefs" },
    ],
  },
  {
    id: "workshop_reg",
    name: "Hands-on Technical Workshop",
    description: "Detailed workshop registration with skill level assessment, prerequisites, and laptop setup.",
    category: "Workshop",
    icon: "💻",
    layout_mode: "multi_step",
    sections: [
      { id: "sec_part", title: "Participant Details", description: "Official contact & college identification", order: 0 },
      { id: "sec_tech", title: "Technical Background", description: "Your programming and tools experience", order: 1 },
      { id: "sec_logistics", title: "Hardware & Logistics", description: "Hardware requirements for lab sessions", order: 2 },
    ],
    fields: [
      { id: "w_1", field_key: "full_name", field_type: "text", label: "Participant Name", placeholder: "e.g. Priya Sharma", required: true, display_order: 0, enabled: true, section_id: "sec_part" },
      { id: "w_2", field_key: "register_number", field_type: "text", label: "Register Number", placeholder: "e.g. SEC25CO045", required: true, display_order: 1, enabled: true, section_id: "sec_part" },
      { id: "w_3", field_key: "email", field_type: "email", label: "College Email", placeholder: "student@sairamtap.edu.in", required: true, display_order: 2, enabled: true, section_id: "sec_part" },
      {
        id: "w_4", field_key: "experience_level", field_type: "difficulty_rating", label: "Self-assessed Skill Level", required: true, display_order: 3, enabled: true, section_id: "sec_tech",
        rating_config: { options: ["Beginner", "Intermediate", "Advanced"], scale_type: "labels" }
      },
      {
        id: "w_5", field_key: "preferred_languages", field_type: "checkbox", label: "Languages / Frameworks you know", required: true, display_order: 4, enabled: true, section_id: "sec_tech",
        options_config: [{ label: "Python", value: "python" }, { label: "JavaScript / TypeScript", value: "js_ts" }, { label: "Java / C++", value: "java_cpp" }, { label: "Cloudflare Workers / Serverless", value: "workers" }]
      },
      {
        id: "w_6", field_key: "has_laptop", field_type: "yes_no", label: "Will you bring your own laptop for hands-on sessions?", required: true, display_order: 5, enabled: true, section_id: "sec_logistics"
      },
      {
        id: "w_7", field_key: "laptop_os", field_type: "dropdown", label: "Laptop Operating System", required: true, display_order: 6, enabled: true, section_id: "sec_logistics",
        conditions: [{ field: "has_laptop", operator: "equals", value: "yes", action: "show" }],
        options_config: [{ label: "Windows 11", value: "win11" }, { label: "macOS (Apple Silicon)", value: "macos" }, { label: "Linux (Ubuntu / Fedora)", value: "linux" }]
      },
    ],
  },
  {
    id: "hackathon_team",
    name: "Hackathon & Project Competition",
    description: "Team-based registration with project abstract, track selection, and repeatable team members list.",
    category: "Competition",
    icon: "🚀",
    layout_mode: "multi_step",
    sections: [
      { id: "sec_proj", title: "Project & Innovation Pitch", description: "Describe your solution, theme and track", order: 0 },
      { id: "sec_team", title: "Team Members Roster", description: "Add up to 4 team members with their roles", order: 1 },
      { id: "sec_docs", title: "Pitch Deck & Links", description: "Supporting presentation and repository links", order: 2 },
    ],
    fields: [
      { id: "h_1", field_key: "team_name", field_type: "text", label: "Team Name", placeholder: "e.g. ByteBuilders", required: true, display_order: 0, enabled: true, section_id: "sec_proj" },
      { id: "h_2", field_key: "project_title", field_type: "text", label: "Project Title", placeholder: "e.g. Smart Campus Energy AI", required: true, display_order: 1, enabled: true, section_id: "sec_proj" },
      {
        id: "h_3", field_key: "hackathon_track", field_type: "dropdown", label: "Competition Track", required: true, display_order: 2, enabled: true, section_id: "sec_proj",
        options_config: [
          { label: "AI & Autonomous Agents", value: "ai_agents" },
          { label: "Cloud & Edge Computing", value: "cloud_edge" },
          { label: "FinTech & Blockchain", value: "fintech" },
          { label: "Healthcare & Social Good", value: "healthcare" },
          { label: "Open Innovation", value: "open_innovation" },
        ]
      },
      { id: "h_4", field_key: "abstract", field_type: "textarea", label: "Problem Statement & Proposed Solution", placeholder: "Describe the core challenge and your technical approach in 200-300 words...", required: true, display_order: 3, enabled: true, section_id: "sec_proj" },
      {
        id: "h_5", field_key: "team_members", field_type: "repeatable_group", label: "Team Members", required: true, display_order: 4, enabled: true, section_id: "sec_team",
        repeatable_config: {
          entity_name: "Team Member",
          min_items: 1,
          max_items: 4,
          add_button_text: "+ Add Team Member",
          fields: [
            { id: "tm_name", field_key: "member_name", field_type: "text", label: "Member Full Name", required: true, display_order: 0, enabled: true },
            { id: "tm_reg", field_key: "member_reg", field_type: "text", label: "Register Number", required: true, display_order: 1, enabled: true },
            {
              id: "tm_role", field_key: "member_role", field_type: "dropdown", label: "Team Role", required: true, display_order: 2, enabled: true,
              options_config: [
                { label: "Team Lead", value: "lead" },
                { label: "Frontend Engineer", value: "frontend" },
                { label: "Backend / Cloud Engineer", value: "backend" },
                { label: "AI / Data Engineer", value: "ai_data" },
                { label: "UI/UX Designer", value: "design" },
              ]
            },
            { id: "tm_email", field_key: "member_email", field_type: "email", label: "Email Address", required: true, display_order: 3, enabled: true },
          ]
        }
      },
      { id: "h_6", field_key: "github_repo", field_type: "url", label: "GitHub Repository / Demo Link", placeholder: "https://github.com/...", required: false, display_order: 5, enabled: true, section_id: "sec_docs" },
      { id: "h_7", field_key: "pitch_deck", field_type: "pdf_upload", label: "Upload Pitch Deck (PDF)", description: "Max 10 slides, PDF format under 15MB", required: true, display_order: 6, enabled: true, section_id: "sec_docs" },
    ],
  },
  {
    id: "internship_noc",
    name: "Internship & NOC Request Form",
    description: "Official student request form for industrial internship approval and college NOC.",
    category: "Internship",
    icon: "🏢",
    layout_mode: "single_page",
    sections: [
      { id: "sec_stu", title: "Student Academic Record", description: "Academic and mentor details", order: 0 },
      { id: "sec_comp", title: "Company & Role Specifications", description: "Information about the hiring organization", order: 1 },
      { id: "sec_verify", title: "Verification & Offer Letter", description: "Official documentation upload", order: 2 },
    ],
    fields: [
      { id: "i_1", field_key: "student_name", field_type: "text", label: "Student Name", required: true, display_order: 0, enabled: true, section_id: "sec_stu" },
      { id: "i_2", field_key: "reg_number", field_type: "text", label: "Register Number", required: true, display_order: 1, enabled: true, section_id: "sec_stu" },
      { id: "i_3", field_key: "cgpa", field_type: "number", label: "Current Cumulative CGPA", placeholder: "e.g. 8.75", required: true, display_order: 2, enabled: true, section_id: "sec_stu" },
      { id: "i_4", field_key: "company_name", field_type: "text", label: "Company / Organization Name", placeholder: "e.g. Zoho Corporation", required: true, display_order: 3, enabled: true, section_id: "sec_comp" },
      { id: "i_5", field_key: "internship_role", field_type: "text", label: "Role / Job Title", placeholder: "e.g. Software Engineering Intern", required: true, display_order: 4, enabled: true, section_id: "sec_comp" },
      {
        id: "i_6", field_key: "work_mode", field_type: "radio", label: "Work Arrangement", required: true, display_order: 5, enabled: true, section_id: "sec_comp",
        options_config: [{ label: "On-Site (At Office)", value: "onsite" }, { label: "Remote (Work from Home)", value: "remote" }, { label: "Hybrid", value: "hybrid" }]
      },
      { id: "i_7", field_key: "internship_period", field_type: "date_range", label: "Internship Duration (Start & End Dates)", required: true, display_order: 6, enabled: true, section_id: "sec_comp" },
      { id: "i_8", field_key: "offer_letter", field_type: "pdf_upload", label: "Upload Official Offer Letter (PDF)", description: "Must include company letterhead and signature", required: true, display_order: 7, enabled: true, section_id: "sec_verify" },
    ],
  },
  {
    id: "exam_feedback",
    name: "Exam Attendance & Session Feedback",
    description: "Session attendance check, geo-verification photo, and question paper feedback.",
    category: "Academic",
    icon: "✍️",
    layout_mode: "single_page",
    sections: [
      { id: "sec_sess", title: "Exam Session Information", description: "Subject code and hall assignment", order: 0 },
      { id: "sec_photo", title: "Identity & Venue Verification", description: "Live verification photograph", order: 1 },
      { id: "sec_rev", title: "Subject Feedback", description: "Confidential paper evaluation", order: 2 },
    ],
    fields: [
      { id: "e_1", field_key: "subject_code", field_type: "text", label: "Subject Code & Title", placeholder: "e.g. CS3401 - Cloud Computing", required: true, display_order: 0, enabled: true, section_id: "sec_sess" },
      { id: "e_2", field_key: "hall_number", field_type: "text", label: "Exam Hall / Lab Number", placeholder: "e.g. Lab 4 (Alpha Block)", required: true, display_order: 1, enabled: true, section_id: "sec_sess" },
      { id: "e_3", field_key: "venue_photo", field_type: "geo_photo", label: "Hall Verification Photo", description: "Take a photo inside the hall with camera", required: true, display_order: 2, enabled: true, section_id: "sec_photo" },
      {
        id: "e_4", field_key: "paper_difficulty", field_type: "difficulty_rating", label: "Question Paper Difficulty", required: true, display_order: 3, enabled: true, section_id: "sec_rev",
        rating_config: { options: ["Easy", "Moderate", "Challenging", "Very Tough"], scale_type: "labels" }
      },
      {
        id: "e_5", field_key: "hall_cleanliness", field_type: "star_rating", label: "Hall Environment & Seating", required: true, display_order: 4, enabled: true, section_id: "sec_rev",
        rating_config: { max_rating: 5, min_label: "Poor", max_label: "Excellent" }
      },
    ],
  },
  {
    id: "event_feedback",
    name: "Event & Speaker Feedback Form",
    description: "Post-event satisfaction survey with star ratings, speaker evaluations, and suggestions.",
    category: "Feedback",
    icon: "⭐",
    layout_mode: "single_page",
    sections: [
      { id: "sec_ratings", title: "Session Ratings", description: "Rate different aspects of the event", order: 0 },
      { id: "sec_written", title: "Detailed Feedback & Suggestions", description: "Help us improve future department events", order: 1 },
    ],
    fields: [
      {
        id: "f_1", field_key: "overall_satisfaction", field_type: "satisfaction_rating", label: "Overall Satisfaction", required: true, display_order: 0, enabled: true, section_id: "sec_ratings",
        rating_config: { options: ["Poor", "Fair", "Good", "Very Good", "Excellent"], scale_type: "labels" }
      },
      {
        id: "f_2", field_key: "speaker_rating", field_type: "star_rating", label: "Speaker Knowledge & Presentation", required: true, display_order: 1, enabled: true, section_id: "sec_ratings",
        rating_config: { max_rating: 5, min_label: "Poor", max_label: "Outstanding" }
      },
      {
        id: "f_3", field_key: "content_relevance", field_type: "star_rating", label: "Content Relevance & Depth", required: true, display_order: 2, enabled: true, section_id: "sec_ratings",
        rating_config: { max_rating: 5, min_label: "Irrelevant", max_label: "Highly Relevant" }
      },
      {
        id: "f_4", field_key: "nps_score", field_type: "numeric_rating", label: "How likely are you to recommend this event to peers? (0-10)", required: true, display_order: 3, enabled: true, section_id: "sec_ratings",
        validation_config: { min_val: 0, max_val: 10 }
      },
      { id: "f_5", field_key: "takeaway", field_type: "textarea", label: "What was your biggest takeaway from today?", placeholder: "Share your thoughts...", required: false, display_order: 4, enabled: true, section_id: "sec_written" },
      { id: "f_6", field_key: "future_topics", field_type: "text", label: "Topics you would like to see in next events", placeholder: "e.g. Docker, Kubernetes, LangChain", required: false, display_order: 5, enabled: true, section_id: "sec_written" },
    ],
  },
  {
    id: "cultural_competition",
    name: "Cultural & Talent Competition",
    description: "Creative performances, solo or group categories, track uploads, and props requests.",
    category: "Cultural",
    icon: "🎭",
    layout_mode: "single_page",
    sections: [
      { id: "sec_act", title: "Act / Performance Details", description: "Tell us about your presentation", order: 0 },
      { id: "sec_media", title: "Music Track & Audio Upload", description: "Background music track", order: 1 },
    ],
    fields: [
      { id: "c_1", field_key: "act_title", field_type: "text", label: "Performance / Song / Act Title", placeholder: "e.g. Classical Fusion", required: true, display_order: 0, enabled: true, section_id: "sec_act" },
      {
        id: "c_2", field_key: "cultural_category", field_type: "dropdown", label: "Competition Category", required: true, display_order: 1, enabled: true, section_id: "sec_act",
        options_config: [
          { label: "Solo Singing (Western/Carnatic)", value: "singing" },
          { label: "Solo Dance", value: "solo_dance" },
          { label: "Group Dance (3-8 members)", value: "group_dance" },
          { label: "Instrumental Solo", value: "instrumental" },
          { label: "Mime / Skit", value: "skit" },
        ]
      },
      {
        id: "c_3", field_key: "is_group", field_type: "radio", label: "Performance Type", required: true, display_order: 2, enabled: true, section_id: "sec_act",
        options_config: [{ label: "Solo Performance", value: "solo" }, { label: "Group Performance", value: "group" }]
      },
      {
        id: "c_4", field_key: "audio_track", field_type: "file", label: "Upload Audio Track (MP3/WAV)", description: "Max 20MB, clean audio cut to length", required: false, display_order: 3, enabled: true, section_id: "sec_media",
        validation_config: { allowed_types: [".mp3", ".wav"], max_size_mb: 20 }
      },
      { id: "c_5", field_key: "prop_requirements", field_type: "textarea", label: "Stage & Sound Requirements", placeholder: "e.g. 2 standing mics, 1 table, keyboard stand...", required: false, display_order: 4, enabled: true, section_id: "sec_media" },
    ],
  },
  {
    id: "student_survey",
    name: "Student Campus & Academic Survey",
    description: "Comprehensive opinion and facilities survey with rating blocks and conditional questions.",
    category: "Survey",
    icon: "📊",
    layout_mode: "single_page",
    sections: [
      { id: "sec_demo", title: "Demographics", description: "Academic year and section", order: 0 },
      { id: "sec_fac", title: "Facilities Evaluation", description: "Rate campus resources", order: 1 },
    ],
    fields: [
      {
        id: "s_1", field_key: "year_of_study", field_type: "dropdown", label: "Year of Study", required: true, display_order: 0, enabled: true, section_id: "sec_demo",
        options_config: [{ label: "1st Year", value: "1" }, { label: "2nd Year", value: "2" }, { label: "3rd Year", value: "3" }, { label: "4th Year", value: "4" }]
      },
      {
        id: "s_2", field_key: "commute_type", field_type: "radio", label: "Commute Type", required: true, display_order: 1, enabled: true, section_id: "sec_demo",
        options_config: [{ label: "Day Scholar (College Bus)", value: "bus" }, { label: "Day Scholar (Self)", value: "self" }, { label: "Hosteller", value: "hostel" }]
      },
      {
        id: "s_3", field_key: "wifi_experience", field_type: "satisfaction_rating", label: "Campus Wi-Fi & Internet Speed", required: true, display_order: 2, enabled: true, section_id: "sec_fac",
        rating_config: { options: ["Very Poor", "Poor", "Average", "Good", "Excellent"], scale_type: "labels" }
      },
      {
        id: "s_4", field_key: "lab_facilities", field_type: "star_rating", label: "Department Computing Labs", required: true, display_order: 3, enabled: true, section_id: "sec_fac",
        rating_config: { max_rating: 5, min_label: "Needs Improvement", max_label: "World Class" }
      },
      { id: "s_5", field_key: "general_suggestions", field_type: "textarea", label: "Key Suggestions or Needs", placeholder: "What one thing would make your student experience better?", required: false, display_order: 4, enabled: true, section_id: "sec_fac" },
    ],
  },
];

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------
export const EventFormBuilder: React.FC<EventFormBuilderProps> = ({
  event,
  initialFields = [],
  initialSections = [],
  onSaved,
  onBack,
}) => {
  // Sections state
  const [sections, setSections] = useState<FormSection[]>(() => {
    if (initialSections && initialSections.length > 0) {
      return [...initialSections];
    }
    return [{ id: "sec_default", title: "General Information", description: "Default section for event registration", order: 0 }];
  });

  // Fields state
  const [fields, setFields] = useState<EventFormField[]>(() => {
    if (initialFields && initialFields.length > 0) {
      return initialFields.map((f, idx) => ({
        ...f,
        section_id: f.section_id || (initialSections[0]?.id || "sec_default"),
        display_order: f.display_order ?? idx,
      }));
    }
    // Default 3 starter fields
    return [
      {
        id: "field_name_default",
        field_key: "full_name",
        field_type: "text",
        label: "Participant Name",
        description: "Official name as registered in college records",
        placeholder: "e.g. John Doe",
        required: true,
        display_order: 0,
        enabled: true,
        section_id: "sec_default",
      },
      {
        id: "field_email_default",
        field_key: "contact_email",
        field_type: "email",
        label: "College Email",
        description: "Registration confirmation will be sent here",
        placeholder: "e.g. student@sairamtap.edu.in",
        required: true,
        display_order: 1,
        enabled: true,
        section_id: "sec_default",
      },
      {
        id: "field_phone_default",
        field_key: "phone_number",
        field_type: "phone",
        label: "WhatsApp / Contact Number",
        placeholder: "10-digit mobile number",
        required: true,
        display_order: 2,
        enabled: true,
        section_id: "sec_default",
      },
    ];
  });

  const [activeSectionId, setActiveSectionId] = useState<string>(sections[0]?.id || "sec_default");
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(fields[0]?.id || null);
  const [layoutMode, setLayoutMode] = useState<FormLayoutMode>(event.form_layout_mode || "single_page");

  // Filter / Search for palette
  const [paletteSearch, setPaletteSearch] = useState<string>("");
  const [paletteCategory, setPaletteCategory] = useState<string>("all");

  // Mode: builder vs live student preview
  const [viewMode, setViewMode] = useState<"builder" | "preview">("builder");
  const [previewDevice, setPreviewDevice] = useState<"desktop" | "mobile">("desktop");

  // Template dropdown state
  const [showTemplatesModal, setShowTemplatesModal] = useState<boolean>(false);

  // Status
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Currently selected field
  const selectedField = useMemo(() => fields.find((f) => f.id === selectedFieldId), [fields, selectedFieldId]);

  // Filtered palette items
  const filteredPalette = useMemo(() => {
    return FIELD_PALETTE.filter((item) => {
      const matchesSearch =
        item.label.toLowerCase().includes(paletteSearch.toLowerCase()) ||
        item.description.toLowerCase().includes(paletteSearch.toLowerCase());
      const matchesCat = paletteCategory === "all" || item.category === paletteCategory;
      return matchesSearch && matchesCat;
    });
  }, [paletteSearch, paletteCategory]);

  // Add field to active section
  const handleAddField = (type: FormFieldType) => {
    const def = FIELD_PALETTE.find((d) => d.type === type);
    const newId = `field_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const newKey = `f_${type}_${fields.length + 1}`;

    const defaultOptions: FormFieldOption[] =
      type === "dropdown" || type === "radio" || type === "checkbox" || type === "multi_select"
        ? [
            { label: "Option 1", value: "option_1" },
            { label: "Option 2", value: "option_2" },
            { label: "Option 3", value: "option_3" },
          ]
        : [];

    let defaultRatingConfig: RatingConfig | undefined;
    if (type === "star_rating") {
      defaultRatingConfig = { max_rating: 5, min_label: "Poor", max_label: "Excellent", scale_type: "stars" };
    } else if (type === "numeric_rating") {
      defaultRatingConfig = { max_rating: 10, min_label: "0 - Not Likely", max_label: "10 - Highly Likely", scale_type: "numbers" };
    } else if (type === "satisfaction_rating") {
      defaultRatingConfig = { options: ["Poor", "Fair", "Good", "Very Good", "Excellent"], scale_type: "labels" };
    } else if (type === "difficulty_rating") {
      defaultRatingConfig = { options: ["Beginner", "Intermediate", "Advanced"], scale_type: "labels" };
    }

    let defaultRepeatable: RepeatableConfig | undefined;
    if (type === "repeatable_group") {
      defaultRepeatable = {
        entity_name: "Team Member",
        min_items: 1,
        max_items: 4,
        add_button_text: "+ Add Member",
        fields: [
          { id: `rep_sub_1_${Date.now()}`, field_key: "name", field_type: "text", label: "Full Name", required: true, display_order: 0, enabled: true },
          { id: `rep_sub_2_${Date.now()}`, field_key: "role", field_type: "text", label: "Role / Contribution", required: true, display_order: 1, enabled: true },
        ],
      };
    }

    const newField: EventFormField = {
      id: newId,
      field_key: newKey,
      field_type: type,
      label: def?.defaultLabel || "New Field",
      description: "",
      placeholder: "",
      required: !["heading", "subheading", "divider", "info_card", "notice"].includes(type),
      display_order: fields.length,
      enabled: true,
      section_id: activeSectionId,
      options_config: defaultOptions,
      rating_config: defaultRatingConfig,
      repeatable_config: defaultRepeatable,
      validation_config:
        type === "file" || type === "pdf_upload" || type === "image_upload"
          ? { allowed_types: [".pdf", ".png", ".jpg"], max_size_mb: 10 }
          : {},
    };

    setFields((prev) => [...prev, newField]);
    setSelectedFieldId(newId);
  };

  // Duplicate an existing field
  const handleDuplicateField = (fieldToDuplicate: EventFormField) => {
    const newId = `field_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const newKey = `${fieldToDuplicate.field_key}_copy_${Math.floor(Math.random() * 900 + 100)}`;
    const duplicate: EventFormField = {
      ...JSON.parse(JSON.stringify(fieldToDuplicate)),
      id: newId,
      field_key: newKey,
      label: `${fieldToDuplicate.label} (Copy)`,
      display_order: fields.length,
    };
    setFields((prev) => [...prev, duplicate]);
    setSelectedFieldId(newId);
  };

  // Remove field
  const handleRemoveField = (id: string) => {
    setFields((prev) => {
      const next = prev.filter((f) => f.id !== id);
      if (selectedFieldId === id) {
        setSelectedFieldId(next[0]?.id || null);
      }
      return next;
    });
  };

  // Move field order
  const handleMoveField = (index: number, direction: "up" | "down") => {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= fields.length) return;

    setFields((prev) => {
      const copy = [...prev];
      const temp = copy[index];
      copy[index] = copy[targetIndex];
      copy[targetIndex] = temp;
      copy.forEach((f, idx) => {
        f.display_order = idx;
      });
      return copy;
    });
  };

  // Update selected field property
  const handleUpdateSelectedField = (patch: Partial<EventFormField>) => {
    if (!selectedFieldId) return;
    setFields((prev) =>
      prev.map((f) => {
        if (f.id === selectedFieldId) {
          return { ...f, ...patch };
        }
        return f;
      })
    );
  };

  // Section Management
  const handleAddSection = () => {
    const newSecId = `sec_${Date.now()}`;
    const nextOrder = sections.length;
    const newSec: FormSection = {
      id: newSecId,
      title: `Section ${nextOrder + 1}`,
      description: "Optional section description",
      order: nextOrder,
    };
    setSections((prev) => [...prev, newSec]);
    setActiveSectionId(newSecId);
  };

  const handleUpdateSection = (secId: string, patch: Partial<FormSection>) => {
    setSections((prev) =>
      prev.map((s) => (s.id === secId ? { ...s, ...patch } : s))
    );
  };

  const handleRemoveSection = (secId: string) => {
    if (sections.length <= 1) {
      alert("A form must have at least one section.");
      return;
    }
    // Re-assign fields belonging to this section to the first available section
    const remaining = sections.filter((s) => s.id !== secId);
    const fallbackSecId = remaining[0].id;
    setSections(remaining);
    setFields((prev) =>
      prev.map((f) => (f.section_id === secId ? { ...f, section_id: fallbackSecId } : f))
    );
    if (activeSectionId === secId) {
      setActiveSectionId(fallbackSecId);
    }
  };

  // Load a starter template
  const handleLoadTemplate = (tpl: FormTemplate) => {
    if (fields.length > 0 && !confirm(`Loading the "${tpl.name}" template will replace your current form layout. Continue?`)) {
      return;
    }
    setSections(tpl.sections);
    setFields(tpl.fields);
    setLayoutMode(tpl.layout_mode);
    setActiveSectionId(tpl.sections[0]?.id || "sec_default");
    setSelectedFieldId(tpl.fields[0]?.id || null);
    setShowTemplatesModal(false);
    setSaveSuccess(`Loaded "${tpl.name}" starter template!`);
  };

  // Save to Backend
  const handleSaveForm = async () => {
    if (fields.length === 0) {
      setErrorMessage("Please add at least one form field before saving.");
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);
    setSaveSuccess(null);

    try {
      // Also update event layout mode if changed
      if (layoutMode !== event.form_layout_mode) {
        await eventsApi.updateEvent(event.id, { form_layout_mode: layoutMode });
      }

      const res = await eventsApi.saveEventForm(event.id, fields, sections);
      setSaveSuccess("Form layout and fields saved successfully!");
      if (onSaved) onSaved();
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to save form fields. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* ===================================================================== */}
      {/* TOP TOOLBAR: Actions, Template Picker, Preview Toggle, Save Draft     */}
      {/* ===================================================================== */}
      <div className="rounded-2xl border border-slate-200 dark:border-[#292929] bg-white dark:bg-[#181818] p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-2xs">
        <div>
          <div className="flex items-center gap-2">
            {onBack && (
              <button
                type="button"
                onClick={onBack}
                className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 cursor-pointer"
                title="Back to Event Details"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            )}
            <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-[#F5F5F5]">
              Form Builder: <span className="text-blue-600 dark:text-[#5DD62C]">{event.title}</span>
            </h2>
          </div>
          <p className="text-xs text-slate-500 dark:text-[#A3A3A3] mt-0.5">
            {sections.length} Section{sections.length > 1 ? "s" : ""} • {fields.length} Field{fields.length > 1 ? "s" : ""} • Layout:{" "}
            <span className="font-semibold text-slate-700 dark:text-slate-300">
              {layoutMode === "multi_step" ? "Multi-Step Wizard" : "Single-Page Form"}
            </span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Templates Picker Trigger */}
          <button
            type="button"
            onClick={() => setShowTemplatesModal(true)}
            className="px-3 py-1.5 text-xs font-semibold rounded-xl border border-slate-300 dark:border-[#383838] bg-slate-50 dark:bg-[#202020] text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#252525] transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <span>⚡ Starter Templates</span>
          </button>

          {/* Single-Page vs Multi-Step Mode Toggle */}
          <div className="inline-flex rounded-xl bg-slate-100 dark:bg-[#202020] p-1 border border-slate-200 dark:border-[#292929]">
            <button
              type="button"
              onClick={() => setLayoutMode("single_page")}
              className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                layoutMode === "single_page"
                  ? "bg-white dark:bg-[#181818] text-slate-900 dark:text-[#F5F5F5] shadow-2xs"
                  : "text-slate-600 dark:text-[#A3A3A3] hover:text-slate-900"
              }`}
              title="All sections rendered on a single scrolling page"
            >
              📄 Single Page
            </button>
            <button
              type="button"
              onClick={() => setLayoutMode("multi_step")}
              className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                layoutMode === "multi_step"
                  ? "bg-white dark:bg-[#181818] text-blue-600 dark:text-[#5DD62C] shadow-2xs"
                  : "text-slate-600 dark:text-[#A3A3A3] hover:text-slate-900"
              }`}
              title="Render as step-by-step wizard with Next / Back navigation"
            >
              ➡️ Wizard Steps
            </button>
          </div>

          {/* Builder vs Preview Toggle */}
          <div className="inline-flex rounded-xl bg-slate-100 dark:bg-[#202020] p-1 border border-slate-200 dark:border-[#292929]">
            <button
              type="button"
              onClick={() => setViewMode("builder")}
              className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                viewMode === "builder"
                  ? "bg-white dark:bg-[#181818] text-slate-900 dark:text-[#F5F5F5] shadow-2xs"
                  : "text-slate-600 dark:text-[#A3A3A3] hover:text-slate-900"
              }`}
            >
              🛠 Editor
            </button>
            <button
              type="button"
              onClick={() => setViewMode("preview")}
              className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                viewMode === "preview"
                  ? "bg-white dark:bg-[#181818] text-blue-600 dark:text-[#5DD62C] shadow-2xs"
                  : "text-slate-600 dark:text-[#A3A3A3] hover:text-slate-900"
              }`}
            >
              👁 Preview
            </button>
          </div>

          {/* Save Button */}
          <button
            type="button"
            onClick={handleSaveForm}
            disabled={isSaving}
            className="rounded-xl bg-blue-600 dark:bg-[#5DD62C] hover:bg-blue-700 dark:hover:bg-[#4cb824] text-white dark:text-black font-semibold text-xs px-4 py-2 shadow-2xs active:scale-95 transition-all cursor-pointer disabled:opacity-50 min-h-[36px] flex items-center gap-1.5"
          >
            {isSaving ? (
              <>
                <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                Saving...
              </>
            ) : (
              "Save Form Changes"
            )}
          </button>
        </div>
      </div>

      {/* Notifications */}
      {saveSuccess && (
        <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-800 dark:text-emerald-300 font-semibold flex items-center justify-between">
          <span>✓ {saveSuccess}</span>
          <button onClick={() => setSaveSuccess(null)} className="text-emerald-600 hover:text-emerald-800 cursor-pointer">×</button>
        </div>
      )}
      {errorMessage && (
        <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-800 dark:text-rose-300 font-semibold flex items-center justify-between">
          <span>⚠️ {errorMessage}</span>
          <button onClick={() => setErrorMessage(null)} className="text-rose-600 hover:text-rose-800 cursor-pointer">×</button>
        </div>
      )}

      {/* ===================================================================== */}
      {/* STARTER TEMPLATES MODAL                                               */}
      {/* ===================================================================== */}
      {showTemplatesModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-4xl bg-white dark:bg-[#1a1a1a] rounded-2xl border border-slate-200 dark:border-[#2d2d2d] shadow-2xl p-6 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-[#292929]">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-[#F5F5F5] flex items-center gap-2">
                  <span>⚡ Select a Starter Form Template</span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-[#A3A3A3] mt-0.5">
                  Jumpstart your event form with industry-standard pre-configured fields and sections.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowTemplatesModal(false)}
                className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4 overflow-y-auto pr-1">
              {STARTER_TEMPLATES.map((tpl) => (
                <div
                  key={tpl.id}
                  onClick={() => handleLoadTemplate(tpl)}
                  className="p-4 rounded-xl border border-slate-200 dark:border-[#2d2d2d] bg-slate-50 dark:bg-[#202020] hover:border-blue-500 dark:hover:border-[#5DD62C] hover:shadow-md transition-all cursor-pointer flex flex-col justify-between group"
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-2xl">{tpl.icon}</span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-200 dark:bg-[#2d2d2d] text-slate-700 dark:text-slate-300">
                        {tpl.category}
                      </span>
                    </div>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-[#F5F5F5] group-hover:text-blue-600 dark:group-hover:text-[#5DD62C]">
                      {tpl.name}
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-[#A3A3A3] mt-1 line-clamp-2">
                      {tpl.description}
                    </p>
                  </div>
                  <div className="mt-3 pt-3 border-t border-slate-200/60 dark:border-[#2d2d2d] flex items-center justify-between text-[11px] text-slate-500 dark:text-[#888]">
                    <span>{tpl.sections.length} Sections • {tpl.fields.length} Fields</span>
                    <span className="text-blue-600 dark:text-[#5DD62C] font-semibold flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                      Load Template →
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-[#292929] flex justify-end">
              <button
                type="button"
                onClick={() => setShowTemplatesModal(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* VIEW: LIVE STUDENT PREVIEW MODE                                      */}
      {/* ===================================================================== */}
      {viewMode === "preview" ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-slate-100 dark:bg-[#202020] p-2 rounded-xl">
            <span className="text-xs font-semibold text-slate-600 dark:text-[#A3A3A3] px-2">
              Viewing form as a student will see it:
            </span>
            <div className="flex items-center gap-1 bg-white dark:bg-[#181818] p-1 rounded-lg border border-slate-200 dark:border-[#292929]">
              <button
                type="button"
                onClick={() => setPreviewDevice("desktop")}
                className={`px-2.5 py-1 text-xs font-semibold rounded cursor-pointer ${
                  previewDevice === "desktop" ? "bg-blue-600 dark:bg-[#5DD62C] text-white dark:text-black" : "text-slate-600 dark:text-[#A3A3A3]"
                }`}
              >
                🖥 Desktop
              </button>
              <button
                type="button"
                onClick={() => setPreviewDevice("mobile")}
                className={`px-2.5 py-1 text-xs font-semibold rounded cursor-pointer ${
                  previewDevice === "mobile" ? "bg-blue-600 dark:bg-[#5DD62C] text-white dark:text-black" : "text-slate-600 dark:text-[#A3A3A3]"
                }`}
              >
                📱 Mobile
              </button>
            </div>
          </div>

          <div className={`mx-auto transition-all ${previewDevice === "mobile" ? "max-w-sm border-4 border-slate-800 rounded-3xl p-3 shadow-2xl" : "max-w-3xl"}`}>
            <div className="bg-white dark:bg-[#181818] rounded-2xl border border-slate-200 dark:border-[#292929] p-6 shadow-sm space-y-6">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-[#F5F5F5]">{event.title}</h3>
                {event.subtitle && <p className="text-xs font-medium text-blue-600 dark:text-[#5DD62C] mt-0.5">{event.subtitle}</p>}
                {event.short_description && <p className="text-xs text-slate-500 dark:text-[#A3A3A3] mt-2">{event.short_description}</p>}
              </div>

              {/* Render preview sections */}
              {sections.map((sec, secIdx) => {
                const secFields = fields.filter((f) => f.section_id === sec.id);
                if (secFields.length === 0) return null;
                return (
                  <div key={sec.id} className="pt-4 first:pt-0 border-t first:border-t-0 border-slate-100 dark:border-[#282828] space-y-4">
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        {layoutMode === "multi_step" ? `Step ${secIdx + 1}: ` : ""}
                        {sec.title}
                      </h4>
                      {sec.description && <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">{sec.description}</p>}
                    </div>

                    <div className="space-y-4">
                      {secFields.map((f) => (
                        <div key={f.id} className="space-y-1">
                          {["heading", "subheading", "divider", "info_card", "notice"].includes(f.field_type) ? (
                            f.field_type === "heading" ? (
                              <h3 className="text-sm font-bold text-slate-900 dark:text-white pt-2">{f.label}</h3>
                            ) : f.field_type === "subheading" ? (
                              <h4 className="text-xs font-semibold text-slate-700 dark:text-slate-300 pt-1">{f.label}</h4>
                            ) : f.field_type === "divider" ? (
                              <hr className="my-2 border-slate-200 dark:border-[#292929]" />
                            ) : f.field_type === "notice" ? (
                              <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-300">
                                ⚠️ {f.label}
                              </div>
                            ) : (
                              <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 text-xs text-blue-800 dark:text-blue-300">
                                ℹ {f.label}
                              </div>
                            )
                          ) : (
                            <>
                              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200">
                                {f.label}
                                {f.required && <span className="text-rose-500 ml-1">*</span>}
                              </label>
                              {f.description && <p className="text-[11px] text-slate-400 dark:text-[#888]">{f.description}</p>}
                              
                              {/* Mock Input Display */}
                              {f.field_type === "textarea" ? (
                                <textarea rows={3} disabled placeholder={f.placeholder || "Enter your response..."} className="w-full text-xs rounded-xl border border-slate-200 dark:border-[#2d2d2d] bg-slate-50 dark:bg-[#141414] p-2.5 opacity-70" />
                              ) : f.field_type === "dropdown" ? (
                                <select disabled className="w-full text-xs rounded-xl border border-slate-200 dark:border-[#2d2d2d] bg-slate-50 dark:bg-[#141414] p-2.5 opacity-70">
                                  <option value="">{f.placeholder || "Select an option..."}</option>
                                  {(f.options_config || []).map((opt) => (
                                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                                  ))}
                                </select>
                              ) : f.field_type === "radio" ? (
                                <div className="space-y-1.5 pt-1">
                                  {(f.options_config || []).map((opt) => (
                                    <label key={opt.value} className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                                      <input type="radio" disabled name={f.field_key} />
                                      <span>{opt.label}</span>
                                    </label>
                                  ))}
                                </div>
                              ) : f.field_type === "star_rating" ? (
                                <div className="flex items-center gap-2 pt-1">
                                  {[1, 2, 3, 4, 5].map((star) => (
                                    <span key={star} className="text-xl text-amber-400 cursor-pointer">★</span>
                                  ))}
                                  <span className="text-[11px] text-slate-400 ml-2">1 to 5 Stars</span>
                                </div>
                              ) : f.field_type === "geo_photo" ? (
                                <div className="p-4 rounded-xl border-2 border-dashed border-slate-200 dark:border-[#2d2d2d] bg-slate-50 dark:bg-[#141414] text-center space-y-2">
                                  <span className="text-2xl">📍📷</span>
                                  <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">Camera Photo with GPS Geotag</p>
                                  <p className="text-[11px] text-slate-400">Captures verified timestamp and coordinates</p>
                                </div>
                              ) : f.field_type === "repeatable_group" ? (
                                <div className="p-3 rounded-xl border border-slate-200 dark:border-[#2d2d2d] bg-slate-50 dark:bg-[#141414] space-y-2">
                                  <div className="flex items-center justify-between">
                                    <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                                      {f.repeatable_config?.entity_name || "Entry"} #1
                                    </span>
                                    <span className="text-[10px] text-blue-600 dark:text-[#5DD62C] font-semibold">+ Add Next</span>
                                  </div>
                                  <div className="p-2 bg-white dark:bg-[#1c1c1c] rounded-lg border border-slate-200/80 dark:border-[#292929] text-[11px] text-slate-400">
                                    Dynamic repeatable entries will be populated by students
                                  </div>
                                </div>
                              ) : (
                                <input type="text" disabled placeholder={f.placeholder || "Enter value..."} className="w-full text-xs rounded-xl border border-slate-200 dark:border-[#2d2d2d] bg-slate-50 dark:bg-[#141414] p-2.5 opacity-70" />
                              )}
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}

              <div className="pt-4 border-t border-slate-100 dark:border-[#282828] flex justify-end">
                <button type="button" disabled className="px-5 py-2.5 bg-blue-600 dark:bg-[#5DD62C] text-white dark:text-black font-semibold text-xs rounded-xl opacity-60">
                  Submit Registration
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* ===================================================================== */
        /* VIEW: 3-PANEL VISUAL BUILDER WORKSPACE                                */
        /* ===================================================================== */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
          {/* ------------------------------------------------------------------- */}
          {/* PANEL 1 (LEFT): PALETTE OF AVAILABLE FIELD TYPES                   */}
          {/* ------------------------------------------------------------------- */}
          <div className="lg:col-span-3 rounded-2xl border border-slate-200 dark:border-[#292929] bg-white dark:bg-[#181818] p-3 shadow-2xs space-y-3">
            <div>
              <h3 className="text-xs font-bold text-slate-900 dark:text-[#F5F5F5] uppercase tracking-wider">
                Field Palette
              </h3>
              <p className="text-[11px] text-slate-400 dark:text-[#888] mt-0.5">
                Click any field to add to the active section.
              </p>
            </div>

            {/* Search Box */}
            <input
              type="text"
              placeholder="Filter fields..."
              value={paletteSearch}
              onChange={(e) => setPaletteSearch(e.target.value)}
              className="w-full text-xs px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-[#2d2d2d] bg-slate-50 dark:bg-[#121212] text-slate-800 dark:text-[#F5F5F5] focus:outline-hidden focus:ring-1 focus:ring-blue-500"
            />

            {/* Category Filter Pills */}
            <div className="flex flex-wrap gap-1">
              {[
                { id: "all", label: "All" },
                { id: "basic", label: "Basic" },
                { id: "choice", label: "Choice" },
                { id: "rating", label: "Rating" },
                { id: "upload", label: "Upload" },
                { id: "advanced", label: "Adv" },
                { id: "layout", label: "Layout" },
              ].map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setPaletteCategory(c.id)}
                  className={`text-[10px] font-semibold px-2 py-0.5 rounded-lg transition-all cursor-pointer ${
                    paletteCategory === c.id
                      ? "bg-blue-600 dark:bg-[#5DD62C] text-white dark:text-black"
                      : "bg-slate-100 dark:bg-[#202020] text-slate-600 dark:text-[#A3A3A3] hover:text-slate-900"
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>

            {/* Field Types List */}
            <div className="space-y-1.5 max-h-[550px] overflow-y-auto pr-1">
              {filteredPalette.map((item) => (
                <button
                  key={item.type}
                  type="button"
                  onClick={() => handleAddField(item.type)}
                  className="w-full text-left p-2 rounded-xl border border-slate-100 dark:border-[#242424] hover:border-blue-400 dark:hover:border-[#5DD62C] bg-slate-50/70 dark:bg-[#1f1f1f] hover:bg-white dark:hover:bg-[#252525] transition-all cursor-pointer flex items-center gap-2.5 group"
                >
                  <span className="w-6 h-6 rounded-lg bg-white dark:bg-[#141414] border border-slate-200 dark:border-[#2d2d2d] flex items-center justify-center text-xs font-bold text-slate-700 dark:text-slate-300 group-hover:text-blue-600 dark:group-hover:text-[#5DD62C]">
                    {item.icon}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-slate-800 dark:text-[#F5F5F5] truncate group-hover:text-blue-600 dark:group-hover:text-[#5DD62C]">
                      {item.label}
                    </p>
                    <p className="text-[10px] text-slate-400 dark:text-[#777] truncate">
                      {item.description}
                    </p>
                  </div>
                  <span className="text-slate-300 dark:text-[#555] group-hover:text-blue-500 dark:group-hover:text-[#5DD62C] text-xs font-bold">
                    +
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* ------------------------------------------------------------------- */}
          {/* PANEL 2 (CENTER): MULTI-SECTION FORM CANVAS                        */}
          {/* ------------------------------------------------------------------- */}
          <div className="lg:col-span-5 rounded-2xl border border-slate-200 dark:border-[#292929] bg-white dark:bg-[#181818] p-4 shadow-2xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold text-slate-900 dark:text-[#F5F5F5] uppercase tracking-wider">
                  Form Canvas & Sections
                </h3>
                <p className="text-[11px] text-slate-400 dark:text-[#888] mt-0.5">
                  Organize questions into sections and reorder.
                </p>
              </div>
              <button
                type="button"
                onClick={handleAddSection}
                className="px-2.5 py-1 text-xs font-semibold rounded-xl bg-slate-100 dark:bg-[#252525] hover:bg-slate-200 dark:hover:bg-[#303030] text-slate-800 dark:text-slate-200 transition-all flex items-center gap-1 cursor-pointer"
              >
                <span>+ Add Section</span>
              </button>
            </div>

            {/* Sections Accordions */}
            <div className="space-y-4 max-h-[700px] overflow-y-auto pr-1">
              {sections.map((sec, secIdx) => {
                const secFields = fields.filter((f) => f.section_id === sec.id);
                const isActive = activeSectionId === sec.id;

                return (
                  <div
                    key={sec.id}
                    className={`rounded-2xl border transition-all ${
                      isActive
                        ? "border-blue-400 dark:border-[#5DD62C] bg-blue-50/20 dark:bg-[#5DD62C]/5"
                        : "border-slate-200 dark:border-[#292929] bg-slate-50/50 dark:bg-[#1c1c1c]"
                    } p-3.5 space-y-3`}
                  >
                    {/* Section Header */}
                    <div className="flex items-start justify-between gap-2">
                      <div
                        className="flex-1 cursor-pointer"
                        onClick={() => setActiveSectionId(sec.id)}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-slate-200 dark:bg-[#2d2d2d] text-slate-700 dark:text-slate-300">
                            #{secIdx + 1}
                          </span>
                          <input
                            type="text"
                            value={sec.title}
                            onChange={(e) => handleUpdateSection(sec.id, { title: e.target.value })}
                            className="font-bold text-xs text-slate-900 dark:text-[#F5F5F5] bg-transparent border-b border-transparent hover:border-slate-300 focus:border-blue-500 focus:outline-hidden"
                          />
                        </div>
                        <input
                          type="text"
                          placeholder="Optional section description..."
                          value={sec.description || ""}
                          onChange={(e) => handleUpdateSection(sec.id, { description: e.target.value })}
                          className="text-[11px] text-slate-400 dark:text-[#888] bg-transparent w-full mt-1 border-b border-transparent hover:border-slate-300 focus:border-blue-500 focus:outline-hidden"
                        />
                      </div>

                      <div className="flex items-center gap-1">
                        <span className="text-[10px] font-semibold text-slate-400 dark:text-[#777] px-1.5 py-0.5 bg-white dark:bg-[#141414] rounded-md border border-slate-200 dark:border-[#2d2d2d]">
                          {secFields.length} fields
                        </span>
                        {sections.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveSection(sec.id)}
                            className="p-1 text-slate-400 hover:text-rose-500 cursor-pointer"
                            title="Delete section"
                          >
                            🗑
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Fields Inside This Section */}
                    <div className="space-y-2 pt-1">
                      {secFields.length === 0 ? (
                        <div
                          onClick={() => setActiveSectionId(sec.id)}
                          className="p-4 rounded-xl border border-dashed border-slate-200 dark:border-[#2d2d2d] text-center cursor-pointer hover:bg-slate-100/50 dark:hover:bg-[#202020]"
                        >
                          <p className="text-xs text-slate-400">Section is empty.</p>
                          <p className="text-[11px] text-blue-600 dark:text-[#5DD62C] font-semibold mt-0.5">
                            Click palette items on left to add fields here
                          </p>
                        </div>
                      ) : (
                        secFields.map((f, fIdx) => {
                          const isSelected = selectedFieldId === f.id;
                          const hasConditions = f.conditions && (Array.isArray(f.conditions) ? f.conditions.length > 0 : Boolean(f.conditions.rules?.length));

                          return (
                            <div
                              key={f.id}
                              onClick={() => {
                                setSelectedFieldId(f.id);
                                setActiveSectionId(sec.id);
                              }}
                              className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-2 ${
                                isSelected
                                  ? "border-blue-500 dark:border-[#5DD62C] bg-white dark:bg-[#222] shadow-xs"
                                  : "border-slate-200 dark:border-[#2a2a2a] bg-white dark:bg-[#161616] hover:border-slate-300 dark:hover:border-[#383838]"
                              }`}
                            >
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-xs font-semibold text-slate-800 dark:text-[#F5F5F5] truncate">
                                    {f.label}
                                  </span>
                                  {f.required && (
                                    <span className="text-rose-500 text-xs font-bold" title="Required field">*</span>
                                  )}
                                </div>
                                <div className="flex items-center gap-2 mt-1">
                                  <span className="text-[10px] font-mono text-slate-400 bg-slate-100 dark:bg-[#202020] px-1 rounded">
                                    {f.field_key}
                                  </span>
                                  <span className="text-[10px] text-blue-600 dark:text-[#5DD62C] font-semibold">
                                    {f.field_type}
                                  </span>
                                  {hasConditions && (
                                    <span className="text-[10px] bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-300 px-1 rounded font-semibold">
                                      ⚡ Logic
                                    </span>
                                  )}
                                </div>
                              </div>

                              {/* Card Action Buttons */}
                              <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                                <button
                                  type="button"
                                  onClick={() => handleMoveField(fields.indexOf(f), "up")}
                                  disabled={fields.indexOf(f) === 0}
                                  className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 disabled:opacity-20 cursor-pointer text-xs"
                                  title="Move Up"
                                >
                                  ▲
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleMoveField(fields.indexOf(f), "down")}
                                  disabled={fields.indexOf(f) === fields.length - 1}
                                  className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 disabled:opacity-20 cursor-pointer text-xs"
                                  title="Move Down"
                                >
                                  ▼
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDuplicateField(f)}
                                  className="p-1 text-slate-400 hover:text-blue-500 cursor-pointer text-xs"
                                  title="Duplicate field"
                                >
                                  📑
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveField(f.id)}
                                  className="p-1 text-slate-400 hover:text-rose-500 cursor-pointer text-xs"
                                  title="Delete field"
                                >
                                  ✕
                                </button>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ------------------------------------------------------------------- */}
          {/* PANEL 3 (RIGHT): FIELD SETTINGS & PROPERTIES INSPECTOR              */}
          {/* ------------------------------------------------------------------- */}
          <div className="lg:col-span-4 rounded-2xl border border-slate-200 dark:border-[#292929] bg-white dark:bg-[#181818] p-4 shadow-2xs space-y-4">
            <div>
              <h3 className="text-xs font-bold text-slate-900 dark:text-[#F5F5F5] uppercase tracking-wider">
                Field Properties
              </h3>
              <p className="text-[11px] text-slate-400 dark:text-[#888] mt-0.5">
                {selectedField ? `Editing "${selectedField.label}"` : "Select a field to configure settings."}
              </p>
            </div>

            {selectedField ? (
              <div className="space-y-4 max-h-[700px] overflow-y-auto pr-1">
                {/* Field Label */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">
                    Field Label / Question
                  </label>
                  <input
                    type="text"
                    value={selectedField.label}
                    onChange={(e) => handleUpdateSelectedField({ label: e.target.value })}
                    className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 dark:border-[#2d2d2d] bg-white dark:bg-[#141414] text-slate-900 dark:text-[#F5F5F5]"
                  />
                </div>

                {/* Field Key & Section Assignment */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">
                      Data Key
                    </label>
                    <input
                      type="text"
                      value={selectedField.field_key}
                      onChange={(e) => handleUpdateSelectedField({ field_key: e.target.value.toLowerCase().replace(/\s+/g, "_") })}
                      className="w-full text-xs font-mono px-3 py-2 rounded-xl border border-slate-200 dark:border-[#2d2d2d] bg-white dark:bg-[#141414] text-slate-900 dark:text-[#F5F5F5]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">
                      Section
                    </label>
                    <select
                      value={selectedField.section_id || sections[0]?.id}
                      onChange={(e) => handleUpdateSelectedField({ section_id: e.target.value })}
                      className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 dark:border-[#2d2d2d] bg-white dark:bg-[#141414] text-slate-900 dark:text-[#F5F5F5]"
                    >
                      {sections.map((s) => (
                        <option key={s.id} value={s.id}>{s.title}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Placeholder & Description */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">
                    Placeholder Text
                  </label>
                  <input
                    type="text"
                    value={selectedField.placeholder || ""}
                    onChange={(e) => handleUpdateSelectedField({ placeholder: e.target.value })}
                    className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 dark:border-[#2d2d2d] bg-white dark:bg-[#141414] text-slate-900 dark:text-[#F5F5F5]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">
                    Help Text / Description
                  </label>
                  <textarea
                    rows={2}
                    value={selectedField.description || ""}
                    onChange={(e) => handleUpdateSelectedField({ description: e.target.value })}
                    className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 dark:border-[#2d2d2d] bg-white dark:bg-[#141414] text-slate-900 dark:text-[#F5F5F5]"
                  />
                </div>

                {/* Required Toggle */}
                <div className="flex items-center justify-between p-3 rounded-xl border border-slate-200 dark:border-[#2d2d2d] bg-slate-50 dark:bg-[#1b1b1b]">
                  <div>
                    <p className="text-xs font-semibold text-slate-800 dark:text-[#F5F5F5]">Required Field</p>
                    <p className="text-[10px] text-slate-400">Must be answered before submitting</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={Boolean(selectedField.required)}
                    onChange={(e) => handleUpdateSelectedField({ required: e.target.checked })}
                    className="w-4 h-4 rounded text-blue-600 dark:text-[#5DD62C] cursor-pointer"
                  />
                </div>

                {/* OPTIONS MANAGER (FOR DROPDOWN, RADIO, CHECKBOX, MULTI_SELECT) */}
                {["dropdown", "radio", "checkbox", "multi_select"].includes(selectedField.field_type) && (
                  <div className="p-3 rounded-xl border border-slate-200 dark:border-[#2d2d2d] bg-slate-50 dark:bg-[#1b1b1b] space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-800 dark:text-[#F5F5F5]">Options Choices</span>
                      <button
                        type="button"
                        onClick={() => {
                          const cur = selectedField.options_config || [];
                          const n = cur.length + 1;
                          handleUpdateSelectedField({
                            options_config: [...cur, { label: `Option ${n}`, value: `option_${n}` }],
                          });
                        }}
                        className="text-[11px] text-blue-600 dark:text-[#5DD62C] font-semibold cursor-pointer"
                      >
                        + Add Choice
                      </button>
                    </div>

                    <div className="space-y-1.5 max-h-40 overflow-y-auto">
                      {(selectedField.options_config || []).map((opt, oIdx) => (
                        <div key={oIdx} className="flex items-center gap-1.5">
                          <input
                            type="text"
                            value={opt.label}
                            onChange={(e) => {
                              const updated = [...(selectedField.options_config || [])];
                              updated[oIdx] = { ...updated[oIdx], label: e.target.value, value: e.target.value.toLowerCase().replace(/\s+/g, "_") };
                              handleUpdateSelectedField({ options_config: updated });
                            }}
                            className="flex-1 text-xs px-2 py-1 rounded-lg border border-slate-200 dark:border-[#2d2d2d] bg-white dark:bg-[#141414]"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const updated = (selectedField.options_config || []).filter((_, i) => i !== oIdx);
                              handleUpdateSelectedField({ options_config: updated });
                            }}
                            className="text-slate-400 hover:text-rose-500 text-xs px-1 cursor-pointer"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* RATING CONFIGURATIONS */}
                {["star_rating", "numeric_rating", "satisfaction_rating", "difficulty_rating"].includes(selectedField.field_type) && (
                  <div className="p-3 rounded-xl border border-slate-200 dark:border-[#2d2d2d] bg-slate-50 dark:bg-[#1b1b1b] space-y-2.5">
                    <span className="text-xs font-bold text-slate-800 dark:text-[#F5F5F5]">Rating Configuration</span>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] font-semibold text-slate-500">Min Label</label>
                        <input
                          type="text"
                          value={selectedField.rating_config?.min_label || ""}
                          placeholder="e.g. Poor"
                          onChange={(e) =>
                            handleUpdateSelectedField({
                              rating_config: { ...selectedField.rating_config, min_label: e.target.value },
                            })
                          }
                          className="w-full text-xs px-2 py-1 rounded-lg border border-slate-200 dark:border-[#2d2d2d] bg-white dark:bg-[#141414]"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-semibold text-slate-500">Max Label</label>
                        <input
                          type="text"
                          value={selectedField.rating_config?.max_label || ""}
                          placeholder="e.g. Excellent"
                          onChange={(e) =>
                            handleUpdateSelectedField({
                              rating_config: { ...selectedField.rating_config, max_label: e.target.value },
                            })
                          }
                          className="w-full text-xs px-2 py-1 rounded-lg border border-slate-200 dark:border-[#2d2d2d] bg-white dark:bg-[#141414]"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* CONDITIONAL LOGIC BUILDER */}
                <div className="p-3 rounded-xl border border-slate-200 dark:border-[#2d2d2d] bg-slate-50 dark:bg-[#1b1b1b] space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold text-slate-800 dark:text-[#F5F5F5]">Conditional Visibility</p>
                      <p className="text-[10px] text-slate-400">Show or hide based on answers</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const cur = Array.isArray(selectedField.conditions)
                          ? selectedField.conditions
                          : selectedField.conditions?.rules || [];
                        const otherFields = fields.filter((f) => f.id !== selectedField.id);
                        if (otherFields.length === 0) {
                          alert("Add other fields to form before creating conditional rules.");
                          return;
                        }
                        const newRule: ConditionalRule = {
                          field: otherFields[0].field_key,
                          operator: "equals",
                          value: "yes",
                          action: "show",
                        };
                        handleUpdateSelectedField({ conditions: [...cur, newRule] });
                      }}
                      className="text-[11px] text-purple-600 dark:text-purple-400 font-semibold cursor-pointer"
                    >
                      + Add Rule
                    </button>
                  </div>

                  {/* Rules list */}
                  {(() => {
                    const rules: ConditionalRule[] = Array.isArray(selectedField.conditions)
                      ? selectedField.conditions
                      : selectedField.conditions?.rules || [];

                    if (rules.length === 0) {
                      return <p className="text-[11px] text-slate-400 italic">No conditional rules. Always visible.</p>;
                    }

                    return (
                      <div className="space-y-2">
                        {rules.map((rule, rIdx) => (
                          <div key={rIdx} className="p-2 rounded-lg bg-white dark:bg-[#141414] border border-slate-200 dark:border-[#2d2d2d] text-xs space-y-1.5">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-bold text-purple-600 dark:text-purple-300">Rule #{rIdx + 1}</span>
                              <button
                                type="button"
                                onClick={() => {
                                  const updated = rules.filter((_, i) => i !== rIdx);
                                  handleUpdateSelectedField({ conditions: updated });
                                }}
                                className="text-slate-400 hover:text-rose-500 text-xs cursor-pointer"
                              >
                                ✕
                              </button>
                            </div>

                            {/* Source Field Dropdown */}
                            <div className="grid grid-cols-2 gap-1.5">
                              <div>
                                <label className="block text-[10px] text-slate-400">If Field:</label>
                                <select
                                  value={rule.field}
                                  onChange={(e) => {
                                    const updated = [...rules];
                                    updated[rIdx] = { ...updated[rIdx], field: e.target.value };
                                    handleUpdateSelectedField({ conditions: updated });
                                  }}
                                  className="w-full text-[11px] px-1.5 py-1 rounded border border-slate-200 dark:border-[#2d2d2d] bg-slate-50 dark:bg-[#1c1c1c]"
                                >
                                  {fields
                                    .filter((f) => f.id !== selectedField.id)
                                    .map((f) => (
                                      <option key={f.field_key} value={f.field_key}>
                                        {f.label} ({f.field_key})
                                      </option>
                                    ))}
                                </select>
                              </div>

                              {/* Operator Dropdown */}
                              <div>
                                <label className="block text-[10px] text-slate-400">Operator:</label>
                                <select
                                  value={rule.operator}
                                  onChange={(e) => {
                                    const updated = [...rules];
                                    updated[rIdx] = { ...updated[rIdx], operator: e.target.value as any };
                                    handleUpdateSelectedField({ conditions: updated });
                                  }}
                                  className="w-full text-[11px] px-1.5 py-1 rounded border border-slate-200 dark:border-[#2d2d2d] bg-slate-50 dark:bg-[#1c1c1c]"
                                >
                                  <option value="equals">equals</option>
                                  <option value="not_equals">not equals</option>
                                  <option value="contains">contains</option>
                                  <option value="greater_than">greater than</option>
                                  <option value="less_than">less than</option>
                                  <option value="is_empty">is empty</option>
                                  <option value="is_not_empty">is not empty</option>
                                </select>
                              </div>
                            </div>

                            {/* Target value */}
                            {!["is_empty", "is_not_empty"].includes(rule.operator) && (
                              <div>
                                <label className="block text-[10px] text-slate-400">Value:</label>
                                <input
                                  type="text"
                                  value={rule.value || ""}
                                  placeholder="e.g. yes or option_1"
                                  onChange={(e) => {
                                    const updated = [...rules];
                                    updated[rIdx] = { ...updated[rIdx], value: e.target.value };
                                    handleUpdateSelectedField({ conditions: updated });
                                  }}
                                  className="w-full text-[11px] px-2 py-1 rounded border border-slate-200 dark:border-[#2d2d2d] bg-slate-50 dark:bg-[#1c1c1c]"
                                />
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </div>
              </div>
            ) : (
              <div className="p-8 text-center text-slate-400 text-xs">
                Select a field from the center canvas to customize its parameters.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
