'use client';

import React, { useState } from 'react';
import {
  X,
  Folder,
  Plus,
  Trash2,
  Download,
  Upload,
  CheckCircle,
  Clock,
  ExternalLink,
  Edit3,
  BarChart2,
  Layers,
  Globe
} from 'lucide-react';
import { SeoProject } from '@/lib/types';
import {
  getSavedProjects,
  getActiveProjectId,
  setActiveProjectId,
  deleteProject,
  importProjectFromJson,
  exportProjectToJson
} from '@/lib/project-store';

interface ProjectManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang: 'ar' | 'en';
  onSelectProject: (project: SeoProject, targetPhase: 'phase0' | 'phase1') => void;
  onNewProject: () => void;
}

export default function ProjectManagerModal({
  isOpen,
  onClose,
  lang,
  onSelectProject,
  onNewProject
}: ProjectManagerModalProps) {
  const isAr = lang === 'ar';
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  if (!isOpen) return null;

  const projects = getSavedProjects();
  const activeId = getActiveProjectId();

  const triggerRefresh = () => setRefreshTrigger((prev) => prev + 1);

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const confirmMsg = isAr
      ? 'هل أنت متأكد من حذف هذا المشروع نهائياً؟'
      : 'Are you sure you want to permanently delete this project?';
    if (confirm(confirmMsg)) {
      deleteProject(id);
      triggerRefresh();
    }
  };

  const handleExport = (proj: SeoProject, e: React.MouseEvent) => {
    e.stopPropagation();
    const jsonStr = exportProjectToJson(proj);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${proj.name.replace(/\s+/g, '_')}_topicalgap.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const imported = importProjectFromJson(content);
        triggerRefresh();
        onSelectProject(imported, imported.analysisResult ? 'phase1' : 'phase0');
        onClose();
      } catch (err: any) {
        alert(
          isAr
            ? `فشل استيراد المشروع: ${err.message}`
            : `Failed to import project: ${err.message}`
        );
      }
    };
    reader.readAsText(file);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4"
      dir={isAr ? 'rtl' : 'ltr'}
    >
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-600 flex items-center justify-center">
              <Folder className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                {isAr ? 'مدير المشاريع المحفوظة' : 'Saved Projects Manager'}
              </h2>
              <p className="text-xs text-slate-500">
                {isAr
                  ? 'استعراض المشاريع، التبديل الفوري، تعديل المدخلات أو عرض النتائج'
                  : 'Manage projects, switch instantly, edit inputs or view results'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-xl transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content body */}
        <div className="p-6 flex-1 overflow-y-auto space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <button
              onClick={() => {
                onNewProject();
                onClose();
              }}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-2 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>{isAr ? '+ إنشاء مشروع تحليل جديد' : '+ New SEO Project'}</span>
            </button>

            <label className="px-4 py-2 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 shadow-xs">
              <Upload className="w-4 h-4 text-indigo-600" />
              <span>{isAr ? 'استيراد مشروع من JSON' : 'Import JSON Project'}</span>
              <input type="file" accept=".json" onChange={handleImportFile} className="hidden" />
            </label>
          </div>

          {projects.length === 0 ? (
            <div className="text-center py-12 px-4 border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
              <Folder className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <h3 className="text-sm font-bold text-slate-700 mb-1">
                {isAr ? 'لا توجد مشاريع محفوظة حالياً' : 'No saved projects found'}
              </h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                {isAr
                  ? 'ابدأ بتحليل موقعك عبر رفع ملفات Search Console وسيتم حفظ المشروع تلقائياً في المتصفح.'
                  : 'Start by uploading your GSC files and your project will be saved automatically.'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-500 font-bold px-1">
                <span>{isAr ? `المشاريع المحفوظة (${projects.length})` : `Saved Projects (${projects.length})`}</span>
                <span className="text-[11px] font-normal text-slate-400">
                  {isAr ? 'اختر الإجراء المطلوب لكل مشروع' : 'Choose action for each project'}
                </span>
              </div>

              {projects.map((proj) => {
                const isActive = proj.id === activeId;
                const hasAnalysis = Boolean(proj.analysisResult);
                const dateStr = new Date(proj.updatedAt || proj.createdAt).toLocaleString(
                  isAr ? 'ar-SA' : 'en-US',
                  {
                    dateStyle: 'medium',
                    timeStyle: 'short'
                  }
                );

                return (
                  <div
                    key={proj.id}
                    className={`p-4 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                      isActive
                        ? 'bg-indigo-50/70 border-indigo-300 shadow-xs'
                        : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/60'
                    }`}
                  >
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      <div
                        className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                          isActive
                            ? 'bg-indigo-600 text-white'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        <Folder className="w-5 h-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-bold text-slate-900 truncate">
                            {proj.name}
                          </h4>
                          {isActive && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 border border-indigo-200 shrink-0 flex items-center gap-1">
                              <CheckCircle className="w-3 h-3" />
                              {isAr ? 'المشروع الحالي' : 'Active'}
                            </span>
                          )}
                        </div>

                        <p className="text-xs text-slate-500 truncate mt-0.5">
                          {proj.siteUrl ||
                            proj.analysisResult?.siteProfile?.siteType ||
                            'Search Console Project'}
                        </p>

                        <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-400 mt-1.5">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {dateStr}
                          </span>
                          {proj.gscBundle?.queries && (
                            <span>
                              • {proj.gscBundle.queries.length.toLocaleString()}{' '}
                              {isAr ? 'استعلام' : 'queries'}
                            </span>
                          )}
                          {proj.sitemap && (
                            <span className="text-emerald-700 font-medium">
                              • {proj.sitemap.totalUrls.toLocaleString()}{' '}
                              {isAr ? 'رابط خريطة' : 'sitemap URLs'}
                            </span>
                          )}
                          {hasAnalysis && (
                            <span className="text-indigo-600 font-medium">
                              • {proj.analysisResult?.clusters.length}{' '}
                              {isAr ? 'كتلة دلالية' : 'clusters'}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Action buttons per user choice */}
                    <div className="flex items-center gap-2 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100 justify-end">
                      {/* Button 1: View Results (Phase 1) */}
                      {hasAnalysis && (
                        <button
                          type="button"
                          onClick={() => {
                            setActiveProjectId(proj.id);
                            onSelectProject(proj, 'phase1');
                            onClose();
                          }}
                          className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                          title={isAr ? 'عرض لوحة النتائج' : 'View Results'}
                        >
                          <BarChart2 className="w-3.5 h-3.5" />
                          <span>{isAr ? 'عرض النتائج' : 'View Results'}</span>
                        </button>
                      )}

                      {/* Button 2: Edit Inputs (Phase 0) */}
                      <button
                        type="button"
                        onClick={() => {
                          setActiveProjectId(proj.id);
                          onSelectProject(proj, 'phase0');
                          onClose();
                        }}
                        className="px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
                        title={isAr ? 'تعديل المدخلات في المرحلة 0' : 'Edit Inputs'}
                      >
                        <Edit3 className="w-3.5 h-3.5 text-slate-500" />
                        <span>{isAr ? 'تعديل المدخلات' : 'Edit Inputs'}</span>
                      </button>

                      {/* Export & Delete icons */}
                      <button
                        type="button"
                        onClick={(e) => handleExport(proj, e)}
                        className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                        title={isAr ? 'تصدير كملف JSON' : 'Export JSON'}
                      >
                        <Download className="w-4 h-4" />
                      </button>

                      <button
                        type="button"
                        onClick={(e) => handleDelete(proj.id, e)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                        title={isAr ? 'حذف المشروع' : 'Delete project'}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
