import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import HetLogo from '@/components/HetLogo';
import { ArrowLeft, LogOut, ShieldCheck } from 'lucide-react';

export default function AdminAbout() {
  const navigate = useNavigate();
  const { logout } = useAuth();

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border bg-card/50 px-6 py-4">
        <div className="flex justify-between items-start gap-3">
          <div className="flex items-center gap-3">
            <HetLogo size={34} />
            <div>
              <h1 className="text-xl font-bold text-foreground">About / System Info</h1>
              <p className="text-xs text-muted-foreground mt-0.5">Administrative ownership and release metadata</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => navigate('/admin')}>
              <ArrowLeft className="h-4 w-4 mr-2" /> Back to Admin
            </Button>
            <Button variant="outline" size="sm" onClick={() => { logout(); navigate('/'); }}>
              <LogOut className="h-4 w-4 mr-2" /> Logout
            </Button>
          </div>
        </div>
      </div>

      <div className="p-6">
        <div className="mx-auto max-w-2xl">
          <div className="rounded-2xl border border-border bg-card shadow-sm">
            <div className="p-8 md:p-10 text-center">
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                <ShieldCheck className="h-3.5 w-3.5" />
                Admin Ownership Metadata
              </div>

              <div className="mt-8 space-y-5">
                <div>
                  <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Built by</p>
                  <p className="mt-1 text-lg md:text-xl font-semibold text-foreground">Sattari Labs</p>
                </div>

                <div>
                  <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Developer</p>
                  <p className="mt-1 text-base md:text-lg text-foreground">Asif Ali - Senior Software Engineer</p>
                </div>

                <div>
                  <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Status</p>
                  <p className="mt-1 text-sm md:text-base text-foreground">Production Ready • Fully Tested • Enterprise Verified</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                  <div className="rounded-xl border border-border bg-background px-4 py-3 text-left">
                    <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Last Updated</p>
                    <p className="mt-1 text-sm font-medium text-foreground">April 30, 2026</p>
                  </div>
                  <div className="rounded-xl border border-border bg-background px-4 py-3 text-left">
                    <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Version</p>
                    <p className="mt-1 text-sm font-medium text-foreground">v3.0</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
