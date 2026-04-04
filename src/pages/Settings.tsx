import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { User, Shield, Lock, LogOut, ChevronRight, Eye, EyeOff, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import PageHeader from "@/components/PageHeader";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type SettingsView = "main" | "profile" | "security" | "password";

export default function Settings() {
  const { user, profile, role, signOut, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [view, setView] = useState<SettingsView>("main");
  const [loading, setLoading] = useState(false);
  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteEmail, setDeleteEmail] = useState("");

  // Profile form state
  const [fullName, setFullName] = useState(profile?.full_name || "");
  const [phone, setPhone] = useState(profile?.phone || "");
  const [location, setLocation] = useState(profile?.location || "");
  const [businessName, setBusinessName] = useState(profile?.business_name || "");

  const handleUpdateProfile = async () => {
    if (!user) return;
    setLoading(true);
    const { error } = await supabase
      .from("profiles")
      .update({ full_name: fullName, phone, location, business_name: businessName })
      .eq("user_id", user.id);
    setLoading(false);
    if (error) {
      toast.error("Failed to update profile");
    } else {
      toast.success("Profile updated");
      await refreshProfile();
    }
  };

  const handleChangePassword = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    const newPassword = fd.get("newPassword") as string;
    const confirmPassword = fd.get("confirmPassword") as string;

    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match");
      setLoading(false);
      return;
    }
    if (newPassword.length < 6) {
      toast.error("Password must be at least 6 characters");
      setLoading(false);
      return;
    }

    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setLoading(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Password changed successfully");
      setView("main");
    }
  };

  const handleDeleteEmployeeAccount = async () => {
    if (!deleteEmail.trim()) {
      toast.error("Enter the employee email");
      return;
    }
    setLoading(true);

    const { data: empUserId, error: lookupErr } = await (supabase.rpc as any)(
      "get_employee_user_id_by_email",
      { _email: deleteEmail.trim() }
    );

    if (lookupErr || !empUserId) {
      toast.error("Employee not found with that email");
      setLoading(false);
      return;
    }

    const { error } = await (supabase
      .from("employee_permissions" as any) as any)
      .delete()
      .eq("employee_user_id", empUserId)
      .eq("manager_user_id", user!.id);

    setLoading(false);
    if (error) {
      toast.error("Failed to remove employee");
    } else {
      toast.success("Employee removed successfully");
      setDeleteConfirmOpen(false);
      setDeleteEmail("");
    }
  };

  const handleLogout = async () => {
    await signOut();
    navigate("/login");
  };

  if (view === "profile") {
    return (
      <div className="pb-24">
        <PageHeader title="Personal Information" subtitle="Update your details" />
        <div className="px-4 space-y-4 mt-2">
          <div className="rounded-xl border border-border bg-card p-4 space-y-4">
            <div>
              <Label className="text-xs text-muted-foreground">Email</Label>
              <p className="text-sm font-medium text-foreground">{user?.email}</p>
            </div>
            <div>
              <Label>Full Name</Label>
              <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
            </div>
            <div>
              <Label>Phone</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone number" />
            </div>
            <div>
              <Label>Location</Label>
              <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Your location" />
            </div>
            {role === "manager" && (
              <div>
                <Label>Business Name</Label>
                <Input value={businessName} onChange={(e) => setBusinessName(e.target.value)} placeholder="Business name" />
              </div>
            )}
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setView("main")}>Cancel</Button>
              <Button className="flex-1" onClick={handleUpdateProfile} disabled={loading}>
                <Save className="h-4 w-4 mr-1" />
                {loading ? "Saving..." : "Save"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (view === "security") {
    return (
      <div className="pb-24">
        <PageHeader title="Security" subtitle="Account security settings" />
        <div className="px-4 space-y-4 mt-2">
          <div className="rounded-xl border border-border bg-card p-4 space-y-3">
            <div>
              <Label className="text-xs text-muted-foreground">Account Email</Label>
              <p className="text-sm font-medium text-foreground">{user?.email}</p>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Role</Label>
              <p className="text-sm font-medium text-foreground capitalize">{role}</p>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Account Created</Label>
              <p className="text-sm font-medium text-foreground">
                {user?.created_at ? new Date(user.created_at).toLocaleDateString() : "N/A"}
              </p>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Last Sign In</Label>
              <p className="text-sm font-medium text-foreground">
                {user?.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleDateString() : "N/A"}
              </p>
            </div>
          </div>

          <button
            onClick={() => setView("password")}
            className="flex items-center justify-between w-full p-4 rounded-xl border border-border bg-card"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Lock className="h-5 w-5 text-primary" />
              </div>
              <span className="font-medium text-sm text-foreground">Change Password</span>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </button>

          {role === "manager" && (
            <>
              <button
                onClick={() => setDeleteConfirmOpen(true)}
                className="flex items-center justify-between w-full p-4 rounded-xl border border-destructive/30 bg-destructive/5"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-destructive/10">
                    <Trash2 className="h-5 w-5 text-destructive" />
                  </div>
                  <div className="text-left">
                    <p className="font-medium text-sm text-foreground">Remove Employee Account</p>
                    <p className="text-xs text-muted-foreground">Delete an employee by email</p>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </button>

              <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
                <DialogContent className="max-w-[90vw] rounded-2xl">
                  <DialogHeader>
                    <DialogTitle>Remove Employee Account</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                      Enter the employee's email to remove them from your team.
                    </p>
                    <div>
                      <Label>Employee Email</Label>
                      <Input
                        type="email"
                        value={deleteEmail}
                        onChange={(e) => setDeleteEmail(e.target.value)}
                        placeholder="employee@example.com"
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" className="flex-1" onClick={() => setDeleteConfirmOpen(false)}>
                        Cancel
                      </Button>
                      <Button variant="destructive" className="flex-1" onClick={handleDeleteEmployeeAccount} disabled={loading}>
                        {loading ? "Removing..." : "Remove Employee"}
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </>
          )}

          <Button variant="outline" className="w-full" onClick={() => setView("main")}>
            Back to Settings
          </Button>
        </div>
      </div>
    );
  }

  if (view === "password") {
    return (
      <div className="pb-24">
        <PageHeader title="Change Password" subtitle="Set a new password" />
        <div className="px-4 mt-2">
          <form onSubmit={handleChangePassword} className="rounded-xl border border-border bg-card p-4 space-y-4">
            <div>
              <Label>New Password</Label>
              <div className="relative">
                <Input name="newPassword" type={showNew ? "text" : "password"} placeholder="••••••••" minLength={6} required />
                <button type="button" onClick={() => setShowNew(!showNew)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div>
              <Label>Confirm Password</Label>
              <div className="relative">
                <Input name="confirmPassword" type={showOld ? "text" : "password"} placeholder="••••••••" minLength={6} required />
                <button type="button" onClick={() => setShowOld(!showOld)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  {showOld ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" className="flex-1" onClick={() => setView("security")}>Cancel</Button>
              <Button type="submit" className="flex-1" disabled={loading}>
                {loading ? "Updating..." : "Update Password"}
              </Button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // Main settings view
  return (
    <div className="pb-24">
      <PageHeader title="Settings" subtitle="Manage your account" />
      <div className="px-4 space-y-3 mt-2">
        {/* User info card */}
        <div className="rounded-xl border border-border bg-card p-4 flex items-center gap-3">
          <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
            <User className="h-6 w-6 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-foreground truncate">{profile?.full_name || "User"}</p>
            <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
            <p className="text-xs text-primary capitalize font-medium">{role}</p>
          </div>
        </div>

        {/* Menu items */}
        <SettingsItem
          icon={User}
          label="Personal Information"
          desc="Name, phone, location"
          onClick={() => {
            setFullName(profile?.full_name || "");
            setPhone(profile?.phone || "");
            setLocation(profile?.location || "");
            setBusinessName(profile?.business_name || "");
            setView("profile");
          }}
        />
        <SettingsItem
          icon={Shield}
          label="Security"
          desc="Password, account details"
          onClick={() => setView("security")}
        />
        <SettingsItem
          icon={Lock}
          label="Change Password"
          desc="Update your password"
          onClick={() => setView("password")}
        />

        {/* Logout */}
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 w-full p-4 rounded-xl border border-destructive/30 bg-destructive/5 mt-4"
        >
          <div className="p-2 rounded-lg bg-destructive/10">
            <LogOut className="h-5 w-5 text-destructive" />
          </div>
          <span className="font-semibold text-sm text-destructive">Log Out</span>
        </button>
      </div>
    </div>
  );
}

function SettingsItem({ icon: Icon, label, desc, onClick }: {
  icon: React.ElementType;
  label: string;
  desc: string;
  onClick: () => void;
}) {
  return (
    <button onClick={onClick} className="flex items-center justify-between w-full p-4 rounded-xl border border-border bg-card">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-primary/10">
          <Icon className="h-5 w-5 text-primary" />
        </div>
        <div className="text-left">
          <p className="font-medium text-sm text-foreground">{label}</p>
          <p className="text-xs text-muted-foreground">{desc}</p>
        </div>
      </div>
      <ChevronRight className="h-4 w-4 text-muted-foreground" />
    </button>
  );
}
