import { createFileRoute, Navigate } from "@tanstack/react-router";
/** Clerk's email-code reset starts on the branded combined authentication page. */
export const Route = createFileRoute("/reset-password")({ component: () => <Navigate to="/auth" replace /> });