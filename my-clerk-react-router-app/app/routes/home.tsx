import { SignedIn, SignedOut } from "@clerk/react-router";
import { Navigate } from "react-router";

import type { Route } from "./+types/home";
import { Welcome } from "../welcome/welcome";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "School Management System" },
    { name: "description", content: "Secure staff dashboard" },
  ];
}

export default function Home() {
  return (
    <>
      <SignedOut>
        <Navigate to="/sign-in" replace />
      </SignedOut>
      <SignedIn>
        <Welcome />
      </SignedIn>
    </>
  );
}
