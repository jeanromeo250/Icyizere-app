import { useState, useEffect } from "react";
import { UserPlus, Users, Shield, Eye, ChevronRight, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import PageHeader from "@/components/PageHeader";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

interface EmployeeWithProfile {
  employee_user_id: string;
  full_name: string;
  email: string;
  can_add_stock: boolean;
  can_remove_stock: boolean;
  can_view_products: boolean;
  can_add_products: boolean;
  can_edit_products: boolean;
  can_delete_products: boolean;
  can_record_sales: boolean;
  can_view_sales: boolean;
  can_add_expenses: boolean;
  can_view_expenses: boolean;
}

const PERMISSION_LABELS: Record<string, string> = {
  can_add_stock: "Add Stock",
  can_remove_stock: "Remove Stock",
  can_view_products: "View Products",
  can_add_products: "Add Products",
  can_edit_products: "Edit Products",
  can_delete_products: "Delete Products",
  can_record_sales: "Record Sales",
  can_view_sales: "View Sales",
  can_add_expenses: "Add Expenses",
  can_view_expenses: "View Expenses",
};

const FULL_ACCESS_PERMISSIONS = {
  can_add_stock: true,
  can_remove_stock: true,
  can_view_products: true,
  can_add_products: true,
  can_edit_products: true,
  can_delete_products: true,
  can_record_sales: true,
  can_view_sales: true,
  can_add_expenses: true,
  can_view_expenses: true,
};

export default function Employees() {
  const { user, role } = useAuth();
  const navigate = useNavigate();
  const [employees, setEmployees] = useState<EmployeeWithProfile[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [permOpen, setPermOpen] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [fullAccess, setFullAccess] = useState(false);
  const [perms, setPerms] = useState({ ...FULL_ACCESS_PERMISSIONS });

  useEffect(() => {
    if (role !== "manager") return;
    fetchEmployees();
  }, [role]);

  const fetchEmployees = async () => {
    if (!user) return;
    const { data: empPerms } = await (supabase
      .from("employee_permissions" as any) as any)
      .select("*")
      .eq("manager_user_id", user.id);

    if (!empPerms?.length) {
      setEmployees([]);
      return;
    }

    const empIds = empPerms.map((e) => e.employee_user_id);
    const { data: profiles } = await (supabase
      .from("profiles" as any) as any)
      .select("*")
      .in("user_id", empIds);

    const result: EmployeeWithProfile[] = empPerms.map((ep) => {
      const prof = profiles?.find((p) => p.user_id === ep.employee_user_id);
      return {
        employee_user_id: ep.employee_user_id,
        full_name: prof?.full_name || "Unknown Employee",
        email: prof?.phone || "",
        can_add_stock: ep.can_add_stock,
        can_remove_stock: ep.can_remove_stock,
        can_view_products: ep.can_view_products,
        can_add_products: ep.can_add_products,
        can_edit_products: ep.can_edit_products,
        can_delete_products: ep.can_delete_products,
        can_record_sales: ep.can_record_sales,
        can_view_sales: ep.can_view_sales,
        can_add_expenses: ep.can_add_expenses,
        can_view_expenses: ep.can_view_expenses,
      };
    });

    setEmployees(result);
  };

  const handleCreateEmployee = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    const fd = new FormData(e.currentTarget);
    const email = fd.get("email") as string;
    const password = fd.get("password") as string;
    const fullName = fd.get("fullName") as string;

    // Save manager's current session before signUp switches it
    const { data: { session: managerSession } } = await supabase.auth.getSession();

    // Create the employee account via Supabase auth
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          role: "employee",
        },
      },
    });

    if (signUpError || !signUpData.user) {
      toast.error(signUpError?.message || "Failed to create employee account");
      // Restore manager session
      if (managerSession) {
        await supabase.auth.setSession({
          access_token: managerSession.access_token,
          refresh_token: managerSession.refresh_token,
        });
      }
      setLoading(false);
      return;
    }

    const employeeUserId = signUpData.user.id;

    // Restore manager session so we can insert profile/permissions as manager
    if (managerSession) {
      await supabase.auth.setSession({
        access_token: managerSession.access_token,
        refresh_token: managerSession.refresh_token,
      });
    }

    // Create profile for the employee
    const { error: profileError } = await (supabase.from("profiles" as any) as any).upsert({
      user_id: employeeUserId,
      full_name: fullName,
      business_name: null,
      phone: null,
      location: null,
    });

    if (profileError) {
      console.error("Profile insert error:", profileError);
    }

    // Insert role
    const { error: roleError } = await supabase.from("user_roles").upsert({
      user_id: employeeUserId,
      role: "employee",
    });

    if (roleError) {
      console.error("Role insert error:", roleError);
    }

    // Set permissions
    const permissionsData = fullAccess ? { ...FULL_ACCESS_PERMISSIONS } : { ...perms };

    const { error: permError } = await supabase.from("employee_permissions").insert({
      employee_user_id: employeeUserId,
      manager_user_id: user!.id,
      ...permissionsData,
    });

    if (permError) {
      toast.error("Account created but failed to set permissions: " + permError.message);
    } else {
      toast.success(`Employee ${fullName} created! They'll receive a confirmation email.`);
    }

    setCreateOpen(false);
    setLoading(false);
    setFullAccess(false);
    setPerms({ ...FULL_ACCESS_PERMISSIONS });
    fetchEmployees();
  };

  const handleUpdatePermissions = async (employeeUserId: string, newPerms: Partial<typeof FULL_ACCESS_PERMISSIONS>) => {
    const { error } = await supabase
      .from("employee_permissions")
      .update(newPerms)
      .eq("employee_user_id", employeeUserId)
      .eq("manager_user_id", user!.id);

    if (error) {
      toast.error("Failed to update permissions");
    } else {
      toast.success("Permissions updated");
      fetchEmployees();
    }
  };

  const handleDeleteEmployee = async (employeeUserId: string) => {
    const { error } = await supabase
      .from("employee_permissions")
      .delete()
      .eq("employee_user_id", employeeUserId)
      .eq("manager_user_id", user!.id);

    if (error) {
      toast.error("Failed to remove employee");
    } else {
      toast.success("Employee removed");
      fetchEmployees();
    }
  };

  if (role !== "manager") {
    return (
      <div className="pb-24">
        <PageHeader title="Employees" subtitle="Access restricted" />
        <div className="px-4 mt-8 text-center">
          <p className="text-muted-foreground">Only managers can access this page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="pb-24">
      <PageHeader title="Employees" subtitle="Manage your team" />

      <div className="px-4 space-y-4 mt-2">
        {/* Create Employee Button */}
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <button className="flex items-center gap-3 p-4 rounded-xl border border-primary/30 bg-primary/5 text-left w-full">
              <div className="p-2 rounded-lg bg-primary/20">
                <UserPlus className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-semibold text-sm text-foreground">Add Employee</p>
                <p className="text-xs text-muted-foreground">Create a new employee account</p>
              </div>
            </button>
          </DialogTrigger>
          <DialogContent className="max-w-[90vw] rounded-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create Employee Account</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreateEmployee} className="space-y-3">
              <div>
                <Label>Full Name</Label>
                <Input name="fullName" placeholder="Employee name" required />
              </div>
              <div>
                <Label>Email</Label>
                <Input name="email" type="email" placeholder="employee@example.com" required />
              </div>
              <div>
                <Label>Password</Label>
                <Input name="password" type="password" placeholder="••••••••" minLength={6} required />
              </div>

              {/* Access Level */}
              <div className="border border-border rounded-xl p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Shield className="h-4 w-4 text-primary" />
                    <span className="font-semibold text-sm">Full Access</span>
                  </div>
                  <Switch
                    checked={fullAccess}
                    onCheckedChange={(v) => {
                      setFullAccess(v);
                      if (v) setPerms({ ...FULL_ACCESS_PERMISSIONS });
                    }}
                  />
                </div>

                {!fullAccess && (
                  <div className="space-y-2 pt-2 border-t border-border">
                    <p className="text-xs text-muted-foreground font-medium">Custom Permissions</p>
                    {Object.entries(PERMISSION_LABELS).map(([key, label]) => (
                      <div key={key} className="flex items-center justify-between">
                        <span className="text-sm text-foreground">{label}</span>
                        <Switch
                          checked={perms[key as keyof typeof perms]}
                          onCheckedChange={(v) => setPerms((p) => ({ ...p, [key]: v }))}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Creating..." : "Create Employee"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>

        {/* Employee List */}
        <div className="rounded-xl border border-border bg-card p-4">
          <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            Team Members ({employees.length})
          </h3>

          {employees.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No employees yet. Add your first team member above.</p>
          ) : (
            <div className="space-y-3">
              {employees.map((emp) => (
                <div key={emp.employee_user_id} className="border border-border rounded-xl p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
                        <span className="text-sm font-bold text-primary">
                          {emp.full_name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <p className="font-semibold text-sm text-foreground">{emp.full_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {Object.entries(PERMISSION_LABELS).filter(([k]) => emp[k as keyof typeof emp]).length}/10 permissions
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => navigate(`/employees/${emp.employee_user_id}/activity`)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setPermOpen(permOpen === emp.employee_user_id ? null : emp.employee_user_id)}
                      >
                        <Shield className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive"
                        onClick={() => handleDeleteEmployee(emp.employee_user_id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  {permOpen === emp.employee_user_id && (
                    <div className="border-t border-border pt-2 space-y-2">
                      {Object.entries(PERMISSION_LABELS).map(([key, label]) => (
                        <div key={key} className="flex items-center justify-between">
                          <span className="text-xs text-foreground">{label}</span>
                          <Switch
                            checked={emp[key as keyof typeof emp] as boolean}
                            onCheckedChange={(v) => handleUpdatePermissions(emp.employee_user_id, { [key]: v })}
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
