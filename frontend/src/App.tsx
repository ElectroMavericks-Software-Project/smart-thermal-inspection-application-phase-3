import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import Dashboard from "./pages/Dashboard";
import Inspections from "./pages/Inspections";
import TransformerDetail from "./pages/TransformerDetail";
import ThermalImageUpload from "./pages/ThermalImageUpload";
import ThermalImageAnalysis from "./pages/ThermalImageAnalysis";
import NotFound from "./pages/NotFound";
import Login from "./pages/Login";
import SignUp from "./pages/SignUp";
import AddTransformer from "./pages/AddTransformer";
import InspectionDetail from "./pages/InspectionDetail";
import Settings from "./pages/Settings";

import { Toaster } from "@/components/ui/toaster";

const isAuthed = () => !!localStorage.getItem("user");

const HomeRedirect = () => (
  <Navigate to={isAuthed() ? "/dashboard" : "/login"} replace />
);

const RequireAuth = ({ children }: { children: JSX.Element }) => {
  return isAuthed() ? children : <Navigate to="/login" replace />;
};

export default function App() {
  return (
    <BrowserRouter>
    <Toaster />
      <Routes>
        {/* Smart root redirect */}
        <Route path="/" element={<HomeRedirect />} />

        {/* Public */}
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<SignUp />} />

        {/* Private */}
        <Route
          path="/dashboard"
          element={
            <RequireAuth>
              <Dashboard />
            </RequireAuth>
          }
        />
        <Route
          path="/inspections"
          element={
            <RequireAuth>
              <Inspections />
            </RequireAuth>
          }
        />
        <Route
          path="/add_transformer"          
          element={
            <RequireAuth>
              <AddTransformer />
            </RequireAuth>
          }
        />
        <Route
          path="/transformer/:id"
          element={
            <RequireAuth>
              <TransformerDetail />
            </RequireAuth>
          }
        />
        <Route
          path="/transformer/:id/inspection/:inspectionId"
          element={
            <RequireAuth>
              <InspectionDetail />
            </RequireAuth>
          }
        />
        <Route
          path="/transformer/:id/inspection/:inspectionId/thermal-upload"
          element={
            <RequireAuth>
              <ThermalImageUpload />
            </RequireAuth>
          }
        />
        <Route
          path="/transformer/:id/inspection/:inspectionId/thermal-analysis"
          element={
            <RequireAuth>
              <ThermalImageAnalysis />
            </RequireAuth>
          }
        />
        <Route
          path="/settings"
          element={
            <RequireAuth>
              <Settings />
            </RequireAuth>
          }
        />

        {/* 404 */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}
