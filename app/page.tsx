'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Header from '../components/Header';
import Phase0Intake from '../components/Phase0Intake';
import Phase1Dashboard from '../components/Phase1Dashboard';
import SettingsModal from '../components/SettingsModal';
import WorkspaceSyncModal from '../components/WorkspaceSyncModal';
import ProjectManagerModal from '../components/ProjectManagerModal';
import {
  RawQueryRow,
  RawPageRow,
  SiteProfile,
  Phase0Answers,
  FullAnalysisResult,
  GscExportBundle,
  SeoProject
} from '../lib/types';
import { runPhase1Analysis } from '../lib/seo-engine';
import {
  getSavedProjects,
  getActiveProject,
  saveProject,
  setActiveProjectId
} from '../lib/project-store';
import { initAuth, googleSignIn, logout } from '../lib/firebase-auth';
import { User } from 'firebase/auth';

export default function Home() {
  const [lang, setLang] = useState<'ar' | 'en'>('ar');
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);

  // Project manager state
  const [isProjectsModalOpen, setIsProjectsModalOpen] = useState(false);
  const [activeProject, setActiveProject] = useState<SeoProject | null>(() => {
    if (typeof window !== 'undefined') {
      try {
        return getActiveProject();
      } catch {
        return null;
      }
    }
    return null;
  });
  const [savedProjectsCount, setSavedProjectsCount] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      try {
        return getSavedProjects().length;
      } catch {
        return 0;
      }
    }
    return 0;
  });

  // Settings state
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [userApiKey, setUserApiKey] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      try {
        return localStorage.getItem('topicalgap_ai_key') || '';
      } catch {
        return '';
      }
    }
    return '';
  });
  const [selectedModel, setSelectedModel] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      try {
        return localStorage.getItem('topicalgap_model') || 'gemini-3.8-flash';
      } catch {
        return 'gemini-3.8-flash';
      }
    }
    return 'gemini-3.8-flash';
  });
  const [useThinking, setUseThinking] = useState<boolean>(false);

  // Analysis & Phase state
  const [phase, setPhase] = useState<'phase0' | 'phase1'>('phase0');
  const [analysisResult, setAnalysisResult] = useState<FullAnalysisResult | null>(null);

  // Pre-filled state for Phase 0 when editing project
  const [intakeAnswers, setIntakeAnswers] = useState<Phase0Answers | undefined>(undefined);
  const [intakeBundle, setIntakeBundle] = useState<GscExportBundle | undefined>(undefined);
  const [intakeProfile, setIntakeProfile] = useState<SiteProfile | undefined>(undefined);
  const [intakeProjectName, setIntakeProjectName] = useState<string | undefined>(undefined);

  // Workspace Sync Modal
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);

  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [authNotification, setAuthNotification] = useState<string | null>(null);

  // Refresh saved projects count and load active project
  const refreshProjectsList = useCallback(() => {
    if (typeof window !== 'undefined') {
      const projs = getSavedProjects();
      setSavedProjectsCount(projs.length);
      const currentActive = getActiveProject();
      if (currentActive) {
        setActiveProject(currentActive);
      }
    }
  }, []);

  // Init Firebase Auth
  useEffect(() => {
    initAuth(
      (currentUser, token) => {
        setUser(currentUser);
        setAccessToken(token);
      },
      () => {
        setUser(null);
        setAccessToken(null);
      }
    );
  }, []);

  const handleSignIn = async () => {
    if (isLoggingIn) return;
    setIsLoggingIn(true);
    setAuthNotification(null);

    try {
      const res = await googleSignIn();
      if (res) {
        setUser(res.user);
        setAccessToken(res.accessToken);
      }
    } catch (err: any) {
      if (
        err?.code !== 'auth/cancelled-popup-request' &&
        err?.code !== 'auth/popup-closed-by-user' &&
        err?.code !== 'auth/user-cancelled'
      ) {
        setAuthNotification(
          lang === 'ar'
            ? `تعذر إكمال تسجيل الدخول: ${err.message || 'يرجى إعادة المحاولة'}`
            : `Sign in error: ${err.message || 'Please try again'}`
        );
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleSignOut = async () => {
    await logout();
    setUser(null);
    setAccessToken(null);
  };

  const handleSaveApiKey = (key: string) => {
    setUserApiKey(key);
    try {
      localStorage.setItem('topicalgap_ai_key', key);
    } catch {
      // ignore
    }
  };

  const handleSelectModel = (model: string) => {
    setSelectedModel(model);
    try {
      localStorage.setItem('topicalgap_model', model);
    } catch {
      // ignore
    }
  };

  // Run Phase 1 with full bundle (including sitemap) & auto-save project
  const handleRunPhase1 = (
    queries: RawQueryRow[],
    pages: RawPageRow[],
    profile: SiteProfile,
    answers: Phase0Answers,
    companionBundle?: Partial<GscExportBundle>,
    customProjectName?: string
  ) => {
    const result = runPhase1Analysis(queries, pages, profile, answers, companionBundle);
    if (customProjectName) {
      result.projectName = customProjectName;
    }

    const projName = customProjectName || result.projectName;
    const existingId = activeProject?.id;
    const projectToSave: SeoProject = {
      id: existingId || `proj_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      name: projName,
      siteUrl: profile.cities[0]?.name ? `${profile.siteType} (${profile.cities[0].name})` : profile.siteType,
      createdAt: activeProject?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      phase0Answers: answers,
      siteProfile: profile,
      gscBundle: companionBundle,
      sitemap: companionBundle?.sitemap,
      analysisResult: result
    };

    saveProject(projectToSave);
    setActiveProject(projectToSave);
    setSavedProjectsCount(getSavedProjects().length);

    setAnalysisResult(result);
    setPhase('phase1');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Project selection handler with dual modes: view Phase 1 results or edit Phase 0 inputs
  const handleSelectProject = (project: SeoProject, targetPhase: 'phase0' | 'phase1') => {
    setActiveProject(project);

    // Populate intake fields so Phase 0 has all saved data
    setIntakeAnswers(project.phase0Answers);
    if (project.gscBundle) {
      setIntakeBundle(project.gscBundle as GscExportBundle);
    }
    if (project.siteProfile) {
      setIntakeProfile(project.siteProfile);
    }
    setIntakeProjectName(project.name);

    if (targetPhase === 'phase1' && project.analysisResult) {
      setAnalysisResult(project.analysisResult);
      setPhase('phase1');
    } else {
      if (project.analysisResult) {
        setAnalysisResult(project.analysisResult);
      }
      setPhase('phase0');
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Start a fresh, blank project
  const handleNewProject = () => {
    setActiveProjectId(null);
    setActiveProject(null);
    setIntakeAnswers(undefined);
    setIntakeBundle(undefined);
    setIntakeProfile(undefined);
    setIntakeProjectName(undefined);
    setAnalysisResult(null);
    setPhase('phase0');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleResetToPhase0 = () => {
    if (activeProject) {
      setIntakeAnswers(activeProject.phase0Answers);
      if (activeProject.gscBundle) {
        setIntakeBundle(activeProject.gscBundle as GscExportBundle);
      }
      if (activeProject.siteProfile) {
        setIntakeProfile(activeProject.siteProfile);
      }
      setIntakeProjectName(activeProject.name);
    }
    setPhase('phase0');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className={`min-h-screen bg-slate-50 text-slate-900 font-sans ${lang === 'ar' ? 'font-arabic' : ''}`}>
      {/* App Header with Projects Manager button */}
      <Header
        user={user}
        onSignIn={handleSignIn}
        onSignOut={handleSignOut}
        lang={lang}
        onToggleLang={() => setLang((prev) => (prev === 'ar' ? 'en' : 'ar'))}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenProjects={() => {
          refreshProjectsList();
          setIsProjectsModalOpen(true);
        }}
        savedProjectsCount={savedProjectsCount}
        activeProjectName={activeProject?.name}
        hasDriveAccess={Boolean(accessToken)}
        isLoggingIn={isLoggingIn}
      />

      {/* Dismissible Auth Notification Banner */}
      {authNotification && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4">
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between text-xs text-amber-900">
            <span>{authNotification}</span>
            <button
              onClick={() => setAuthNotification(null)}
              className="text-amber-700 hover:text-amber-900 font-bold px-2 py-0.5 cursor-pointer"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {phase === 'phase0' && (
          <Phase0Intake
            lang={lang}
            initialAnswers={intakeAnswers}
            initialBundle={intakeBundle}
            initialProfile={intakeProfile}
            initialProjectName={intakeProjectName}
            onRunPhase1={handleRunPhase1}
          />
        )}

        {phase === 'phase1' && analysisResult && (
          <Phase1Dashboard
            analysis={analysisResult}
            lang={lang}
            onOpenSyncModal={() => {
              if (!accessToken) {
                handleSignIn();
              } else {
                setIsSyncModalOpen(true);
              }
            }}
            onResetToPhase0={handleResetToPhase0}
            userApiKey={userApiKey}
            selectedModel={selectedModel}
            useThinking={useThinking}
          />
        )}
      </main>

      {/* Projects Manager Modal */}
      <ProjectManagerModal
        isOpen={isProjectsModalOpen}
        onClose={() => {
          setIsProjectsModalOpen(false);
          refreshProjectsList();
        }}
        lang={lang}
        onSelectProject={handleSelectProject}
        onNewProject={handleNewProject}
      />

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        lang={lang}
        userApiKey={userApiKey}
        onSaveApiKey={handleSaveApiKey}
        selectedModel={selectedModel}
        onSelectModel={handleSelectModel}
        useThinking={useThinking}
        onToggleThinking={setUseThinking}
      />

      {/* Google Workspace Sync Modal */}
      {analysisResult && (
        <WorkspaceSyncModal
          isOpen={isSyncModalOpen}
          onClose={() => setIsSyncModalOpen(false)}
          analysis={analysisResult}
          accessToken={accessToken}
          onNeedAuth={handleSignIn}
          lang={lang}
        />
      )}
    </div>
  );
}
