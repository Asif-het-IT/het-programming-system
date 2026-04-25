import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AlertCircle, LogIn } from "lucide-react";

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (!email.trim() || !password.trim()) {
        throw new Error("Email aur password enter karo");
      }

      const user = await login(email.trim(), password);
      
      if (user.role === "admin") {
        navigate("/admin");
      } else {
        navigate("/dashboard");
      }
    } catch (err) {
      setError(err.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white/95 backdrop-blur rounded-2xl shadow-2xl p-8">
          <div className="text-center mb-8">
            <div className="inline-block bg-primary/10 p-3 rounded-lg mb-4">
              <LogIn className="h-8 w-8 text-primary" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900">Het Database</h1>
            <p className="text-sm text-slate-500 mt-2">Apna view dekho</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label htmlFor="login-email" className="block text-sm font-medium text-slate-700 mb-1.5">
                Email
              </label>
              <Input
                id="login-email"
                type="email"
                placeholder="e.g. user@het.local"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-10"
                disabled={loading}
                autoFocus
              />
            </div>

            <div>
              <label htmlFor="login-password" className="block text-sm font-medium text-slate-700 mb-1.5">
                Password
              </label>
              <Input
                id="login-password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-10"
                disabled={loading}
              />
            </div>

            {error && (
              <div className="flex items-start gap-3 p-3 rounded-lg bg-red-50 border border-red-200">
                <AlertCircle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-10 bg-primary hover:bg-primary/90"
            >
              {loading ? "Login ho raha hai..." : "Login"}
            </Button>
          </form>
        </div>

        <p className="text-center text-xs text-slate-400 mt-6">
          Production Ready • Secure Access • Read-Only Views
        </p>
      </div>
    </div>
  );
}
