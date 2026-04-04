import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type AppRole = "manager" | "employee";

interface Profile {
  id: string;
  user_id: string;
  full_name: string | null;
  business_name: string | null;
  phone: string | null;
  location: string | null;
  created_at: string;
  updated_at: string;
}

interface EmployeePermissions {
  id: string;
  employee_user_id: string;
  manager_user_id: string;
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
  created_at: string;
  updated_at: string;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  role: AppRole | null;
  permissions: EmployeePermissions | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  profile: null,
  role: null,
  permissions: null,
  loading: true,
  signOut: async () => {},
  refreshProfile: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [permissions, setPermissions] = useState<EmployeePermissions | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUserData = async (userId: string) => {
    const [profileRes, permRes] = await Promise.all([
      supabase.from("profiles" as any).select("*").eq("user_id", userId).single(),
      supabase.from("employee_permissions" as any).select("*").eq("employee_user_id", userId).single(),
    ]);

    if (profileRes.data) setProfile(profileRes.data as any);
    if (permRes.data) setPermissions(permRes.data as any);

    const { data: roleData } = await supabase
      .from("user_roles" as any)
      .select("role")
      .eq("user_id", userId)
      .single();

    if (roleData?.role) {
      setRole((roleData as any).role as AppRole);
    } else {
      const { data: { user } } = await supabase.auth.getUser();
      const metaRole = user?.user_metadata?.role as string;
      setRole((metaRole === "manager" || metaRole === "employee") ? metaRole : "employee");
    }
  };

  const refreshProfile = async () => {
    if (user) await fetchUserData(user.id);
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          setTimeout(() => fetchUserData(session.user.id), 0);
        } else {
          setProfile(null);
          setRole(null);
          setPermissions(null);
        }
        setLoading(false);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchUserData(session.user.id);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
    setRole(null);
    setPermissions(null);
  };

  return (
    <AuthContext.Provider value={{ user, session, profile, role, permissions, loading, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}
