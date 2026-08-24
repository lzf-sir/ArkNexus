import { createBrowserRouter, Navigate } from "react-router-dom";
import { MainLayout } from "./layouts/MainLayout";
import { DashboardPage } from "./apps/dashboard/DashboardPage";
import { EmailApp } from "./apps/email/EmailApp";
import { EmailInboxPage } from "./apps/email/pages/EmailInboxPage";
import { LoginPage } from "./apps/auth/pages/LoginPage";
import { OAuthCallbackPage } from "./apps/auth/pages/OAuthCallbackPage";
import { AIChatPage } from "./apps/ai/pages/AIChatPage";
import { SettingsPage } from "./apps/settings/pages/SettingsPage";
import { ProfilePage } from "./apps/profile/ProfilePage";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { InitPage } from "./apps/init/InitPage";

export const router = createBrowserRouter([
  { path: "/init", element: <InitPage /> },
  { path: "/login", element: <LoginPage /> },
  { path: "/auth/oauth/callback", element: <OAuthCallbackPage /> },
  {
    path: "/",
    element: (
      <ProtectedRoute>
        <MainLayout />
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <DashboardPage /> },
      {
        path: "email",
        element: <EmailApp />,
        children: [
          { index: true, element: <EmailInboxPage /> },
          { path: ":mailboxId", element: <EmailInboxPage /> },
        ],
      },
      {
        path: "ai",
        children: [
          { index: true, element: <Navigate to="ai/chat" replace /> },
          { path: "chat", element: <AIChatPage /> },
        ],
      },
      {
        path: "settings",
        element: <SettingsPage />,
      },
      {
        path: "profile",
        element: <ProfilePage />,
      },
      { path: "*", element: <Navigate to="/" replace /> },
    ],
  },
]);
