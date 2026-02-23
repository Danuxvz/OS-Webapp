import { useEffect } from "react";
import { loginWithDiscord, getCurrentUser } from "./SupaBase.ts";

export default function Login() {
  useEffect(() => {
    const user = getCurrentUser();
    if (!user) {
      // Trigger Discord login
      loginWithDiscord();
    } else {
      // User is already logged in, redirect to app
      window.location.href = "/";
    }
  }, []);

  return (
    <div style={{ display: "flex", justifyContent: "center", marginTop: "20vh" }}>
      <h2>Redirecting to Discord login...</h2>
    </div>
  );
}